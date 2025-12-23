import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";
import {
	fetchFileContent,
	checkWritePermission,
	hasGitHubAppInstalled,
	fetchGetherConfig,
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
