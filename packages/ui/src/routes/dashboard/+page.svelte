<script lang="ts">
	import { getGitHubAppStatus, getRepositories } from "./github";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import Lock from "@lucide/svelte/icons/lock";

	import Github from "@lucide/svelte/icons/github";
	import Plus from "@lucide/svelte/icons/plus";

	import { authClient } from "$lib/auth-client";
	import { GITHUB_APP_INSTALL_URL } from "$lib/github-app";

	async function handleGitHubAppClick() {
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
	}
</script>

<div class="container mx-auto py-8">
	{#await getGitHubAppStatus()}
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold">Your Repositories</h1>
			<Skeleton class="h-9 w-36" />
		</div>
		<div class="space-y-3">
			{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
				<div class="flex items-center gap-3">
					<Skeleton class="h-5 w-48" />
					<Skeleton class="h-4 w-16" />
				</div>
			{/each}
		</div>
	{:then status}
		{#if status.isInstalled}
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-3xl font-bold">Your Repositories</h1>
				{#if status.installUrl}
					<Button variant="outline" onclick={handleGitHubAppClick}>
						<Plus class="size-4" />
						Add Repositories
					</Button>
				{/if}
			</div>

			{#await getRepositories()}
				<div class="space-y-3">
					{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
						<div class="flex items-center gap-3">
							<Skeleton class="h-5 w-48" />
							<Skeleton class="h-4 w-16" />
						</div>
					{/each}
				</div>
			{:then repos}
				{#if repos.length === 0}
					<p class="text-muted-foreground">No repositories found.</p>
				{:else}
					<div class="space-y-3">
						{#each repos as repo (repo.id)}
							<a
								href={`/${repo.fullName}`}
								class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
							>
								{#if repo.isPrivate}
									<Lock class="size-4 text-muted-foreground" />
								{/if}
								<div>
									<div class="font-medium">{repo.fullName}</div>
									{#if repo.description}
										<div class="line-clamp-1 text-sm text-muted-foreground">
											{repo.description}
										</div>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{:catch error}
				<Alert variant="destructive">
					<CircleAlert class="size-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>
						Failed to load repositories: {error.message}
					</AlertDescription>
				</Alert>
			{/await}
		{:else}
			<div class="mb-6 flex items-center justify-between">
				<h1 class="text-3xl font-bold">Your Repositories</h1>
			</div>

			<div class="flex flex-col items-center justify-center py-24">
				<div class="flex max-w-md flex-col items-center gap-6 text-center">
					<div class="rounded-full bg-muted p-6">
						<Github class="size-12 text-muted-foreground" />
					</div>
					<div class="space-y-2">
						<h2 class="text-2xl font-semibold">Connect GitHub</h2>
						<p class="text-muted-foreground">
							Install the Gether GitHub App to grant access to your repositories and start
							collaborating.
						</p>
					</div>
					{#if status.installUrl}
						<Button size="lg" onclick={handleGitHubAppClick}>
							<Github class="size-4" />
							Install GitHub App
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	{:catch error}
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-3xl font-bold">Your Repositories</h1>
		</div>
		<Alert variant="destructive">
			<CircleAlert class="size-4" />
			<AlertTitle>Error</AlertTitle>
			<AlertDescription>
				Failed to check GitHub App status: {error.message}
			</AlertDescription>
		</Alert>
	{/await}
</div>
