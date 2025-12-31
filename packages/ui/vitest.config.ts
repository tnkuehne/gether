import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, "./src/lib"),
			"$env/static/public": path.resolve(__dirname, "./src/lib/__tests__/__mocks__/env.ts"),
		},
	},
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
