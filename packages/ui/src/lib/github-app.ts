import { Octokit } from "octokit";
import { PUBLIC_GITHUB_APP_ID, PUBLIC_GITHUB_APP_SLUG } from "$env/static/public";

// GitHub App installation URL - user installs app to grant access to specific repos
export const GITHUB_APP_INSTALL_URL = PUBLIC_GITHUB_APP_SLUG
	? `https://github.com/apps/${PUBLIC_GITHUB_APP_SLUG}/installations/new`
	: null;

/**
 * Check if user has installed the GitHub App
 * Once installed, their OAuth token will have access to the repos they selected
 */
export async function hasGitHubAppInstalled(userAccessToken: string): Promise<boolean> {
	if (!PUBLIC_GITHUB_APP_ID) {
		return false;
	}

	try {
		const userOctokit = new Octokit({ auth: userAccessToken });
		const { data: installations } =
			await userOctokit.rest.apps.listInstallationsForAuthenticatedUser();

		return installations.installations.some(
			(inst) => inst.app_id === parseInt(PUBLIC_GITHUB_APP_ID),
		);
	} catch (error) {
		console.error("Failed to check GitHub App installation:", error);
		return false;
	}
}

/**
 * Fetch file content from GitHub repository
 */
export async function fetchFileContent(
	octokit: Octokit,
	org: string,
	repo: string,
	path: string,
	branch: string,
) {
	const { data: fileResponse } = await octokit.rest.repos.getContent({
		owner: org,
		repo: repo,
		path: path,
		ref: branch,
	});

	if ("content" in fileResponse && fileResponse.type === "file") {
		const decodedContent = atob(fileResponse.content);

		return {
			content: decodedContent,
			url: fileResponse.html_url,
			downloadUrl: fileResponse.download_url,
			sha: fileResponse.sha,
			size: fileResponse.size,
			name: fileResponse.name,
		};
	} else if (Array.isArray(fileResponse)) {
		throw new Error("Path is a directory, not a file");
	} else {
		throw new Error("Invalid file type");
	}
}

/**
 * Gether preview configuration from gether.jsonc
 */
export interface GetherConfig {
	packageManager: "npm" | "pnpm" | "yarn" | "bun";
	root: string;
	install: string;
	dev: string;
	port: number;
}

/**
 * Fetch gether.jsonc config from repository root
 * Returns null if the file doesn't exist
 */
export async function fetchGetherConfig(
	octokit: Octokit,
	org: string,
	repo: string,
	branch: string,
): Promise<GetherConfig | null> {
	try {
		const { data: fileResponse } = await octokit.rest.repos.getContent({
			owner: org,
			repo: repo,
			path: "gether.jsonc",
			ref: branch,
		});

		if ("content" in fileResponse && fileResponse.type === "file") {
			const decodedContent = atob(fileResponse.content);
			// Strip JSONC comments (single-line // comments)
			const jsonContent = decodedContent.replace(/\/\/.*$/gm, "");
			return JSON.parse(jsonContent) as GetherConfig;
		}

		return null;
	} catch {
		// File doesn't exist or other error
		return null;
	}
}

/**
 * Commit a file to the repository
 */
export async function commitFile(
	octokit: Octokit,
	org: string,
	repo: string,
	path: string,
	branch: string,
	content: string,
	message: string,
	sha: string,
) {
	const { data } = await octokit.rest.repos.createOrUpdateFileContents({
		owner: org,
		repo: repo,
		path: path,
		message: message,
		content: btoa(content),
		sha: sha,
		branch: branch,
	});

	return {
		sha: data.content?.sha,
		commitSha: data.commit.sha,
		commitUrl: data.commit.html_url,
	};
}

/**
 * Check if the authenticated user has write permission to the repository
 */
export async function checkWritePermission(octokit: Octokit, org: string, repo: string) {
	try {
		const { data: userData } = await octokit.rest.users.getAuthenticated();

		// If user is the repo owner, they have write access
		if (userData.login.toLowerCase() === org.toLowerCase()) {
			return true;
		}

		// Otherwise, check collaborator permissions
		try {
			const { data: permissionData } = await octokit.rest.repos.getCollaboratorPermissionLevel({
				owner: org,
				repo: repo,
				username: userData.login,
			});

			return (
				permissionData.permission === "admin" ||
				permissionData.permission === "write" ||
				permissionData.permission === "maintain"
			);
		} catch {
			// If 403, user is not a collaborator
			return false;
		}
	} catch {
		return false;
	}
}

/**
 * Check if a branch is protected
 * Uses the branch API which includes a 'protected' field accessible without admin permissions
 */
export async function checkBranchProtection(
	octokit: Octokit,
	org: string,
	repo: string,
	branch: string,
): Promise<boolean> {
	try {
		const { data } = await octokit.rest.repos.getBranch({
			owner: org,
			repo: repo,
			branch: branch,
		});
		return data.protected;
	} catch {
		return false;
	}
}

/**
 * Get the default branch name for a repository
 */
export async function getDefaultBranch(
	octokit: Octokit,
	org: string,
	repo: string,
): Promise<string> {
	const { data: repoData } = await octokit.rest.repos.get({
		owner: org,
		repo: repo,
	});
	return repoData.default_branch;
}

/**
 * Fork information returned from fork operations
 */
export interface ForkInfo {
	owner: string;
	repo: string;
	fullName: string;
	htmlUrl: string;
	defaultBranch: string;
}

/**
 * Fork a repository to the authenticated user's account
 */
export async function forkRepository(
	octokit: Octokit,
	org: string,
	repo: string,
): Promise<ForkInfo> {
	const { data } = await octokit.rest.repos.createFork({
		owner: org,
		repo: repo,
	});

	return {
		owner: data.owner.login,
		repo: data.name,
		fullName: data.full_name,
		htmlUrl: data.html_url,
		defaultBranch: data.default_branch,
	};
}

/**
 * Check if the user has an existing fork of a repository
 */
export async function getUserFork(
	octokit: Octokit,
	org: string,
	repo: string,
): Promise<ForkInfo | null> {
	try {
		const { data: userData } = await octokit.rest.users.getAuthenticated();

		// Try to get the fork directly (assumes fork has same name as original repo)
		try {
			const { data: forkData } = await octokit.rest.repos.get({
				owner: userData.login,
				repo: repo,
			});

			// Verify it's actually a fork of the target repo
			if (forkData.fork && forkData.parent?.full_name === `${org}/${repo}`) {
				return {
					owner: forkData.owner.login,
					repo: forkData.name,
					fullName: forkData.full_name,
					htmlUrl: forkData.html_url,
					defaultBranch: forkData.default_branch,
				};
			}
		} catch {
			// Fork doesn't exist with the same name
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
	number: number;
	title: string;
	body: string | null;
	htmlUrl: string;
	state: "open" | "closed";
	draft: boolean;
	headRef: string;
	baseRef: string;
	headOwner: string;
	baseOwner: string;
}

/**
 * Create a pull request
 */
export async function createPullRequest(
	octokit: Octokit,
	org: string,
	repo: string,
	params: {
		title: string;
		body?: string;
		head: string; // Can be "branch" or "owner:branch" for cross-repo PRs
		base: string;
		draft?: boolean;
	},
): Promise<PullRequestInfo> {
	const { data } = await octokit.rest.pulls.create({
		owner: org,
		repo: repo,
		title: params.title,
		body: params.body,
		head: params.head,
		base: params.base,
		draft: params.draft ?? false,
	});

	return {
		number: data.number,
		title: data.title,
		body: data.body,
		htmlUrl: data.html_url,
		state: data.state as "open" | "closed",
		draft: data.draft ?? false,
		headRef: data.head.ref,
		baseRef: data.base.ref,
		headOwner: data.head.repo?.owner.login ?? org,
		baseOwner: data.base.repo?.owner.login ?? org,
	};
}

/**
 * Check if there's an existing PR from a branch
 */
export async function getExistingPullRequest(
	octokit: Octokit,
	org: string,
	repo: string,
	headBranch: string,
	headOwner?: string,
): Promise<PullRequestInfo | null> {
	try {
		// GitHub API requires head in format "owner:branch"
		const head = `${headOwner || org}:${headBranch}`;

		const { data: prs } = await octokit.rest.pulls.list({
			owner: org,
			repo: repo,
			head: head,
			state: "open",
			per_page: 1,
		});

		if (prs.length === 0) return null;

		const pr = prs[0];
		return {
			number: pr.number,
			title: pr.title,
			body: pr.body,
			htmlUrl: pr.html_url,
			state: pr.state as "open" | "closed",
			draft: pr.draft ?? false,
			headRef: pr.head.ref,
			baseRef: pr.base.ref,
			headOwner: pr.head.repo?.owner.login ?? org,
			baseOwner: pr.base.repo?.owner.login ?? org,
		};
	} catch {
		return null;
	}
}

/**
 * Get the authenticated user's login
 */
export async function getAuthenticatedUser(octokit: Octokit): Promise<string> {
	const { data } = await octokit.rest.users.getAuthenticated();
	return data.login;
}

/**
 * Create a new branch from a source branch
 */
export async function createBranch(
	octokit: Octokit,
	org: string,
	repo: string,
	branchName: string,
	sourceBranch: string,
): Promise<string> {
	// Get the SHA of the source branch
	const { data: refData } = await octokit.rest.git.getRef({
		owner: org,
		repo: repo,
		ref: `heads/${sourceBranch}`,
	});

	// Create the new branch
	await octokit.rest.git.createRef({
		owner: org,
		repo: repo,
		ref: `refs/heads/${branchName}`,
		sha: refData.object.sha,
	});

	return branchName;
}

/**
 * Pull request review comment
 */
export interface PRComment {
	id: number;
	pull_request_review_id: number;
	diff_hunk: string;
	path: string;
	position: number | null; // Position in diff (deprecated for multi-line)
	original_position: number | null;
	commit_id: string;
	original_commit_id: string;
	line: number | null; // Line number in file
	original_line: number | null;
	side: "LEFT" | "RIGHT"; // Which side of diff
	start_line: number | null; // For multi-line comments
	start_side: "LEFT" | "RIGHT" | null;
	body: string;
	user: {
		login: string;
		avatar_url: string;
	};
	created_at: string;
	updated_at: string;
	html_url: string;
	in_reply_to_id: number | null; // For threaded comments
	subject_type?: "line" | "file"; // Whether this is a file-level or line-level comment
}

/**
 * A thread of comments on a specific line or file
 */
export interface PRCommentThread {
	line: number; // Use 0 for file-level comments
	comments: PRComment[];
	resolved: boolean;
	isFileLevel: boolean; // True if this is a file-level comment thread
}

/**
 * Fetch review comments for a specific pull request
 */
export async function fetchPRComments(
	octokit: Octokit,
	org: string,
	repo: string,
	prNumber: number,
): Promise<PRComment[]> {
	const { data } = await octokit.rest.pulls.listReviewComments({
		owner: org,
		repo: repo,
		pull_number: prNumber,
		per_page: 100,
	});

	return data as PRComment[];
}

/**
 * Group comments by file path and line number, respecting reply threading
 * Includes both file-level and line-specific comments
 */
export function groupCommentsByLine(
	comments: PRComment[],
	filePath: string,
): Map<number, PRCommentThread> {
	const threads = new Map<number, PRCommentThread>();

	// Filter comments for this file only
	const fileComments = comments.filter((c) => c.path === filePath);

	// Simple approach: group all comments by line, then sort them chronologically
	// This ensures all comments show up even if threading logic has issues
	for (const comment of fileComments) {
		const isFileLevel = comment.subject_type === "file";

		// File-level comments use line 0, line-specific use actual line number
		let line: number;
		if (isFileLevel) {
			line = 0; // Special marker for file-level comments
		} else {
			const commentLine = comment.line ?? comment.original_line;
			if (!commentLine) continue;
			line = commentLine;
		}

		if (!threads.has(line)) {
			threads.set(line, {
				line,
				comments: [],
				resolved: false,
				isFileLevel,
			});
		}

		threads.get(line)!.comments.push(comment);
	}

	// Sort comments within each thread by creation date
	// This will naturally group replies after their parent comments
	threads.forEach((thread) => {
		thread.comments.sort(
			(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
		);
	});

	return threads;
}
