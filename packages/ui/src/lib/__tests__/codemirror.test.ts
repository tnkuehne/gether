import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import CodeMirror from "../components/editor/CodeMirror.svelte";

describe("CodeMirror", () => {
	it("renders the editor container", async () => {
		const { container } = render(CodeMirror);

		// Editor should initialize and create codemirror structure
		// Wait for the editor to initialize
		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});
	});

	it("displays initial value", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "# Hello World",
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
			expect(cmContent?.textContent).toContain("Hello World");
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
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});

		// Focus the editor and type
		const cmContent = container.querySelector(".cm-content") as HTMLElement;
		cmContent.focus();
		await userEvent.type(cmContent, "Test input");

		await vi.waitFor(() => {
			expect(onchange).toHaveBeenCalled();
		});
	});

	it("respects readonly mode", async () => {
		const onchange = vi.fn();
		const { container } = render(CodeMirror, {
			props: {
				value: "Read only content",
				readonly: true,
				onchange,
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});

		// Try to type in readonly editor - content should not change
		const cmContent = container.querySelector(".cm-content") as HTMLElement;
		cmContent.focus();

		// In readonly mode, the contenteditable should be false
		await vi.waitFor(() => {
			expect(cmContent.getAttribute("contenteditable")).toBe("false");
		});
	});

	it("calls oncursorchange when cursor position changes", async () => {
		const oncursorchange = vi.fn();
		const { container } = render(CodeMirror, {
			props: {
				value: "Some text here",
				oncursorchange,
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});

		// Click on the editor to change cursor position
		const cmContent = container.querySelector(".cm-content") as HTMLElement;
		await userEvent.click(cmContent);

		await vi.waitFor(() => {
			expect(oncursorchange).toHaveBeenCalled();
		});
	});

	it("renders with markdown syntax highlighting", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "# Heading\n\n**bold** and *italic*",
			},
		});

		await vi.waitFor(() => {
			const cmEditor = container.querySelector(".cm-editor");
			expect(cmEditor).not.toBeNull();
		});

		// Check that markdown content is rendered
		const cmContent = container.querySelector(".cm-content");
		expect(cmContent?.textContent).toContain("Heading");
		expect(cmContent?.textContent).toContain("bold");
	});

	it("handles empty remoteCursors and remoteSelections", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "Test content",
				remoteCursors: [],
				remoteSelections: [],
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});
	});

	it("handles remote cursors with position and color", async () => {
		const { container } = render(CodeMirror, {
			props: {
				value: "Hello World",
				remoteCursors: [
					{ position: 5, color: "#ff0000", userName: "Alice" },
					{ position: 8, color: "#00ff00", userName: "Bob" },
				],
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
		});

		// Remote cursors should be rendered as decorations
		// This is a basic test - remote cursor widgets are created via CodeMirror extensions
	});

	it("handles remote selections array prop", async () => {
		// Test that the component accepts remoteSelections prop
		// Note: Remote selections are applied via CodeMirror state effects after initialization
		const { container } = render(CodeMirror, {
			props: {
				value: "Select this text here for testing",
				remoteSelections: [], // Start with empty, selections applied via effects
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent).not.toBeNull();
			expect(cmContent?.textContent).toContain("Select this text");
		});
	});

	it("updates content when value prop changes", async () => {
		const { container, rerender } = render(CodeMirror, {
			props: {
				value: "Initial content",
			},
		});

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent?.textContent).toContain("Initial content");
		});

		// Update the value prop
		await rerender({ value: "Updated content" });

		await vi.waitFor(() => {
			const cmContent = container.querySelector(".cm-content");
			expect(cmContent?.textContent).toContain("Updated content");
		});
	});
});
