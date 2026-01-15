import type { PageLoad } from "./$types";
import { getRepoFiles, getDefaultBranch, getBranches } from "$lib/github-app";
import { getOctokit, getPublicOctokit } from "$lib/github-auth";

export const load: PageLoad = async ({ params }) => {
	const { org, repo } = params;

	// Get octokit (authenticated or public)
	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();

	// Start all fetches in parallel, but don't await them
	// This enables streaming - the page renders immediately while data loads
	const branchesPromise = getBranches(octokit, org, repo);

	// Files depend on the default branch, so we chain them
	const filesPromise = getDefaultBranch(octokit, org, repo).then(async (defaultBranch) => {
		const branch = defaultBranch ?? "main";
		const files = await getRepoFiles(octokit, org, repo, branch);
		return { defaultBranch: branch, files };
	});

	return {
		org,
		repo,
		branches: branchesPromise,
		filesData: filesPromise,
	};
};
