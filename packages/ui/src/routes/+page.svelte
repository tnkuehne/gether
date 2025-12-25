<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import githubMark from "$lib/assets/github-mark.svg";
	import githubMarkWhite from "$lib/assets/github-mark-white.svg";
	import logo from "$lib/assets/logo.svg";
	import { authClient } from "$lib/auth-client";
	import { onMount } from "svelte";
	import CollaborativeCursor from "$lib/components/collaborative-cursor.svelte";

	// Animation state
	let timoText = $state("");
	let maxText = $state("");
	let showTimoCursor = $state(false);
	let showMaxCursor = $state(false);
	let animationComplete = $state(false);
	let hasAnimated = $state(false);

	const timoPhrase = " — in real time.";
	const maxPhrase = " together";

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
			if (document.visibilityState === "visible" && !hasAnimated) {
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
				<Button
					onclick={async () => {
						await authClient.signIn.social({
							provider: "github",
							callbackURL: "/dashboard",
						});
					}}
					size="lg"
				>
					Sign in with GitHub
				</Button>
				<Button
					href="https://gether.md/tnkuehne/gether/blob/main/README.md"
					size="lg"
					variant="outline"
				>
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
