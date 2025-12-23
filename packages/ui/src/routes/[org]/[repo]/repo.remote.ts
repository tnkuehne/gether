import { query, command, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { Octokit } from "octokit";
import { auth } from "$lib/server/auth";

const ALLOWED_EXTENSIONS = [".md", ".mdx", ".svx"];

async function getGitHubToken() {
	const event = getRequestEvent();
	if (!event.locals.user) {
		error(401, "Unauthorized");
	}

	const tokenResponse = await auth.api.getAccessToken({
		body: {
			providerId: "github",
		},
		headers: event.request.headers,
	});

	if (!tokenResponse?.accessToken) {
		error(401, "Failed to get GitHub token");
	}

	return tokenResponse.accessToken;
}

interface TreeItem {
	type: "file" | "dir";
	name: string;
	path: string;
}

async function getMarkdownFiles(
	octokit: Octokit,
	owner: string,
	repo: string,
	path: string = "",
): Promise<TreeItem[]> {
	const { data: contents } = await octokit.rest.repos.getContent({
		owner,
		repo,
		path,
	});

	if (!Array.isArray(contents)) {
		return [];
	}

	const results: TreeItem[] = [];

	for (const item of contents) {
		if (item.type === "dir") {
			const children = await getMarkdownFiles(octokit, owner, repo, item.path);
			if (children.length > 0) {
				results.push({
					type: "dir",
					name: item.name,
					path: item.path,
				});
				results.push(...children);
			}
		} else if (item.type === "file") {
			const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
				item.name.toLowerCase().endsWith(ext),
			);
			if (hasAllowedExtension) {
				results.push({
					type: "file",
					name: item.name,
					path: item.path,
				});
			}
		}
	}

	return results;
}

const repoParamsSchema = v.object({
	org: v.string(),
	repo: v.string(),
});

export const getRepoFiles = query(repoParamsSchema, async ({ org, repo }) => {
	const accessToken = await getGitHubToken();
	const octokit = new Octokit({ auth: accessToken });

	// Get repo info for default branch
	const { data: repoData } = await octokit.rest.repos.get({
		owner: org,
		repo,
	});

	const files = await getMarkdownFiles(octokit, org, repo);

	return {
		defaultBranch: repoData.default_branch,
		files,
	};
});

const createFileSchema = v.object({
	org: v.string(),
	repo: v.string(),
	path: v.pipe(v.string(), v.nonEmpty()),
	content: v.string(),
	message: v.pipe(v.string(), v.nonEmpty()),
});

export const createFile = command(
	createFileSchema,
	async ({ org, repo, path, content, message }) => {
		const accessToken = await getGitHubToken();
		const octokit = new Octokit({ auth: accessToken });

		// Get default branch
		const { data: repoData } = await octokit.rest.repos.get({
			owner: org,
			repo,
		});

		const { data } = await octokit.rest.repos.createOrUpdateFileContents({
			owner: org,
			repo,
			path,
			message,
			content: btoa(content),
			branch: repoData.default_branch,
		});

		// Refresh the file list
		await getRepoFiles({ org, repo }).refresh();

		return {
			sha: data.content?.sha,
			path: data.content?.path,
		};
	},
);
