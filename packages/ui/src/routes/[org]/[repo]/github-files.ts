import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";

const ALLOWED_EXTENSIONS = [".md", ".mdx", ".svx"];

export interface TreeItem {
	type: "file" | "dir";
	name: string;
	path: string;
}

export async function getRepoFiles(
	owner: string,
	repo: string,
	branch: string,
): Promise<TreeItem[]> {
	const { data } = await authClient.getAccessToken({
		providerId: "github",
	});

	const accessToken = data?.accessToken;

	if (!accessToken) {
		throw new Error("Failed to get GitHub token");
	}

	const octokit = new Octokit({ auth: accessToken });

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
