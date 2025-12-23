import { query, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { hasGitHubAppInstalled, GITHUB_APP_INSTALL_URL } from "$lib/github-app";
import { auth } from "$lib/server/auth";

export const getGitHubAppStatus = query(async () => {
	const event = getRequestEvent();
	if (!event.locals.user) {
		error(401, "Unauthorized");
	}

	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: event.request.headers,
	});

	if (!tokenResponse?.accessToken) {
		error(401, "Failed to get GitHub token");
	}

	const isInstalled = await hasGitHubAppInstalled(tokenResponse.accessToken);

	return {
		isInstalled,
		installUrl: GITHUB_APP_INSTALL_URL,
	};
});
