<script lang="ts">
	import { page } from "$app/state";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";
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
	let expandedDirs = new SvelteSet<string>();

	// Parse current file path from rest param
	let currentPath = $derived.by(() => {
		if (!rest || !selectedBranch) return "";
		const branchPrefix = selectedBranch + "/";
		if (rest.startsWith(branchPrefix)) {
			return rest.slice(branchPrefix.length);
		}
		const parts = rest.split("/");
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
			}
		} catch {
			files = [];
		}
		isLoadingFiles = false;
		return defaultBranch;
	});

	// Filter files based on search query, including ancestor directories
	let filteredFiles = $derived.by(() => {
		if (!searchQuery.trim()) return files;
		const query = searchQuery.toLowerCase();

		// First find all matching files
		const matchingFiles = files.filter(
			(item) =>
				item.type === "file" &&
				(item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query)),
		);

		// Collect all ancestor directory paths for matching files
		const requiredDirs = new SvelteSet<string>();
		for (const file of matchingFiles) {
			const parts = file.path.split("/");
			for (let i = 1; i < parts.length; i++) {
				requiredDirs.add(parts.slice(0, i).join("/"));
			}
		}

		// Return matching files plus their ancestor directories
		return files.filter(
			(item) =>
				(item.type === "file" &&
					(item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query))) ||
				(item.type === "dir" && requiredDirs.has(item.path)),
		);
	});

	// Auto-expand directories when searching
	$effect(() => {
		if (searchQuery.trim()) {
			// Expand all directories that are in the filtered results
			for (const item of filteredFiles) {
				if (item.type === "dir") {
					expandedDirs.add(item.path);
				}
			}
		}
	});

	// Build a tree structure from flat files
	let fileTree = $derived.by(() => {
		const items = filteredFiles;
		const tree = new SvelteMap<string, TreeItem[]>();
		tree.set("", []);

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
	<Sidebar.Root variant="inset" collapsible="offcanvas">
		<Sidebar.Header>
			<a href="/" class="flex items-center gap-2 px-2 py-1">
				<div
					class="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<HeartHandshake class="size-5" />
				</div>
				<span class="text-lg font-semibold">Gether</span>
			</a>
		</Sidebar.Header>

		<Sidebar.Content>
			<!-- Search -->
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<div class="relative px-2">
						<Search class="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
						<Sidebar.Input placeholder="Search files..." class="pl-8" bind:value={searchQuery} />
					</div>
				</Sidebar.GroupContent>
			</Sidebar.Group>

			<!-- File tree -->
			<Sidebar.Group class="flex-1">
				<Sidebar.GroupLabel class="flex items-center gap-2">
					<Github class="size-4" />
					<span class="truncate">{org}/{repo}</span>
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
							<div class="px-4 py-2 text-sm text-muted-foreground">No markdown files found</div>
						{:else}
							{#snippet renderItems(parentPath: string)}
								{#each fileTree.get(parentPath) ?? [] as item (item.path)}
									{@const isDir = item.type === "dir"}
									{@const isExpanded = expandedDirs.has(item.path)}
									{@const hasChildren = fileTree.has(item.path)}

									{#if isDir}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton onclick={() => toggleDir(item.path)}>
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
													{#snippet renderSubItems(subParentPath: string)}
														{#each fileTree.get(subParentPath) ?? [] as subItem (subItem.path)}
															{@const subIsDir = subItem.type === "dir"}
															{@const subIsExpanded = expandedDirs.has(subItem.path)}
															{@const subHasChildren = fileTree.has(subItem.path)}

															<Sidebar.MenuSubItem>
																{#if subIsDir}
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
																	{#if subHasChildren && subIsExpanded}
																		{@render renderSubItems(subItem.path)}
																	{/if}
																{:else}
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
																{/if}
															</Sidebar.MenuSubItem>
														{/each}
													{/snippet}
													{@render renderSubItems(item.path)}
												</Sidebar.MenuSub>
											{/if}
										</Sidebar.MenuItem>
									{:else}
										<Sidebar.MenuItem>
											<Sidebar.MenuButton isActive={isFileActive(item.path)}>
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
							{/snippet}
							{@render renderItems("")}
						{/if}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>

		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					{#if $session.isPending}
						<Sidebar.MenuSkeleton showIcon />
					{:else if $session.data}
						<Sidebar.MenuButton onclick={handleSignOut}>
							<LogOut class="size-4" />
							<span class="truncate">
								{$session.data.user.name ?? "Sign out"}
							</span>
						</Sidebar.MenuButton>
					{:else}
						<Sidebar.MenuButton onclick={handleSignIn}>
							<LogIn class="size-4" />
							<span>Sign in with GitHub</span>
						</Sidebar.MenuButton>
					{/if}
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
	</Sidebar.Root>

	<Sidebar.Inset class="flex max-h-svh flex-col overflow-hidden">
		<!-- Header with sidebar trigger, branch and file path -->
		<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="h-4" />
			{#await initPromise}
				<Skeleton class="h-5 w-24" />
			{:then}
				<div class="flex min-w-0 items-center gap-2 text-sm">
					<GitBranch class="size-4 shrink-0 text-muted-foreground" />
					<span class="shrink-0 text-muted-foreground">{selectedBranch}</span>
					{#if currentPath}
						<span class="text-muted-foreground">/</span>
						<span class="truncate">{currentPath}</span>
					{/if}
				</div>
			{/await}
		</header>

		<!-- Main content -->
		<div class="min-h-0 flex-1 overflow-hidden">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
