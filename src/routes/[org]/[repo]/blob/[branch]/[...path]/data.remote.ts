import { query } from '$app/server';
import * as v from 'valibot';
import { Octokit } from 'octokit';
import { error } from '@sveltejs/kit';

const GitHubFileSchema = v.object({
	org: v.string(),
	repo: v.string(),
	branch: v.string(),
	path: v.string()
});

export const getFileContent = query(
	GitHubFileSchema,
	async ({ org, repo, branch, path }: v.InferOutput<typeof GitHubFileSchema>) => {
		const octokit = new Octokit({
			// You can add auth token here if needed for higher rate limits
			// auth: process.env.GITHUB_TOKEN
		});

		try {
			const { data } = await octokit.rest.repos.getContent({
				owner: org,
				repo: repo,
				path: path,
				ref: branch
			});

			// GitHub API returns base64 encoded content for files
			if ('content' in data && data.type === 'file') {
				const content = Buffer.from(data.content, 'base64').toString('utf-8');

				return {
					content,
					url: data.html_url,
					downloadUrl: data.download_url,
					sha: data.sha,
					size: data.size,
					name: data.name,
					org,
					repo,
					branch,
					path
				};
			}

			// Handle directory case
			if (Array.isArray(data)) {
				error(400, 'Path is a directory, not a file');
			}

			error(400, 'Invalid file type');
		} catch (err: any) {
			if (err.status === 404) {
				error(404, 'File not found');
			}
			if (err.status === 403) {
				error(403, 'Rate limit exceeded or access denied');
			}
			error(500, `Failed to fetch file: ${err.message}`);
		}
	}
);

export const getRepoMetadata = query(
	v.object({
		org: v.string(),
		repo: v.string()
	}),
	async ({ org, repo }: { org: string; repo: string }) => {
		const octokit = new Octokit();

		try {
			const { data } = await octokit.rest.repos.get({
				owner: org,
				repo: repo
			});

			return {
				name: data.name,
				fullName: data.full_name,
				description: data.description,
				defaultBranch: data.default_branch,
				isPrivate: data.private,
				stars: data.stargazers_count,
				forks: data.forks_count,
				language: data.language,
				updatedAt: data.updated_at,
				htmlUrl: data.html_url
			};
		} catch (err: any) {
			if (err.status === 404) {
				error(404, 'Repository not found');
			}
			error(500, `Failed to fetch repository: ${err.message}`);
		}
	}
);

export const getDirectoryContents = query(
	GitHubFileSchema,
	async ({ org, repo, branch, path }: v.InferOutput<typeof GitHubFileSchema>) => {
		const octokit = new Octokit();

		try {
			const { data } = await octokit.rest.repos.getContent({
				owner: org,
				repo: repo,
				path: path,
				ref: branch
			});

			if (Array.isArray(data)) {
				return data.map((item) => ({
					name: item.name,
					path: item.path,
					type: item.type,
					size: item.size,
					sha: item.sha,
					url: item.html_url
				}));
			}

			// Single file, return as array
			if ('content' in data) {
				return [
					{
						name: data.name,
						path: data.path,
						type: data.type,
						size: data.size,
						sha: data.sha,
						url: data.html_url
					}
				];
			}

			return [];
		} catch (err: any) {
			if (err.status === 404) {
				error(404, 'Directory not found');
			}
			error(500, `Failed to fetch directory: ${err.message}`);
		}
	}
);
