<script lang="ts">
	import { onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState, StateEffect, StateField } from '@codemirror/state';
	import { markdown } from '@codemirror/lang-markdown';
	import { Decoration, type DecorationSet, WidgetType } from '@codemirror/view';

	interface RemoteCursor {
		position: number;
		color: string;
	}

	let {
		value = $bindable(''),
		onchange = undefined as ((value: string) => void) | undefined,
		oncursorchange = undefined as ((position: number) => void) | undefined,
		remoteCursors = [] as RemoteCursor[],
		readonly = false
	}: {
		value?: string;
		onchange?: (value: string) => void;
		oncursorchange?: (position: number) => void;
		remoteCursors?: RemoteCursor[];
		readonly?: boolean;
	} = $props();

	let editorView: EditorView | null = null;
	let isUpdatingFromRemote = false;

	// Cursor widget for rendering remote cursors
	class CursorWidget extends WidgetType {
		color: string;

		constructor(color: string) {
			super();
			this.color = color;
		}

		toDOM() {
			const cursor = document.createElement('span');
			cursor.style.position = 'absolute';
			cursor.style.borderLeft = `2px solid ${this.color}`;
			cursor.style.height = '1.2em';
			cursor.style.marginLeft = '-1px';
			cursor.style.pointerEvents = 'none';
			cursor.style.zIndex = '10';
			cursor.style.boxShadow = `0 0 4px ${this.color}`;
			return cursor;
		}
	}

	// Effect to update remote cursors
	const updateRemoteCursorsEffect = StateEffect.define<RemoteCursor[]>();

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
					console.log('[EDITOR] Processing cursor update effect:', cursors);
					const widgets = cursors.map((cursor) => {
						// Clamp position to valid range
						const pos = Math.min(cursor.position, tr.newDoc.length);
						console.log('[EDITOR] Creating cursor widget at position:', pos, 'with color:', cursor.color);
						return Decoration.widget({
							widget: new CursorWidget(cursor.color),
							side: 1
						}).range(pos);
					});
					decorations = Decoration.set(widgets);
					console.log('[EDITOR] Created', widgets.length, 'cursor decorations');
				}
			}

			return decorations;
		},
		provide: (f) => EditorView.decorations.from(f)
	});

	function initializeEditor(container: HTMLDivElement) {
		console.log('[EDITOR] Initializing CodeMirror');
		console.log('[EDITOR] Container element:', container);

		const state = EditorState.create({
			doc: '',
			extensions: [
				basicSetup,
				markdown(),
				remoteCursorsField,
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !isUpdatingFromRemote) {
						const newValue = update.state.doc.toString();
						value = newValue;
						// Access current callback from props
						onchange?.(newValue);
					}
					// Track cursor/selection changes
					if (update.selectionSet) {
						const cursorPos = update.state.selection.main.head;
						// Access current callback from props
						oncursorchange?.(cursorPos);
					}
				}),
				EditorView.theme({
					'&': {
						height: '500px',
						fontSize: '14px'
					},
					'.cm-scroller': {
						fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
						lineHeight: '1.5',
						overflow: 'auto'
					},
					'.cm-content': {
						minHeight: '500px',
						padding: '16px'
					},
					'.cm-editor': {
						height: '100%'
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: container
		});

		console.log('[EDITOR] CodeMirror initialized:', editorView);
		console.log('[EDITOR] Editor DOM:', editorView.dom);

		// Create nested effects to handle reactive updates without re-running the attachment
		$effect(() => {
			if (editorView) {
				const currentContent = editorView.state.doc.toString();
				if (value !== currentContent) {
					console.log('[EDITOR] Updating content, length:', value.length);
					isUpdatingFromRemote = true;
					editorView.dispatch({
						changes: {
							from: 0,
							to: editorView.state.doc.length,
							insert: value
						}
					});
					isUpdatingFromRemote = false;
				}
			}
		});

		$effect(() => {
			if (editorView) {
				console.log('[EDITOR] Updating readonly state:', readonly);
				editorView.dispatch({
					effects: StateEffect.reconfigure.of([
						basicSetup,
						markdown(),
						remoteCursorsField,
						EditorView.updateListener.of((update) => {
							if (update.docChanged && !isUpdatingFromRemote) {
								const newValue = update.state.doc.toString();
								value = newValue;
								onchange?.(newValue);
							}
							if (update.selectionSet) {
								const cursorPos = update.state.selection.main.head;
								oncursorchange?.(cursorPos);
							}
						}),
						EditorView.editable.of(!readonly),
						EditorView.theme({
							'&': {
								height: '500px',
								fontSize: '14px'
							},
							'.cm-scroller': {
								fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
								lineHeight: '1.5',
								overflow: 'auto'
							},
							'.cm-content': {
								minHeight: '500px',
								padding: '16px'
							},
							'.cm-editor': {
								height: '100%'
							}
						})
					])
				});
			}
		});

		$effect.pre(() => {
			console.log('[EDITOR] Effect running, remoteCursors:', remoteCursors, 'editorView:', !!editorView);
			if (editorView) {
				console.log('[EDITOR] Updating remote cursors:', remoteCursors);
				editorView.dispatch({
					effects: updateRemoteCursorsEffect.of(remoteCursors)
				});
			}
		});

		return () => {
			console.log('[EDITOR] Destroying CodeMirror');
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

<div {@attach initializeEditor} class="w-full border rounded-md overflow-hidden" style="min-height: 500px;"></div>
