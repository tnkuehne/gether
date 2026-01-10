import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

// Message types matching the server
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export interface YjsProviderOptions {
	url: string;
	doc: Y.Doc;
	awareness: awarenessProtocol.Awareness;
	initialContent?: string;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onSynced?: () => void;
}

export class YjsWebSocketProvider {
	private ws: WebSocket | null = null;
	private doc: Y.Doc;
	private awareness: awarenessProtocol.Awareness;
	private url: string;
	private initialContent?: string;
	private synced = false;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private connected = false;
	private destroyed = false;

	public onConnect?: () => void;
	public onDisconnect?: () => void;
	public onSynced?: () => void;

	constructor(options: YjsProviderOptions) {
		this.url = options.url;
		this.doc = options.doc;
		this.awareness = options.awareness;
		this.initialContent = options.initialContent;
		this.onConnect = options.onConnect;
		this.onDisconnect = options.onDisconnect;
		this.onSynced = options.onSynced;

		// Set up document update handler
		this.doc.on("update", this.handleDocUpdate);

		// Set up awareness update handler
		this.awareness.on("update", this.handleAwarenessUpdate);

		// Connect
		this.connect();
	}

	private connect() {
		if (this.destroyed) return;

		try {
			this.ws = new WebSocket(this.url);
			this.ws.binaryType = "arraybuffer";

			this.ws.onopen = () => {
				this.connected = true;
				this.onConnect?.();

				// Send sync step 1 (request state from server)
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, MESSAGE_SYNC);
				syncProtocol.writeSyncStep1(encoder, this.doc);
				this.ws?.send(encoding.toUint8Array(encoder));

				// Send local awareness state
				const awarenessEncoder = encoding.createEncoder();
				encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
				encoding.writeVarUint8Array(
					awarenessEncoder,
					awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
				);
				this.ws?.send(encoding.toUint8Array(awarenessEncoder));
			};

			this.ws.onmessage = (event) => {
				const data = new Uint8Array(event.data);
				const decoder = decoding.createDecoder(data);
				const messageType = decoding.readVarUint(decoder);

				switch (messageType) {
					case MESSAGE_SYNC: {
						const encoder = encoding.createEncoder();
						encoding.writeVarUint(encoder, MESSAGE_SYNC);
						const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);

						// Send response if any
						if (encoding.length(encoder) > 1) {
							this.ws?.send(encoding.toUint8Array(encoder));
						}

						// If this was sync step 2, we're now synced
						if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
							if (!this.synced) {
								this.synced = true;
								this.onSynced?.();
							}
						}
						break;
					}

					case MESSAGE_AWARENESS: {
						awarenessProtocol.applyAwarenessUpdate(
							this.awareness,
							decoding.readVarUint8Array(decoder),
							this,
						);
						break;
					}
				}
			};

			this.ws.onclose = () => {
				this.connected = false;
				this.synced = false;
				this.onDisconnect?.();

				// Reconnect after delay
				if (!this.destroyed) {
					this.reconnectTimeout = setTimeout(() => {
						this.connect();
					}, 2000);
				}
			};

			this.ws.onerror = (error) => {
				console.error("WebSocket error:", error);
			};
		} catch (error) {
			console.error("Failed to connect:", error);
			// Retry connection
			if (!this.destroyed) {
				this.reconnectTimeout = setTimeout(() => {
					this.connect();
				}, 2000);
			}
		}
	}

	private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
		// Don't send updates that came from the WebSocket
		if (origin === this) return;

		if (this.ws?.readyState === WebSocket.OPEN) {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, MESSAGE_SYNC);
			syncProtocol.writeUpdate(encoder, update);
			this.ws.send(encoding.toUint8Array(encoder));
		}
	};

	private handleAwarenessUpdate = ({
		added,
		updated,
		removed,
	}: {
		added: number[];
		updated: number[];
		removed: number[];
	}) => {
		const changedClients = added.concat(updated, removed);

		if (this.ws?.readyState === WebSocket.OPEN) {
			const encoder = encoding.createEncoder();
			encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
			encoding.writeVarUint8Array(
				encoder,
				awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
			);
			this.ws.send(encoding.toUint8Array(encoder));
		}
	};

	public isConnected(): boolean {
		return this.connected;
	}

	public isSynced(): boolean {
		return this.synced;
	}

	public destroy() {
		this.destroyed = true;

		// Clean up timeout
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		// Remove awareness state
		awarenessProtocol.removeAwarenessStates(
			this.awareness,
			[this.doc.clientID],
			"provider destroyed",
		);

		// Remove event listeners
		this.doc.off("update", this.handleDocUpdate);
		this.awareness.off("update", this.handleAwarenessUpdate);

		// Close WebSocket
		if (this.ws) {
			this.ws.onclose = null; // Prevent reconnect
			this.ws.close();
			this.ws = null;
		}
	}
}
