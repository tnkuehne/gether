<script lang="ts">
	import { Button, buttonVariants } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Field from "$lib/components/ui/field";
	import { Input } from "$lib/components/ui/input";
	import { Textarea } from "$lib/components/ui/textarea";
	import { onDestroy } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import CodeMirror, { type SelectionInfo } from "$lib/components/editor/CodeMirror.svelte";
	import FrontmatterEditor from "$lib/components/editor/FrontmatterEditor.svelte";
	import {
		updateContributionState,
		resetContributionState,
	} from "$lib/components/contribution/contribution-state.svelte";
	import { Octokit } from "octokit";
	import { authClient } from "$lib/auth-client";
	import {
		commitFile,
		getFileContentWithErrorHandling,
		checkWritePermission,
		hasGitHubAppInstalled,
		fetchGetherConfig,
		checkBranchProtection,
		getAuthenticatedUser,
		getUserFork,
		getExistingPullRequest,
		forkRepository,
		createBranch,
		createPullRequest,
		fetchPRComments,
		groupCommentsByLine,
		createPRComment,
		replyToPRComment,
		GITHUB_APP_INSTALL_URL,
		type FileData,
		type FileResult,
		type ForkInfo,
		type PullRequestInfo,
		type PRCommentThread,
	} from "$lib/github-app";
	import { getOctokit, getPublicOctokit, requireOctokit } from "$lib/github-auth";
	import { ResizablePaneGroup, ResizablePane, ResizableHandle } from "$lib/components/ui/resizable";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { ConnectionIndicator } from "$lib/components/ui/connection-indicator";
	import { Streamdown } from "svelte-streamdown";
	import Mermaid from "svelte-streamdown/mermaid";
	import posthog from "posthog-js";
	import { startPreview, getSandboxStatus, syncFileToSandbox } from "./sandbox.remote";
	import { parseFrontmatter, combineDocument, type FrontmatterField } from "$lib/frontmatter";

	// Helper functions that compose auth + lib functions
	async function getFileContent(
		org: string,
		repo: string,
		path: string,
		branch: string,
	): Promise<FileResult> {
		const auth = await getOctokit();
		const octokit = auth?.octokit ?? getPublicOctokit();
		return getFileContentWithErrorHandling(octokit, org, repo, path, branch, !!auth);
	}

	async function getCanEdit(org: string, repo: string): Promise<boolean> {
		const auth = await getOctokit();
		if (!auth) return false;
		try {
			return await checkWritePermission(auth.octokit, org, repo);
		} catch {
			return false;
		}
	}

	async function getHasGitHubApp(): Promise<boolean> {
		const auth = await getOctokit();
		if (!auth) return false;
		try {
			return await hasGitHubAppInstalled(auth.accessToken);
		} catch {
			return false;
		}
	}

	async function getGetherConfig(org: string, repo: string, branch: string) {
		const auth = await getOctokit();
		const octokit = auth?.octokit ?? getPublicOctokit();
		try {
			return await fetchGetherConfig(octokit, org, repo, branch);
		} catch {
			return null;
		}
	}

	async function getIsBranchProtected(org: string, repo: string, branch: string): Promise<boolean> {
		const auth = await getOctokit();
		if (!auth) return false;
		try {
			return await checkBranchProtection(auth.octokit, org, repo, branch);
		} catch {
			return false;
		}
	}

	async function getCurrentUser(): Promise<string | null> {
		const auth = await getOctokit();
		if (!auth) return null;
		try {
			return await getAuthenticatedUser(auth.octokit);
		} catch {
			return null;
		}
	}

	async function checkUserFork(org: string, repo: string): Promise<ForkInfo | null> {
		const auth = await getOctokit();
		if (!auth) return null;
		try {
			return await getUserFork(auth.octokit, org, repo);
		} catch {
			return null;
		}
	}

	async function checkExistingPR(
		org: string,
		repo: string,
		headBranch: string,
		headOwner?: string,
	): Promise<PullRequestInfo | null> {
		const auth = await getOctokit();
		if (!auth) return null;
		try {
			return await getExistingPullRequest(auth.octokit, org, repo, headBranch, headOwner);
		} catch {
			return null;
		}
	}

	async function doForkRepository(org: string, repo: string): Promise<ForkInfo> {
		const { octokit } = await requireOctokit();
		return forkRepository(octokit, org, repo);
	}

	async function doCreateBranch(
		org: string,
		repo: string,
		branchName: string,
		sourceBranch: string,
	): Promise<string> {
		const { octokit } = await requireOctokit();
		return createBranch(octokit, org, repo, branchName, sourceBranch);
	}

	async function doCreatePullRequest(
		org: string,
		repo: string,
		params: { title: string; body?: string; head: string; base: string; draft?: boolean },
	): Promise<PullRequestInfo> {
		const { octokit } = await requireOctokit();
		return createPullRequest(octokit, org, repo, params);
	}

	async function getPRCommentsForFile(
		org: string,
		repo: string,
		prNumber: number,
		filePath: string,
	): Promise<Map<number, PRCommentThread>> {
		const auth = await getOctokit();
		if (!auth) return new Map();
		try {
			const comments = await fetchPRComments(auth.octokit, org, repo, prNumber);
			return groupCommentsByLine(comments, filePath);
		} catch {
			return new Map();
		}
	}

	async function doCreatePRComment(
		org: string,
		repo: string,
		prNumber: number,
		params: { body: string; path: string; line: number; commitId: string; side?: "LEFT" | "RIGHT" },
	) {
		const { octokit } = await requireOctokit();
		return createPRComment(octokit, org, repo, prNumber, params);
	}

	async function doReplyToPRComment(
		org: string,
		repo: string,
		prNumber: number,
		commentId: number,
		body: string,
	) {
		const { octokit } = await requireOctokit();
		return replyToPRComment(octokit, org, repo, prNumber, commentId, body);
	}

	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();

	// All route parameters come from the load function to ensure they're available
	// immediately during client-side navigation (page.params may lag behind)
	let org = $derived(data.org);
	let repo = $derived(data.repo);
	let branch = $derived(data.branch);
	let path = $derived(data.path);
	let defaultBranch = $derived(data.defaultBranch);

	// Check if file is markdown (derived from path state)
	let isMarkdown = $derived(
		path?.endsWith(".md") ||
			path?.endsWith(".markdown") ||
			path?.endsWith(".mdx") ||
			path?.endsWith(".svx") ||
			false,
	);
	let showPreview = $state(true);
	let previewMode = $state<"markdown" | "live">("markdown");
	let mobileView = $state<"code" | "preview">("code");

	const session = authClient.useSession();

	// Fetch data using promises chained after init
	const filePromise = getFileContent(org!, repo!, data.path, data.branch);
	const canEditPromise = getCanEdit(org!, repo!);
	const getherConfigPromise = getGetherConfig(org!, repo!, data.branch);

	// Contribution workflow data promises
	const branchProtectedPromise = getIsBranchProtected(org!, repo!, data.branch);
	const currentUserPromise = getCurrentUser();
	const existingForkPromise = checkUserFork(org!, repo!);

	// Contribution workflow state
	let currentOrg = $state(org!);
	let currentRepo = $state(repo!);
	let currentBranch = $state<string>("");
	let canEdit = $state(false);
	let isProtected = $state(false);
	let currentUser = $state<string | null>(null);
	let existingFork = $state<ForkInfo | null>(null);
	let existingPR = $state<PullRequestInfo | null>(null);
	let justCommitted = $state(false);
	let contributionDataLoaded = $state(false);

	// Contribution workflow handlers (defined early for context setup)
	async function handleCreateBranch(branchName: string) {
		await doCreateBranch(currentOrg, currentRepo, branchName, currentBranch);
		// Navigate to the new branch (full reload to refresh all data)
		window.location.href = `/${currentOrg}/${currentRepo}/blob/${branchName}/${path}`;
	}

	async function handleFork(): Promise<ForkInfo> {
		const fork = await doForkRepository(org!, repo!);
		existingFork = fork;
		return fork;
	}

	async function handleCreatePR(params: {
		title: string;
		body: string;
		draft: boolean;
	}): Promise<PullRequestInfo> {
		if (!defaultBranch) throw new Error("Default branch not found");

		// For cross-repo PRs (forks), we need to include the owner
		const isFromFork = currentOrg !== org;
		const head = isFromFork ? `${currentOrg}:${currentBranch}` : currentBranch;

		const pr = await doCreatePullRequest(org!, repo!, {
			title: params.title,
			body: params.body || undefined,
			head,
			base: defaultBranch,
			draft: params.draft,
		});

		existingPR = pr;
		justCommitted = false;
		return pr;
	}

	// Update contribution state whenever relevant values change
	$effect(() => {
		updateContributionState({
			org: currentOrg,
			repo: currentRepo,
			branch: currentBranch,
			path: path ?? "",
			canEdit,
			isProtected,
			defaultBranch,
			currentUser,
			existingFork,
			existingPR,
			justCommitted,
			isLoaded: contributionDataLoaded,
			onCreateBranch: handleCreateBranch,
			onFork: handleFork,
			onCreatePR: handleCreatePR,
		});
	});

	// Reset contribution state on component destroy
	onDestroy(() => {
		resetContributionState();
	});

	// PR comments state
	let prComments = $state<Map<number, PRCommentThread>>(new Map());
	let selectedThread = $state<PRCommentThread | null>(null);
	let commentPopoverOpen = $state(false);

	// New comment state
	let replyText = $state("");
	let isSubmittingComment = $state(false);
	let commentError = $state<string | null>(null);
	let newCommentLine = $state<number | null>(null);
	let newCommentText = $state("");
	let isCreatingNewComment = $state(false);

	// Selection-based comment trigger
	let currentSelection = $state<SelectionInfo | null>(null);

	// Initialize currentBranch when parsing completes
	$effect(() => {
		if (branch) {
			currentBranch = branch;
		}
	});

	// Editor state - initialized when file loads
	let fileData = $state<FileData | null>(null);
	let content = $state("");
	let originalContent = $state("");
	let ws = $state<WebSocket | null>(null);
	let wsConnectionStatus = $state<"connected" | "connecting" | "disconnected">("disconnected");
	let isRemoteUpdate = $state(false);
	let lastValue = $state("");
	let hasStartedEditing = $state(false);

	// Frontmatter state
	let frontmatterFields = $state<FrontmatterField[]>([]);
	let hasFrontmatter = $state(false);
	let bodyContent = $state(""); // Content without frontmatter
	// Editor content - what's shown in CodeMirror (bodyContent when hasFrontmatter, else content)
	let editorContent = $state("");
	const remoteCursors = new SvelteMap<
		string,
		{ position: number; color: string; userName?: string }
	>();
	const remoteSelections = new SvelteMap<
		string,
		{ from: number; to: number; color: string; userName?: string }
	>();
	let myConnectionId = $state<string>("");
	let editorRef: ReturnType<typeof CodeMirror> | null = $state(null);
	let hasUnsavedChanges = $derived(content !== originalContent);

	// Commit dialog state
	let commitDialogOpen = $state(false);
	let signInPromptOpen = $state(false);
	let readOnlyPromptOpen = $state(false);
	let commitMessage = $state("");
	let isCommitting = $state(false);
	let commitError = $state<string | null>(null);

	// Live Preview state
	let sandboxStatus = $state<"idle" | "starting" | "running" | "error">("idle");
	let previewUrl = $state<string | null>(null);
	let sandboxError = $state<string | null>(null);

	// HMR file sync state
	let syncTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let isSyncing = $state(false);

	// Feature flag state for live preview
	let isLivePreviewEnabled = $state(false);

	// Check feature flag once PostHog flags are loaded
	$effect(() => {
		if ($session.data) {
			posthog.onFeatureFlags(() => {
				isLivePreviewEnabled = posthog.isFeatureEnabled("live-preview") ?? false;
			});
		}
	});

	const result = await filePromise;
	if (result.fileData) {
		fileData = result.fileData;
		content = result.fileData.content;
		originalContent = result.fileData.content;
		lastValue = result.fileData.content;

		// Parse frontmatter if present
		const parsed = parseFrontmatter(result.fileData.content);
		hasFrontmatter = parsed.hasFrontmatter;
		frontmatterFields = parsed.frontmatter;
		bodyContent = parsed.content;
		// Set editor content based on whether frontmatter exists
		editorContent = parsed.hasFrontmatter ? parsed.content : result.fileData.content;
	}

	// Watch for data changes (file switching via sidebar triggers load function re-run)
	let lastPath = $state<string | undefined>(undefined);
	$effect(() => {
		// Skip initial load
		if (lastPath === undefined) {
			lastPath = data.path;
			return;
		}

		// Skip if no change
		if (data.path === lastPath) {
			return;
		}

		lastPath = data.path;

		// Close existing WebSocket connection before switching files
		if (ws) {
			ws.onclose = null; // Prevent reconnect logic
			ws.close();
			ws = null;
		}

		// Clear remote cursors/selections from previous file
		remoteCursors.clear();
		remoteSelections.clear();

		// Reset comment state
		selectedThread = null;
		commentPopoverOpen = false;
		prComments = new Map();
		newCommentLine = null;
		newCommentText = "";

		// Reset editing tracking
		hasStartedEditing = false;

		// Fetch new file content
		getFileContent(org!, repo!, data.path, data.branch).then((fileResult) => {
			if (fileResult.fileData) {
				fileData = fileResult.fileData;
				content = fileResult.fileData.content;
				originalContent = fileResult.fileData.content;
				lastValue = fileResult.fileData.content;

				// Parse frontmatter if present
				const parsedFm = parseFrontmatter(fileResult.fileData.content);
				hasFrontmatter = parsedFm.hasFrontmatter;
				frontmatterFields = parsedFm.frontmatter;
				bodyContent = parsedFm.content;
				editorContent = parsedFm.hasFrontmatter ? parsedFm.content : fileResult.fileData.content;

				// Reconnect WebSocket for new file (will happen via the session effect)
			} else if (fileResult.error) {
				// Handle error - reset file data
				fileData = null;
				content = "";
				originalContent = "";
				lastValue = "";
				hasFrontmatter = false;
				frontmatterFields = [];
				bodyContent = "";
				editorContent = "";
			}
		});
	});

	// Initialize contribution workflow state
	$effect(() => {
		if ($session.data) {
			Promise.all([
				canEditPromise,
				branchProtectedPromise,
				currentUserPromise,
				existingForkPromise,
			]).then(async ([canEditResult, isProtectedResult, userResult, forkResult]) => {
				canEdit = canEditResult;
				isProtected = isProtectedResult;
				currentUser = userResult;
				existingFork = forkResult;

				// Check for existing PR if we're not on default branch
				if (defaultBranch && currentBranch !== defaultBranch) {
					const pr = await checkExistingPR(
						currentOrg,
						currentRepo,
						currentBranch,
						userResult ?? undefined,
					);
					existingPR = pr;
				}

				// Mark contribution data as loaded
				contributionDataLoaded = true;
			});
		}
	});

	// Fetch PR comments when we have an existing PR
	$effect(() => {
		if (existingPR && path && $session.data) {
			getPRCommentsForFile(org!, repo!, existingPR.number, path!).then((comments) => {
				prComments = comments;
			});
		}
	});

	// Comment click handler
	function handleCommentClick(thread: PRCommentThread) {
		selectedThread = thread;
		commentPopoverOpen = true;
		// Reset new comment state when viewing a thread
		newCommentLine = null;
		newCommentText = "";
	}

	// Reply to an existing comment thread
	async function handleReplyToComment(): Promise<void> {
		if (!replyText.trim() || !existingPR || !selectedThread || isSubmittingComment) return;

		isSubmittingComment = true;
		commentError = null;

		try {
			const firstComment = selectedThread.comments[0];
			const newComment = await doReplyToPRComment(
				org!,
				repo!,
				existingPR.number,
				firstComment.id,
				replyText.trim(),
			);

			// Add the new comment to the thread
			selectedThread.comments = [...selectedThread.comments, newComment];
			replyText = "";

			// Refresh comments to update the map
			const comments = await getPRCommentsForFile(org!, repo!, existingPR.number, path!);
			prComments = comments;
		} catch (err: unknown) {
			const error = err as { message?: string };
			commentError = error.message || "Failed to post reply";
		} finally {
			isSubmittingComment = false;
		}
	}

	// Create a new comment on a specific line
	async function handleCreateNewComment(): Promise<void> {
		if (!newCommentText.trim() || !existingPR || newCommentLine === null || isCreatingNewComment)
			return;

		isCreatingNewComment = true;
		commentError = null;

		try {
			await doCreatePRComment(org!, repo!, existingPR.number, {
				body: newCommentText.trim(),
				path: path!,
				line: newCommentLine,
				commitId: existingPR.headSha,
			});

			newCommentText = "";
			newCommentLine = null;

			// Refresh comments
			const comments = await getPRCommentsForFile(org!, repo!, existingPR.number, path!);
			prComments = comments;
		} catch (err: unknown) {
			const error = err as { message?: string };
			commentError = error.message || "Failed to create comment";
		} finally {
			isCreatingNewComment = false;
		}
	}

	// Handle selection change for floating comment button
	function handleSelectionChange(selection: SelectionInfo | null) {
		currentSelection = selection;
	}

	// Open new comment dialog from floating button
	function handleAddCommentFromSelection() {
		if (!currentSelection) return;
		newCommentLine = currentSelection.line;
		newCommentText = "";
		commentError = null;
		currentSelection = null;
		// Close any existing thread view
		selectedThread = null;
		commentPopoverOpen = false;
	}

	// Check sandbox status when config loads
	$effect(() => {
		if ($session.data && isLivePreviewEnabled) {
			getherConfigPromise.then((config) => {
				if (config) {
					checkSandboxStatus(config);
				}
			});
		}
	});

	// Debounced file sync for HMR
	function scheduleSyncToSandbox(newContent: string) {
		// Only sync if sandbox is running
		if (sandboxStatus !== "running") return;

		// Clear existing timeout
		if (syncTimeoutId) {
			clearTimeout(syncTimeoutId);
		}

		// Debounce: wait 300ms after last change before syncing
		syncTimeoutId = setTimeout(async () => {
			isSyncing = true;
			try {
				const result = await syncFileToSandbox({
					org: org!,
					repo: repo!,
					branch: branch!,
					filePath: path!,
					content: newContent,
				});

				if (!result.success) {
					console.error("Failed to sync file to sandbox:", result.error);
				}
			} catch (err) {
				console.error("Error syncing file to sandbox:", err);
			} finally {
				isSyncing = false;
			}
		}, 300);
	}

	$effect(() => {
		// Re-connect when session becomes available (if not already connected)
		if (fileData && $session.data && !ws) {
			connect();
		}
	});

	function connect() {
		if (!fileData) return;

		// Only connect if user is logged in
		if (!$session.data) return;

		// Close existing connection before creating a new one
		if (ws) {
			ws.onclose = null; // Prevent reconnect logic
			ws.close();
			ws = null;
		}

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}/${org}/${repo}/blob/${branch}/${path}/ws`;

		wsConnectionStatus = "connecting";
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			wsConnectionStatus = "connected";
			ws?.send(JSON.stringify({ type: "init", content: content }));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case "init": {
					if (data.connectionId) {
						myConnectionId = data.connectionId;
					}

					// Sync to server content if it differs (collaborative changes on reload)
					if (data.content !== undefined && data.content !== content) {
						isRemoteUpdate = true;
						content = data.content;
						lastValue = data.content;

						// Update all editor state to reflect server content
						const parsed = parseFrontmatter(data.content);
						hasFrontmatter = parsed.hasFrontmatter;
						frontmatterFields = parsed.frontmatter;
						bodyContent = parsed.content;
						editorContent = parsed.hasFrontmatter ? parsed.content : data.content;

						isRemoteUpdate = false;
					}
					break;
				}

				case "change": {
					// Skip our own changes
					if (data.connectionId && data.connectionId === myConnectionId) {
						break;
					}

					const { from, to, insert } = data.changes;
					// Apply incremental change directly to CodeMirror
					// This also updates the bound content value
					editorRef?.applyRemoteChange({ from, to, insert });
					lastValue = content;

					// Sync remote changes to sandbox for HMR
					scheduleSyncToSandbox(content);
					break;
				}

				case "cursor": {
					if (
						data.position !== undefined &&
						data.connectionId &&
						data.connectionId !== myConnectionId
					) {
						const color = getCursorColor(data.connectionId);
						remoteCursors.set(data.connectionId, {
							position: data.position,
							color,
							userName: data.userName,
						});

						// If selection data is included
						if (data.selection && data.selection.from !== data.selection.to) {
							remoteSelections.set(data.connectionId, {
								from: data.selection.from,
								to: data.selection.to,
								color,
								userName: data.userName,
							});
						} else {
							// No selection, remove it
							remoteSelections.delete(data.connectionId);
						}
					}
					break;
				}

				case "cursor-leave": {
					if (data.connectionId) {
						remoteCursors.delete(data.connectionId);
						remoteSelections.delete(data.connectionId);
					}
					break;
				}
			}
		};

		ws.onclose = () => {
			wsConnectionStatus = "disconnected";
			// Only reconnect if still logged in
			if ($session.data) {
				setTimeout(connect, 2000);
			}
		};

		ws.onerror = (error) => {
			wsConnectionStatus = "disconnected";
			console.error("WebSocket error:", error);
		};
	}

	function handleEditorChange(newValue: string) {
		if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		// Capture PostHog event when user starts editing
		if (!hasStartedEditing) {
			hasStartedEditing = true;
			posthog.capture("file_edit_started", {
				fileType: path?.split(".").pop(),
			});
		}

		// Simple diff: find where the change occurred
		let from = 0;
		while (
			from < lastValue.length &&
			from < newValue.length &&
			lastValue[from] === newValue[from]
		) {
			from++;
		}

		let lastEnd = lastValue.length;
		let newEnd = newValue.length;
		while (lastEnd > from && newEnd > from && lastValue[lastEnd - 1] === newValue[newEnd - 1]) {
			lastEnd--;
			newEnd--;
		}

		const insert = newValue.slice(from, newEnd);

		// Send change
		ws.send(
			JSON.stringify({
				type: "change",
				changes: { from, to: lastEnd, insert },
			}),
		);

		lastValue = newValue;

		// Sync to sandbox for HMR if preview is running
		scheduleSyncToSandbox(newValue);
	}

	function handleCursorChange(position: number, selection?: { from: number; to: number }) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		ws.send(
			JSON.stringify({
				type: "cursor",
				position,
				selection,
				userName: $session.data?.user.name,
			}),
		);
	}

	function handleFrontmatterChange(fields: FrontmatterField[]) {
		frontmatterFields = fields;
		// Recombine the document with updated frontmatter
		const newContent = combineDocument(fields, bodyContent);
		content = newContent;
		lastValue = newContent;

		// Broadcast the change to other connected clients
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(
				JSON.stringify({
					type: "change",
					changes: { from: 0, to: lastValue.length, insert: newContent },
				}),
			);
		}

		// Sync to sandbox for HMR if preview is running
		scheduleSyncToSandbox(newContent);
	}

	function handleEditorContentChange(newEditorContent: string) {
		editorContent = newEditorContent;
		// Recombine the document with updated body content
		if (hasFrontmatter) {
			bodyContent = newEditorContent;
			const newContent = combineDocument(frontmatterFields, newEditorContent);
			content = newContent;
		} else {
			content = newEditorContent;
		}
	}

	function getCursorColor(connectionId: string): string {
		const colors = [
			"rgba(59, 130, 246, 0.8)", // blue
			"rgba(239, 68, 68, 0.8)", // red
			"rgba(16, 185, 129, 0.8)", // green
			"rgba(245, 158, 11, 0.8)", // orange
			"rgba(139, 92, 246, 0.8)", // purple
			"rgba(236, 72, 153, 0.8)", // pink
			"rgba(20, 184, 166, 0.8)", // teal
		];

		let hash = 0;
		for (let i = 0; i < connectionId.length; i++) {
			hash = connectionId.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	function handleEditBlocked() {
		if (!$session.data) {
			// User is not logged in
			signInPromptOpen = true;
		} else if (!canEdit) {
			// User is logged in but doesn't have write permission
			readOnlyPromptOpen = true;
		}
	}

	function handleReset() {
		if (
			confirm(
				"Are you sure you want to reset to the original GitHub content? All unsaved changes will be lost.",
			)
		) {
			isRemoteUpdate = true;
			content = originalContent;
			lastValue = originalContent;

			// Re-parse frontmatter from original content
			const parsed = parseFrontmatter(originalContent);
			hasFrontmatter = parsed.hasFrontmatter;
			frontmatterFields = parsed.frontmatter;
			bodyContent = parsed.content;
			editorContent = parsed.hasFrontmatter ? parsed.content : originalContent;

			isRemoteUpdate = false;

			// Broadcast the reset to other connected clients
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(
					JSON.stringify({
						type: "change",
						changes: { from: 0, to: lastValue.length, insert: originalContent },
					}),
				);
			}
		}
	}

	async function handleCommit() {
		let accessToken;

		try {
			const response = await authClient.getAccessToken({ providerId: "github" });
			accessToken = response.data.accessToken;
		} catch (error) {
			console.error("Error getting access token:", error);
			return;
		}

		if (!accessToken || !fileData || !commitMessage.trim()) {
			return;
		}

		isCommitting = true;
		commitError = null;

		try {
			const octokit = new Octokit({ auth: accessToken });
			const result = await commitFile(
				octokit,
				currentOrg,
				currentRepo,
				path!,
				currentBranch,
				content,
				commitMessage.trim(),
				fileData.sha,
			);

			// Update file data with new SHA
			fileData.sha = result.sha!;
			originalContent = content;
			commitMessage = "";
			commitDialogOpen = false;

			// Track that we just committed for PR prompt
			if (defaultBranch && currentBranch !== defaultBranch && !existingPR) {
				justCommitted = true;
			}
		} catch (err: unknown) {
			const error = err as { status?: number; message?: string };
			if (error.status === 409) {
				commitError =
					"Conflict: The file has been modified on GitHub. Please refresh and try again.";
			} else if (error.status === 422) {
				commitError = "The file content is unchanged or the commit message is invalid.";
			} else {
				commitError = error.message || "Failed to commit changes";
			}
		} finally {
			isCommitting = false;
		}
	}

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
		if (syncTimeoutId) {
			clearTimeout(syncTimeoutId);
		}
	});

	async function startLivePreview(config: import("$lib/github-app").GetherConfig) {
		sandboxStatus = "starting";
		sandboxError = null;

		try {
			const result = await startPreview({
				org: org!,
				repo: repo!,
				branch: branch!,
				config,
			});

			if (result.success) {
				sandboxStatus = "running";
				previewUrl = result.previewUrl;
				// Automatically show preview pane and switch to live mode
				showPreview = true;
				previewMode = "live";
			} else {
				sandboxStatus = "error";
				sandboxError = result.error || "Failed to start preview";
			}
		} catch (err: unknown) {
			sandboxStatus = "error";
			sandboxError = err instanceof Error ? err.message : "Failed to start preview";
		}
	}

	async function checkSandboxStatus(config: import("$lib/github-app").GetherConfig) {
		try {
			const result = await getSandboxStatus({
				org: org!,
				repo: repo!,
				branch: branch!,
				port: config.port,
			});

			if (result.success && result.status === "running") {
				sandboxStatus = "running";
				previewUrl = result.previewUrl ?? null;
				// Show preview pane if sandbox is already running
				showPreview = true;
			}
		} catch {
			// Ignore errors on status check
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">
	{#await filePromise}
		<!-- Loading skeleton -->
		<div class="flex shrink-0 items-center gap-2 border-b px-4 py-2">
			<Skeleton class="h-8 w-20" />
			<Skeleton class="h-8 w-16" />
		</div>
		<div class="flex-1 p-4">
			<Skeleton class="mb-2 h-4 w-full" />
			<Skeleton class="mb-2 h-4 w-full" />
			<Skeleton class="mb-2 h-4 w-3/4" />
			<Skeleton class="mb-2 h-4 w-full" />
			<Skeleton class="mb-2 h-4 w-5/6" />
			<Skeleton class="mb-2 h-4 w-full" />
			<Skeleton class="mb-2 h-4 w-2/3" />
			<Skeleton class="h-4 w-full" />
		</div>
	{:then fileResult}
		{#if fileResult.error}
			{#if !$session.data && fileResult.error.toLowerCase().includes("not found")}
				<!-- Private repo - show sign in prompt for unauthenticated users -->
				<div class="flex flex-col items-center justify-center py-8 sm:py-12">
					<div class="flex max-w-md flex-col items-center gap-4 text-center">
						<div class="rounded-full bg-muted p-4">
							<CircleAlert class="size-8 text-muted-foreground" />
						</div>
						<div class="space-y-2">
							<h2 class="text-xl font-semibold">Private Repository</h2>
							<p class="text-muted-foreground">
								This repository may be private. Sign in with GitHub to access it.
							</p>
						</div>
						<Button
							onclick={async () => {
								await authClient.signIn.social({
									provider: "github",
									callbackURL: window.location.href,
								});
							}}
						>
							Sign in with GitHub
						</Button>
					</div>
				</div>
			{:else}
				<!-- Show error message for authenticated users or other errors -->
				<div class="p-4">
					<div class="rounded-lg border border-destructive bg-destructive/10 p-4">
						<h2 class="text-xl font-semibold text-destructive">Failed to load file</h2>
						<p class="mt-2 text-destructive">{fileResult.error}</p>
						{#if fileResult.needsGitHubApp}
							{#await getHasGitHubApp() then hasGitHubApp}
								<div class="mt-4 space-y-2">
									<p class="text-sm text-muted-foreground">
										{#if hasGitHubApp}
											The GitHub App is installed but doesn't have access to this repository. Click
											below to add this repository to your installation.
										{:else}
											Install our GitHub App to access private repositories with fine-grained
											permissions. You can select which specific repositories to grant access to.
										{/if}
									</p>
									<Button
										onclick={async () => {
											const response = await authClient.signIn.social({
												provider: "github",
												callbackURL: window.location.href,
												disableRedirect: true,
											});

											if (response?.data.url) {
												const oauthUrl = new URL(response.data.url);
												const state = oauthUrl.searchParams.get("state");

												window.location.href = `${GITHUB_APP_INSTALL_URL}?state=${state}`;
											}
										}}
									>
										{hasGitHubApp ? "Configure GitHub App" : "Install GitHub App"}
									</Button>
								</div>
							{/await}
						{/if}
					</div>
				</div>
			{/if}
		{:else if fileResult.fileData}
			<!-- Toolbar -->
			<div class="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
				{#if isMarkdown || sandboxStatus === "running"}
					<!-- Mobile: toggle between code and preview -->
					<div class="flex items-center rounded-md border sm:hidden">
						<Button
							onclick={() => {
								mobileView = "code";
							}}
							variant={mobileView === "code" ? "secondary" : "ghost"}
							size="sm"
							class="rounded-r-none border-0"
						>
							Code
						</Button>
						<Separator orientation="vertical" class="h-6" />
						<Button
							onclick={() => {
								mobileView = "preview";
							}}
							variant={mobileView === "preview" ? "secondary" : "ghost"}
							size="sm"
							class="rounded-l-none border-0"
						>
							Preview
						</Button>
					</div>
					<!-- Desktop: show/hide preview pane -->
					<Button
						onclick={() => {
							showPreview = !showPreview;
						}}
						variant={showPreview ? "secondary" : "ghost"}
						size="sm"
						title={showPreview ? "Hide preview" : "Show preview"}
						class="hidden sm:inline-flex"
					>
						{showPreview ? "Hide Preview" : "Show Preview"}
					</Button>
				{/if}
				{#if showPreview && sandboxStatus === "running" && isMarkdown}
					<div class="flex items-center rounded-md border">
						<Button
							onclick={() => {
								previewMode = "markdown";
							}}
							variant={previewMode === "markdown" ? "secondary" : "ghost"}
							size="sm"
							class="rounded-r-none border-0"
						>
							Markdown
						</Button>
						<Separator orientation="vertical" class="h-6" />
						<Button
							onclick={() => {
								previewMode = "live";
							}}
							variant={previewMode === "live" ? "secondary" : "ghost"}
							size="sm"
							class="rounded-l-none border-0"
						>
							Live
							{#if isSyncing}
								<span class="ml-1 text-xs text-muted-foreground">...</span>
							{/if}
						</Button>
					</div>
				{/if}
				{#await canEditPromise then canEdit}
					{#if canEdit}
						<Button
							onclick={() => {
								commitDialogOpen = true;
							}}
							disabled={!hasUnsavedChanges}
							size="sm"
							title={hasUnsavedChanges ? "Commit changes to GitHub" : "No changes to commit"}
						>
							Commit
						</Button>
						<Button
							onclick={handleReset}
							disabled={!hasUnsavedChanges}
							variant="ghost"
							size="sm"
							title={hasUnsavedChanges ? "Reset to original GitHub content" : "No changes to reset"}
						>
							Reset
						</Button>
					{/if}
				{/await}

				{#if $session.data && isLivePreviewEnabled}
					{#await getherConfigPromise then getherConfig}
						<Separator orientation="vertical" class="h-6" />
						{#if !getherConfig}
							<Tooltip.Root>
								<Tooltip.Trigger
									class="{buttonVariants({
										variant: 'outline',
										size: 'sm',
									})} cursor-not-allowed opacity-50"
								>
									Live Preview
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>
										Add <code class="rounded bg-muted px-1 text-muted-foreground">gether.jsonc</code
										> to enable.
									</p>
									<a
										href="https://github.com/tnkuehne/gether#live-preview"
										target="_blank"
										rel="noopener noreferrer"
										class="text-secondary underline"
									>
										Learn more
									</a>
								</Tooltip.Content>
							</Tooltip.Root>
						{:else if sandboxStatus === "idle"}
							<Button onclick={() => startLivePreview(getherConfig)} variant="outline" size="sm"
								>Start Live Preview</Button
							>
						{:else if sandboxStatus === "starting"}
							<Button disabled variant="outline" size="sm">Starting sandbox...</Button>
						{:else if sandboxStatus === "running" && previewUrl}
							{#if isSyncing && !isMarkdown}
								<span class="text-xs text-muted-foreground">Syncing...</span>
							{/if}
							<a
								href={previewUrl}
								target="_blank"
								rel="noopener noreferrer"
								class={buttonVariants({ variant: "ghost", size: "sm" })}
								title="Open live preview in new tab"
							>
								Open Preview
							</a>
						{:else if sandboxStatus === "error"}
							<Button
								onclick={() => startLivePreview(getherConfig)}
								variant="destructive"
								size="sm"
								title={sandboxError || "Error"}
							>
								Retry Preview
							</Button>
						{/if}
					{/await}
				{/if}

				<!-- Connection status indicator (shown for logged-in users) -->
				{#if $session.data}
					<div class="ml-auto">
						<ConnectionIndicator status={wsConnectionStatus} />
					</div>
				{/if}
			</div>

			<!-- Editor content -->
			<div class="min-h-0 flex-1 overflow-hidden">
				{#if showPreview && (isMarkdown || sandboxStatus === "running")}
					<!-- Desktop: side-by-side resizable panes -->
					<div class="hidden h-full sm:block">
						<ResizablePaneGroup direction="horizontal" class="h-full">
							<ResizablePane defaultSize={50} minSize={30}>
								<div class="flex h-full flex-col overflow-hidden">
									{#await canEditPromise then canEdit}
										{#if hasFrontmatter}
											<FrontmatterEditor
												bind:fields={frontmatterFields}
												readonly={!$session.data || !canEdit}
												onchange={handleFrontmatterChange}
											/>
										{/if}
										<div class="min-h-0 flex-1 overflow-auto">
											<CodeMirror
												bind:this={editorRef}
												bind:value={editorContent}
												onchange={(newValue) => {
													handleEditorContentChange(newValue);
													handleEditorChange(
														hasFrontmatter
															? combineDocument(frontmatterFields, newValue)
															: newValue,
													);
												}}
												oncursorchange={handleCursorChange}
												oneditblocked={handleEditBlocked}
												remoteCursors={Array.from(remoteCursors.values())}
												remoteSelections={Array.from(remoteSelections.values())}
												{prComments}
												onCommentClick={handleCommentClick}
												onselectionchange={handleSelectionChange}
												canAddComments={!!existingPR && !!$session.data}
												readonly={!$session.data || !canEdit}
											/>
										</div>
									{/await}
								</div>
							</ResizablePane>
							<ResizableHandle withHandle />
							<ResizablePane defaultSize={50} minSize={30}>
								{#if previewMode === "live" && sandboxStatus === "running" && previewUrl}
									<iframe
										src={previewUrl}
										title="Live Preview"
										class="h-full w-full border-0"
										sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
									></iframe>
								{:else if isMarkdown}
									<div class="h-full overflow-auto bg-background p-6">
										<Streamdown
											content={hasFrontmatter ? bodyContent : content}
											baseTheme="shadcn"
											components={{ mermaid: Mermaid }}
										/>
									</div>
								{:else if sandboxStatus === "running" && previewUrl}
									<iframe
										src={previewUrl}
										title="Live Preview"
										class="h-full w-full border-0"
										sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
									></iframe>
								{/if}
							</ResizablePane>
						</ResizablePaneGroup>
					</div>
					<!-- Mobile: toggle between code and preview -->
					<div class="h-full overflow-hidden sm:hidden">
						{#if mobileView === "code"}
							<div class="flex h-full flex-col overflow-hidden">
								{#await canEditPromise then canEdit}
									{#if hasFrontmatter}
										<FrontmatterEditor
											bind:fields={frontmatterFields}
											readonly={!$session.data || !canEdit}
											onchange={handleFrontmatterChange}
										/>
									{/if}
									<div class="min-h-0 flex-1 overflow-auto">
										<CodeMirror
											bind:this={editorRef}
											bind:value={editorContent}
											onchange={(newValue) => {
												handleEditorContentChange(newValue);
												handleEditorChange(
													hasFrontmatter ? combineDocument(frontmatterFields, newValue) : newValue,
												);
											}}
											oncursorchange={handleCursorChange}
											oneditblocked={handleEditBlocked}
											remoteCursors={Array.from(remoteCursors.values())}
											remoteSelections={Array.from(remoteSelections.values())}
											{prComments}
											onCommentClick={handleCommentClick}
											onselectionchange={handleSelectionChange}
											canAddComments={!!existingPR && !!$session.data}
											readonly={!$session.data || !canEdit}
										/>
									</div>
								{/await}
							</div>
						{:else if previewMode === "live" && sandboxStatus === "running" && previewUrl}
							<iframe
								src={previewUrl}
								title="Live Preview"
								class="h-full w-full border-0"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
							></iframe>
						{:else if isMarkdown}
							<div class="h-full overflow-auto bg-background p-4">
								<Streamdown
									content={hasFrontmatter ? bodyContent : content}
									baseTheme="shadcn"
									components={{ mermaid: Mermaid }}
								/>
							</div>
						{:else if sandboxStatus === "running" && previewUrl}
							<iframe
								src={previewUrl}
								title="Live Preview"
								class="h-full w-full border-0"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
							></iframe>
						{/if}
					</div>
				{:else}
					<div class="flex h-full flex-col overflow-hidden">
						{#await canEditPromise then canEdit}
							{#if hasFrontmatter}
								<FrontmatterEditor
									bind:fields={frontmatterFields}
									readonly={!$session.data || !canEdit}
									onchange={handleFrontmatterChange}
								/>
							{/if}
							<div class="min-h-0 flex-1 overflow-auto">
								<CodeMirror
									bind:this={editorRef}
									bind:value={editorContent}
									onchange={(newValue) => {
										handleEditorContentChange(newValue);
										handleEditorChange(
											hasFrontmatter ? combineDocument(frontmatterFields, newValue) : newValue,
										);
									}}
									oncursorchange={handleCursorChange}
									oneditblocked={handleEditBlocked}
									remoteCursors={Array.from(remoteCursors.values())}
									remoteSelections={Array.from(remoteSelections.values())}
									{prComments}
									onCommentClick={handleCommentClick}
									onselectionchange={handleSelectionChange}
									canAddComments={!!existingPR && !!$session.data}
									readonly={!$session.data || !canEdit}
								/>
							</div>
						{/await}
					</div>
				{/if}
			</div>
		{/if}
	{/await}
</div>

<!-- PR Comment Thread Popover -->
{#if selectedThread && commentPopoverOpen}
	<div
		class="fixed top-20 right-4 z-50 max-h-[calc(100vh-120px)] w-96 overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-md"
		role="dialog"
	>
		<div class="border-b bg-muted/30 px-4 py-2">
			<div class="flex items-center gap-2 text-sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-4"
				>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
				</svg>
				<span class="font-medium">
					{selectedThread.comments.length} comment{selectedThread.comments.length > 1 ? "s" : ""}
				</span>
				<span class="ml-auto rounded-md bg-secondary px-2 py-1 text-xs">
					{selectedThread.isFileLevel ? "File comment" : `Line ${selectedThread.line}`}
				</span>
				<button
					onclick={() => {
						commentPopoverOpen = false;
						selectedThread = null;
					}}
					class="ml-2 rounded-sm opacity-70 hover:opacity-100"
					aria-label="Close comment thread"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4"
					>
						<path d="M18 6 6 18"></path>
						<path d="m6 6 12 12"></path>
					</svg>
				</button>
			</div>
		</div>

		<div class="divide-y">
			{#each selectedThread.comments as comment (comment.id)}
				<div class="p-4">
					<div class="mb-2 flex items-start gap-3">
						<img
							src={comment.user.avatar_url}
							alt={comment.user.login}
							class="size-8 rounded-full"
						/>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium">{comment.user.login}</span>
								<span class="text-xs text-muted-foreground">
									{new Date(comment.created_at).toLocaleDateString()}
								</span>
							</div>
						</div>
					</div>
					<div class="ml-11 text-sm break-words whitespace-pre-wrap">
						{comment.body}
					</div>
				</div>
			{/each}
		</div>

		{#if $session.data && existingPR}
			<div class="border-t bg-muted/10 p-3">
				<Textarea
					bind:value={replyText}
					placeholder="Write a reply..."
					class="min-h-[60px] resize-none text-sm"
					onkeydown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
							e.preventDefault();
							handleReplyToComment();
						}
					}}
				/>
				{#if commentError}
					<p class="mt-1 text-xs text-destructive">{commentError}</p>
				{/if}
				<div class="mt-2 flex items-center justify-between">
					<a
						href={selectedThread.comments[0].html_url}
						target="_blank"
						rel="noopener noreferrer external"
						data-sveltekit-reload
						class="text-xs text-blue-600 hover:underline dark:text-blue-400"
					>
						View on GitHub →
					</a>
					<Button
						onclick={handleReplyToComment}
						disabled={!replyText.trim() || isSubmittingComment}
						size="sm"
					>
						{isSubmittingComment ? "Sending..." : "Reply"}
					</Button>
				</div>
			</div>
		{:else}
			<div class="border-t bg-muted/10 px-4 py-2">
				<a
					href={selectedThread.comments[0].html_url}
					target="_blank"
					rel="noopener noreferrer external"
					data-sveltekit-reload
					class="text-xs text-blue-600 hover:underline dark:text-blue-400"
				>
					View on GitHub →
				</a>
			</div>
		{/if}
	</div>
{/if}

<!-- Floating Add Comment Button -->
{#if currentSelection && existingPR && $session.data}
	<button
		onclick={handleAddCommentFromSelection}
		class="fixed z-50 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
		style="top: {currentSelection.coords.bottom + 8}px; left: {currentSelection.coords.left}px;"
		aria-label="Add comment on line {currentSelection.line}"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
		</svg>
		Comment
	</button>
{/if}

<!-- New Comment Dialog -->
{#if newCommentLine !== null && existingPR && $session.data}
	<div
		class="fixed top-20 right-4 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-md"
		role="dialog"
	>
		<div class="border-b bg-muted/30 px-4 py-2">
			<div class="flex items-center gap-2 text-sm">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="size-4"
				>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
				</svg>
				<span class="font-medium">New Comment</span>
				<span class="ml-auto rounded-md bg-secondary px-2 py-1 text-xs">
					Line {newCommentLine}
				</span>
				<button
					onclick={() => {
						newCommentLine = null;
						newCommentText = "";
						commentError = null;
					}}
					class="ml-2 rounded-sm opacity-70 hover:opacity-100"
					aria-label="Close new comment dialog"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="size-4"
					>
						<path d="M18 6 6 18"></path>
						<path d="m6 6 12 12"></path>
					</svg>
				</button>
			</div>
		</div>

		<div class="p-3">
			<Textarea
				bind:value={newCommentText}
				placeholder="Write a comment..."
				class="min-h-[100px] resize-none text-sm"
				onkeydown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						handleCreateNewComment();
					}
				}}
			/>
			{#if commentError}
				<p class="mt-1 text-xs text-destructive">{commentError}</p>
			{/if}
			<div class="mt-2 flex items-center justify-between">
				<span class="text-xs text-muted-foreground">Ctrl+Enter to submit</span>
				<Button
					onclick={handleCreateNewComment}
					disabled={!newCommentText.trim() || isCreatingNewComment}
					size="sm"
				>
					{isCreatingNewComment ? "Posting..." : "Add Comment"}
				</Button>
			</div>
		</div>
	</div>
{/if}

<Dialog.Root bind:open={commitDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Commit Changes</Dialog.Title>
			<Dialog.Description>
				Commit your changes to <span class="font-mono text-foreground">{branch}</span> branch.
			</Dialog.Description>
		</Dialog.Header>
		<Field.Field data-invalid={!!commitError}>
			<Field.Label for="commit-message">Commit message</Field.Label>
			<Input
				id="commit-message"
				bind:value={commitMessage}
				placeholder="Update {path?.split('/').pop()}"
				aria-invalid={!!commitError}
				onkeydown={(e) => {
					if (e.key === "Enter" && commitMessage.trim() && !isCommitting) {
						handleCommit();
					}
				}}
			/>
			<Field.Description>Describe the changes you made to this file.</Field.Description>
			{#if commitError}
				<Field.Error>{commitError}</Field.Error>
			{/if}
		</Field.Field>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					commitDialogOpen = false;
				}}
			>
				Cancel
			</Button>
			<Button onclick={handleCommit} disabled={!commitMessage.trim() || isCommitting}>
				{isCommitting ? "Committing..." : "Commit"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={signInPromptOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Sign in to edit</Dialog.Title>
			<Dialog.Description>
				Sign in with GitHub to edit this file and contribute to the project.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex-col gap-2 sm:flex-row">
			<Button
				variant="outline"
				onclick={() => {
					signInPromptOpen = false;
				}}
			>
				Cancel
			</Button>
			<Button
				onclick={async () => {
					await authClient.signIn.social({
						provider: "github",
						callbackURL: window.location.href,
					});
				}}
			>
				Sign in with GitHub
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={readOnlyPromptOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Read-only access</Dialog.Title>
			<Dialog.Description>
				You don't have write access to this repository. Fork it to make changes and submit a pull
				request.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => {
					readOnlyPromptOpen = false;
				}}
			>
				Close
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
