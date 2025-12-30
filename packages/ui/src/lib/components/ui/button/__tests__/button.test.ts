import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "@vitest/browser/context";
import Button from "../button.svelte";

describe("Button", () => {
	it("renders a button element by default", async () => {
		render(Button, { props: { children: createSnippet("Click me") } });
		const button = page.getByRole("button");
		await expect.element(button).toBeInTheDocument();
		await expect.element(button).toHaveTextContent("Click me");
	});

	it("renders an anchor element when href is provided", async () => {
		render(Button, {
			props: { href: "https://example.com", children: createSnippet("Link") },
		});
		const link = page.getByRole("link");
		await expect.element(link).toBeInTheDocument();
		await expect.element(link).toHaveAttribute("href", "https://example.com");
	});

	it("applies variant classes correctly", async () => {
		render(Button, {
			props: { variant: "destructive", children: createSnippet("Delete") },
		});
		const button = page.getByRole("button");
		await expect.element(button).toHaveClass("bg-destructive");
	});

	it("applies size classes correctly", async () => {
		render(Button, {
			props: { size: "lg", children: createSnippet("Large Button") },
		});
		const button = page.getByRole("button");
		await expect.element(button).toHaveClass("h-10");
	});

	it("handles disabled state", async () => {
		render(Button, {
			props: { disabled: true, children: createSnippet("Disabled") },
		});
		const button = page.getByRole("button");
		await expect.element(button).toBeDisabled();
	});

	it("handles click events", async () => {
		let clicked = false;
		render(Button, {
			props: {
				onclick: () => {
					clicked = true;
				},
				children: createSnippet("Click me"),
			},
		});
		const button = page.getByRole("button");
		await userEvent.click(button);
		expect(clicked).toBe(true);
	});

	it("applies custom class names", async () => {
		render(Button, {
			props: { class: "custom-class", children: createSnippet("Custom") },
		});
		const button = page.getByRole("button");
		await expect.element(button).toHaveClass("custom-class");
	});

	it("has correct button type by default", async () => {
		render(Button, { props: { children: createSnippet("Submit") } });
		const button = page.getByRole("button");
		await expect.element(button).toHaveAttribute("type", "button");
	});

	it("supports submit type", async () => {
		render(Button, {
			props: { type: "submit", children: createSnippet("Submit") },
		});
		const button = page.getByRole("button");
		await expect.element(button).toHaveAttribute("type", "submit");
	});

	it("disabled link does not have href", async () => {
		render(Button, {
			props: {
				href: "https://example.com",
				disabled: true,
				children: createSnippet("Disabled Link"),
			},
		});
		const link = page.getByRole("link");
		await expect.element(link).not.toHaveAttribute("href");
		await expect.element(link).toHaveAttribute("aria-disabled", "true");
	});
});

/**
 * Helper to create a Svelte 5 snippet for passing children to components
 */
function createSnippet(text: string) {
	return (() => {
		const el = document.createTextNode(text);
		return el;
	}) as unknown as import("svelte").Snippet;
}
