import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import CodeMirror from "../components/editor/CodeMirror.svelte";

describe("CodeMirror", () => {
	it("renders the editor container", async () => {
		const { container } = render(CodeMirror);

		// CodeMirror creates a .cm-editor element
		// Wait for it to be rendered
		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});
	});

	it("displays initial value", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "# Hello World",
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
			expect(editor?.textContent).toContain("Hello World");
		});
	});

	it("calls onchange when content is modified", async () => {
		const onchange = vi.fn();
		const { container } = render(CodeMirror, {
			props: {
				value: "",
				onchange,
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});

		// Find the editable content area
		const contentArea = container.querySelector(".cm-content");
		expect(contentArea).not.toBeNull();

		// Focus and type
		await userEvent.click(contentArea!);
		await userEvent.type(contentArea!, "test");

		await vi.waitFor(() => {
			expect(onchange).toHaveBeenCalled();
		});
	});

	it("renders in readonly mode", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "Read only content",
				readonly: true,
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
			expect(editor?.textContent).toContain("Read only content");
		});
	});

	it("calls oncursorchange when cursor moves", async () => {
		const oncursorchange = vi.fn();
		const { container } = render(CodeMirror, {
			props: {
				value: "Hello World",
				oncursorchange,
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});

		// Click on the content area to move cursor
		const contentArea = container.querySelector(".cm-content");
		expect(contentArea).not.toBeNull();

		await userEvent.click(contentArea!);

		await vi.waitFor(() => {
			expect(oncursorchange).toHaveBeenCalled();
		});
	});

	it("updates content when value prop changes", async () => {
		const { container, rerender } = render(CodeMirror, {
			props: {
				value: "Initial content",
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
			expect(editor?.textContent).toContain("Initial content");
		});

		// Re-render with new value
		await rerender({ value: "Updated content" });

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor?.textContent).toContain("Updated content");
		});
	});

	it("applies markdown syntax highlighting", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "# Heading\n\n**bold** and *italic*",
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
			// Check that markdown elements are present
			expect(editor?.textContent).toContain("Heading");
			expect(editor?.textContent).toContain("bold");
			expect(editor?.textContent).toContain("italic");
		});
	});

	it("creates editor with empty initial value", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "",
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});
	});

	it("handles remote cursors prop", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "Hello World",
				remoteCursors: [{ position: 5, color: "#ff0000", userName: "Alice" }],
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});
	});

	it("handles remote selections prop", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "Hello World",
				remoteSelections: [{ from: 0, to: 5, color: "rgba(255,0,0,0.2)", userName: "Bob" }],
			},
		});

		await vi.waitFor(() => {
			const editor = container.querySelector(".cm-editor");
			expect(editor).not.toBeNull();
		});
	});
});
