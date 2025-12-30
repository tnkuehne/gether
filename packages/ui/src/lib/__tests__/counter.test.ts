import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import Counter from "./Counter.svelte";

describe("Counter", () => {
	it("renders with initial count of 0", async () => {
		render(Counter);
		const button = page.getByRole("button");
		await expect.element(button).toHaveTextContent("Count: 0");
	});

	it("increments count on click", async () => {
		render(Counter);
		const button = page.getByRole("button");
		await userEvent.click(button);
		await expect.element(button).toHaveTextContent("Count: 1");
	});

	it("increments multiple times", async () => {
		render(Counter);
		const button = page.getByRole("button");
		await userEvent.click(button);
		await userEvent.click(button);
		await userEvent.click(button);
		await expect.element(button).toHaveTextContent("Count: 3");
	});
});
