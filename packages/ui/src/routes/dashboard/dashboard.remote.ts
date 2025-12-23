import { query, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { Octokit } from "octokit";
import { hasGitHubAppInstalled, GITHUB_APP_INSTALL_URL } from "$lib/github-app";
import { auth } from "$lib/server/auth";

async function getGitHubToken() {
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

	return tokenResponse.accessToken;
}

export const getGitHubAppStatus = query(async () => {
	const accessToken = await getGitHubToken();
	const isInstalled = await hasGitHubAppInstalled(accessToken);

	return {
		isInstalled,
		installUrl: GITHUB_APP_INSTALL_URL,
	};
});

export const getRepositories = query(async () => {
	const accessToken = await getGitHubToken();
	const octokit = new Octokit({ auth: accessToken });

	const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
		sort: "updated",
		per_page: 100,
	});

	return repos.map((repo) => ({
		id: repo.id,
		name: repo.name,
		fullName: repo.full_name,
		description: repo.description,
		isPrivate: repo.private,
		htmlUrl: repo.html_url,
		language: repo.language,
		updatedAt: repo.updated_at,
		stars: repo.stargazers_count,
	}));
});
