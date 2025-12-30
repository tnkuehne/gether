import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		svelte({
			// Hot module replacement breaks tests
			hot: false,
		}),
	],
	test: {
		include: ["src/**/*.{test,spec}.{js,ts,svelte}"],
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
	resolve: {
		alias: {
			$lib: "/src/lib",
		},
	},
});
