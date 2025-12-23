import { Octokit } from "octokit";
import { authClient } from "$lib/auth-client";

const ALLOWED_EXTENSIONS = [".md", ".mdx", ".svx"];

export interface TreeItem {
	type: "file" | "dir";
	name: string;
	path: string;
}

export function createFileDiscovery(owner: string, repo: string) {
	let files = $state<TreeItem[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let pendingDirs = $state(0);
	let octokit: Octokit | null = null;

	async function init() {
		try {
			const { data } = await authClient.getAccessToken({
				providerId: "github",
			});

			const accessToken = data?.accessToken;

			if (!accessToken) {
				throw new Error("Failed to get GitHub token");
			}

			octokit = new Octokit({ auth: accessToken });
			await exploreDirectory("");
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to initialize";
			isLoading = false;
		}
	}

	async function exploreDirectory(path: string) {
		if (!octokit) return;

		pendingDirs++;

		try {
			const { data: contents } = await octokit.rest.repos.getContent({
				owner,
				repo,
				path,
			});

			if (!Array.isArray(contents)) {
				pendingDirs--;
				if (pendingDirs === 0) isLoading = false;
				return;
			}

			const dirsToExplore: { name: string; path: string }[] = [];
			const newItems: TreeItem[] = [];

			for (const item of contents) {
				if (item.type === "dir") {
					dirsToExplore.push({ name: item.name, path: item.path });
				} else if (item.type === "file") {
					const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
						item.name.toLowerCase().endsWith(ext),
					);
					if (hasAllowedExtension) {
						newItems.push({
							type: "file",
							name: item.name,
							path: item.path,
						});
					}
				}
			}

			pendingDirs--;

			// Explore subdirectories in parallel, add dir entry only if it has markdown files
			const results = await Promise.all(
				dirsToExplore.map(async (dir) => {
					await exploreDirectory(dir.path);
					// Check if any files were added under this directory
					const hasFiles = files.some((f) => f.path.startsWith(dir.path + "/"));
					return { dir, hasFiles };
				}),
			);

			// Add directory entries for dirs that contain markdown files
			for (const { dir, hasFiles } of results) {
				if (hasFiles) {
					newItems.push({
						type: "dir",
						name: dir.name,
						path: dir.path,
					});
				}
			}

			// Add discovered items
			if (newItems.length > 0) {
				files = [...files, ...newItems].sort((a, b) => a.path.localeCompare(b.path));
			}
		} catch (err) {
			pendingDirs--;
			console.error(`Failed to explore ${path}:`, err);
		}

		if (pendingDirs === 0) {
			isLoading = false;
		}
	}

	// Start discovery
	init();

	return {
		get files() {
			return files;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
	};
}
