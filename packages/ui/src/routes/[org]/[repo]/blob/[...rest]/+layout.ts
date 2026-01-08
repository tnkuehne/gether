import type { LayoutLoad } from "./$types";
import { getBranches, getDefaultBranch, parseBranchAndPath } from "$lib/github-app";
import { getOctokit, getPublicOctokit } from "$lib/github-auth";

export const load: LayoutLoad = async ({ params }) => {
	const { org, repo, rest } = params;

	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();

	const [branches, defaultBranch] = await Promise.all([
		getBranches(octokit, org!, repo!),
		getDefaultBranch(octokit, org!, repo!),
	]);

	let branch = defaultBranch ?? "main";
	let path = "";

	if (rest && branches.length > 0) {
		const parsed = parseBranchAndPath(rest, branches, defaultBranch ?? undefined);
		if (parsed) {
			branch = parsed.branch;
			path = parsed.path;
		}
	}

	return {
		org: org!,
		repo: repo!,
		branch,
		path,
		branches,
		defaultBranch,
	};
};
