import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";
import {
	fetchFileContent,
	checkWritePermission,
	hasGitHubAppInstalled,
	fetchGetherConfig,
	checkBranchProtection,
	getDefaultBranch,
	forkRepository,
	getUserFork,
	createPullRequest,
	getExistingPullRequest,
	getAuthenticatedUser,
	createBranch,
	type ForkInfo,
	type PullRequestInfo,
} from "$lib/github-app";

async function getOctokit(): Promise<{ octokit: Octokit; accessToken: string } | null> {
	try {
		const { data } = await authClient.getAccessToken({
			providerId: "github",
		});

		const accessToken = data?.accessToken;

		if (!accessToken) {
			return null;
		}

		return { octokit: new Octokit({ auth: accessToken }), accessToken };
	} catch {
		return null;
	}
}

function getPublicOctokit(): Octokit {
	return new Octokit();
}

/**
 * Get list of branches for a repository
 */
export async function getRepoBranches(org: string, repo: string): Promise<string[]> {
	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();

	try {
		const branches: string[] = [];
		let page = 1;
		const perPage = 100;

		// Fetch all branches (paginated)
		while (true) {
			const { data } = await octokit.rest.repos.listBranches({
				owner: org,
				repo: repo,
				per_page: perPage,
				page,
			});

			branches.push(...data.map((b) => b.name));

			if (data.length < perPage) break;
			page++;
		}

		return branches;
	} catch {
		return [];
	}
}

/**
 * Parse branch and path from a combined path, matching against known branches.
 * This handles branches with slashes like "user/feature".
 */
export function parseBranchAndPath(
	restPath: string,
	branches: string[],
	defaultBranch?: string,
): { branch: string; path: string } | null {
	if (!restPath) return null;

	// Sort branches by length descending to match longest first
	const sortedBranches = [...branches].sort((a, b) => b.length - a.length);

	for (const branch of sortedBranches) {
		// Check if path starts with this branch name
		if (restPath === branch) {
			// Exact match - no file path
			return { branch, path: "" };
		}
		if (restPath.startsWith(branch + "/")) {
			// Branch followed by path
			return { branch, path: restPath.slice(branch.length + 1) };
		}
	}

	// No branch matched - try using first segment as branch (fallback)
	const firstSlash = restPath.indexOf("/");
	if (firstSlash === -1) {
		// Single segment - assume it's a branch
		return { branch: restPath, path: "" };
	}

	// Use default branch if available and path doesn't start with a known branch
	if (defaultBranch) {
		return { branch: defaultBranch, path: restPath };
	}

	// Fallback: first segment is branch, rest is path
	return {
		branch: restPath.slice(0, firstSlash),
		path: restPath.slice(firstSlash + 1),
	};
}

export interface FileData {
	content: string;
	url: string | null;
	downloadUrl: string | null;
	sha: string;
	size: number;
	name: string;
}

export interface FileResult {
	fileData: FileData | null;
	error: string | null;
	needsGitHubApp: boolean;
}

export async function getFileContent(
	org: string,
	repo: string,
	path: string,
	branch: string,
): Promise<FileResult> {
	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();
	const hasToken = !!auth;

	try {
		const fileData = await fetchFileContent(octokit, org, repo, path, branch);
		return { fileData, error: null, needsGitHubApp: false };
	} catch (err: unknown) {
		const error = err as { status?: number; message?: string };
		if (error.status === 404) {
			const needsGitHubApp = hasToken;
			return {
				fileData: null,
				error: needsGitHubApp
					? "This appears to be a private repository. Install the GitHub App to grant access."
					: "File or repository not found",
				needsGitHubApp,
			};
		} else if (error.status === 403) {
			return {
				fileData: null,
				error: "Rate limit exceeded or access denied",
				needsGitHubApp: false,
			};
		}

		return {
			fileData: null,
			error: error.message || "Failed to fetch file",
			needsGitHubApp: false,
		};
	}
}

export async function getCanEdit(org: string, repo: string): Promise<boolean> {
	const auth = await getOctokit();
	if (!auth) return false;

	try {
		return await checkWritePermission(auth.octokit, org, repo);
	} catch {
		return false;
	}
}

export async function getHasGitHubApp(): Promise<boolean> {
	const auth = await getOctokit();
	if (!auth) return false;

	try {
		return await hasGitHubAppInstalled(auth.accessToken);
	} catch {
		return false;
	}
}

export async function getGetherConfig(
	org: string,
	repo: string,
	branch: string,
): Promise<import("$lib/github-app").GetherConfig | null> {
	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();

	try {
		return await fetchGetherConfig(octokit, org, repo, branch);
	} catch {
		return null;
	}
}

/**
 * Check if a branch is protected
 */
export async function getIsBranchProtected(
	org: string,
	repo: string,
	branch: string,
): Promise<boolean> {
	const auth = await getOctokit();
	if (!auth) return false;

	try {
		return await checkBranchProtection(auth.octokit, org, repo, branch);
	} catch {
		return false;
	}
}

/**
 * Get the default branch for a repository
 */
export async function getRepoDefaultBranch(org: string, repo: string): Promise<string | null> {
	const auth = await getOctokit();
	const octokit = auth?.octokit ?? getPublicOctokit();

	try {
		return await getDefaultBranch(octokit, org, repo);
	} catch {
		return null;
	}
}

/**
 * Get the authenticated user's login
 */
export async function getCurrentUser(): Promise<string | null> {
	const auth = await getOctokit();
	if (!auth) return null;

	try {
		return await getAuthenticatedUser(auth.octokit);
	} catch {
		return null;
	}
}

/**
 * Check if user has an existing fork
 */
export async function checkUserFork(org: string, repo: string): Promise<ForkInfo | null> {
	const auth = await getOctokit();
	if (!auth) return null;

	try {
		return await getUserFork(auth.octokit, org, repo);
	} catch {
		return null;
	}
}

/**
 * Fork a repository
 */
export async function doForkRepository(org: string, repo: string): Promise<ForkInfo> {
	const auth = await getOctokit();
	if (!auth) throw new Error("Not authenticated");

	return await forkRepository(auth.octokit, org, repo);
}

/**
 * Create a new branch
 */
export async function doCreateBranch(
	org: string,
	repo: string,
	branchName: string,
	sourceBranch: string,
): Promise<string> {
	const auth = await getOctokit();
	if (!auth) throw new Error("Not authenticated");

	return await createBranch(auth.octokit, org, repo, branchName, sourceBranch);
}

/**
 * Check if there's an existing PR for a branch
 */
export async function checkExistingPR(
	org: string,
	repo: string,
	headBranch: string,
	headOwner?: string,
): Promise<PullRequestInfo | null> {
	const auth = await getOctokit();
	if (!auth) return null;

	try {
		return await getExistingPullRequest(auth.octokit, org, repo, headBranch, headOwner);
	} catch {
		return null;
	}
}

/**
 * Create a pull request
 */
export async function doCreatePullRequest(
	org: string,
	repo: string,
	params: {
		title: string;
		body?: string;
		head: string;
		base: string;
		draft?: boolean;
	},
): Promise<PullRequestInfo> {
	const auth = await getOctokit();
	if (!auth) throw new Error("Not authenticated");

	return await createPullRequest(auth.octokit, org, repo, params);
}

export type { ForkInfo, PullRequestInfo };
