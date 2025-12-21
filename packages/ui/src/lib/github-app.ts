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
 * Fetch repository metadata from GitHub
 */
export async function fetchRepoMetadata(octokit: Octokit, org: string, repo: string) {
	const { data: repoResponse } = await octokit.rest.repos.get({
		owner: org,
		repo: repo,
	});

	return {
		name: repoResponse.name,
		fullName: repoResponse.full_name,
		description: repoResponse.description,
		defaultBranch: repoResponse.default_branch,
		isPrivate: repoResponse.private,
		stars: repoResponse.stargazers_count,
		forks: repoResponse.forks_count,
		language: repoResponse.language,
		updatedAt: repoResponse.updated_at,
		htmlUrl: repoResponse.html_url,
	};
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
