import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";
import { hasGitHubAppInstalled, GITHUB_APP_INSTALL_URL } from "$lib/github-app";

async function getOctokit(): Promise<{ octokit: Octokit; accessToken: string }> {
	const { data } = await authClient.getAccessToken({
		providerId: "github",
	});

	const accessToken = data?.accessToken;

	if (!accessToken) {
		throw new Error("Failed to get GitHub token");
	}

	return { octokit: new Octokit({ auth: accessToken }), accessToken };
}

export async function getGitHubAppStatus(): Promise<{
	isInstalled: boolean;
	installUrl: string | null;
}> {
	const { accessToken } = await getOctokit();
	const isInstalled = await hasGitHubAppInstalled(accessToken);

	return {
		isInstalled,
		installUrl: GITHUB_APP_INSTALL_URL,
	};
}

export interface Repository {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	isPrivate: boolean;
	htmlUrl: string;
	language: string | null;
	updatedAt: string | null;
	stars: number;
}

export async function getRepositories(): Promise<Repository[]> {
	const { octokit } = await getOctokit();

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
}
