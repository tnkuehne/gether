<script lang="ts">
	import { contributionState } from "./contribution-state.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Field from "$lib/components/ui/field";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import GitFork from "@lucide/svelte/icons/git-fork";
	import GitPullRequest from "@lucide/svelte/icons/git-pull-request";
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Check from "@lucide/svelte/icons/check";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import AlertCircle from "@lucide/svelte/icons/alert-circle";
	import Lock from "@lucide/svelte/icons/lock";

	// Derived state from shared reactive state
	let showBanner = $derived(
		contributionState.isLoaded &&
			(!contributionState.canEdit ||
				(contributionState.isProtected &&
					contributionState.branch === contributionState.defaultBranch)),
	);
	let isOnDefaultBranch = $derived(contributionState.branch === contributionState.defaultBranch);
	let showPROption = $derived(
		contributionState.isLoaded &&
			contributionState.canEdit &&
			!isOnDefaultBranch &&
			!contributionState.existingPR,
	);

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
	let createdPR = $state<{ number: number; title: string; draft: boolean; htmlUrl: string } | null>(
		null,
	);

	// Collapsible state
	let isOpen = $state(true);

	function generateBranchName(): string {
		if (!contributionState.isLoaded) return "edit";
		const filename =
			contributionState.path
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") || "edit";
		const date = new Date().toISOString().slice(0, 10);
		return `${contributionState.currentUser || "edit"}/${filename}-${date}`;
	}

	$effect(() => {
		if (branchDialogOpen && !newBranchName) {
			newBranchName = generateBranchName();
		}
	});

	$effect(() => {
		if (prDialogOpen && !prTitle && contributionState.isLoaded) {
			const filename = contributionState.path.split("/").pop() || contributionState.path;
			prTitle = `Update ${filename}`;
		}
	});

	async function handleCreateBranch() {
		if (!newBranchName.trim() || !contributionState.isLoaded) return;

		isCreatingBranch = true;
		branchError = null;

		try {
			await contributionState.onCreateBranch(newBranchName.trim());
			branchDialogOpen = false;
			newBranchName = "";
		} catch (err) {
			branchError = err instanceof Error ? err.message : "Failed to create branch";
		} finally {
			isCreatingBranch = false;
		}
	}

	async function handleFork() {
		if (!contributionState.isLoaded) return;
		isForkingRepo = true;
		forkError = null;

		try {
			const fork = await contributionState.onFork();
			// Redirect to the fork
			window.location.href = `/${fork.owner}/${fork.repo}/blob/${fork.defaultBranch}/${contributionState.path}`;
		} catch (err) {
			forkError = err instanceof Error ? err.message : "Failed to fork repository";
			isForkingRepo = false;
		}
	}

	async function handleCreatePR() {
		if (!prTitle.trim() || !contributionState.isLoaded) return;

		isCreatingPR = true;
		prError = null;

		try {
			const pr = await contributionState.onCreatePR({
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

{#if contributionState.isLoaded}
	<Sidebar.Group>
		<Collapsible.Root bind:open={isOpen} class="group/collapsible">
			<Sidebar.GroupLabel class="cursor-pointer">
				<Collapsible.Trigger class="flex w-full items-center gap-2">
					<GitPullRequest class="size-4" />
					<span>Contribution</span>
					<ChevronRight
						class="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
					/>
				</Collapsible.Trigger>
			</Sidebar.GroupLabel>
			<Collapsible.Content>
				<Sidebar.GroupContent>
					<div class="space-y-2 px-2 py-1">
						{#if !contributionState.canEdit}
							<!-- Read-only: Show fork option -->
							<div
								class="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950"
							>
								<Lock class="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
								<span class="text-amber-700 dark:text-amber-300">Read-only access</span>
							</div>
							{#if contributionState.existingFork}
								<Button
									size="sm"
									variant="outline"
									class="w-full justify-start"
									href="/{contributionState.existingFork.owner}/{contributionState.existingFork
										.repo}/blob/{contributionState.branch}/{contributionState.path}"
								>
									<GitFork class="mr-2 size-3.5" />
									Go to your fork
								</Button>
							{:else}
								<Button
									size="sm"
									variant="outline"
									class="w-full justify-start"
									onclick={handleFork}
									disabled={isForkingRepo}
								>
									<GitFork class="mr-2 size-3.5" />
									{isForkingRepo ? "Forking..." : "Fork repository"}
								</Button>
							{/if}
							{#if forkError}
								<p class="text-xs text-destructive">{forkError}</p>
							{/if}
						{:else if contributionState.isProtected && isOnDefaultBranch}
							<!-- Protected branch: Show create branch option -->
							<div
								class="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950"
							>
								<AlertCircle class="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
								<span class="text-amber-700 dark:text-amber-300">
									<strong>{contributionState.branch}</strong> is protected
								</span>
							</div>
							<Button
								size="sm"
								variant="outline"
								class="w-full justify-start"
								onclick={() => (branchDialogOpen = true)}
							>
								<GitBranch class="mr-2 size-3.5" />
								Create a branch
							</Button>
						{/if}

						{#if contributionState.justCommitted}
							<!-- Just committed: Prompt to create PR -->
							<div
								class="flex items-center gap-2 rounded-md bg-green-50 p-2 text-xs dark:bg-green-950"
							>
								<Check class="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
								<span class="text-green-700 dark:text-green-300">Changes committed!</span>
							</div>
							<Button
								size="sm"
								variant="default"
								class="w-full justify-start"
								onclick={() => (prDialogOpen = true)}
							>
								<GitPullRequest class="mr-2 size-3.5" />
								Create PR
							</Button>
						{:else if showPROption}
							<!-- On feature branch without PR: Offer to create one -->
							<div
								class="flex items-center gap-2 rounded-md bg-blue-50 p-2 text-xs dark:bg-blue-950"
							>
								<GitBranch class="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
								<span class="text-blue-700 dark:text-blue-300">
									On <strong>{contributionState.branch}</strong>
								</span>
							</div>
							<Button
								size="sm"
								variant="outline"
								class="w-full justify-start"
								onclick={() => (prDialogOpen = true)}
							>
								<GitPullRequest class="mr-2 size-3.5" />
								Create PR
							</Button>
						{/if}

						{#if contributionState.existingPR && !isOnDefaultBranch}
							<!-- Existing PR: Show link -->
							<div
								class="flex items-center gap-2 rounded-md bg-green-50 p-2 text-xs dark:bg-green-950"
							>
								<GitPullRequest class="size-3.5 shrink-0 text-green-600 dark:text-green-400" />
								<span class="text-green-700 dark:text-green-300">
									PR #{contributionState.existingPR.number} open
								</span>
							</div>
							<Button
								size="sm"
								variant="outline"
								class="w-full justify-start"
								href={contributionState.existingPR.htmlUrl}
								target="_blank"
							>
								<ExternalLink class="mr-2 size-3.5" />
								View PR
							</Button>
						{/if}

						{#if contributionState.canEdit && !showBanner && !showPROption && !contributionState.existingPR && !contributionState.justCommitted}
							<!-- Can edit, no warnings - show a simple status -->
							<div class="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
								<Check class="size-3.5 shrink-0 text-muted-foreground" />
								<span class="text-muted-foreground">You have write access</span>
							</div>
						{/if}
					</div>
				</Sidebar.GroupContent>
			</Collapsible.Content>
		</Collapsible.Root>
	</Sidebar.Group>
{/if}

<!-- Branch creation dialog -->
<Dialog.Root bind:open={branchDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create a new branch</Dialog.Title>
			<Dialog.Description>
				Create a new branch from <strong>{contributionState.branch}</strong> to make your changes.
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
					Open a pull request to merge <strong>{contributionState.branch}</strong> into
					<strong>{contributionState.defaultBranch}</strong>.
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
