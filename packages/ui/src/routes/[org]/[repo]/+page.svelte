<script lang="ts">
	import { page } from "$app/state";
	import { getRepoFiles } from "./repo.remote";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import FileText from "@lucide/svelte/icons/file-text";
	import Folder from "@lucide/svelte/icons/folder";
</script>

<div class="container mx-auto py-8">
	<h1 class="mb-2 text-3xl font-bold">{page.params.org}/{page.params.repo}</h1>
	<p class="mb-6 text-muted-foreground">Markdown, MDX files</p>

	<Card>
		<CardHeader>
			<CardTitle>Files</CardTitle>
			<CardDescription>Select a file to view</CardDescription>
		</CardHeader>
		<CardContent>
			{#await getRepoFiles({ org: page.params.org, repo: page.params.repo })}
				<div class="space-y-2">
					{#each Array.from({ length: 8 }, (_, i) => i) as i (i)}
						<div class="flex items-center gap-3">
							<Skeleton class="size-4" />
							<Skeleton class="h-4 w-64" />
						</div>
					{/each}
				</div>
			{:then data}
				{#if data.files.length === 0}
					<p class="text-muted-foreground">No markdown files found in this repository.</p>
				{:else}
					<div class="space-y-1">
						{#each data.files as item (item.path)}
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
									href="/{page.params.org}/{page.params.repo}/blob/{data.defaultBranch}/{item.path}"
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
					<AlertDescription>
						Failed to load files: {error.message}
					</AlertDescription>
				</Alert>
			{/await}
		</CardContent>
	</Card>
</div>
