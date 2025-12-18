import { browser } from "$app/environment";
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from "$env/static/public";
import posthog from "posthog-js";

export async function load() {
    if (browser) {
        posthog.init(PUBLIC_POSTHOG_KEY, {
            api_host: "/adler",
            ui_host: PUBLIC_POSTHOG_HOST,
            persistence: 'memory',
        });
    }
};
