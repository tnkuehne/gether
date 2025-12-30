import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("handles undefined and null values", () => {
		expect(cn("foo", undefined, "bar", null)).toBe("foo bar");
	});

	it("handles empty strings", () => {
		expect(cn("foo", "", "bar")).toBe("foo bar");
	});

	it("handles conditional classes with clsx syntax", () => {
		expect(cn("foo", { bar: true, baz: false })).toBe("foo bar");
	});

	it("handles arrays of classes", () => {
		expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
	});

	it("merges tailwind classes correctly", () => {
		// tailwind-merge should handle conflicting classes
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
	});

	it("handles tailwind responsive prefixes", () => {
		expect(cn("text-sm md:text-base", "md:text-lg")).toBe("text-sm md:text-lg");
	});

	it("handles tailwind state variants", () => {
		expect(cn("hover:bg-blue-500", "hover:bg-red-500")).toBe("hover:bg-red-500");
	});

	it("returns empty string for no arguments", () => {
		expect(cn()).toBe("");
	});

	it("handles complex nested conditionals", () => {
		const isActive = true;
		const isDisabled = false;
		expect(
			cn("base", {
				active: isActive,
				disabled: isDisabled,
			}),
		).toBe("base active");
	});
});
