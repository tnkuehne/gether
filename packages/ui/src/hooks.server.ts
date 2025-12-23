import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import type { HandleServerError } from "@sveltejs/kit";
import { createPostHogClient } from "$lib/server/posthog";

export async function handle({ event, resolve }) {
	const { pathname } = event.url;

	if (pathname.startsWith("/adler")) {
		const hostname = pathname.startsWith("/adler/static/")
			? "eu-assets.i.posthog.com"
			: "eu.i.posthog.com";

		const url = new URL(event.request.url);
		url.protocol = "https:";
		url.hostname = hostname;
		url.port = "443";
		url.pathname = pathname.replace("/adler/", "");

		const headers = new Headers(event.request.headers);
		headers.set("Accept-Encoding", "");
		headers.set("host", hostname);

		const response = await fetch(url.toString(), {
			method: event.request.method,
			headers,
			body: event.request.body,
			duplex: "half",
		});

		return response;
	}

	// Fetch current session from Better Auth
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	// Make session and user available on server
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
}

export const handleError = async ({ error, status }: HandleServerError) => {
	console.error(error);
	if (status !== 404) {
		createPostHogClient().captureException(error);
	}
};
