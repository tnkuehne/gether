import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { userEvent } from "@vitest/browser/context";
import Button from "../button.svelte";

describe("Button", () => {
	it("renders a button element by default", () => {
		render(Button, { props: { children: createSnippet("Click me") } });
		const button = screen.getByRole("button");
		expect(button).toBeInTheDocument();
		expect(button.textContent).toBe("Click me");
	});

	it("renders an anchor element when href is provided", () => {
		render(Button, {
			props: { href: "https://example.com", children: createSnippet("Link") },
		});
		const link = screen.getByRole("link");
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", "https://example.com");
	});

	it("applies variant classes correctly", () => {
		render(Button, {
			props: { variant: "destructive", children: createSnippet("Delete") },
		});
		const button = screen.getByRole("button");
		expect(button).toHaveClass("bg-destructive");
	});

	it("applies size classes correctly", () => {
		render(Button, {
			props: { size: "lg", children: createSnippet("Large Button") },
		});
		const button = screen.getByRole("button");
		expect(button).toHaveClass("h-10");
	});

	it("handles disabled state", () => {
		render(Button, {
			props: { disabled: true, children: createSnippet("Disabled") },
		});
		const button = screen.getByRole("button");
		expect(button).toBeDisabled();
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
		const button = screen.getByRole("button");
		await userEvent.click(button);
		expect(clicked).toBe(true);
	});

	it("applies custom class names", () => {
		render(Button, {
			props: { class: "custom-class", children: createSnippet("Custom") },
		});
		const button = screen.getByRole("button");
		expect(button).toHaveClass("custom-class");
	});

	it("has correct button type by default", () => {
		render(Button, { props: { children: createSnippet("Submit") } });
		const button = screen.getByRole("button");
		expect(button).toHaveAttribute("type", "button");
	});

	it("supports submit type", () => {
		render(Button, {
			props: { type: "submit", children: createSnippet("Submit") },
		});
		const button = screen.getByRole("button");
		expect(button).toHaveAttribute("type", "submit");
	});

	it("disabled link does not have href", () => {
		render(Button, {
			props: {
				href: "https://example.com",
				disabled: true,
				children: createSnippet("Disabled Link"),
			},
		});
		const link = screen.getByRole("link");
		expect(link).not.toHaveAttribute("href");
		expect(link).toHaveAttribute("aria-disabled", "true");
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
