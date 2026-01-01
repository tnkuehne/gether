<script lang="ts">
	import { onDestroy } from "svelte";
	import { EditorView, basicSetup } from "codemirror";
	import { EditorState, StateEffect, StateField } from "@codemirror/state";
	import { markdown } from "@codemirror/lang-markdown";
	import { Decoration, type DecorationSet, WidgetType } from "@codemirror/view";
	import type { PRCommentThread } from "$lib/github-app";
	import { CommentGutterWidget } from "./comment-widgets";

	interface RemoteCursor {
		position: number;
		color: string;
		userName?: string;
	}

	interface RemoteSelection {
		from: number;
		to: number;
		color: string;
		userName?: string;
	}

	let {
		value = $bindable(""),
		onchange = undefined as ((value: string) => void) | undefined,
		oncursorchange = undefined as
			| ((position: number, selection?: { from: number; to: number }) => void)
			| undefined,
		remoteCursors = [] as RemoteCursor[],
		remoteSelections = [] as RemoteSelection[],
		prComments = new Map() as Map<number, PRCommentThread>,
		onCommentClick = undefined as ((thread: PRCommentThread) => void) | undefined,
		readonly = false,
	}: {
		value?: string;
		onchange?: (value: string) => void;
		oncursorchange?: (position: number, selection?: { from: number; to: number }) => void;
		remoteCursors?: RemoteCursor[];
		remoteSelections?: RemoteSelection[];
		prComments?: Map<number, PRCommentThread>;
		onCommentClick?: (thread: PRCommentThread) => void;
		readonly?: boolean;
	} = $props();

	let editorView: EditorView | null = null;
	let isUpdatingFromRemote = false;

	export function applyRemoteChange(change: { from: number; to: number; insert: string }) {
		if (editorView) {
			isUpdatingFromRemote = true;
			editorView.dispatch({
				changes: change,
			});
			// Update value to match so the $effect doesn't trigger a full replacement
			value = editorView.state.doc.toString();
			isUpdatingFromRemote = false;
		}
	}

	// Cursor widget for rendering remote cursors
	class CursorWidget extends WidgetType {
		color: string;
		userName?: string;

		constructor(color: string, userName?: string) {
			super();
			this.color = color;
			this.userName = userName;
		}

		toDOM() {
			const wrapper = document.createElement("span");
			wrapper.style.position = "relative";
			wrapper.style.display = "inline";
			wrapper.style.height = "0";
			wrapper.style.width = "0";

			const cursor = document.createElement("span");
			cursor.style.position = "absolute";
			cursor.style.borderLeft = `2px solid ${this.color}`;
			cursor.style.height = "1.2em";
			cursor.style.left = "0";
			cursor.style.top = "0";
			cursor.style.pointerEvents = "none";
			cursor.style.zIndex = "10";
			cursor.style.boxShadow = `0 0 4px ${this.color}`;

			wrapper.appendChild(cursor);

			if (this.userName) {
				const label = document.createElement("span");
				label.textContent = this.userName;
				label.style.position = "absolute";
				label.style.top = "-20px";
				label.style.left = "2px";
				label.style.backgroundColor = this.color;
				label.style.color = "white";
				label.style.padding = "2px 6px";
				label.style.borderRadius = "3px";
				label.style.fontSize = "11px";
				label.style.fontWeight = "500";
				label.style.whiteSpace = "nowrap";
				label.style.pointerEvents = "none";
				label.style.zIndex = "11";
				wrapper.appendChild(label);
			}

			return wrapper;
		}
	}

	// Effect to update remote cursors
	const updateRemoteCursorsEffect = StateEffect.define<RemoteCursor[]>();

	// Effect to update remote selections
	const updateRemoteSelectionsEffect = StateEffect.define<RemoteSelection[]>();

	// Field to store remote cursors decorations
	const remoteCursorsField = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			decorations = decorations.map(tr.changes);

			for (const effect of tr.effects) {
				if (effect.is(updateRemoteCursorsEffect)) {
					const cursors = effect.value;
					const widgets = cursors.map((cursor) => {
						// Clamp position to valid range
						const pos = Math.min(cursor.position, tr.newDoc.length);
						return Decoration.widget({
							widget: new CursorWidget(cursor.color, cursor.userName),
							side: 1,
						}).range(pos);
					});
					decorations = Decoration.set(widgets);
				}
			}

			return decorations;
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	// Field to store remote selections decorations
	const remoteSelectionsField = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			decorations = decorations.map(tr.changes);

			for (const effect of tr.effects) {
				if (effect.is(updateRemoteSelectionsEffect)) {
					const selections = effect.value;
					const marks = selections.map((selection) => {
						// Clamp positions to valid range
						const from = Math.min(selection.from, tr.newDoc.length);
						const to = Math.min(selection.to, tr.newDoc.length);
						return Decoration.mark({
							attributes: {
								style: `background-color: ${selection.color.replace("0.8", "0.2")};`,
							},
						}).range(from, to);
					});
					decorations = Decoration.set(marks);
				}
			}

			return decorations;
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	// Effect to update PR comments
	const updatePRCommentsEffect = StateEffect.define<Map<number, PRCommentThread>>();

	// Field to store PR comment decorations
	const prCommentsField = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			decorations = decorations.map(tr.changes);

			for (const effect of tr.effects) {
				if (effect.is(updatePRCommentsEffect)) {
					const comments = effect.value;
					const widgets: ReturnType<typeof Decoration.widget>[] = [];

					// Convert line numbers to document positions
					comments.forEach((thread, line) => {
						try {
							// Line numbers are 1-based, CodeMirror is 0-based
							const lineObj = tr.newDoc.line(line);
							const pos = lineObj.from;

							widgets.push(
								Decoration.widget({
									widget: new CommentGutterWidget(thread, () => {
										onCommentClick?.(thread);
									}),
									side: -1, // Place before the line
									block: false,
								}).range(pos),
							);
						} catch {
							// Line doesn't exist in current document
						}
					});

					decorations = Decoration.set(widgets);
				}
			}

			return decorations;
		},
		provide: (f) => EditorView.decorations.from(f),
	});

	function initializeEditor(container: HTMLDivElement) {
		const state = EditorState.create({
			doc: "",
			extensions: [
				basicSetup,
				markdown(),
				remoteCursorsField,
				remoteSelectionsField,
				prCommentsField,
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !isUpdatingFromRemote) {
						const newValue = update.state.doc.toString();
						value = newValue;
						// Access current callback from props
						onchange?.(newValue);
					}
					// Track cursor/selection changes
					if (update.selectionSet) {
						const selection = update.state.selection.main;
						const cursorPos = selection.head;
						// Send selection range if text is selected
						const selectionRange =
							selection.from !== selection.to
								? { from: selection.from, to: selection.to }
								: undefined;
						// Access current callback from props
						oncursorchange?.(cursorPos, selectionRange);
					}
				}),
				EditorView.theme({
					"&": {
						fontSize: "14px",
					},
					".cm-scroller": {
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
						lineHeight: "1.5",
						overflow: "auto",
					},
				}),
			],
		});

		editorView = new EditorView({
			state,
			parent: container,
		});

		// Create nested effects to handle reactive updates without re-running the attachment
		$effect(() => {
			if (editorView) {
				const currentContent = editorView.state.doc.toString();
				if (value !== currentContent) {
					isUpdatingFromRemote = true;
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: value,
						},
					});
					isUpdatingFromRemote = false;
				}
			}
		});

		$effect(() => {
			if (editorView) {
				editorView.dispatch({
					effects: StateEffect.reconfigure.of([
						basicSetup,
						markdown(),
						remoteCursorsField,
						remoteSelectionsField,
						prCommentsField,
						EditorView.updateListener.of((update) => {
							if (update.docChanged && !isUpdatingFromRemote) {
								const newValue = update.state.doc.toString();
								value = newValue;
								onchange?.(newValue);
							}
							if (update.selectionSet) {
								const selection = update.state.selection.main;
								const cursorPos = selection.head;
								const selectionRange =
									selection.from !== selection.to
										? { from: selection.from, to: selection.to }
										: undefined;
								oncursorchange?.(cursorPos, selectionRange);
							}
						}),
						EditorView.editable.of(!readonly),
						EditorView.theme({
							"&": {
								fontSize: "14px",
							},
							".cm-scroller": {
								fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
								lineHeight: "1.5",
								overflow: "auto",
							},
						}),
					]),
				});
			}
		});

		$effect.pre(() => {
			if (editorView) {
				editorView.dispatch({
					effects: updateRemoteCursorsEffect.of(remoteCursors),
				});
			}
		});

		$effect.pre(() => {
			if (editorView) {
				editorView.dispatch({
					effects: updateRemoteSelectionsEffect.of(remoteSelections),
				});
			}
		});

		$effect.pre(() => {
			if (editorView) {
				editorView.dispatch({
					effects: updatePRCommentsEffect.of(prComments),
				});
			}
		});

		return () => {
			editorView?.destroy();
			editorView = null;
		};
	}

	onDestroy(() => {
		editorView?.destroy();
	});

	// Expose methods to parent
	export function getCursorPosition(): number {
		return editorView?.state.selection.main.head ?? 0;
	}

	export function focus() {
		editorView?.focus();
	}
</script>

<div {@attach initializeEditor}></div>
