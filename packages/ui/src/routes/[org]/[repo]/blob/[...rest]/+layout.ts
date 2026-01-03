import type { LayoutLoad } from "./$types";
import { getRepoBranches, getRepoDefaultBranch, parseBranchAndPath } from "./github";

export const load: LayoutLoad = async ({ params }) => {
	const { org, repo, rest } = params;

	const [branches, defaultBranch] = await Promise.all([
		getRepoBranches(org!, repo!),
		getRepoDefaultBranch(org!, repo!),
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
		branch,
		path,
		branches,
		defaultBranch,
	};
};
