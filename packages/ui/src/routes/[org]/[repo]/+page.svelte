<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { getRepoFiles } from "./github-files";
	import { getDefaultBranch, createFile } from "./github";
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
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import FileText from "@lucide/svelte/icons/file-text";
	import Folder from "@lucide/svelte/icons/folder";
	import Plus from "@lucide/svelte/icons/plus";

	let dialogOpen = $state(false);
	let filePath = $state("");
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	const repoDataPromise = getDefaultBranch(page.params.org, page.params.repo).then(
		async (branch) => ({
			branch,
			files: await getRepoFiles(page.params.org, page.params.repo, branch),
		}),
	);

	async function handleCreateFile() {
		if (!filePath.trim()) return;

		let finalPath = filePath.trim();
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
			);

			dialogOpen = false;
			filePath = "";

			const { branch } = await repoDataPromise;
			goto(`/${page.params.org}/${page.params.repo}/blob/${branch}/${result.path}`);
		} catch (err) {
			createError = err instanceof Error ? err.message : "Failed to create file";
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="container mx-auto py-8">
	<h1 class="mb-2 text-3xl font-bold">{page.params.org}/{page.params.repo}</h1>
	<p class="mb-6 text-muted-foreground">Markdown, MDX files</p>

	<Card>
		<CardHeader class="flex flex-row items-center justify-between">
			<div>
				<CardTitle>Files</CardTitle>
				<CardDescription>Select a file to view</CardDescription>
			</div>
			<Dialog.Root bind:open={dialogOpen}>
				<Dialog.Trigger>
					{#snippet child({ props })}
						<Button {...props} size="sm">
							<Plus class="mr-2 size-4" />
							Add file
						</Button>
					{/snippet}
				</Dialog.Trigger>
				<Dialog.Content>
					<Dialog.Header>
						<Dialog.Title>Create new file</Dialog.Title>
						<Dialog.Description>Enter the path for your new markdown file.</Dialog.Description>
					</Dialog.Header>
					<div class="grid gap-4 py-4">
						<div class="grid gap-2">
							<Label for="file-path">File path</Label>
							<Input
								id="file-path"
								placeholder="docs/example.md"
								bind:value={filePath}
								onkeydown={(e) => e.key === "Enter" && handleCreateFile()}
							/>
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
		</CardHeader>
		<CardContent>
			{#await repoDataPromise}
				<div class="space-y-2">
					{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
						<div class="flex items-center gap-3">
							<Skeleton class="size-4" />
							<Skeleton class="h-4 w-64" />
						</div>
					{/each}
				</div>
			{:then { branch, files }}
				{#if files.length === 0}
					<p class="text-muted-foreground">No markdown files found in this repository.</p>
				{:else}
					<div class="space-y-1">
						{#each files as item (item.path)}
							{@const depth = item.path.split("/").length - 1}
							{#if item.type === "dir"}
								<div
									class="flex items-center gap-2 py-1.5 text-muted-foreground"
									style="padding-left: {depth * 1.25}rem"
								>
									<Folder class="size-4" />
									<span class="text-sm font-medium">{item.name}</span>
								</div>
							{:else}
								<a
									href="/{page.params.org}/{page.params.repo}/blob/{branch}/{item.path}"
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
