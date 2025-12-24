import { PostHog } from "posthog-node";
import { env } from "$env/dynamic/public";

export function createPostHogClient(): PostHog | null {
	if (!env.PUBLIC_POSTHOG_KEY) {
		return null;
	}

	const posthog = new PostHog(env.PUBLIC_POSTHOG_KEY, {
		host: env.PUBLIC_POSTHOG_HOST,
		flushAt: 1, // Send events immediately in edge environment
		flushInterval: 0, // Don't wait for interval
	});
	return posthog;
}
