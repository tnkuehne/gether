import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	fetchFileContent,
	fetchGetherConfig,
	commitFile,
	checkWritePermission,
	type GetherConfig,
} from "../github-app";
import type { Octokit } from "octokit";

// Mock Octokit type for testing
function createMockOctokit(overrides: {
	getContent?: ReturnType<typeof vi.fn>;
	createOrUpdateFileContents?: ReturnType<typeof vi.fn>;
	getAuthenticated?: ReturnType<typeof vi.fn>;
	getCollaboratorPermissionLevel?: ReturnType<typeof vi.fn>;
}) {
	return {
		rest: {
			repos: {
				getContent: overrides.getContent ?? vi.fn(),
				createOrUpdateFileContents: overrides.createOrUpdateFileContents ?? vi.fn(),
				getCollaboratorPermissionLevel: overrides.getCollaboratorPermissionLevel ?? vi.fn(),
			},
			users: {
				getAuthenticated: overrides.getAuthenticated ?? vi.fn(),
			},
		},
	} as unknown as Octokit;
}

describe("fetchFileContent", () => {
	it("fetches and decodes file content", async () => {
		const content = "Hello, World!";
		const encodedContent = btoa(content);

		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
					html_url: "https://github.com/org/repo/blob/main/test.md",
					download_url: "https://raw.githubusercontent.com/org/repo/main/test.md",
					sha: "abc123",
					size: 13,
					name: "test.md",
				},
			}),
		});

		const result = await fetchFileContent(mockOctokit, "org", "repo", "test.md", "main");

		expect(result.content).toBe(content);
		expect(result.sha).toBe("abc123");
		expect(result.name).toBe("test.md");
		expect(result.size).toBe(13);
	});

	it("throws error for directory path", async () => {
		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: [{ name: "file1.md" }, { name: "file2.md" }],
			}),
		});

		await expect(fetchFileContent(mockOctokit, "org", "repo", "docs", "main")).rejects.toThrow(
			"Path is a directory, not a file",
		);
	});

	it("throws error for non-file type", async () => {
		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: {
					type: "symlink",
					target: "other-file.md",
				},
			}),
		});

		await expect(fetchFileContent(mockOctokit, "org", "repo", "link.md", "main")).rejects.toThrow(
			"Invalid file type",
		);
	});
});

describe("fetchGetherConfig", () => {
	it("fetches and parses gether.jsonc config", async () => {
		const config: GetherConfig = {
			packageManager: "pnpm",
			root: ".",
			install: "pnpm install",
			dev: "pnpm dev",
			port: 3000,
		};
		const configContent = JSON.stringify(config);
		const encodedContent = btoa(configContent);

		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
				},
			}),
		});

		const result = await fetchGetherConfig(mockOctokit, "org", "repo", "main");

		expect(result).toEqual(config);
	});

	it("strips single-line comments from JSONC", async () => {
		const jsonc = `{
			// This is a comment
			"packageManager": "npm",
			"root": ".", // inline comment
			"install": "npm install",
			"dev": "npm run dev",
			"port": 3000
		}`;
		const encodedContent = btoa(jsonc);

		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
				},
			}),
		});

		const result = await fetchGetherConfig(mockOctokit, "org", "repo", "main");

		expect(result?.packageManager).toBe("npm");
		expect(result?.port).toBe(3000);
	});

	it("returns null when config file does not exist", async () => {
		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockRejectedValue(new Error("Not found")),
		});

		const result = await fetchGetherConfig(mockOctokit, "org", "repo", "main");

		expect(result).toBeNull();
	});

	it("returns null for directory response", async () => {
		const mockOctokit = createMockOctokit({
			getContent: vi.fn().mockResolvedValue({
				data: [{ name: "file.md" }],
			}),
		});

		const result = await fetchGetherConfig(mockOctokit, "org", "repo", "main");

		expect(result).toBeNull();
	});
});

describe("commitFile", () => {
	it("commits file content and returns commit info", async () => {
		const mockOctokit = createMockOctokit({
			createOrUpdateFileContents: vi.fn().mockResolvedValue({
				data: {
					content: { sha: "newsha123" },
					commit: {
						sha: "commitsha456",
						html_url: "https://github.com/org/repo/commit/commitsha456",
					},
				},
			}),
		});

		const result = await commitFile(
			mockOctokit,
			"org",
			"repo",
			"docs/test.md",
			"main",
			"Updated content",
			"Update test.md",
			"oldsha789",
		);

		expect(result.sha).toBe("newsha123");
		expect(result.commitSha).toBe("commitsha456");
		expect(result.commitUrl).toBe("https://github.com/org/repo/commit/commitsha456");

		expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
			owner: "org",
			repo: "repo",
			path: "docs/test.md",
			message: "Update test.md",
			content: btoa("Updated content"),
			sha: "oldsha789",
			branch: "main",
		});
	});
});

describe("checkWritePermission", () => {
	it("returns true when user is repo owner", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "owner" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "owner", "repo");

		expect(result).toBe(true);
	});

	it("returns true when user is repo owner (case insensitive)", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "Owner" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "owner", "repo");

		expect(result).toBe(true);
	});

	it("returns true when user has admin permission", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "contributor" },
			}),
			getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
				data: { permission: "admin" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(true);
	});

	it("returns true when user has write permission", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "contributor" },
			}),
			getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
				data: { permission: "write" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(true);
	});

	it("returns true when user has maintain permission", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "contributor" },
			}),
			getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
				data: { permission: "maintain" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(true);
	});

	it("returns false when user has read-only permission", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "reader" },
			}),
			getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
				data: { permission: "read" },
			}),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(false);
	});

	it("returns false when user is not a collaborator", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockResolvedValue({
				data: { login: "stranger" },
			}),
			getCollaboratorPermissionLevel: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(false);
	});

	it("returns false when authentication fails", async () => {
		const mockOctokit = createMockOctokit({
			getAuthenticated: vi.fn().mockRejectedValue(new Error("Unauthorized")),
		});

		const result = await checkWritePermission(mockOctokit, "org", "repo");

		expect(result).toBe(false);
	});
});
