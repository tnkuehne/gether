<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import githubMark from '$lib/assets/github-mark.svg';
	import githubMarkWhite from '$lib/assets/github-mark-white.svg';
</script>

<svelte:head>
	<title>Gether - Collaborative GitHub Markdown Editing</title>
	<meta name="description" content="Edit GitHub Markdown files collaboratively in real time. Replace github.com with gether.app and start editing together." />
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header with GitHub link -->
	<header class="absolute top-0 right-0 p-4 sm:p-6">
		<a
			href="https://github.com/tnkuehne/gether"
			target="_blank"
			rel="noopener noreferrer"
			class="opacity-70 hover:opacity-100 transition-opacity"
			aria-label="View source on GitHub"
		>
			<img src={githubMark} alt="GitHub" class="w-8 h-8 dark:hidden" />
			<img src={githubMarkWhite} alt="GitHub" class="w-8 h-8 hidden dark:block" />
		</a>
	</header>

	<main class="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
		<!-- Hero Section -->
		<section class="text-center mb-16">
			<h1 class="text-2xl sm:text-3xl font-semibold text-foreground mb-4">
				Edit GitHub Markdown files collaboratively — in real time.
			</h1>
			<p class="text-muted-foreground mb-8">
				Replace <code class="bg-muted px-1.5 py-0.5 rounded text-sm">github.com</code> with <code class="bg-muted px-1.5 py-0.5 rounded text-sm">gether.app</code> and start editing together.
			</p>

			<!-- URL Example -->
			<div class="bg-muted rounded-lg p-4 sm:p-6 text-left font-mono text-sm mb-8">
				<div class="text-muted-foreground mb-2">
					<span class="text-muted-foreground/60">github.com</span>/org/repo/blob/main/README.md
				</div>
				<div class="text-muted-foreground mb-2">→</div>
				<div class="text-foreground">
					<span class="text-primary font-medium">gether.timokuehne.com</span>/org/repo/blob/main/README.md
				</div>
			</div>

			<Button href="https://gether.timokuehne.com/tnkuehne/gether/blob/main/README.md" size="lg">
				Try it on a GitHub Markdown file
			</Button>
		</section>

		<!-- How it works -->
		<section class="mb-16">
			<h2 class="text-lg font-medium text-foreground mb-6">How it works</h2>
			<ol class="space-y-4 text-muted-foreground">
				<li class="flex gap-4">
					<span class="shrink-0 w-6 h-6 rounded-full bg-muted text-foreground text-sm flex items-center justify-center font-medium">1</span>
					<span>Open a Markdown file on GitHub</span>
				</li>
				<li class="flex gap-4">
					<span class="shrink-0 w-6 h-6 rounded-full bg-muted text-foreground text-sm flex items-center justify-center font-medium">2</span>
					<span>Replace <code class="bg-muted px-1.5 py-0.5 rounded text-xs">github.com</code> with <code class="bg-muted px-1.5 py-0.5 rounded text-xs">gether.app</code></span>
				</li>
				<li class="flex gap-4">
					<span class="shrink-0 w-6 h-6 rounded-full bg-muted text-foreground text-sm flex items-center justify-center font-medium">3</span>
					<span>Edit together and commit back to GitHub</span>
				</li>
			</ol>
		</section>

		<!-- Trust & Safety -->
		<section class="mb-16">
			<h2 class="text-lg font-medium text-foreground mb-6">Trust & safety</h2>
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
			<h2 class="text-lg font-medium text-foreground mb-4">Open source</h2>
			<p class="text-muted-foreground">
				Fully open source. <a href="https://github.com/tnkuehne/gether" target="_blank" rel="noopener noreferrer" class="text-foreground underline underline-offset-4 hover:text-primary">View the source code on GitHub</a>.
			</p>
		</section>
	</main>
</div>
