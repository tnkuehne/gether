<script lang="ts">
	import { onDestroy } from "svelte";
	import { EditorView, basicSetup } from "codemirror";
	import { EditorState, StateEffect, StateField, type Range } from "@codemirror/state";
	import { markdown } from "@codemirror/lang-markdown";
	import { Decoration, type DecorationSet } from "@codemirror/view";
	import type { PRCommentThread } from "$lib/github-app";
	import { CommentGutterWidget } from "./comment-widgets";
	import type * as Y from "yjs";
	import type { Awareness } from "y-protocols/awareness";
	import { yCollab } from "y-codemirror.next";

	export interface SelectionInfo {
		from: number;
		to: number;
		line: number;
		coords: { top: number; left: number; bottom: number };
	}

	let {
		value = $bindable(""),
		onchange = undefined as ((value: string) => void) | undefined,
		oncursorchange = undefined as
			| ((position: number, selection?: { from: number; to: number }) => void)
			| undefined,
		onselectionchange = undefined as ((selection: SelectionInfo | null) => void) | undefined,
		oneditblocked = undefined as (() => void) | undefined,
		prComments = new Map() as Map<number, PRCommentThread>,
		onCommentClick = undefined as ((thread: PRCommentThread) => void) | undefined,
		canAddComments = false,
		readonly = false,
		// Yjs collaborative editing props
		yText = undefined as Y.Text | undefined,
		awareness = undefined as Awareness | undefined,
	}: {
		value?: string;
		onchange?: (value: string) => void;
		oncursorchange?: (position: number, selection?: { from: number; to: number }) => void;
		onselectionchange?: (selection: SelectionInfo | null) => void;
		oneditblocked?: () => void;
		prComments?: Map<number, PRCommentThread>;
		onCommentClick?: (thread: PRCommentThread) => void;
		canAddComments?: boolean;
		readonly?: boolean;
		yText?: Y.Text;
		awareness?: Awareness;
	} = $props();

	let editorView: EditorView | null = null;
	let isUpdatingFromRemote = false;

	// Collaborative mode is enabled when both yText and awareness are provided
	let isCollaborative = $derived(!!yText && !!awareness);

	export function applyRemoteChange(change: { from: number; to: number; insert: string }) {
		// In collaborative mode, changes are handled by Yjs
		if (isCollaborative) return;

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
					const widgets: Range<Decoration>[] = [];

					// Convert line numbers to document positions
					// Note: Map keys are encoded as (line * 10000 + counter) to allow multiple threads per line
					comments.forEach((thread) => {
						try {
							// Extract the actual line number from the thread
							const line = thread.line;
							// File-level comments (line 0) are shown at line 1
							// Line numbers are 1-based, CodeMirror is 0-based
							const displayLine = line === 0 ? 1 : line;
							const lineObj = tr.newDoc.line(displayLine);
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

	// Helper to get selection info with coordinates
	function getSelectionInfo(view: EditorView): SelectionInfo | null {
		const selection = view.state.selection.main;
		if (selection.from === selection.to) return null;

		const line = view.state.doc.lineAt(selection.to);
		const coords = view.coordsAtPos(selection.to);

		if (!coords) return null;

		return {
			from: selection.from,
			to: selection.to,
			line: line.number,
			coords: {
				top: coords.top,
				left: coords.left,
				bottom: coords.bottom,
			},
		};
	}

	// Track if we've recently notified about blocked edits to avoid spamming
	let lastEditBlockedNotification = 0;
	const EDIT_BLOCKED_DEBOUNCE_MS = 2000;

	// Helper to check if a key event is an edit attempt
	function isEditKeyEvent(event: KeyboardEvent): boolean {
		// Ignore modifier-only keys and navigation keys
		if (
			event.key === "Control" ||
			event.key === "Alt" ||
			event.key === "Shift" ||
			event.key === "Meta" ||
			event.key === "Escape" ||
			event.key === "Tab" ||
			event.key === "ArrowUp" ||
			event.key === "ArrowDown" ||
			event.key === "ArrowLeft" ||
			event.key === "ArrowRight" ||
			event.key === "Home" ||
			event.key === "End" ||
			event.key === "PageUp" ||
			event.key === "PageDown"
		) {
			return false;
		}

		// Allow Ctrl/Cmd + C (copy) and other non-editing shortcuts
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
			return false;
		}

		// Printable characters, backspace, delete, enter are edit attempts
		return (
			event.key.length === 1 ||
			event.key === "Backspace" ||
			event.key === "Delete" ||
			event.key === "Enter"
		);
	}

	function notifyEditBlocked() {
		const now = Date.now();
		if (now - lastEditBlockedNotification > EDIT_BLOCKED_DEBOUNCE_MS) {
			lastEditBlockedNotification = now;
			oneditblocked?.();
		}
	}

	function initializeEditor(container: HTMLDivElement) {
		// Build extensions based on collaborative mode
		const extensions = [
			basicSetup,
			markdown(),
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

					if (canAddComments && onselectionchange) {
						onselectionchange(getSelectionInfo(update.view));
					}
				}
			}),
			EditorView.editable.of(!readonly),
			EditorView.theme({
				"&": {
					fontSize: "14px",
				},
				".cm-gutters": {
					display: "none",
				},
				".cm-scroller": {
					fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
					lineHeight: "1.5",
					overflow: "auto",
				},
			}),
		];

		// Add Yjs collaboration extension if in collaborative mode
		if (yText && awareness) {
			extensions.push(yCollab(yText, awareness, { undoManager: false }));
		}

		const state = EditorState.create({
			doc: yText ? yText.toString() : value,
			extensions,
		});

		editorView = new EditorView({
			state,
			parent: container,
		});

		// Handle value synchronization for non-collaborative mode
		if (!isCollaborative) {
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
		}

		$effect.pre(() => {
			if (editorView) {
				editorView.dispatch({
					effects: updatePRCommentsEffect.of(prComments),
				});
			}
		});

		// Handle readonly changes
		$effect(() => {
			if (editorView) {
				editorView.dispatch({
					effects: StateEffect.reconfigure.of([
						basicSetup,
						markdown(),
						prCommentsField,
						...(yText && awareness ? [yCollab(yText, awareness, { undoManager: false })] : []),
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

								if (canAddComments && onselectionchange) {
									onselectionchange(getSelectionInfo(update.view));
								}
							}
						}),
						EditorView.editable.of(!readonly),
						EditorView.theme({
							"&": {
								fontSize: "14px",
							},
							".cm-gutters": {
								display: "none",
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

		// Add direct DOM event listeners for detecting edit attempts in readonly mode
		const handleKeyDown = (event: KeyboardEvent) => {
			if (readonly && isEditKeyEvent(event)) {
				notifyEditBlocked();
			}
		};

		const handlePaste = () => {
			if (readonly) {
				notifyEditBlocked();
			}
		};

		const handleClick = () => {
			// When user clicks in readonly mode, listen for the next keypress
			// to detect edit attempts (since the editor doesn't receive focus in readonly mode)
			if (readonly) {
				const docKeyHandler = (event: KeyboardEvent) => {
					if (isEditKeyEvent(event)) {
						notifyEditBlocked();
					}
					document.removeEventListener("keydown", docKeyHandler);
				};
				document.addEventListener("keydown", docKeyHandler, { once: true });
				// Clean up after 5 seconds if no keypress
				setTimeout(() => {
					document.removeEventListener("keydown", docKeyHandler);
				}, 5000);
			}
		};

		container.addEventListener("keydown", handleKeyDown);
		container.addEventListener("paste", handlePaste);
		container.addEventListener("click", handleClick);

		return () => {
			container.removeEventListener("keydown", handleKeyDown);
			container.removeEventListener("paste", handlePaste);
			container.removeEventListener("click", handleClick);
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

	export function getContent(): string {
		return editorView?.state.doc.toString() ?? "";
	}
</script>

<div {@attach initializeEditor}></div>
