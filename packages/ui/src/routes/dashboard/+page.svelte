<script lang="ts">
	import { getGitHubAppStatus, getRepositories } from "./dashboard.remote";
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Button } from "$lib/components/ui/button";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import CircleCheck from "@lucide/svelte/icons/circle-check";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import Lock from "@lucide/svelte/icons/lock";
	import Star from "@lucide/svelte/icons/star";
	import { Badge } from "$lib/components/ui/badge";
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
	<h1 class="mb-6 text-3xl font-bold">Dashboard</h1>

	<div class="grid gap-6">
		<Card class="max-w-md">
			<CardHeader>
				<CardTitle>GitHub App</CardTitle>
				<CardDescription>Connect your repositories to Gether</CardDescription>
			</CardHeader>
			<CardContent>
				{#await getGitHubAppStatus()}
					<div class="space-y-2">
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-3/4" />
					</div>
				{:then status}
					{#if status.isInstalled}
						<Alert>
							<CircleCheck class="size-4" />
							<AlertTitle>Installed</AlertTitle>
							<AlertDescription
								>The Gether GitHub App is installed on your account.</AlertDescription
							>
						</Alert>
					{:else}
						<Alert variant="destructive">
							<CircleAlert class="size-4" />
							<AlertTitle>Not Installed</AlertTitle>
							<AlertDescription>
								Install the Gether GitHub App to grant access to your repositories.
							</AlertDescription>
						</Alert>
					{/if}
					{#if status.installUrl}
						<Button onclick={handleGitHubAppClick} class="mt-4">
							{status.isInstalled ? "Configure GitHub App" : "Install GitHub App"}
						</Button>
					{/if}
				{:catch error}
					<Alert variant="destructive">
						<CircleAlert class="size-4" />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Failed to check GitHub App status: {error.message}
						</AlertDescription>
					</Alert>
				{/await}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Your Repositories</CardTitle>
				<CardDescription>Repositories you have access to</CardDescription>
			</CardHeader>
			<CardContent>
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
									class="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
								>
									<div class="flex items-center gap-3">
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
									</div>
									<div class="flex items-center gap-2">
										{#if repo.language}
											<Badge variant="secondary">{repo.language}</Badge>
										{/if}
										{#if repo.stars && repo.stars > 0}
											<span class="flex items-center gap-1 text-sm text-muted-foreground">
												<Star class="size-3" />
												{repo.stars}
											</span>
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
			</CardContent>
		</Card>
	</div>
</div>
