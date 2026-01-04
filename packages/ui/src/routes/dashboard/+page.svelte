<script lang="ts">
	import {
		getGitHubAppStatus,
		listUserRepositories,
		GITHUB_APP_INSTALL_URL,
		type Repository,
	} from "$lib/github-app";
	import { requireOctokit } from "$lib/github-auth";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import Lock from "@lucide/svelte/icons/lock";

	import Github from "@lucide/svelte/icons/github";
	import Plus from "@lucide/svelte/icons/plus";

	import { authClient } from "$lib/auth-client";

	const session = authClient.useSession();

	async function getRepositories(): Promise<Repository[]> {
		const auth = await requireOctokit();
		return listUserRepositories(auth.octokit);
	}

	async function fetchGitHubAppStatus() {
		const auth = await requireOctokit();
		return getGitHubAppStatus(auth.accessToken);
	}

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

	async function handleSignIn() {
		await authClient.signIn.social({
			provider: "github",
			callbackURL: window.location.href,
		});
	}
</script>

<div class="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
	{#if $session.isPending}
		<!-- Loading session state -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">Your Repositories</h1>
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
	{:else if $session.data}
		<!-- User is authenticated -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold sm:text-3xl">Your Repositories</h1>
			<div class="flex items-center gap-2">
				<span class="hidden text-sm text-muted-foreground sm:inline">{$session.data.user.name}</span
				>
				<Button
					onclick={async () => {
						await authClient.signOut();
					}}
					variant="outline"
					size="sm"
				>
					Sign Out
				</Button>
			</div>
		</div>

		{#await fetchGitHubAppStatus()}
			<!-- Loading app status -->
		{:then appStatus}
			{#if !appStatus.isInstalled && appStatus.installUrl}
				<Alert class="mb-6">
					<Lock class="size-4" />
					<AlertTitle>Access Private Repositories</AlertTitle>
					<AlertDescription class="flex flex-col gap-3">
						<p>Install the GitHub App to access your private repositories.</p>
						<Button onclick={handleGitHubAppClick} size="sm" class="w-fit">
							<Plus class="mr-2 size-4" />
							Install GitHub App
						</Button>
					</AlertDescription>
				</Alert>
			{/if}
		{:catch}
			<!-- Ignore app status errors -->
		{/await}

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
				<div class="space-y-2">
					{#each repos as repo (repo.id)}
						<a
							href="/{repo.fullName}"
							class="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
						>
							<div class="flex items-center gap-3">
								<Github class="size-5 text-muted-foreground" />
								<div>
									<div class="font-medium">{repo.fullName}</div>
									{#if repo.description}
										<div class="text-sm text-muted-foreground line-clamp-1">
											{repo.description}
										</div>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if repo.isPrivate}
									<Lock class="size-4 text-muted-foreground" />
								{/if}
								{#if repo.language}
									<span class="text-sm text-muted-foreground">{repo.language}</span>
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
				<AlertDescription>Failed to load repositories: {error.message}</AlertDescription>
			</Alert>
		{/await}
	{:else}
		<!-- User is not authenticated -->
		<div class="flex flex-col items-center justify-center py-12 sm:py-20">
			<div class="flex max-w-md flex-col items-center gap-6 text-center">
				<div class="rounded-full bg-muted p-6">
					<Github class="size-12 text-muted-foreground" />
				</div>
				<div class="space-y-2">
					<h1 class="text-2xl font-bold sm:text-3xl">Welcome to Gether</h1>
					<p class="text-muted-foreground">
						Sign in with GitHub to access your repositories and start editing markdown files.
					</p>
				</div>
				<Button onclick={handleSignIn} size="lg">
					<Github class="mr-2 size-5" />
					Sign in with GitHub
				</Button>
			</div>
		</div>
	{/if}
</div>
