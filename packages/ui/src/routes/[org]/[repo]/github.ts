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

export async function getBranches(owner: string, repo: string): Promise<string[]> {
	const octokit = await getOctokit();
	const { data: branches } = await octokit.rest.repos.listBranches({
		owner,
		repo,
		per_page: 100,
	});

	return branches.map((b) => b.name);
}

export async function createBranch(
	owner: string,
	repo: string,
	branchName: string,
	sourceBranch: string,
): Promise<string> {
	const octokit = await getOctokit();

	// Get the SHA of the source branch
	const { data: refData } = await octokit.rest.git.getRef({
		owner,
		repo,
		ref: `heads/${sourceBranch}`,
	});

	// Create the new branch
	await octokit.rest.git.createRef({
		owner,
		repo,
		ref: `refs/heads/${branchName}`,
		sha: refData.object.sha,
	});

	return branchName;
}

export async function createFile(
	owner: string,
	repo: string,
	path: string,
	content: string,
	message: string,
	branch: string,
): Promise<{ sha?: string; path?: string }> {
	const octokit = await getOctokit();

	const { data: fileData } = await octokit.rest.repos.createOrUpdateFileContents({
		owner,
		repo,
		path,
		message,
		content: btoa(content),
		branch,
	});

	return {
		sha: fileData.content?.sha,
		path: fileData.content?.path,
	};
}
