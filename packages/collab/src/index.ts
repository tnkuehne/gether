import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

interface Env {
	COLLAB_DOCUMENT: DurableObjectNamespace<CollaborativeDocument>;
}

// Message types for Yjs protocol
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const MAX_MESSAGE_SIZE = 1048576; // 1MB - generous limit for Yjs updates

// Cleanup inactive documents after 48 hours of no activity
const CLEANUP_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

// Checkpoint interval
const CHECKPOINT_INTERVAL_MS = 30000;

export class CollaborativeDocument extends DurableObject<Env> {
	private doc: Y.Doc;
	private awareness: awarenessProtocol.Awareness;
	private checkpointScheduled: boolean = false;
	private documentInitialized: boolean = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize Yjs document
		this.doc = new Y.Doc();
		this.awareness = new awarenessProtocol.Awareness(this.doc);

		// Set up awareness change handler
		this.awareness.on(
			"update",
			({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
				const changedClients = added.concat(updated, removed);
				this.broadcastAwarenessUpdate(changedClients);
			},
		);

		// Initialize storage and load existing document state
		ctx.blockConcurrencyWhile(async () => {
			// Create table if it doesn't exist
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS document (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					state BLOB,
					last_activity INTEGER NOT NULL DEFAULT 0
				)
			`);

			// Load existing state
			const result = this.ctx.storage.sql
				.exec<{ state: ArrayBuffer | null }>("SELECT state FROM document WHERE id = 1")
				.toArray();

			if (result.length > 0 && result[0].state) {
				try {
					const state = new Uint8Array(result[0].state);
					Y.applyUpdate(this.doc, state);
					// Document has existing content, mark as initialized
					this.documentInitialized = true;
				} catch (error) {
					console.error("Failed to load document state:", error);
				}
			} else {
				// Insert initial empty document
				this.ctx.storage.sql.exec(
					"INSERT INTO document (id, state, last_activity) VALUES (1, NULL, ?)",
					Date.now(),
				);
			}
		});

		// Listen for document updates to schedule checkpoints
		this.doc.on("update", () => {
			if (!this.checkpointScheduled) {
				this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);
				this.checkpointScheduled = true;
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

		// Extract initial content if provided (for initialization)
		const initialContent = request.headers.get("X-Initial-Content");

		// Create WebSocket pair
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Accept the WebSocket with Hibernation API
		const tags: string[] = [];
		if (userName) tags.push(userName);
		if (userImage) tags.push(userImage);
		if (userId) tags.push(userId);
		this.ctx.acceptWebSocket(server, tags);

		// Generate a unique connection ID for debugging/logging
		const connectionId = crypto.randomUUID();

		// Store attachment with connection info
		server.serializeAttachment({
			connectionId,
			userName: userName ? this.decodeUserName(userName) : undefined,
			userImage: userImage || undefined,
			userId: userId || undefined,
		});

		// If document is empty and initial content is provided, initialize it
		// Use documentInitialized flag to prevent race conditions with multiple connections
		if (!this.documentInitialized && initialContent) {
			const text = this.doc.getText("content");
			if (text.length === 0) {
				try {
					const decoded = decodeURIComponent(escape(atob(initialContent)));
					text.insert(0, decoded);
					this.documentInitialized = true;
				} catch {
					// Ignore initialization errors
				}
			} else {
				// Document has content now (from concurrent insert), mark as initialized
				this.documentInitialized = true;
			}
		}

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	private decodeUserName(encoded: string): string {
		try {
			return decodeURIComponent(escape(atob(encoded)));
		} catch {
			return encoded;
		}
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		// Check message size
		const messageSize = typeof message === "string" ? message.length : message.byteLength;
		if (messageSize > MAX_MESSAGE_SIZE) {
			ws.close(1009, "Message too big");
			return;
		}

		try {
			// Handle binary Yjs messages
			const data =
				message instanceof ArrayBuffer
					? new Uint8Array(message)
					: new TextEncoder().encode(message as string);

			const decoder = decoding.createDecoder(data);
			const messageType = decoding.readVarUint(decoder);

			switch (messageType) {
				case MESSAGE_SYNC: {
					// Handle sync protocol
					const encoder = encoding.createEncoder();
					encoding.writeVarUint(encoder, MESSAGE_SYNC);
					const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, null);

					// If we have a response to send
					if (encoding.length(encoder) > 1) {
						ws.send(encoding.toUint8Array(encoder));
					}

					// If this was a sync step 2 or update, broadcast to other clients
					if (syncMessageType === syncProtocol.messageYjsUpdate) {
						this.broadcastUpdate(data, ws);
					}
					break;
				}

				case MESSAGE_AWARENESS: {
					// Handle awareness protocol
					// The awareness protocol handles client presence automatically
					// Clients send their own state updates and cleanup is handled via timeouts
					awarenessProtocol.applyAwarenessUpdate(
						this.awareness,
						decoding.readVarUint8Array(decoder),
						ws,
					);
					break;
				}
			}
		} catch (error) {
			console.error("WebSocket message error:", error);
		}
	}

	async webSocketOpen(ws: WebSocket) {
		// Send sync step 1 (document state) to new client
		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, MESSAGE_SYNC);
		syncProtocol.writeSyncStep1(encoder, this.doc);
		ws.send(encoding.toUint8Array(encoder));

		// Send current awareness state
		const awarenessStates = this.awareness.getStates();
		if (awarenessStates.size > 0) {
			const awarenessEncoder = encoding.createEncoder();
			encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
			encoding.writeVarUint8Array(
				awarenessEncoder,
				awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(awarenessStates.keys())),
			);
			ws.send(encoding.toUint8Array(awarenessEncoder));
		}
	}

	async webSocketClose(ws: WebSocket) {
		// Note: We don't manually remove awareness states here.
		// The Yjs awareness protocol handles cleanup automatically:
		// 1. Clients send awareness updates with null state before disconnecting
		// 2. The awareness protocol has built-in timeout mechanisms for stale clients
		// Manual cleanup would require knowing the client's Yjs clientID, which is
		// generated client-side and not accessible from server-assigned connection IDs.

		// Check if this was the last client
		const remainingClients = this.ctx.getWebSockets().filter((c) => c !== ws);
		if (remainingClients.length === 0) {
			// Persist state before hibernation
			await this.checkpoint();

			// Schedule cleanup alarm
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
			await this.checkpoint();
			this.checkpointScheduled = false;

			// Reschedule checkpoint
			this.ctx.storage.setAlarm(Date.now() + CHECKPOINT_INTERVAL_MS);
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

	private async checkpoint() {
		const state = Y.encodeStateAsUpdate(this.doc);
		this.ctx.storage.sql.exec(
			"UPDATE document SET state = ?, last_activity = ? WHERE id = 1",
			state,
			Date.now(),
		);
	}

	private broadcastUpdate(message: Uint8Array, exclude?: WebSocket) {
		for (const client of this.ctx.getWebSockets()) {
			if (client === exclude) continue;
			if (client.readyState === WebSocket.OPEN) {
				try {
					client.send(message);
				} catch (error) {
					console.error("Broadcast error:", error);
				}
			}
		}
	}

	private broadcastAwarenessUpdate(changedClients: number[]) {
		if (changedClients.length === 0) return;

		const encoder = encoding.createEncoder();
		encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
		encoding.writeVarUint8Array(
			encoder,
			awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
		);
		const message = encoding.toUint8Array(encoder);

		for (const client of this.ctx.getWebSockets()) {
			if (client.readyState === WebSocket.OPEN) {
				try {
					client.send(message);
				} catch (error) {
					console.error("Awareness broadcast error:", error);
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
