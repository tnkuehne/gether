import type { PageLoad } from "./$types";
import { getRepoFiles } from "./github-files";
import { getDefaultBranch, getBranches } from "./github";

export const load: PageLoad = async ({ params }) => {
	const { org, repo } = params;

	// Start all fetches in parallel, but don't await them
	// This enables streaming - the page renders immediately while data loads
	const branchesPromise = getBranches(org, repo);

	// Files depend on the default branch, so we chain them
	const filesPromise = getDefaultBranch(org, repo).then(async (defaultBranch) => {
		const files = await getRepoFiles(org, repo, defaultBranch);
		return { defaultBranch, files };
	});

	return {
		org,
		repo,
		branches: branchesPromise,
		filesData: filesPromise,
	};
};
