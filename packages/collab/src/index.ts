import { DurableObject } from "cloudflare:workers";

interface Env {
	COLLAB_DOCUMENT: DurableObjectNamespace<CollaborativeDocument>;
}

interface Message {
	type: "init" | "change" | "cursor" | "cursor-leave";
	content?: string;
	changes?: {
		from: number;
		to: number;
		insert: string;
	};
	position?: number;
	selection?: {
		from: number;
		to: number;
	};
	connectionId?: string;
	user?: {
		name: string;
		image?: string;
	};
	userName?: string;
	userImage?: string;
}

const MAX_MESSAGE_SIZE = 65536; // 64KB - generous limit for collaborative text editor

// Cleanup inactive documents after 48 hours of no activity
const CLEANUP_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

export class CollaborativeDocument extends DurableObject<Env> {
	private content: string = "";
	private checkpointScheduled: boolean = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize SQLite storage for document content
		ctx.blockConcurrencyWhile(async () => {
			// Create table if it doesn't exist (with last_activity for cleanup scheduling)
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS document (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					content TEXT NOT NULL DEFAULT '',
					last_activity INTEGER NOT NULL DEFAULT 0
				)
			`);

			// Migration: add last_activity column if it doesn't exist (for existing documents)
			const columns = this.ctx.storage.sql
				.exec<{ name: string }>("PRAGMA table_info(document)")
				.toArray()
				.map((col) => col.name);

			if (!columns.includes("last_activity")) {
				this.ctx.storage.sql.exec(
					"ALTER TABLE document ADD COLUMN last_activity INTEGER NOT NULL DEFAULT 0",
				);
				// Set last_activity to now for existing documents
				this.ctx.storage.sql.exec("UPDATE document SET last_activity = ? WHERE id = 1", Date.now());
			}

			// Load existing content or initialize with empty
			const result = this.ctx.storage.sql
				.exec<{ content: string }>("SELECT content FROM document WHERE id = 1")
				.toArray();

			if (result.length > 0) {
				this.content = result[0].content;
			} else {
				// Insert initial empty document with current timestamp
				this.ctx.storage.sql.exec(
					"INSERT INTO document (id, content, last_activity) VALUES (1, ?, ?)",
					"",
					Date.now(),
				);
				this.content = "";
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		// Check for WebSocket upgrade
		const upgradeHeader = request.headers.get("Upgrade");
		if (upgradeHeader !== "websocket") {
			return new Response("Expected WebSocket", { status: 426 });
		}

		// Extract user info from headers
		const userName = request.headers.get("X-User-Name");
		const userImage = request.headers.get("X-User-Image");
		const userId = request.headers.get("X-User-Id");

		// Create WebSocket pair
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket with Hibernation API and store user info
		const tags: string[] = [];
		if (userName) tags.push(userName);
		if (userImage) tags.push(userImage);
		if (userId) tags.push(userId);
		this.ctx.acceptWebSocket(server, tags);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		// Check message size before parsing to prevent memory exhaustion
		const messageSize = typeof message === "string" ? message.length : message.byteLength;
		if (messageSize > MAX_MESSAGE_SIZE) {
			ws.close(1009, "Message too big");
			return;
		}

		try {
			const data = JSON.parse(message.toString()) as Message;

			switch (data.type) {
				case "init": {
					// Generate a unique connection ID for this client
					const connectionId = crypto.randomUUID();

					// Get user info from websocket tags (set during accept)
					const tags = this.ctx.getTags(ws);
					const userNameEncoded = tags[0];
					const userImage = tags[1];

					// Decode base64 user name
					let userName: string | undefined;
					if (userNameEncoded) {
						try {
							userName = decodeURIComponent(escape(atob(userNameEncoded)));
						} catch {
							userName = userNameEncoded; // Fallback to encoded value
						}
					}

					ws.serializeAttachment({
						connectionId,
						userName: userName || undefined,
						userImage: userImage || undefined,
					});

					// If DO has no content and client sent content, initialize with it
					if (!this.content && data.content) {
						this.content = data.content;
						this.ctx.storage.sql.exec("UPDATE document SET content = ? WHERE id = 1", this.content);
					}

					// Send current document state to client
					ws.send(
						JSON.stringify({
							type: "init",
							content: this.content,
							connectionId,
						}),
					);
					break;
				}

				case "change": {
					// Apply and broadcast document changes
					const { changes } = data;
					if (changes) {
						// Apply change to content
						const before = this.content.slice(0, changes.from);
						const after = this.content.slice(changes.to);
						this.content = before + changes.insert + after;

						// Schedule checkpoint alarm if not already scheduled
						if (!this.checkpointScheduled) {
							this.ctx.storage.setAlarm(Date.now() + 30000);
							this.checkpointScheduled = true;
						}

						// Get connection ID from attachment
						const attachment = ws.deserializeAttachment() as {
							connectionId: string;
							userName?: string;
							userImage?: string;
						} | null;

						// Broadcast to all clients (including sender) with connectionId
						this.broadcast(
							{
								type: "change",
								changes,
								connectionId: attachment?.connectionId,
							},
							ws,
						);
					}
					break;
				}

				case "cursor": {
					// Broadcast cursor position to all other clients with connection ID and user info
					if (data.position !== undefined) {
						const attachment = ws.deserializeAttachment() as {
							connectionId: string;
							userName?: string;
							userImage?: string;
						} | null;

						this.broadcast(
							{
								type: "cursor",
								position: data.position,
								selection: data.selection,
								connectionId: attachment?.connectionId,
								userName: data.userName || attachment?.userName,
								userImage: data.userImage || attachment?.userImage,
							},
							ws,
						);
					}
					break;
				}
			}
		} catch (error) {
			console.error("WebSocket message error:", error);
		}
	}

	async webSocketClose(ws: WebSocket) {
		const attachment = ws.deserializeAttachment() as {
			connectionId: string;
			userName?: string;
			userImage?: string;
		} | null;

		if (attachment?.connectionId) {
			this.broadcast({
				type: "cursor-leave",
				connectionId: attachment.connectionId,
			});
		}

		// Check if this was the last client
		const remainingClients = this.ctx.getWebSockets().filter((c) => c !== ws);
		if (remainingClients.length === 0) {
			// Persist content and last activity to SQLite before hibernation
			this.ctx.storage.sql.exec(
				"UPDATE document SET content = ?, last_activity = ? WHERE id = 1",
				this.content,
				Date.now(),
			);
			this.checkpointScheduled = false;

			// Schedule cleanup alarm for inactive document deletion
			this.ctx.storage.setAlarm(Date.now() + CLEANUP_AFTER_MS);
		}
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("WebSocket error:", error);
		ws.close(1011, "WebSocket error");
	}

	async alarm() {
		const connectedClients = this.ctx.getWebSockets().length;

		if (connectedClients > 0) {
			// Clients connected: this is a checkpoint alarm
			this.ctx.storage.sql.exec(
				"UPDATE document SET content = ?, last_activity = ? WHERE id = 1",
				this.content,
				Date.now(),
			);
			this.checkpointScheduled = false;

			// Reschedule checkpoint
			this.ctx.storage.setAlarm(Date.now() + 30000);
			this.checkpointScheduled = true;
		} else {
			// No clients: check if document is inactive and should be cleaned up
			const result = this.ctx.storage.sql
				.exec<{ last_activity: number }>("SELECT last_activity FROM document WHERE id = 1")
				.toArray();

			if (result.length > 0) {
				const lastActivity = result[0].last_activity;
				const inactiveTime = Date.now() - lastActivity;

				if (inactiveTime >= CLEANUP_AFTER_MS) {
					// Document has been inactive long enough, delete all storage
					await this.ctx.storage.deleteAll();
				} else {
					// Not inactive long enough yet, reschedule cleanup
					const remainingTime = CLEANUP_AFTER_MS - inactiveTime;
					this.ctx.storage.setAlarm(Date.now() + remainingTime);
				}
			}
		}
	}

	private broadcast(message: Message, exclude?: WebSocket) {
		const payload = JSON.stringify(message);

		for (const client of this.ctx.getWebSockets()) {
			if (client === exclude) continue;
			if (client.readyState === WebSocket.OPEN) {
				try {
					client.send(payload);
				} catch (error) {
					console.error("Broadcast error:", error);
				}
			}
		}
	}
}

export default {
	async fetch(): Promise<Response> {
		return new Response();
	},
} satisfies ExportedHandler<Env>;
