import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import posthog from "posthog-js";

export async function load() {
	if (browser && env.PUBLIC_POSTHOG_KEY) {
		posthog.init(env.PUBLIC_POSTHOG_KEY, {
			api_host: "/adler",
			ui_host: env.PUBLIC_POSTHOG_HOST,
			persistence: "memory",
		});
	}
}
