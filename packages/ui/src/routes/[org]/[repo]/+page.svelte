<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { getRepoFiles } from "./github-files";
	import { getDefaultBranch, getBranches, createFile, createBranch } from "./github";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Popover from "$lib/components/ui/popover";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Check from "@lucide/svelte/icons/check";
	import FileText from "@lucide/svelte/icons/file-text";
	import Folder from "@lucide/svelte/icons/folder";
	import Plus from "@lucide/svelte/icons/plus";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import GitBranchPlus from "@lucide/svelte/icons/git-branch-plus";

	let dialogOpen = $state(false);
	let filePath = $state("");
	let baseDir = $state("");
	let isCreating = $state(false);
	let createError = $state<string | null>(null);
	let selectedBranch = $state<string | undefined>(undefined);
	let files = $state<Awaited<ReturnType<typeof getRepoFiles>>>([]);
	let isLoadingFiles = $state(false);

	// Branch creation state
	let branchPopoverOpen = $state(false);
	let newBranchName = $state("");
	let isCreatingBranch = $state(false);
	let createBranchError = $state<string | null>(null);
	let showNewBranchInput = $state(false);

	// Files depend on default branch
	const filesPromise = getDefaultBranch(page.params.org, page.params.repo).then(
		async (defaultBranch) => {
			selectedBranch = defaultBranch;
			files = await getRepoFiles(page.params.org, page.params.repo, defaultBranch);
		},
	);

	async function handleBranchChange(branch: string) {
		if (branch === selectedBranch) return;
		branchPopoverOpen = false;
		selectedBranch = branch;
		isLoadingFiles = true;
		try {
			files = await getRepoFiles(page.params.org, page.params.repo, branch);
		} finally {
			isLoadingFiles = false;
		}
	}

	function openCreateDialog(dir: string = "") {
		baseDir = dir;
		filePath = "";
		createError = null;
		dialogOpen = true;
	}

	async function handleCreateFile() {
		if (!filePath.trim() || !selectedBranch) return;

		let finalPath = baseDir ? `${baseDir}/${filePath.trim()}` : filePath.trim();
		if (!finalPath.match(/\.(md|mdx|svx)$/i)) {
			finalPath += ".md";
		}

		isCreating = true;
		createError = null;

		try {
			const result = await createFile(
				page.params.org,
				page.params.repo,
				finalPath,
				"",
				`Create ${finalPath}`,
				selectedBranch,
			);

			dialogOpen = false;
			filePath = "";
			baseDir = "";

			// Refresh files list
			files = await getRepoFiles(page.params.org, page.params.repo, selectedBranch);

			goto(`/${page.params.org}/${page.params.repo}/blob/${selectedBranch}/${result.path}`);
		} catch (err) {
			createError = err instanceof Error ? err.message : "Failed to create file";
		} finally {
			isCreating = false;
		}
	}

	async function handleCreateBranch() {
		if (!newBranchName.trim() || !selectedBranch) return;

		isCreatingBranch = true;
		createBranchError = null;

		try {
			const branchName = await createBranch(
				page.params.org,
				page.params.repo,
				newBranchName.trim(),
				selectedBranch,
			);

			// Add to branches list and select it
			selectedBranch = branchName;

			// Load files for the new branch
			files = await getRepoFiles(page.params.org, page.params.repo, branchName);

			branchPopoverOpen = false;
			showNewBranchInput = false;
			newBranchName = "";
		} catch (err) {
			createBranchError = err instanceof Error ? err.message : "Failed to create branch";
		} finally {
			isCreatingBranch = false;
		}
	}
</script>

<div class="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
	<h1 class="mb-2 text-2xl font-bold break-all sm:text-3xl">
		{page.params.org}/{page.params.repo}
	</h1>
	<p class="mb-6 text-muted-foreground">Markdown, MDX files</p>

	<Card>
		<CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle>Files</CardTitle>
				<CardDescription>Select a file to view</CardDescription>
			</div>
			<div class="flex flex-row gap-2 sm:items-center">
				{#await getBranches(page.params.org, page.params.repo)}
					<Button variant="outline" size="sm" disabled class="sm:w-[180px]">
						<GitBranch class="mr-2 size-4" />
						<Skeleton class="h-4 w-16" />
					</Button>
				{:then branches}
					<Popover.Root bind:open={branchPopoverOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									size="sm"
									class="flex-1 justify-between sm:w-[180px] sm:flex-none"
								>
									<span class="flex items-center">
										<GitBranch class="mr-2 size-4" />
										<span class="truncate">{selectedBranch}</span>
									</span>
									<ChevronDown class="ml-2 size-4 shrink-0 opacity-50" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content class="w-[200px] p-0" align="start">
							{#if showNewBranchInput}
								<div class="p-3">
									<p class="mb-2 text-sm text-muted-foreground">
										New branch from <strong>{selectedBranch}</strong>
									</p>
									<div class="flex flex-col gap-2">
										<Input
											placeholder="branch-name"
											bind:value={newBranchName}
											onkeydown={(e) => {
												if (e.key === "Enter") handleCreateBranch();
												if (e.key === "Escape") {
													showNewBranchInput = false;
													newBranchName = "";
													createBranchError = null;
												}
											}}
										/>
										{#if createBranchError}
											<p class="text-sm text-destructive">{createBranchError}</p>
										{/if}
										<div class="flex gap-2">
											<Button
												size="sm"
												variant="outline"
												class="flex-1"
												onclick={() => {
													showNewBranchInput = false;
													newBranchName = "";
													createBranchError = null;
												}}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												class="flex-1"
												onclick={handleCreateBranch}
												disabled={isCreatingBranch || !newBranchName.trim()}
											>
												{isCreatingBranch ? "..." : "Create"}
											</Button>
										</div>
									</div>
								</div>
							{:else}
								<div class="max-h-[200px] overflow-y-auto p-1">
									{#each branches as branch (branch)}
										<button
											class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
											onclick={() => handleBranchChange(branch)}
										>
											{#if branch === selectedBranch}
												<Check class="mr-2 size-4" />
											{:else}
												<span class="mr-2 size-4"></span>
											{/if}
											<span class="truncate">{branch}</span>
										</button>
									{/each}
								</div>
								<div class="border-t p-1">
									<button
										class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
										onclick={() => (showNewBranchInput = true)}
									>
										<GitBranchPlus class="mr-2 size-4" />
										New branch
									</button>
								</div>
							{/if}
						</Popover.Content>
					</Popover.Root>
				{/await}
				<Button size="sm" onclick={() => openCreateDialog()}>
					<Plus class="mr-2 size-4" />
					Add file
				</Button>
				<Dialog.Root bind:open={dialogOpen}>
					<Dialog.Content>
						<Dialog.Header>
							<Dialog.Title>Create new file</Dialog.Title>
							<Dialog.Description>
								Create a new markdown file on the <strong>{selectedBranch}</strong> branch.
							</Dialog.Description>
						</Dialog.Header>
						<div class="grid gap-4 py-4">
							<div class="grid gap-2">
								<Label for="file-path">File name</Label>
								{#if baseDir}
									<div class="flex items-center gap-1">
										<span class="text-sm text-muted-foreground">{baseDir}/</span>
										<Input
											id="file-path"
											placeholder="example.md"
											class="flex-1"
											bind:value={filePath}
											onkeydown={(e) => e.key === "Enter" && handleCreateFile()}
										/>
									</div>
								{:else}
									<Input
										id="file-path"
										placeholder="docs/example.md"
										bind:value={filePath}
										onkeydown={(e) => e.key === "Enter" && handleCreateFile()}
									/>
								{/if}
								<p class="text-sm text-muted-foreground">Supports .md, .mdx, and .svx extensions</p>
							</div>
							{#if createError}
								<Alert variant="destructive">
									<CircleAlert class="size-4" />
									<AlertTitle>Error</AlertTitle>
									<AlertDescription>{createError}</AlertDescription>
								</Alert>
							{/if}
						</div>
						<Dialog.Footer>
							<Button variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
							<Button onclick={handleCreateFile} disabled={isCreating || !filePath.trim()}>
								{isCreating ? "Creating..." : "Create file"}
							</Button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Root>
			</div>
		</CardHeader>
		<CardContent>
			{#await filesPromise}
				<div class="space-y-2">
					{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
						<div class="flex items-center gap-3">
							<Skeleton class="size-4" />
							<Skeleton class="h-4 w-48 sm:w-64" />
						</div>
					{/each}
				</div>
			{:then}
				{#if isLoadingFiles}
					<div class="space-y-2">
						{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
							<div class="flex items-center gap-3">
								<Skeleton class="size-4" />
								<Skeleton class="h-4 w-48 sm:w-64" />
							</div>
						{/each}
					</div>
				{:else if files.length === 0}
					<p class="text-muted-foreground">No markdown files found in this repository.</p>
				{:else}
					<div class="space-y-1">
						{#each files as item (item.path)}
							{@const depth = item.path.split("/").length - 1}
							{#if item.type === "dir"}
								<div
									class="group flex items-center gap-2 py-1.5 text-muted-foreground"
									style="padding-left: {depth * 1.25}rem"
								>
									<Folder class="size-4" />
									<span class="text-sm font-medium">{item.name}</span>
									<button
										class="rounded p-1 opacity-100 transition-opacity hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100"
										onclick={() => openCreateDialog(item.path)}
										title="Create file in {item.path}"
									>
										<Plus class="size-3" />
									</button>
								</div>
							{:else}
								<a
									href="/{page.params.org}/{page.params.repo}/blob/{selectedBranch}/{item.path}"
									class="flex items-center gap-2 rounded-md py-1.5 transition-colors hover:bg-muted"
									style="padding-left: {depth * 1.25}rem"
								>
									<FileText class="size-4 text-muted-foreground" />
									<span class="text-sm">{item.name}</span>
								</a>
							{/if}
						{/each}
					</div>
				{/if}
			{:catch error}
				<Alert variant="destructive">
					<CircleAlert class="size-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>Failed to load files: {error.message}</AlertDescription>
				</Alert>
			{/await}
		</CardContent>
	</Card>
</div>
