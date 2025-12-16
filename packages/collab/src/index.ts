import { DurableObject } from 'cloudflare:workers';

interface Env {
	COLLAB_DOCUMENT: DurableObjectNamespace<CollaborativeDocument>;
}

interface Message {
	type: 'init' | 'change' | 'cursor' | 'cursor-leave';
	content?: string;
	changes?: {
		from: number;
		to: number;
		insert: string;
	};
	position?: number;
	connectionId?: string;
	user?: {
		name: string;
		image?: string;
	};
	userName?: string;
	userImage?: string;
}

export class CollaborativeDocument extends DurableObject<Env> {
	private content: string = '';

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize SQLite storage for document content
		ctx.blockConcurrencyWhile(async () => {
			// Create table if it doesn't exist
			this.ctx.storage.sql.exec(`
				CREATE TABLE IF NOT EXISTS document (
					id INTEGER PRIMARY KEY CHECK (id = 1),
					content TEXT NOT NULL DEFAULT ''
				)
			`);

			// Load existing content or initialize with empty
			const result = this.ctx.storage.sql.exec<{ content: string }>('SELECT content FROM document WHERE id = 1').toArray();

			if (result.length > 0) {
				this.content = result[0].content;
			} else {
				// Insert initial empty document
				this.ctx.storage.sql.exec("INSERT INTO document (id, content) VALUES (1, '')");
				this.content = '';
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		// Check for WebSocket upgrade
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket', { status: 426 });
		}

		// Extract user info from headers
		const userName = request.headers.get('X-User-Name');
		const userImage = request.headers.get('X-User-Image');
		const userId = request.headers.get('X-User-Id');

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
			webSocket: client
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			const data = JSON.parse(message.toString()) as Message;

			switch (data.type) {
				case 'init': {
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
						userImage: userImage || undefined
					});

					// If DO has no content and client sent content, initialize with it
					if (!this.content && data.content) {
						this.content = data.content;
						this.ctx.storage.sql.exec('UPDATE document SET content = ? WHERE id = 1', this.content);
					}

					// Send current document state to client
					ws.send(
						JSON.stringify({
							type: 'init',
							content: this.content,
							connectionId
						})
					);
					break;
				}

				case 'change': {
					// Apply and broadcast document changes
					const { changes } = data;
					if (changes) {
						// Apply change to content
						const before = this.content.slice(0, changes.from);
						const after = this.content.slice(changes.to);
						this.content = before + changes.insert + after;

						// Persist to storage
						this.ctx.storage.sql.exec('UPDATE document SET content = ? WHERE id = 1', this.content);

						// Get connection ID from attachment
						const attachment = ws.deserializeAttachment() as {
							connectionId: string;
							userName?: string;
							userImage?: string;
						} | null;

						// Broadcast to all clients (including sender) with connectionId
						this.broadcast(
							{
								type: 'change',
								changes,
								connectionId: attachment?.connectionId
							},
							ws
						);
					}
					break;
				}

				case 'cursor': {
					// Broadcast cursor position to all other clients with connection ID and user info
					if (data.position !== undefined) {
						const attachment = ws.deserializeAttachment() as {
							connectionId: string;
							userName?: string;
							userImage?: string;
						} | null;

						this.broadcast(
							{
								type: 'cursor',
								position: data.position,
								connectionId: attachment?.connectionId,
								userName: data.userName || attachment?.userName,
								userImage: data.userImage || attachment?.userImage
							},
							ws
						);
					}
					break;
				}
			}
		} catch (error) {
			console.error('WebSocket message error:', error);
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean) {
		const attachment = ws.deserializeAttachment() as {
			connectionId: string;
			userName?: string;
			userImage?: string;
		} | null;

		if (attachment?.connectionId) {
			this.broadcast({
				type: 'cursor-leave',
				connectionId: attachment.connectionId
			});
		}
		ws.close(code, reason);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error('WebSocket error:', error);
		ws.close(1011, 'WebSocket error');
	}

	private broadcast(message: Message, exclude?: WebSocket) {
		const payload = JSON.stringify(message);

		for (const client of this.ctx.getWebSockets()) {
			if (client.readyState === WebSocket.OPEN) {
				try {
					client.send(payload);
				} catch (error) {
					console.error('Broadcast error:', error);
				}
			}
		}
	}
}

export default {
	async fetch(): Promise<Response> {
		return new Response('Collab service running. Use WebSocket endpoints.', {
			status: 200
		});
	}
} satisfies ExportedHandler<Env>;
