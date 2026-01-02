import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import posthog from "@posthog/rollup-plugin";
import { defineConfig } from "vite";
import { faviconPlugin } from "./vite-plugin-favicon";

export default defineConfig({
	plugins: [
		...(process.env.POSTHOG_SOURCE_MAP_KEY
			? [
					posthog({
						personalApiKey: process.env.POSTHOG_SOURCE_MAP_KEY as string,
						envId: process.env.POSTHOG_PROJECT_ID as string,
						host: process.env.PUBLIC_POSTHOG_HOST,
						sourcemaps: {
							project: "gether",
						},
					}),
				]
			: []),
		tailwindcss(),
		sveltekit(),
		faviconPlugin(),
	],
});
