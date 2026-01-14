<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import githubMark from "$lib/assets/github-mark.svg";
	import githubMarkWhite from "$lib/assets/github-mark-white.svg";
	import logo from "$lib/assets/logo.svg";
	import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";
	import CollaborativeCursor from "$lib/components/collaborative-cursor.svelte";
	import {
		getGitHubAppStatus,
		listUserRepositories,
		GITHUB_APP_INSTALL_URL,
		type Repository,
	} from "$lib/github-app";
	import { requireOctokit } from "$lib/github-auth";
	import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import CircleAlert from "@lucide/svelte/icons/circle-alert";
	import Github from "@lucide/svelte/icons/github";
	import Plus from "@lucide/svelte/icons/plus";

	// Server-side user data for instant SSR decision
	let { data } = $props();

	// Dashboard functions
	async function fetchGitHubAppStatus() {
		const auth = await requireOctokit();
		return getGitHubAppStatus(auth.accessToken);
	}

	async function getRepositories(): Promise<Repository[]> {
		const auth = await requireOctokit();
		return listUserRepositories(auth.octokit);
	}

	async function handleGitHubAppClick() {
		const response = await authClient.signIn.social({
			provider: "github",
			callbackURL: window.location.href,
			disableRedirect: true,
		});

		if (response?.data?.url) {
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

	// Landing page animation state
	let timoText = $state("");
	let maxText = $state("");
	let showTimoCursor = $state(false);
	let showMaxCursor = $state(false);
	let animationComplete = $state(false);
	let hasAnimated = $state(false);

	const timoPhrase = " — in real time.";
	const maxPhrase = " together";

	const testimonials = [
		{
			name: "Nick Khami",
			handle: "skeptrune",
			avatar:
				"https://cdn.xcancel.com/pic/A22D12BF459FC/profile_images%2F1914786311774593024%2FKFy4uSNd_bigger.jpg",
			content: "very cool",
			url: "https://x.com/skeptrune/status/2003477914596356402",
		},
		{
			name: "Lennert Jansen",
			handle: "lennertjansen",
			avatar:
				"https://cdn.xcancel.com/pic/7D05404876EEF/profile_images%2F1973104046710902784%2Fdy6phOTa_bigger.jpg",
			content: "starred",
			url: "https://x.com/lennertjansen/status/2003479306341933321",
		},
		{
			name: "Rhys",
			handle: "RhysSullivan",
			avatar:
				"https://cdn.xcancel.com/pic/F553653F14C10/profile_images%2F1303727365265203200%2F0cgHOP3y_bigger.jpg",
			content: "i love this",
			url: "https://x.com/RhysSullivan/status/2006423915808301394",
		},
	];

	function sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function typeText(
		phrase: string,
		setText: (val: string) => void,
		minDelay = 60,
		maxDelay = 120,
	) {
		for (let i = 0; i <= phrase.length; i++) {
			setText(phrase.slice(0, i));
			await sleep(minDelay + Math.random() * (maxDelay - minDelay));
		}
	}

	async function animate() {
		if (hasAnimated) return;
		hasAnimated = true;

		await sleep(400);

		// Timo starts typing
		showTimoCursor = true;
		await sleep(300);
		await typeText(timoPhrase, (val) => (timoText = val));
		await sleep(200);
		showTimoCursor = false;

		// Small pause, then Max types
		await sleep(400);
		showMaxCursor = true;
		await sleep(300);
		await typeText(maxPhrase, (val) => (maxText = val), 70, 130);
		await sleep(200);
		showMaxCursor = false;

		animationComplete = true;
	}

	onMount(() => {
		function tryAnimate() {
			// Only animate for unauthenticated users
			if (document.visibilityState === "visible" && !hasAnimated && !data.user) {
				animate();
			}
		}

		// Start animation when page becomes visible
		document.addEventListener("visibilitychange", tryAnimate);

		// Also try immediately in case page is already visible
		tryAnimate();

		return () => {
			document.removeEventListener("visibilitychange", tryAnimate);
		};
	});
</script>

<svelte:head>
	<title>Gether - Collaborative Content Editor for Git</title>
	<meta
		name="description"
		content="A collaborative content editor for markdown and static site generators. Edit together in real time with live preview."
	/>
</svelte:head>

{#if data.user}
	<!-- Authenticated - show dashboard -->
	<div class="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
		{#await fetchGitHubAppStatus()}
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
		{:then status}
			{#if status.isInstalled}
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<h1 class="text-2xl font-bold sm:text-3xl">Your Repositories</h1>
					{#if status.installUrl}
						<Button variant="outline" class="w-full sm:w-auto" onclick={handleGitHubAppClick}>
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
									class="block rounded-lg border p-3 transition-colors hover:bg-muted"
								>
									<div class="font-medium">{repo.fullName}</div>
									<div class="line-clamp-1 text-sm text-muted-foreground">
										{repo.description || "\u00A0"}
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
					<h1 class="text-2xl font-bold sm:text-3xl">Your Repositories</h1>
				</div>

				<div class="flex flex-col items-center justify-center py-12 sm:py-24">
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
				<h1 class="text-2xl font-bold sm:text-3xl">Your Repositories</h1>
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
{:else}
	<!-- Not authenticated (or still loading) - show landing page instantly -->
	<div class="min-h-screen bg-background">
		<!-- Header with GitHub link -->
		<header class="absolute top-0 right-0 p-4 sm:p-6">
			<a
				href="https://github.com/tnkuehne/gether"
				target="_blank"
				rel="noopener noreferrer"
				class="opacity-70 transition-opacity hover:opacity-100"
				aria-label="View source on GitHub"
			>
				<img src={githubMark} alt="GitHub" class="h-8 w-8 dark:hidden" />
				<img src={githubMarkWhite} alt="GitHub" class="hidden h-8 w-8 dark:block" />
			</a>
		</header>

		<main class="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
			<!-- Hero Section -->
			<section class="mb-16 text-center">
				<img src={logo} alt="Gether" class="mx-auto mb-8 h-16 w-16 dark:invert" />
				<h1 class="mb-4 text-2xl font-semibold text-foreground sm:text-3xl">
					A collaborative content editor for Git{timoText}{#if showTimoCursor}<CollaborativeCursor
							name="Timo"
							color="#3b82f6"
						/>{/if}
				</h1>
				<p class="mb-8 text-muted-foreground">
					Replace <code class="rounded bg-muted px-1.5 py-0.5 text-sm">github.com</code> with
					<code class="rounded bg-muted px-1.5 py-0.5 text-sm">gether.md</code> and start editing{maxText}{#if showMaxCursor}<CollaborativeCursor
							name="Max"
							color="#10b981"
						/>{/if}{#if !showMaxCursor && animationComplete}.{/if}
				</p>

				<!-- URL Example -->
				<div class="mb-8 rounded-lg bg-muted p-4 text-left font-mono text-sm sm:p-6">
					<div class="mb-2 text-muted-foreground">
						<span class="text-muted-foreground/60">github.com</span>/org/repo/blob/main/README.md
					</div>
					<div class="mb-2 text-muted-foreground">→</div>
					<div class="text-foreground">
						<span class="font-medium text-primary">gether.md</span>/org/repo/blob/main/README.md
					</div>
				</div>

				<div class="mx-auto flex w-fit flex-col items-center gap-4 sm:flex-row">
					<Button onclick={handleSignIn} size="lg">Sign in with GitHub</Button>
					<Button href="/tnkuehne/gether/blob/main/README.md" size="lg" variant="outline">
						See it in action
					</Button>
				</div>
			</section>

			<!-- Features -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">Features</h2>
				<ul class="space-y-3 text-muted-foreground">
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Real-time collaboration with live cursors</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Rendered markdown preview</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Live site preview for static site generators</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>File navigation within repositories</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Commit directly back to GitHub</span>
					</li>
				</ul>
			</section>

			<!-- How it works -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">How it works</h2>
				<ol class="space-y-4 text-muted-foreground">
					<li class="flex gap-4">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
							>1</span
						>
						<span>Open markdown/mdx file on GitHub</span>
					</li>
					<li class="flex gap-4">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
							>2</span
						>
						<span
							>Replace <code class="rounded bg-muted px-1.5 py-0.5 text-xs">github.com</code> with
							<code class="rounded bg-muted px-1.5 py-0.5 text-xs">gether.md</code></span
						>
					</li>
					<li class="flex gap-4">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
							>3</span
						>
						<span>Edit together with live preview</span>
					</li>
				</ol>
			</section>

			<!-- Testimonials -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">What people are saying</h2>
				<div class="-mx-4 flex gap-4 overflow-x-auto px-4 sm:-mx-32 sm:justify-center sm:px-6">
					{#each testimonials as testimonial (testimonial.handle)}
						<a
							href={testimonial.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex shrink-0 gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
						>
							<img
								src={testimonial.avatar}
								alt={testimonial.name}
								class="h-10 w-10 shrink-0 rounded-full"
								loading="lazy"
							/>
							<div>
								<div class="flex items-center gap-1">
									<span class="font-medium text-foreground">{testimonial.name}</span>
									<span class="text-muted-foreground">@{testimonial.handle}</span>
								</div>
								<p class="mt-1 text-sm text-muted-foreground">{testimonial.content}</p>
							</div>
						</a>
					{/each}
				</div>
			</section>

			<!-- Trust & Safety -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">Trust & safety</h2>
				<ul class="space-y-3 text-muted-foreground">
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Uses GitHub OAuth for authentication</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Requests only the minimal permissions required to commit</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>Commits are made as the authenticated GitHub user</span>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span>No unnecessary data is stored</span>
					</li>
				</ul>
			</section>

			<!-- Open Source -->
			<section>
				<h2 class="mb-4 text-lg font-medium text-foreground">Open source</h2>
				<p class="text-muted-foreground">
					Fully open source. <a
						href="https://github.com/tnkuehne/gether"
						target="_blank"
						rel="noopener noreferrer"
						class="text-foreground underline underline-offset-4 hover:text-primary"
						>View the source code on GitHub</a
					>.
				</p>
			</section>
		</main>
	</div>
{/if}
