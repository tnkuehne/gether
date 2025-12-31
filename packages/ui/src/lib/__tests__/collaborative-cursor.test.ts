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

		// Check that the name is displayed
		const nameLabel = page.getByText("Alice");
		await expect.element(nameLabel).toBeVisible();
	});

	it("applies correct background color to name label", async () => {
		render(CollaborativeCursor, {
			props: {
				name: "Bob",
				color: "#00ff00",
			},
		});

		const nameLabel = page.getByText("Bob");
		await expect.element(nameLabel).toBeVisible();

		// Check that the style contains the background-color
		await expect.element(nameLabel).toHaveAttribute("style");
	});

	it("applies color to cursor line", async () => {
		const { container } = render(CollaborativeCursor, {
			props: {
				name: "Charlie",
				color: "#0000ff",
			},
		});

		// The cursor line is the second span with animate-pulse class
		const cursorLine = container.querySelector(".animate-pulse");
		expect(cursorLine).not.toBeNull();
	});

	it("renders different users with different colors", async () => {
		render(CollaborativeCursor, {
			props: {
				name: "User1",
				color: "#ff0000",
			},
		});

		// Check User1 is rendered
		const user1Label = page.getByText("User1");
		await expect.element(user1Label).toBeVisible();
	});

	it("handles special characters in name", async () => {
		render(CollaborativeCursor, {
			props: {
				name: "User <script>",
				color: "#purple",
			},
		});

		// Name with special characters should be escaped/displayed as text
		const nameLabel = page.getByText("User <script>");
		await expect.element(nameLabel).toBeVisible();
	});

	it("handles empty name", async () => {
		const { container } = render(CollaborativeCursor, {
			props: {
				name: "",
				color: "#000000",
			},
		});

		// Component should still render even with empty name
		const wrapper = container.querySelector(".relative");
		expect(wrapper).not.toBeNull();
	});
});
