import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import CollaborativeCursor from "../components/collaborative-cursor.svelte";

describe("CollaborativeCursor", () => {
	it("renders with name and color", async () => {
		render(CollaborativeCursor, {
			props: {
				name: "Alice",
				color: "#ff0000",
			},
		});

		// Check that the name label is rendered
		const nameLabel = page.getByText("Alice");
		await expect.element(nameLabel).toBeVisible();
	});

	it("applies the correct background color to name label", async () => {
		const { container } = render(CollaborativeCursor, {
			props: {
				name: "Bob",
				color: "#00ff00",
			},
		});

		const nameLabel = page.getByText("Bob");
		await expect.element(nameLabel).toBeVisible();

		// Verify the background color is applied via container query
		const labelElement = container.querySelector("span[style]");
		expect(labelElement).not.toBeNull();
		const style = labelElement?.getAttribute("style");
		expect(style).toContain("background-color: #00ff00");
	});

	it("renders the cursor line with matching color", async () => {
		const { container } = render(CollaborativeCursor, {
			props: {
				name: "Charlie",
				color: "#0000ff",
			},
		});

		// The cursor line is a span with animate-pulse class
		const cursorLine = container.querySelector(".animate-pulse");
		expect(cursorLine).not.toBeNull();

		const style = cursorLine?.getAttribute("style");
		expect(style).toContain("background-color: #0000ff");
	});

	it("renders with different user names", async () => {
		render(CollaborativeCursor, {
			props: {
				name: "User with Long Name",
				color: "#purple",
			},
		});

		const nameLabel = page.getByText("User with Long Name");
		await expect.element(nameLabel).toBeVisible();
	});

	it("handles rgb colors correctly", async () => {
		const { container } = render(CollaborativeCursor, {
			props: {
				name: "Test",
				color: "rgb(255, 128, 0)",
			},
		});

		const nameLabel = page.getByText("Test");
		await expect.element(nameLabel).toBeVisible();

		// Verify via container query
		const labelElement = container.querySelector("span[style]");
		expect(labelElement).not.toBeNull();
		const style = labelElement?.getAttribute("style");
		expect(style).toContain("background-color: rgb(255, 128, 0)");
	});
});
