import { Octokit } from "octokit";
import { PUBLIC_GITHUB_APP_ID, PUBLIC_GITHUB_APP_SLUG } from "$env/static/public";

/**
 * Encode a UTF-8 string to base64 (handles non-ASCII characters like emoji, CJK, etc.)
 * This is the inverse of how fetchFileContent decodes content.
 */
function encodeBase64(content: string): string {
	const bytes = new TextEncoder().encode(content);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

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
		// Properly decode UTF-8 content from base64
		const binaryString = atob(fileResponse.content);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const decodedContent = new TextDecoder("utf-8").decode(bytes);

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
		content: encodeBase64(content),
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
): Promise<string | null> {
	try {
		const { data: repoData } = await octokit.rest.repos.get({
			owner: org,
			repo: repo,
		});
		return repoData.default_branch;
	} catch {
		return null;
	}
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
	headSha: string; // Commit SHA of the PR head (needed for creating comments)
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
		headSha: data.head.sha,
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
			headSha: pr.head.sha,
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
 * Create a new review comment on a pull request
 */
export async function createPRComment(
	octokit: Octokit,
	org: string,
	repo: string,
	prNumber: number,
	params: {
		body: string;
		path: string;
		line: number;
		commitId: string;
		side?: "LEFT" | "RIGHT";
	},
): Promise<PRComment> {
	const { data } = await octokit.rest.pulls.createReviewComment({
		owner: org,
		repo: repo,
		pull_number: prNumber,
		body: params.body,
		path: params.path,
		line: params.line,
		commit_id: params.commitId,
		side: params.side ?? "RIGHT",
	});

	return data as PRComment;
}

/**
 * Reply to an existing review comment on a pull request
 */
export async function replyToPRComment(
	octokit: Octokit,
	org: string,
	repo: string,
	prNumber: number,
	commentId: number,
	body: string,
): Promise<PRComment> {
	const { data } = await octokit.rest.pulls.createReplyForReviewComment({
		owner: org,
		repo: repo,
		pull_number: prNumber,
		comment_id: commentId,
		body: body,
	});

	return data as PRComment;
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

/**
 * Get list of branches for a repository (paginated)
 */
export async function getBranches(octokit: Octokit, org: string, repo: string): Promise<string[]> {
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
 * Tree item for file listing
 */
export interface TreeItem {
	type: "file" | "dir";
	name: string;
	path: string;
}

const ALLOWED_EXTENSIONS = [".md", ".mdx", ".svx"];

/**
 * Get markdown files from a repository tree
 */
export async function getRepoFiles(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string,
): Promise<TreeItem[]> {
	// Single API call to get entire tree
	const { data: treeData } = await octokit.rest.git.getTree({
		owner,
		repo,
		tree_sha: branch,
		recursive: "1",
	});

	// Filter for markdown files and collect their parent directories
	const markdownFiles: TreeItem[] = [];
	const dirsWithMarkdown = new Set<string>();

	for (const item of treeData.tree) {
		if (item.type === "blob" && item.path) {
			const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
				item.path!.toLowerCase().endsWith(ext),
			);
			if (hasAllowedExtension) {
				markdownFiles.push({
					type: "file",
					name: item.path.split("/").pop()!,
					path: item.path,
				});

				// Mark all parent directories as containing markdown
				const parts = item.path.split("/");
				for (let i = 1; i < parts.length; i++) {
					dirsWithMarkdown.add(parts.slice(0, i).join("/"));
				}
			}
		}
	}

	// Add directory entries for dirs that contain markdown files
	const dirItems: TreeItem[] = [];
	for (const dirPath of dirsWithMarkdown) {
		dirItems.push({
			type: "dir",
			name: dirPath.split("/").pop()!,
			path: dirPath,
		});
	}

	// Combine and sort
	return [...markdownFiles, ...dirItems].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Repository info returned from listing
 */
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

/**
 * List repositories for the authenticated user
 */
export async function listUserRepositories(octokit: Octokit): Promise<Repository[]> {
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

/**
 * Get GitHub App installation status
 */
export async function getGitHubAppStatus(accessToken: string): Promise<{
	isInstalled: boolean;
	installUrl: string | null;
}> {
	const isInstalled = await hasGitHubAppInstalled(accessToken);

	return {
		isInstalled,
		installUrl: GITHUB_APP_INSTALL_URL,
	};
}

/**
 * File data returned from fetching file content
 */
export interface FileData {
	content: string;
	url: string | null;
	downloadUrl: string | null;
	sha: string;
	size: number;
	name: string;
}

/**
 * Result of fetching file content with error handling
 */
export interface FileResult {
	fileData: FileData | null;
	error: string | null;
	needsGitHubApp: boolean;
}

/**
 * Fetch file content with error handling
 * Returns a result object with fileData, error message, and needsGitHubApp flag
 */
export async function getFileContentWithErrorHandling(
	octokit: Octokit,
	org: string,
	repo: string,
	path: string,
	branch: string,
	isAuthenticated: boolean,
): Promise<FileResult> {
	try {
		const fileData = await fetchFileContent(octokit, org, repo, path, branch);
		return { fileData, error: null, needsGitHubApp: false };
	} catch (err: unknown) {
		const error = err as { status?: number; message?: string };
		if (error.status === 404) {
			const needsGitHubApp = isAuthenticated;
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

/**
 * Create a file in a repository
 */
export async function createFile(
	octokit: Octokit,
	owner: string,
	repo: string,
	path: string,
	content: string,
	message: string,
	branch: string,
): Promise<{ sha?: string; path?: string }> {
	const { data: fileData } = await octokit.rest.repos.createOrUpdateFileContents({
		owner,
		repo,
		path,
		message,
		content: encodeBase64(content),
		branch,
	});

	return {
		sha: fileData.content?.sha,
		path: fileData.content?.path,
	};
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
	threads.forEach((thread) => {
		thread.comments.sort(
			(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
		);
	});

	// Now split threads by conversation (separate threads for replies vs separate top-level comments)
	const finalThreads = new Map<number, PRCommentThread>();
	let threadId = 0;

	threads.forEach((thread) => {
		const topLevel = thread.comments.filter((c) => !c.in_reply_to_id);
		const allReplies = thread.comments.filter((c) => c.in_reply_to_id);

		// Build reply map
		const replyMap = new Map<number, PRComment[]>();
		for (const reply of allReplies) {
			if (!replyMap.has(reply.in_reply_to_id!)) {
				replyMap.set(reply.in_reply_to_id!, []);
			}
			replyMap.get(reply.in_reply_to_id!)!.push(reply);
		}

		// Create separate thread for each top-level comment
		for (const topComment of topLevel) {
			const threadComments = [topComment];

			// Recursively collect replies
			const collectReplies = (parentId: number) => {
				const replies = replyMap.get(parentId) || [];
				for (const reply of replies) {
					threadComments.push(reply);
					collectReplies(reply.id);
				}
			};
			collectReplies(topComment.id);

			// Sort by creation date
			threadComments.sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
			);

			const key = thread.line * 1000000 + threadId++;
			finalThreads.set(key, {
				line: thread.line,
				comments: threadComments,
				resolved: false,
				isFileLevel: thread.isFileLevel,
			});
		}
	});

	return finalThreads;
}
