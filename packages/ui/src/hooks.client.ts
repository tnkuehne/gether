import posthog from "posthog-js";
import type { HandleClientError } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";

export const handleError = ({ error, status }: HandleClientError) => {
	console.error(error);
	if (status !== 404 && env.PUBLIC_POSTHOG_KEY) {
		posthog.captureException(error);
	}
};
