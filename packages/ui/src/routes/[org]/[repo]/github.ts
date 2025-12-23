import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";

async function getOctokit(): Promise<Octokit> {
	const { data } = await authClient.getAccessToken({
		providerId: "github",
	});

	const accessToken = data?.accessToken;

	if (!accessToken) {
		throw new Error("Failed to get GitHub token");
	}

	return new Octokit({ auth: accessToken });
}

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
	const octokit = await getOctokit();
	const { data: repoData } = await octokit.rest.repos.get({
		owner,
		repo,
	});

	return repoData.default_branch;
}

export async function createFile(
	owner: string,
	repo: string,
	path: string,
	content: string,
	message: string,
): Promise<{ sha?: string; path?: string }> {
	const octokit = await getOctokit();

	const { data: repoData } = await octokit.rest.repos.get({
		owner,
		repo,
	});

	const { data: fileData } = await octokit.rest.repos.createOrUpdateFileContents({
		owner,
		repo,
		path,
		message,
		content: btoa(content),
		branch: repoData.default_branch,
	});

	return {
		sha: fileData.content?.sha,
		path: fileData.content?.path,
	};
}
