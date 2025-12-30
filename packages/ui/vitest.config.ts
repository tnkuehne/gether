import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ["src/**/*.{test,spec}.{js,ts,svelte}"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});
