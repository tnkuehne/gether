import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	GITHUB_APP_INSTALL_URL,
	hasGitHubAppInstalled,
	fetchFileContent,
	fetchGetherConfig,
	commitFile,
	checkWritePermission,
} from "../github-app";
import { Octokit } from "octokit";

// Environment variables are mocked via vitest.config.ts alias

describe("github-app", () => {
	describe("GITHUB_APP_INSTALL_URL", () => {
		it("should generate correct installation URL from app slug", () => {
			expect(GITHUB_APP_INSTALL_URL).toBe("https://github.com/apps/test-app/installations/new");
		});
	});

	describe("hasGitHubAppInstalled", () => {
		// Note: hasGitHubAppInstalled creates its own Octokit instance internally,
		// making it difficult to mock without module mocking. These tests verify
		// the function handles errors gracefully (returns false on any error).
		it("should return false when no valid token is provided", async () => {
			// With an invalid/empty token, the API call will fail
			const result = await hasGitHubAppInstalled("");
			expect(result).toBe(false);
		});
	});

	describe("fetchFileContent", () => {
		let mockOctokit: { rest: { repos: { getContent: ReturnType<typeof vi.fn> } } };

		beforeEach(() => {
			mockOctokit = {
				rest: {
					repos: {
						getContent: vi.fn(),
					},
				},
			};
		});

		it("should fetch and decode file content", async () => {
			const encodedContent = btoa("Hello, World!");
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
					html_url: "https://github.com/org/repo/blob/main/file.txt",
					download_url: "https://raw.githubusercontent.com/org/repo/main/file.txt",
					sha: "abc123",
					size: 13,
					name: "file.txt",
				},
			});

			const result = await fetchFileContent(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"file.txt",
				"main",
			);

			expect(result).toEqual({
				content: "Hello, World!",
				url: "https://github.com/org/repo/blob/main/file.txt",
				downloadUrl: "https://raw.githubusercontent.com/org/repo/main/file.txt",
				sha: "abc123",
				size: 13,
				name: "file.txt",
			});
		});

		it("should throw error when path is a directory", async () => {
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: [{ type: "file", name: "file1.txt" }],
			});

			await expect(
				fetchFileContent(mockOctokit as unknown as Octokit, "org", "repo", "directory", "main"),
			).rejects.toThrow("Path is a directory, not a file");
		});

		it("should throw error for invalid file type", async () => {
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					type: "symlink",
					target: "some-target",
				},
			});

			await expect(
				fetchFileContent(mockOctokit as unknown as Octokit, "org", "repo", "symlink", "main"),
			).rejects.toThrow("Invalid file type");
		});
	});

	describe("fetchGetherConfig", () => {
		let mockOctokit: { rest: { repos: { getContent: ReturnType<typeof vi.fn> } } };

		beforeEach(() => {
			mockOctokit = {
				rest: {
					repos: {
						getContent: vi.fn(),
					},
				},
			};
		});

		it("should fetch and parse gether.jsonc config", async () => {
			const config = {
				packageManager: "pnpm",
				root: ".",
				install: "pnpm install",
				dev: "pnpm dev",
				port: 3000,
			};
			const jsonContent = JSON.stringify(config);
			const encodedContent = btoa(jsonContent);

			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
				},
			});

			const result = await fetchGetherConfig(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"main",
			);

			expect(result).toEqual(config);
		});

		it("should strip JSONC comments and parse", async () => {
			const jsoncContent = `{
				// This is a comment
				"packageManager": "npm",
				"root": "./app", // inline comment
				"install": "npm install",
				"dev": "npm run dev",
				"port": 5173
			}`;
			const encodedContent = btoa(jsoncContent);

			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: {
					type: "file",
					content: encodedContent,
				},
			});

			const result = await fetchGetherConfig(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"main",
			);

			expect(result).toEqual({
				packageManager: "npm",
				root: "./app",
				install: "npm install",
				dev: "npm run dev",
				port: 5173,
			});
		});

		it("should return null when file does not exist", async () => {
			mockOctokit.rest.repos.getContent.mockRejectedValue(new Error("Not Found"));

			const result = await fetchGetherConfig(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"main",
			);

			expect(result).toBeNull();
		});

		it("should return null for non-file response", async () => {
			mockOctokit.rest.repos.getContent.mockResolvedValue({
				data: [{ type: "file", name: "other.json" }],
			});

			const result = await fetchGetherConfig(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"main",
			);

			expect(result).toBeNull();
		});
	});

	describe("commitFile", () => {
		let mockOctokit: { rest: { repos: { createOrUpdateFileContents: ReturnType<typeof vi.fn> } } };

		beforeEach(() => {
			mockOctokit = {
				rest: {
					repos: {
						createOrUpdateFileContents: vi.fn(),
					},
				},
			};
		});

		it("should commit file and return commit info", async () => {
			mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({
				data: {
					content: {
						sha: "new-file-sha",
					},
					commit: {
						sha: "commit-sha",
						html_url: "https://github.com/org/repo/commit/commit-sha",
					},
				},
			});

			const result = await commitFile(
				mockOctokit as unknown as Octokit,
				"org",
				"repo",
				"file.txt",
				"main",
				"New content",
				"Update file",
				"old-sha",
			);

			expect(result).toEqual({
				sha: "new-file-sha",
				commitSha: "commit-sha",
				commitUrl: "https://github.com/org/repo/commit/commit-sha",
			});

			expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
				owner: "org",
				repo: "repo",
				path: "file.txt",
				message: "Update file",
				content: btoa("New content"),
				sha: "old-sha",
				branch: "main",
			});
		});
	});

	describe("checkWritePermission", () => {
		let mockOctokit: {
			rest: {
				users: { getAuthenticated: ReturnType<typeof vi.fn> };
				repos: { getCollaboratorPermissionLevel: ReturnType<typeof vi.fn> };
			};
		};

		beforeEach(() => {
			mockOctokit = {
				rest: {
					users: {
						getAuthenticated: vi.fn(),
					},
					repos: {
						getCollaboratorPermissionLevel: vi.fn(),
					},
				},
			};
		});

		it("should return true when user is repo owner", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "owner" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "owner", "repo");

			expect(result).toBe(true);
		});

		it("should return true when user is repo owner (case insensitive)", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "Owner" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "OWNER", "repo");

			expect(result).toBe(true);
		});

		it("should return true when user has admin permission", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "collaborator" },
			});
			mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
				data: { permission: "admin" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(true);
		});

		it("should return true when user has write permission", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "collaborator" },
			});
			mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
				data: { permission: "write" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(true);
		});

		it("should return true when user has maintain permission", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "collaborator" },
			});
			mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
				data: { permission: "maintain" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(true);
		});

		it("should return false when user has only read permission", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "reader" },
			});
			mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
				data: { permission: "read" },
			});

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(false);
		});

		it("should return false when user is not a collaborator", async () => {
			mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
				data: { login: "outsider" },
			});
			mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(
				new Error("403 Forbidden"),
			);

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(false);
		});

		it("should return false when getAuthenticated fails", async () => {
			mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error("Unauthorized"));

			const result = await checkWritePermission(mockOctokit as unknown as Octokit, "org", "repo");

			expect(result).toBe(false);
		});
	});
});
