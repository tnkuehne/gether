<script lang="ts">
	import { page } from "$app/state";
	import { SvelteMap } from "svelte/reactivity";
	import { authClient } from "$lib/auth-client";
	import { getRepoFiles, type TreeItem } from "../github-files";
	import { getDefaultBranch } from "../github";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { Separator } from "$lib/components/ui/separator";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import HeartHandshake from "@lucide/svelte/icons/heart-handshake";
	import Search from "@lucide/svelte/icons/search";
	import FileText from "@lucide/svelte/icons/file-text";
	import Folder from "@lucide/svelte/icons/folder";
	import FolderOpen from "@lucide/svelte/icons/folder-open";
	import ChevronRight from "@lucide/svelte/icons/chevron-right";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import LogOut from "@lucide/svelte/icons/log-out";
	import LogIn from "@lucide/svelte/icons/log-in";
	import Github from "@lucide/svelte/icons/github";

	let { children } = $props();

	const org = page.params.org!;
	const repo = page.params.repo!;
	const rest = page.params.rest!;
	const session = authClient.useSession();

	// State for file tree
	let files = $state<TreeItem[]>([]);
	let isLoadingFiles = $state(true);
	let selectedBranch = $state<string>("");
	let searchQuery = $state("");
	let expandedDirs = $state<Set<string>>(new Set());

	// Parse current file path from rest param
	let currentPath = $derived.by(() => {
		if (!rest || !selectedBranch) return "";
		// rest is "branch/path/to/file.md"
		// We need to extract just the path portion after the branch
		const branchPrefix = selectedBranch + "/";
		if (rest.startsWith(branchPrefix)) {
			return rest.slice(branchPrefix.length);
		}
		// If branch has slashes, we need to be smarter about parsing
		// For now, assume it's after the branch
		const parts = rest.split("/");
		// Try to find where the branch ends and path begins
		for (let i = 1; i <= parts.length; i++) {
			const possibleBranch = parts.slice(0, i).join("/");
			if (possibleBranch === selectedBranch) {
				return parts.slice(i).join("/");
			}
		}
		return rest;
	});

	// Initialize files on load
	const initPromise = getDefaultBranch(org, repo).then(async (defaultBranch) => {
		selectedBranch = defaultBranch;
		try {
			files = await getRepoFiles(org, repo, defaultBranch);
			// Expand directories that contain the current file
			if (currentPath) {
				const pathParts = currentPath.split("/");
				for (let i = 1; i < pathParts.length; i++) {
					expandedDirs.add(pathParts.slice(0, i).join("/"));
				}
				expandedDirs = expandedDirs;
			}
		} catch {
			files = [];
		}
		isLoadingFiles = false;
		return defaultBranch;
	});

	// Filter files based on search query
	let filteredFiles = $derived.by(() => {
		if (!searchQuery.trim()) return files;
		const query = searchQuery.toLowerCase();
		return files.filter(
			(item) => item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query),
		);
	});

	// Build a tree structure from flat files
	let fileTree = $derived.by(() => {
		const items = filteredFiles;
		const tree = new SvelteMap<string, TreeItem[]>();
		tree.set("", []); // Root level

		for (const item of items) {
			const parentPath = item.path.includes("/")
				? item.path.substring(0, item.path.lastIndexOf("/"))
				: "";
			if (!tree.has(parentPath)) {
				tree.set(parentPath, []);
			}
			tree.get(parentPath)!.push(item);
		}

		return tree;
	});

	function toggleDir(path: string) {
		if (expandedDirs.has(path)) {
			expandedDirs.delete(path);
		} else {
			expandedDirs.add(path);
		}
		expandedDirs = expandedDirs;
	}

	function isFileActive(filePath: string): boolean {
		return currentPath === filePath;
	}

	function handleSignIn() {
		authClient.signIn.social({
			provider: "github",
			callbackURL: window.location.href,
		});
	}

	function handleSignOut() {
		authClient.signOut();
	}
</script>

<Sidebar.Provider>
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header class="border-b border-sidebar-border">
			<a href="/" class="flex items-center gap-2 px-2 py-1">
				<div
					class="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<HeartHandshake class="size-5" />
				</div>
				<span class="text-lg font-semibold group-data-[collapsible=icon]:hidden">Gether</span>
			</a>
		</Sidebar.Header>

		<Sidebar.Content>
			<!-- Repository info -->
			<Sidebar.Group>
				<Sidebar.GroupLabel class="flex items-center gap-2">
					<Github class="size-4" />
					<span class="truncate group-data-[collapsible=icon]:hidden">{org}/{repo}</span>
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<div class="px-2 py-1 group-data-[collapsible=icon]:hidden">
						{#await initPromise}
							<Skeleton class="h-6 w-24" />
						{:then}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<GitBranch class="size-4" />
								<span class="truncate">{selectedBranch}</span>
							</div>
						{/await}
					</div>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Separator />

			<!-- Search -->
			<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
				<Sidebar.GroupContent>
					<div class="relative px-2">
						<Search class="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
						<Sidebar.Input placeholder="Search files..." class="pl-8" bind:value={searchQuery} />
					</div>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<Sidebar.Separator class="group-data-[collapsible=icon]:hidden" />

			<!-- File tree -->
			<Sidebar.Group class="flex-1 overflow-y-auto">
				<Sidebar.GroupLabel>
					<FileText class="size-4" />
					<span class="group-data-[collapsible=icon]:hidden">Files</span>
				</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#if isLoadingFiles}
							{#each [0, 1, 2, 3, 4] as i (i)}
								<Sidebar.MenuItem>
									<Sidebar.MenuSkeleton showIcon />
								</Sidebar.MenuItem>
							{/each}
						{:else if files.length === 0}
							<div
								class="px-4 py-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden"
							>
								No markdown files found
							</div>
						{:else}
							{#each fileTree.get("") ?? [] as item (item.path)}
								{@const isDir = item.type === "dir"}
								{@const isExpanded = expandedDirs.has(item.path)}
								{@const hasChildren = fileTree.has(item.path)}

								{#if isDir}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											onclick={() => toggleDir(item.path)}
											tooltipContent={item.name}
										>
											{#if isExpanded}
												<FolderOpen class="size-4 text-muted-foreground" />
											{:else}
												<Folder class="size-4 text-muted-foreground" />
											{/if}
											<span class="truncate">{item.name}</span>
											{#if hasChildren}
												{#if isExpanded}
													<ChevronDown class="ml-auto size-4" />
												{:else}
													<ChevronRight class="ml-auto size-4" />
												{/if}
											{/if}
										</Sidebar.MenuButton>
										{#if hasChildren && isExpanded}
											<Sidebar.MenuSub>
												{#each fileTree.get(item.path) ?? [] as subItem (subItem.path)}
													{@const subIsDir = subItem.type === "dir"}
													{@const subIsExpanded = expandedDirs.has(subItem.path)}
													{@const subHasChildren = fileTree.has(subItem.path)}

													{#if subIsDir}
														<Sidebar.MenuSubItem>
															<Sidebar.MenuSubButton onclick={() => toggleDir(subItem.path)}>
																{#if subIsExpanded}
																	<FolderOpen class="size-4 text-muted-foreground" />
																{:else}
																	<Folder class="size-4 text-muted-foreground" />
																{/if}
																<span class="truncate">{subItem.name}</span>
																{#if subHasChildren}
																	{#if subIsExpanded}
																		<ChevronDown class="ml-auto size-4" />
																	{:else}
																		<ChevronRight class="ml-auto size-4" />
																	{/if}
																{/if}
															</Sidebar.MenuSubButton>
														</Sidebar.MenuSubItem>
														{#if subHasChildren && subIsExpanded}
															{#each fileTree.get(subItem.path) ?? [] as deepItem (deepItem.path)}
																<Sidebar.MenuSubItem>
																	{#if deepItem.type === "file"}
																		<Sidebar.MenuSubButton
																			data-active={isFileActive(deepItem.path)}
																		>
																			{#snippet child({ props })}
																				<a
																					href="/{org}/{repo}/blob/{selectedBranch}/{deepItem.path}"
																					{...props}
																				>
																					<FileText class="size-4 text-muted-foreground" />
																					<span class="truncate">{deepItem.name}</span>
																				</a>
																			{/snippet}
																		</Sidebar.MenuSubButton>
																	{:else}
																		<Sidebar.MenuSubButton onclick={() => toggleDir(deepItem.path)}>
																			{#if expandedDirs.has(deepItem.path)}
																				<FolderOpen class="size-4 text-muted-foreground" />
																			{:else}
																				<Folder class="size-4 text-muted-foreground" />
																			{/if}
																			<span class="truncate">{deepItem.name}</span>
																		</Sidebar.MenuSubButton>
																	{/if}
																</Sidebar.MenuSubItem>
															{/each}
														{/if}
													{:else}
														<Sidebar.MenuSubItem>
															<Sidebar.MenuSubButton data-active={isFileActive(subItem.path)}>
																{#snippet child({ props })}
																	<a
																		href="/{org}/{repo}/blob/{selectedBranch}/{subItem.path}"
																		{...props}
																	>
																		<FileText class="size-4 text-muted-foreground" />
																		<span class="truncate">{subItem.name}</span>
																	</a>
																{/snippet}
															</Sidebar.MenuSubButton>
														</Sidebar.MenuSubItem>
													{/if}
												{/each}
											</Sidebar.MenuSub>
										{/if}
									</Sidebar.MenuItem>
								{:else}
									<Sidebar.MenuItem>
										<Sidebar.MenuButton
											isActive={isFileActive(item.path)}
											tooltipContent={item.name}
										>
											{#snippet child({ props })}
												<a href="/{org}/{repo}/blob/{selectedBranch}/{item.path}" {...props}>
													<FileText class="size-4 text-muted-foreground" />
													<span class="truncate">{item.name}</span>
												</a>
											{/snippet}
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								{/if}
							{/each}
						{/if}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer class="border-t border-sidebar-border">
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					{#if $session.isPending}
						<Sidebar.MenuSkeleton showIcon />
					{:else if $session.data}
						<Sidebar.MenuButton onclick={handleSignOut} tooltipContent="Sign out">
							<LogOut class="size-4" />
							<span class="truncate group-data-[collapsible=icon]:hidden">
								{$session.data.user.name ?? "Sign out"}
							</span>
						</Sidebar.MenuButton>
					{:else}
						<Sidebar.MenuButton onclick={handleSignIn} tooltipContent="Sign in with GitHub">
							<LogIn class="size-4" />
							<span class="group-data-[collapsible=icon]:hidden">Sign in with GitHub</span>
						</Sidebar.MenuButton>
					{/if}
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>

		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset class="flex flex-col">
		<!-- Header with sidebar trigger and file path -->
		<header
			class="flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-blur:bg-background/60"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
			<div class="flex min-w-0 flex-1 items-center gap-2 text-sm">
				{#if currentPath}
					<span class="truncate font-mono text-muted-foreground">{currentPath}</span>
				{:else}
					<span class="text-muted-foreground">Select a file</span>
				{/if}
			</div>
		</header>

		<!-- Main content -->
		<div class="min-h-0 flex-1 overflow-auto">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
