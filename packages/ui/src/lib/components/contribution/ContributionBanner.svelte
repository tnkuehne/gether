<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import { Input } from "$lib/components/ui/input";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Field from "$lib/components/ui/field";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import GitFork from "@lucide/svelte/icons/git-fork";
	import GitPullRequest from "@lucide/svelte/icons/git-pull-request";
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Check from "@lucide/svelte/icons/check";
	import type { ForkInfo, PullRequestInfo } from "$lib/github-app";

	interface Props {
		branch: string;
		path: string;
		canEdit: boolean;
		isProtected: boolean;
		defaultBranch: string | null;
		existingFork: ForkInfo | null;
		existingPR: PullRequestInfo | null;
		currentUser: string | null;
		justCommitted?: boolean;
		onCreateBranch: (branchName: string) => Promise<void>;
		onFork: () => Promise<ForkInfo>;
		onCreatePR: (params: {
			title: string;
			body: string;
			draft: boolean;
		}) => Promise<PullRequestInfo>;
	}

	let {
		branch,
		path,
		canEdit,
		isProtected,
		defaultBranch,
		existingFork,
		existingPR,
		currentUser,
		justCommitted = false,
		onCreateBranch,
		onFork,
		onCreatePR,
	}: Props = $props();

	// Determine if user should see the contribution banner
	let showBanner = $derived(!canEdit || (isProtected && branch === defaultBranch));
	let isOnDefaultBranch = $derived(branch === defaultBranch);
	let showPROption = $derived(canEdit && !isOnDefaultBranch && !existingPR);

	// Branch creation state
	let branchDialogOpen = $state(false);
	let newBranchName = $state("");
	let isCreatingBranch = $state(false);
	let branchError = $state<string | null>(null);

	// Fork state
	let isForkingRepo = $state(false);
	let forkError = $state<string | null>(null);

	// PR creation state
	let prDialogOpen = $state(false);
	let prTitle = $state("");
	let prBody = $state("");
	let prDraft = $state(true);
	let isCreatingPR = $state(false);
	let prError = $state<string | null>(null);
	let createdPR = $state<PullRequestInfo | null>(null);

	function generateBranchName(): string {
		const filename =
			path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") || "edit";
		const date = new Date().toISOString().slice(0, 10);
		return `${currentUser || "edit"}/${filename}-${date}`;
	}

	$effect(() => {
		if (branchDialogOpen && !newBranchName) {
			newBranchName = generateBranchName();
		}
	});

	$effect(() => {
		if (prDialogOpen && !prTitle) {
			const filename = path.split("/").pop() || path;
			prTitle = `Update ${filename}`;
		}
	});

	async function handleCreateBranch() {
		if (!newBranchName.trim()) return;

		isCreatingBranch = true;
		branchError = null;

		try {
			await onCreateBranch(newBranchName.trim());
			branchDialogOpen = false;
			newBranchName = "";
		} catch (err) {
			branchError = err instanceof Error ? err.message : "Failed to create branch";
		} finally {
			isCreatingBranch = false;
		}
	}

	async function handleFork() {
		isForkingRepo = true;
		forkError = null;

		try {
			const fork = await onFork();
			// Redirect to the fork
			window.location.href = `/${fork.owner}/${fork.repo}/blob/${fork.defaultBranch}/${path}`;
		} catch (err) {
			forkError = err instanceof Error ? err.message : "Failed to fork repository";
			isForkingRepo = false;
		}
	}

	async function handleCreatePR() {
		if (!prTitle.trim()) return;

		isCreatingPR = true;
		prError = null;

		try {
			const pr = await onCreatePR({
				title: prTitle.trim(),
				body: prBody.trim(),
				draft: prDraft,
			});
			createdPR = pr;
		} catch (err) {
			prError = err instanceof Error ? err.message : "Failed to create pull request";
		} finally {
			isCreatingPR = false;
		}
	}
</script>

{#if showBanner}
	<div
		class="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
	>
		{#if !canEdit}
			<div class="flex flex-1 items-center gap-2">
				<Badge
					variant="outline"
					class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300"
				>
					Read-only
				</Badge>
				<span class="text-amber-700 dark:text-amber-300">
					You don't have write access to this repository.
				</span>
			</div>
			<div class="flex gap-2">
				{#if existingFork}
					<Button
						size="sm"
						variant="outline"
						href="/{existingFork.owner}/{existingFork.repo}/blob/{branch}/{path}"
					>
						<GitFork class="mr-1.5 size-3.5" />
						Go to your fork
					</Button>
				{:else}
					<Button size="sm" variant="outline" onclick={handleFork} disabled={isForkingRepo}>
						<GitFork class="mr-1.5 size-3.5" />
						{isForkingRepo ? "Forking..." : "Fork repository"}
					</Button>
				{/if}
			</div>
			{#if forkError}
				<p class="w-full text-sm text-destructive">{forkError}</p>
			{/if}
		{:else if isProtected}
			<div class="flex flex-1 items-center gap-2">
				<Badge
					variant="outline"
					class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300"
				>
					Protected
				</Badge>
				<span class="text-amber-700 dark:text-amber-300">
					<strong>{branch}</strong> is a protected branch.
				</span>
			</div>
			<Button size="sm" variant="outline" onclick={() => (branchDialogOpen = true)}>
				<GitBranch class="mr-1.5 size-3.5" />
				Create a branch
			</Button>
		{/if}
	</div>
{/if}

{#if showPROption || justCommitted}
	<div
		class="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm {justCommitted
			? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
			: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'}"
	>
		<div class="flex flex-1 items-center gap-2">
			{#if justCommitted}
				<Check class="size-4 text-green-600 dark:text-green-400" />
				<span class="text-green-700 dark:text-green-300">
					Changes committed! Create a pull request to merge into <strong>{defaultBranch}</strong>?
				</span>
			{:else}
				<GitPullRequest class="size-4 text-blue-600 dark:text-blue-400" />
				<span class="text-blue-700 dark:text-blue-300">
					Editing on <strong>{branch}</strong>. Ready to create a pull request?
				</span>
			{/if}
		</div>
		<Button
			size="sm"
			variant={justCommitted ? "default" : "outline"}
			onclick={() => (prDialogOpen = true)}
		>
			<GitPullRequest class="mr-1.5 size-3.5" />
			Create PR
		</Button>
	</div>
{/if}

{#if existingPR && !isOnDefaultBranch}
	<div
		class="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950"
	>
		<div class="flex flex-1 items-center gap-2">
			<GitPullRequest class="size-4 text-green-600 dark:text-green-400" />
			<span class="text-green-700 dark:text-green-300">
				Pull request <strong>#{existingPR.number}</strong> is open for this branch.
			</span>
		</div>
		<Button size="sm" variant="outline" href={existingPR.htmlUrl} target="_blank">
			View PR
			<ExternalLink class="ml-1.5 size-3.5" />
		</Button>
	</div>
{/if}

<!-- Branch creation dialog -->
<Dialog.Root bind:open={branchDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create a new branch</Dialog.Title>
			<Dialog.Description>
				Create a new branch from <strong>{branch}</strong> to make your changes.
			</Dialog.Description>
		</Dialog.Header>
		<Field.Field data-invalid={!!branchError}>
			<Field.Label for="branch-name">Branch name</Field.Label>
			<Input
				id="branch-name"
				bind:value={newBranchName}
				placeholder="my-feature-branch"
				aria-invalid={!!branchError}
				onkeydown={(e) => {
					if (e.key === "Enter" && newBranchName.trim() && !isCreatingBranch) {
						handleCreateBranch();
					}
				}}
			/>
			<Field.Description>Choose a descriptive name for your branch.</Field.Description>
			{#if branchError}
				<Field.Error>{branchError}</Field.Error>
			{/if}
		</Field.Field>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (branchDialogOpen = false)}>Cancel</Button>
			<Button onclick={handleCreateBranch} disabled={!newBranchName.trim() || isCreatingBranch}>
				{isCreatingBranch ? "Creating..." : "Create branch"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- PR creation dialog -->
<Dialog.Root bind:open={prDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		{#if createdPR}
			<Dialog.Header>
				<Dialog.Title>Pull request created</Dialog.Title>
			</Dialog.Header>
			<div class="py-4">
				<div class="flex items-center gap-2 rounded-lg border bg-muted/50 p-4">
					<GitPullRequest class="size-5 text-green-600" />
					<div class="flex-1">
						<p class="font-medium">{createdPR.title}</p>
						<p class="text-sm text-muted-foreground">
							#{createdPR.number}
							{createdPR.draft ? "(Draft)" : ""}
						</p>
					</div>
				</div>
			</div>
			<Dialog.Footer>
				<Button
					variant="outline"
					onclick={() => {
						prDialogOpen = false;
						createdPR = null;
					}}
				>
					Close
				</Button>
				<Button href={createdPR?.htmlUrl} target="_blank">
					View on GitHub
					<ExternalLink class="ml-1.5 size-3.5" />
				</Button>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>Create a pull request</Dialog.Title>
				<Dialog.Description>
					Open a pull request to merge <strong>{branch}</strong> into
					<strong>{defaultBranch}</strong>.
				</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4 py-4">
				<Field.Field data-invalid={!!prError}>
					<Field.Label for="pr-title">Title</Field.Label>
					<Input id="pr-title" bind:value={prTitle} placeholder="Add feature X" />
				</Field.Field>
				<Field.Field>
					<Field.Label for="pr-body">Description (optional)</Field.Label>
					<textarea
						id="pr-body"
						bind:value={prBody}
						placeholder="Describe your changes..."
						class="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					></textarea>
				</Field.Field>
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="pr-draft"
						bind:checked={prDraft}
						class="size-4 rounded border-gray-300"
					/>
					<label for="pr-draft" class="text-sm"> Create as draft pull request </label>
				</div>
				{#if prError}
					<p class="text-sm text-destructive">{prError}</p>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (prDialogOpen = false)}>Cancel</Button>
				<Button onclick={handleCreatePR} disabled={!prTitle.trim() || isCreatingPR}>
					{isCreatingPR ? "Creating..." : "Create pull request"}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
