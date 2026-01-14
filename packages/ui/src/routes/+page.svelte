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
	import Users from "@lucide/svelte/icons/users";
	import Eye from "@lucide/svelte/icons/eye";
	import GitBranch from "@lucide/svelte/icons/git-branch";
	import Server from "@lucide/svelte/icons/server";

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

	const timoPhrase = " — in real time";
	const maxPhrase = ", together";

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
	<title>Gether - Collaborative Content Editor for Static Sites</title>
	<meta
		name="description"
		content="Real-time collaborative editing for markdown and static sites. Live preview, Git-native workflow, works with any static site generator. Open source and free."
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
					Edit content{timoText}{#if showTimoCursor}<CollaborativeCursor
							name="Timo"
							color="#3b82f6"
						/>{/if}{maxText}{#if showMaxCursor}<CollaborativeCursor
							name="Max"
							color="#10b981"
						/>{/if}{#if !showMaxCursor && animationComplete}.{/if}
				</h1>
				<p class="mb-8 text-lg text-muted-foreground">
					A collaborative editor for markdown and static sites. Real-time editing with live preview,
					powered by Git.
				</p>

				<div class="mx-auto mb-12 flex w-fit flex-col items-center gap-4 sm:flex-row">
					<Button onclick={handleSignIn} size="lg">Sign in with GitHub</Button>
					<Button href="/tnkuehne/gether/blob/main/README.md" size="lg" variant="outline">
						See it in action
					</Button>
				</div>

				<!-- Quick start hint -->
				<div class="rounded-lg border border-dashed p-4 text-left sm:p-6">
					<p class="mb-3 text-sm font-medium text-foreground">Quick start</p>
					<div class="font-mono text-sm">
						<div class="mb-1 text-muted-foreground">
							<span class="text-muted-foreground/60">github.com</span>/org/repo/blob/main/content.md
						</div>
						<div class="mb-1 text-muted-foreground">↓</div>
						<div class="text-foreground">
							<span class="font-medium text-primary">gether.md</span>/org/repo/blob/main/content.md
						</div>
					</div>
				</div>
			</section>

			<!-- Problem/Solution -->
			<section class="mb-16">
				<p class="text-muted-foreground">
					Git is great for code, but not for content collaboration. Merge conflicts, no real-time
					editing, and non-developers struggle with the workflow. Gether gives your content the
					editing experience it deserves—without leaving Git behind.
				</p>
			</section>

			<!-- Key Features with Icons -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">What you get</h2>
				<div class="-mx-4 grid gap-6 px-4 sm:-mx-32 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-8 sm:px-8">
					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
							<Users class="h-5 w-5 text-foreground" />
						</div>
						<div>
							<p class="font-medium text-foreground">Real-time collaboration</p>
							<p class="text-sm text-muted-foreground">
								Edit together with live cursors, like Google Docs
							</p>
						</div>
					</div>
					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
							<Eye class="h-5 w-5 text-foreground" />
						</div>
						<div>
							<p class="font-medium text-foreground">Live site preview</p>
							<p class="text-sm text-muted-foreground">See your actual site update as you type</p>
						</div>
					</div>
					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
							<GitBranch class="h-5 w-5 text-foreground" />
						</div>
						<div>
							<p class="font-medium text-foreground">Git-native workflow</p>
							<p class="text-sm text-muted-foreground">Branches, PRs, and commits—all built in</p>
						</div>
					</div>
					<div class="flex gap-4">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
							<Server class="h-5 w-5 text-foreground" />
						</div>
						<div>
							<p class="font-medium text-foreground">Any static site generator</p>
							<p class="text-sm text-muted-foreground">Works with Astro, Next.js, Hugo, and more</p>
						</div>
					</div>
				</div>
			</section>

			<!-- Who it's for -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">Built for</h2>
				<ul class="space-y-3 text-muted-foreground">
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">Content teams</span> who need to edit without learning Git</span
						>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">Developers</span> who want to keep content in code without
							the CMS overhead</span
						>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">Teams</span> who collaborate on docs, blogs, or marketing
							sites</span
						>
					</li>
				</ul>
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

			<!-- Trust & Open Source combined -->
			<section class="mb-16">
				<h2 class="mb-6 text-lg font-medium text-foreground">Open source & free</h2>
				<p class="mb-6 text-muted-foreground">
					Gether is fully open source and free to use. Self-host it on your own infrastructure or
					use the hosted version at gether.md.
				</p>
				<ul class="space-y-3 text-muted-foreground">
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">GitHub OAuth only</span>—no separate accounts to manage</span
						>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">Minimal permissions</span>—only repository contents
							access</span
						>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">Your commits</span>—all changes are attributed to you</span
						>
					</li>
					<li class="flex gap-3">
						<span class="text-foreground">•</span>
						<span
							><span class="text-foreground">No data stored</span>—content stays in your GitHub repo</span
						>
					</li>
				</ul>
			</section>

			<!-- Final CTA -->
			<section class="text-center">
				<div class="mx-auto flex w-fit flex-col items-center gap-4 sm:flex-row">
					<Button onclick={handleSignIn} size="lg">Get started</Button>
					<Button
						href="https://github.com/tnkuehne/gether"
						target="_blank"
						size="lg"
						variant="outline"
					>
						<img src={githubMark} alt="" class="h-4 w-4 dark:hidden" />
						<img src={githubMarkWhite} alt="" class="hidden h-4 w-4 dark:block" />
						Star on GitHub
					</Button>
				</div>
			</section>
		</main>
	</div>
{/if}
