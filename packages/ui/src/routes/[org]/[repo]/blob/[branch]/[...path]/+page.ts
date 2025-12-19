import type { PageLoad } from "./$types";
import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";
import {
	fetchFileContent,
	fetchRepoMetadata,
	checkWritePermission,
	hasGitHubAppInstalled,
} from "$lib/github-app";

export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const { org, repo, branch } = params;
	const path = params.path;

	// Get session and token
	const session = await authClient.getSession({ fetchOptions: { customFetchImpl: fetch } });
	let githubToken: string | undefined;
	let hasGitHubApp = false;

	if (session.data) {
		try {
			const tokenResponse = await authClient.getAccessToken({
				providerId: "github",
				fetchOptions: { customFetchImpl: fetch },
			});
			githubToken = tokenResponse?.data?.accessToken;

			if (githubToken) {
				hasGitHubApp = await hasGitHubAppInstalled(githubToken);
			}
		} catch {
			// Continue without token
		}
	}

	const octokit = new Octokit(githubToken ? { auth: githubToken } : undefined);

	try {
		const [fileData, repoData] = await Promise.all([
			fetchFileContent(octokit, org, repo, path, branch),
			fetchRepoMetadata(octokit, org, repo),
		]);

		let canEdit = false;
		if (githubToken) {
			canEdit = await checkWritePermission(octokit, org, repo);
		}

		return {
			fileData,
			repoData,
			canEdit,
			hasGitHubApp,
			error: null,
			needsGitHubApp: false,
		};
	} catch (err: any) {
		if (err.status === 404) {
			const needsGitHubApp = !!session.data && !!githubToken;
			return {
				fileData: null,
				repoData: null,
				canEdit: false,
				hasGitHubApp,
				error: needsGitHubApp
					? "This appears to be a private repository. Install the GitHub App to grant access."
					: "File or repository not found",
				needsGitHubApp,
			};
		} else if (err.status === 403) {
			return {
				fileData: null,
				repoData: null,
				canEdit: false,
				hasGitHubApp,
				error: "Rate limit exceeded or access denied",
				needsGitHubApp: false,
			};
		}

		return {
			fileData: null,
			repoData: null,
			canEdit: false,
			hasGitHubApp,
			error: err.message || "Failed to fetch",
			needsGitHubApp: false,
		};
	}
};
