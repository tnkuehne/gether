import { render } from "vitest-browser-svelte";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import ContributionBanner from "../components/contribution/ContributionBanner.svelte";

describe("ContributionBanner", () => {
	const defaultProps = {
		org: "testorg",
		repo: "testrepo",
		branch: "feature-branch",
		path: "docs/readme.md",
		canEdit: true,
		isProtected: false,
		defaultBranch: "main",
		existingFork: null,
		existingPR: null,
		currentUser: "testuser",
		justCommitted: false,
		onCreateBranch: vi.fn(),
		onFork: vi.fn(),
		onCreatePR: vi.fn(),
	};

	describe("Read-only access", () => {
		it("shows fork option when user cannot edit", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					canEdit: false,
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("Read-only");
				expect(container.textContent).toContain("don't have write access");
			});

			const forkButton = container.querySelector("button");
			expect(forkButton?.textContent).toContain("Fork repository");
		});

		it("shows existing fork link when user has a fork", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					canEdit: false,
					existingFork: {
						owner: "testuser",
						repo: "testrepo",
						fullName: "testuser/testrepo",
						htmlUrl: "https://github.com/testuser/testrepo",
						defaultBranch: "main",
					},
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("Go to your fork");
			});
		});

		it("calls onFork when fork button is clicked", async () => {
			const onFork = vi.fn().mockResolvedValue({
				owner: "testuser",
				repo: "testrepo",
				fullName: "testuser/testrepo",
				htmlUrl: "https://github.com/testuser/testrepo",
				defaultBranch: "main",
			});

			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					canEdit: false,
					onFork,
				},
			});

			await vi.waitFor(() => {
				const forkButton = container.querySelector("button");
				expect(forkButton).not.toBeNull();
			});

			const forkButton = container.querySelector("button") as HTMLButtonElement;
			await userEvent.click(forkButton);

			await vi.waitFor(() => {
				expect(onFork).toHaveBeenCalled();
			});
		});
	});

	describe("Protected branch", () => {
		it("shows create branch option when on protected branch", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "main",
					isProtected: true,
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("Protected");
				expect(container.textContent).toContain("protected branch");
			});

			const branchButton = container.querySelector("button");
			expect(branchButton?.textContent).toContain("Create a branch");
		});

		it("opens branch creation dialog when button is clicked", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "main",
					isProtected: true,
				},
			});

			await vi.waitFor(() => {
				const branchButton = container.querySelector("button");
				expect(branchButton).not.toBeNull();
			});

			const branchButton = container.querySelector("button") as HTMLButtonElement;
			await userEvent.click(branchButton);

			await vi.waitFor(() => {
				// Dialog should be open
				expect(document.body.textContent).toContain("Create a new branch");
			});
		});
	});

	describe("PR creation", () => {
		it("shows PR option when on non-default branch with no existing PR", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("Editing on");
				expect(container.textContent).toContain("feature-branch");
				expect(container.textContent).toContain("Create PR");
			});
		});

		it("shows commit success message when justCommitted is true", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
					justCommitted: true,
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("Changes committed");
				expect(container.textContent).toContain("Create PR");
			});
		});

		it("does not show PR option when on default branch", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "main",
					canEdit: true,
					isProtected: false,
				},
			});

			// Should not contain PR-related text
			expect(container.textContent).not.toContain("Create PR");
		});

		it("shows existing PR info when there is an existing PR", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
					existingPR: {
						number: 123,
						title: "Add feature",
						body: "Description",
						htmlUrl: "https://github.com/testorg/testrepo/pull/123",
						state: "open" as const,
						draft: false,
						headRef: "feature-branch",
						baseRef: "main",
						headOwner: "testorg",
						baseOwner: "testorg",
					},
				},
			});

			await vi.waitFor(() => {
				expect(container.textContent).toContain("#123");
				expect(container.textContent).toContain("View PR");
			});
		});
	});

	describe("No banners shown", () => {
		it("shows no banner when user has edit access and branch is not protected", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "main",
					canEdit: true,
					isProtected: false,
				},
			});

			// No read-only or protected badge should be shown
			expect(container.textContent).not.toContain("Read-only");
			expect(container.textContent).not.toContain("Protected");
		});
	});

	describe("PR creation dialog", () => {
		it("opens PR dialog when Create PR button is clicked", async () => {
			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
				},
			});

			await vi.waitFor(() => {
				const prButton = Array.from(container.querySelectorAll("button")).find((btn) =>
					btn.textContent?.includes("Create PR"),
				);
				expect(prButton).not.toBeNull();
			});

			const prButton = Array.from(container.querySelectorAll("button")).find((btn) =>
				btn.textContent?.includes("Create PR"),
			) as HTMLButtonElement;
			await userEvent.click(prButton);

			await vi.waitFor(() => {
				expect(document.body.textContent).toContain("Create a pull request");
			});
		});

		it("calls onCreatePR with correct parameters", async () => {
			const onCreatePR = vi.fn().mockResolvedValue({
				number: 124,
				title: "Test PR",
				body: "Test description",
				htmlUrl: "https://github.com/testorg/testrepo/pull/124",
				state: "open" as const,
				draft: true,
				headRef: "feature-branch",
				baseRef: "main",
				headOwner: "testorg",
				baseOwner: "testorg",
			});

			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
					onCreatePR,
				},
			});

			// Open the dialog
			await vi.waitFor(() => {
				const prButton = Array.from(container.querySelectorAll("button")).find((btn) =>
					btn.textContent?.includes("Create PR"),
				);
				expect(prButton).not.toBeNull();
			});

			const prButton = Array.from(container.querySelectorAll("button")).find((btn) =>
				btn.textContent?.includes("Create PR"),
			) as HTMLButtonElement;
			await userEvent.click(prButton);

			await vi.waitFor(() => {
				expect(document.body.textContent).toContain("Create a pull request");
			});

			// Fill in the title
			const titleInput = document.querySelector('input[id="pr-title"]') as HTMLInputElement;
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "Test PR Title");

			// Click create button
			const createButton = Array.from(document.querySelectorAll("button")).find(
				(btn) => btn.textContent === "Create pull request",
			) as HTMLButtonElement;
			await userEvent.click(createButton);

			await vi.waitFor(() => {
				expect(onCreatePR).toHaveBeenCalledWith(
					expect.objectContaining({
						title: "Test PR Title",
						draft: true,
					}),
				);
			});
		});

		it("shows success message after PR is created", async () => {
			const onCreatePR = vi.fn().mockResolvedValue({
				number: 125,
				title: "New Feature",
				body: null,
				htmlUrl: "https://github.com/testorg/testrepo/pull/125",
				state: "open" as const,
				draft: false,
				headRef: "feature-branch",
				baseRef: "main",
				headOwner: "testorg",
				baseOwner: "testorg",
			});

			const { container } = render(ContributionBanner, {
				props: {
					...defaultProps,
					branch: "feature-branch",
					canEdit: true,
					onCreatePR,
				},
			});

			// Open the dialog
			const prButton = Array.from(container.querySelectorAll("button")).find((btn) =>
				btn.textContent?.includes("Create PR"),
			) as HTMLButtonElement;
			await userEvent.click(prButton);

			await vi.waitFor(() => {
				const titleInput = document.querySelector('input[id="pr-title"]') as HTMLInputElement;
				expect(titleInput).not.toBeNull();
			});

			// Fill in title and create
			const titleInput = document.querySelector('input[id="pr-title"]') as HTMLInputElement;
			await userEvent.clear(titleInput);
			await userEvent.type(titleInput, "New Feature");

			const createButton = Array.from(document.querySelectorAll("button")).find(
				(btn) => btn.textContent === "Create pull request",
			) as HTMLButtonElement;
			await userEvent.click(createButton);

			await vi.waitFor(() => {
				expect(document.body.textContent).toContain("Pull request created");
				expect(document.body.textContent).toContain("View on GitHub");
			});
		});
	});
});
