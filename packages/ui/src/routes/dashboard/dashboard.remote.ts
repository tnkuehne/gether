import { query, getRequestEvent } from "$app/server";
import { Octokit } from "octokit";
import { hasGitHubAppInstalled } from "$lib/github-app";
import { auth } from "$lib/server/auth";

export const getPosts = query(async () => {
	const event = getRequestEvent();
	if (!event.locals.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: event.request.headers,
	});

	if (!tokenResponse?.accessToken) {
		return new Response("Failed to get GitHub token", { status: 401 });
	}

	const octokit = new Octokit({ auth: tokenResponse.accessToken });
});
