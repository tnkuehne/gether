<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import githubMark from "$lib/assets/github-mark.svg";
	import githubMarkWhite from "$lib/assets/github-mark-white.svg";
	import { authClient } from "$lib/auth-client";
</script>

<svelte:head>
	<title>Gether - Collaborative GitHub Markdown Editing</title>
	<meta
		name="description"
		content="Edit GitHub Markdown files collaboratively in real time. Replace github.com with gether.md and start editing together."
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
			<h1 class="mb-4 text-2xl font-semibold text-foreground sm:text-3xl">
				Edit GitHub Markdown files collaboratively — in real time.
			</h1>
			<p class="mb-8 text-muted-foreground">
				Replace <code class="rounded bg-muted px-1.5 py-0.5 text-sm">github.com</code> with
				<code class="rounded bg-muted px-1.5 py-0.5 text-sm">gether.md</code> and start editing together.
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

			<div class="mx-auto flex w-fit flex-col items-center gap-2">
				<Button href="https://gether.md/tnkuehne/gether/blob/main/README.md" size="lg">
					Try it on a GitHub Markdown file
				</Button>
				<Button
					onclick={async () => {
						await authClient.signIn.social({
							provider: "github",
							callbackURL: "/dashboard",
						});
					}}
					size="sm"
					variant="outline"
				>
					Sign in with GitHub
				</Button>
			</div>
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
					<span>Open a Markdown file on GitHub</span>
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
					<span>Edit together and commit back to GitHub</span>
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
