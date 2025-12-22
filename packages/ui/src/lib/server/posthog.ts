import { PostHog } from "posthog-node";
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from "$env/static/public";

export function createPostHogClient() {
	const posthog = new PostHog(PUBLIC_POSTHOG_KEY, {
		host: PUBLIC_POSTHOG_HOST,
		flushAt: 1, // Send events immediately in edge environment
		flushInterval: 0, // Don't wait for interval
	});
	return posthog;
}
