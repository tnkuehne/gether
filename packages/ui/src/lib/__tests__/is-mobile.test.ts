import { describe, expect, it } from "vitest";
import { IsMobile } from "../hooks/is-mobile.svelte";

describe("IsMobile", () => {
	it("creates an IsMobile instance with default breakpoint", () => {
		const isMobile = new IsMobile();
		// The current property should be a boolean indicating if viewport matches
		expect(typeof isMobile.current).toBe("boolean");
	});

	it("creates an IsMobile instance with custom breakpoint", () => {
		const isMobile = new IsMobile(1024);
		expect(typeof isMobile.current).toBe("boolean");
	});

	it("creates an IsMobile instance with small breakpoint", () => {
		const isMobile = new IsMobile(480);
		expect(typeof isMobile.current).toBe("boolean");
	});

	it("returns false for wide viewport (desktop browser test environment)", () => {
		// In a desktop browser test environment, window is typically wide (1280px+)
		// so current should be false (not mobile) for default 768px breakpoint
		const isMobile = new IsMobile();
		expect(isMobile.current).toBe(false);
	});

	it("returns false for large custom breakpoint in desktop environment", () => {
		// With a breakpoint of 1024px, in a typical test browser (1280px wide)
		// the result should still be false
		const isMobile = new IsMobile(1024);
		expect(isMobile.current).toBe(false);
	});
});
