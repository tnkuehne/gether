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
	import Zap from "@lucide/svelte/icons/zap";

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

	const ssgLogos = [
		{
			name: "Astro",
			icon: "M8.358 20.162c-1.186-1.07-1.532-3.316-1.038-4.944.856 1.026 2.043 1.352 3.272 1.535 1.897.283 3.76.177 5.522-.678.202-.098.388-.229.608-.36.166.473.209.95.151 1.437-.14 1.185-.738 2.1-1.688 2.794-.38.277-.782.525-1.175.787-1.205.804-1.531 1.747-1.078 3.119l.044.148a3.158 3.158 0 0 1-1.407-1.188 3.31 3.31 0 0 1-.544-1.815c-.004-.32-.004-.642-.048-.958-.106-.769-.472-1.113-1.161-1.133-.707-.02-1.267.411-1.415 1.09-.012.053-.028.104-.045.165h.002zm-5.961-4.445s3.24-1.575 6.49-1.575l2.451-7.565c.092-.366.36-.614.662-.614.302 0 .57.248.662.614l2.45 7.565c3.85 0 6.491 1.575 6.491 1.575L16.088.727C15.93.285 15.663 0 15.303 0H8.697c-.36 0-.615.285-.784.727l-5.516 14.99z",
		},
		{
			name: "Next.js",
			icon: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
		},
		{
			name: "Hugo",
			icon: "M11.754 0a3.998 3.998 0 00-2.049.596L3.33 4.532a4.252 4.252 0 00-2.017 3.615v8.03c0 1.473.79 2.838 2.067 3.574l6.486 3.733a3.88 3.88 0 003.835.018l7.043-3.966a3.817 3.817 0 001.943-3.323V7.752a3.57 3.57 0 00-1.774-3.084L13.817.541a3.998 3.998 0 00-2.063-.54zm.022 1.674c.413-.006.828.1 1.2.315l7.095 4.127c.584.34.941.96.94 1.635v8.462c0 .774-.414 1.484-1.089 1.864l-7.042 3.966a2.199 2.199 0 01-2.179-.01l-6.485-3.734a2.447 2.447 0 01-1.228-2.123v-8.03c0-.893.461-1.72 1.221-2.19l6.376-3.935a2.323 2.323 0 011.19-.347zm-4.7 3.844V18.37h2.69v-5.62h4.46v5.62h2.696V5.518h-2.696v4.681h-4.46V5.518Z",
		},
		{
			name: "Nuxt",
			icon: "M13.4642 19.8295h8.9218c.2834 0 .5618-.0723.8072-.2098a1.5899 1.5899 0 0 0 .5908-.5732 1.5293 1.5293 0 0 0 .216-.783 1.529 1.529 0 0 0-.2167-.7828L17.7916 7.4142a1.5904 1.5904 0 0 0-.5907-.573 1.6524 1.6524 0 0 0-.807-.2099c-.2833 0-.5616.0724-.807.2098a1.5904 1.5904 0 0 0-.5907.5731L13.4642 9.99l-2.9954-5.0366a1.5913 1.5913 0 0 0-.591-.573 1.6533 1.6533 0 0 0-.8071-.2098c-.2834 0-.5617.0723-.8072.2097a1.5913 1.5913 0 0 0-.591.573L.2168 17.4808A1.5292 1.5292 0 0 0 0 18.2635c-.0001.2749.0744.545.216.783a1.59 1.59 0 0 0 .5908.5732c.2454.1375.5238.2098.8072.2098h5.6003c2.219 0 3.8554-.9454 4.9813-2.7899l2.7337-4.5922L16.3935 9.99l4.3944 7.382h-5.8586ZM7.123 17.3694l-3.9083-.0009 5.8586-9.8421 2.9232 4.921-1.9572 3.2892c-.7478 1.1967-1.5972 1.6328-2.9163 1.6328z",
		},
		{
			name: "Gatsby",
			icon: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 2.571c3.171 0 5.915 1.543 7.629 3.858l-1.286 1.115C16.886 5.572 14.571 4.286 12 4.286c-3.343 0-6.171 2.143-7.286 5.143l9.857 9.857c2.486-.857 4.373-3 4.973-5.572h-4.115V12h6c0 4.457-3.172 8.228-7.372 9.17L2.83 9.944C3.772 5.743 7.543 2.57 12 2.57zm-9.429 9.6l9.344 9.258c-2.4-.086-4.801-.943-6.601-2.743-1.8-1.8-2.743-4.201-2.743-6.515z",
		},
		{
			name: "Svelte",
			icon: "M10.354 21.125a4.44 4.44 0 0 1-4.765-1.767 4.109 4.109 0 0 1-.703-3.107 3.898 3.898 0 0 1 .134-.522l.105-.321.287.21a7.21 7.21 0 0 0 2.186 1.092l.208.063-.02.208a1.253 1.253 0 0 0 .226.83 1.337 1.337 0 0 0 1.435.533 1.231 1.231 0 0 0 .343-.15l5.59-3.562a1.164 1.164 0 0 0 .524-.778 1.242 1.242 0 0 0-.211-.937 1.338 1.338 0 0 0-1.435-.533 1.23 1.23 0 0 0-.343.15l-2.133 1.36a4.078 4.078 0 0 1-1.135.499 4.44 4.44 0 0 1-4.765-1.766 4.108 4.108 0 0 1-.702-3.108 3.855 3.855 0 0 1 1.742-2.582l5.589-3.563a4.072 4.072 0 0 1 1.135-.499 4.44 4.44 0 0 1 4.765 1.767 4.109 4.109 0 0 1 .703 3.107 3.943 3.943 0 0 1-.134.522l-.105.321-.286-.21a7.204 7.204 0 0 0-2.187-1.093l-.208-.063.02-.207a1.255 1.255 0 0 0-.226-.831 1.337 1.337 0 0 0-1.435-.532 1.231 1.231 0 0 0-.343.15L8.62 9.368a1.162 1.162 0 0 0-.524.778 1.24 1.24 0 0 0 .211.937 1.338 1.338 0 0 0 1.435.533 1.235 1.235 0 0 0 .344-.151l2.132-1.36a4.067 4.067 0 0 1 1.135-.498 4.44 4.44 0 0 1 4.765 1.766 4.108 4.108 0 0 1 .702 3.108 3.857 3.857 0 0 1-1.742 2.583l-5.589 3.562a4.072 4.072 0 0 1-1.135.499",
		},
		{
			name: "Jekyll",
			icon: "M8.073 24c-.348 0-.689-.063-1.02-.189-1.375-.525-2.104-2.02-1.726-3.402l-.015-.006.09-.226L12.399 2.01c.105-.27.057-.91.006-1.267-.016-.085-.016-.161.008-.24l.008-.023.006-.015V.458l.009-.019c.108-.292.45-.439 1.008-.439.673 0 1.602.21 2.551.573.797.307 1.523.689 2.033 1.075.602.45.842.854.707 1.2l-.031.045-.016.015c-.045.061-.09.12-.15.165-.314.271-.764.735-.84.945l-7.063 18.421-.016-.006c-.494.948-1.457 1.557-2.543 1.561H8.07l.003.006z",
		},
		{
			name: "Vite",
			icon: "m8.286 10.578.512-8.657a.306.306 0 0 1 .247-.282L17.377.006a.306.306 0 0 1 .353.385l-1.558 5.403a.306.306 0 0 0 .352.385l2.388-.46a.306.306 0 0 1 .332.438l-6.79 13.55-.123.19a.294.294 0 0 1-.252.14c-.177 0-.35-.152-.305-.369l1.095-5.301a.306.306 0 0 0-.388-.355l-1.433.435a.306.306 0 0 1-.389-.354l.69-3.375a.306.306 0 0 0-.37-.36l-2.32.536a.306.306 0 0 1-.374-.316z",
		},
		{
			name: "Docusaurus",
			icon: "M2.462 22.201h12.321a2.466 2.466 0 0 0 2.369-1.854c.026.004.052.008.079.008a.621.621 0 0 0 .615-.615.621.621 0 0 0-.615-.615c-.027 0-.053.004-.079.007l-.014-.055a.62.62 0 0 0 .378-.568.621.621 0 0 0-.615-.615.608.608 0 0 0-.371.127l-.042-.041a.606.606 0 0 0 .125-.368c0-.67-.919-.858-1.181-.241l-.055-.014c.003-.026.008-.052.008-.079a.622.622 0 0 0-.616-.615.621.621 0 0 0-.615.615h-.096a.617.617 0 0 0-1.033 0h-.717v-2.461h2.461c.115 0 .226-.017.331-.047a.307.307 0 1 0 .529-.304l.02-.021c.052.04.116.064.186.064h.002c.337 0 .428-.463.117-.591l.007-.028c.013.001.026.004.039.004a.31.31 0 0 0 .308-.308.31.31 0 0 0-.308-.308c-.013 0-.026.003-.039.004a.28.28 0 0 1-.007-.027c.327-.13-.028-.745-.305-.528l-.02-.021a.307.307 0 0 0 .062-.184c-.011-.326-.454-.416-.591-.12a1.238 1.238 0 0 0-.32-.047h-2.143a2.465 2.465 0 0 1 2.132-1.23h7.385V9.894l-8.618-.539a1.315 1.315 0 0 1-1.229-1.308c0-.688.542-1.265 1.229-1.307l8.618-.539v-1.23a2.473 2.473 0 0 0-2.462-2.462H8.615l-.307-.533a.356.356 0 0 0-.616 0l-.307.533-.308-.533a.355.355 0 0 0-.615 0l-.308.533-.308-.533a.355.355 0 0 0-.615 0l-.308.533-.008.001-.51-.51a.354.354 0 0 0-.594.159l-.168.628-.639-.171a.357.357 0 0 0-.436.435l.172.639-.628.169a.356.356 0 0 0-.16.594l.51.51v.008l-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308a2.463 2.463 0 0 1-2.13-1.231A2.465 2.465 0 0 0 0 19.74c0 1.35 1.112 2.46 2.462 2.461z",
		},
		{
			name: "Hexo",
			icon: "M12.02 0L1.596 6.02l-.02 12L11.978 24l10.426-6.02.02-12zm4.828 17.14l-.96.558-.969-.574V12.99H9.081v4.15l-.96.558-.969-.574V6.854l.964-.552.965.563v4.145h5.838V6.86l.965-.552.964.563z",
		},
		{
			name: "Gridsome",
			icon: "M12.026.017l-.108.001C4.905.135-.102 5.975.002 11.956.025 19.286 6.02 24.13 12.083 23.98c7.208-.2 12.323-6.461 11.892-12.05a2.197 2.197 0 0 0-2.192-2.001h-3.15a2.155 2.155 0 0 0-2.161 2.147c0 1.187.967 2.148 2.16 2.148h.788c-.87 2.791-3.62 5.455-7.44 5.56-3.803.095-7.61-2.904-7.768-7.569a2.173 2.173 0 0 0 0-.159c-.148-3.72 2.895-7.637 7.88-7.845a2.096 2.096 0 0 0 2.003-2.183 2.095 2.095 0 0 0-2.07-2.011zm-.018 9.911a2.15 2.15 0 0 0-2.146 2.151 2.15 2.15 0 0 0 2.146 2.152 2.15 2.15 0 0 0 2.147-2.152 2.15 2.15 0 0 0-2.147-2.15Z",
		},
		{
			name: "Zola",
			icon: "M21.379 18.017 21.083 24H2.824a.566.566 0 0 1-.565-.565V23.4c0-.313.081-.62.233-.895L12.99 3.79c.841-1.5.897-2.713-1.712-2.713s-5.386.909-6.442 5.077a.565.565 0 0 1-1.112-.17L4.019 0h16.894c-1.74.798-3.273 1.813-4.565 3.038-1.578 1.497-2.699 3.125-4.876 6.451a82 82 0 0 0-3.462 5.799 81 81 0 0 0-2.743 5.566c.764-1.08 2.02-2.507 3.96-3.425.958-.453 1.703-.602 2.083-.7a6.4 6.4 0 0 0 1.366-.534l-2.251 4.015c-.842 1.5.3 2.713 2.91 2.713 2.612 0 5.875-.909 6.93-5.077a.565.565 0 0 1 1.112.17z",
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
	<div class="container mx-auto px-4 py-6 sm:px-6 sm:py-8 touch-pan-x touch-pan-y">
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
							<Zap class="h-5 w-5 text-foreground" />
						</div>
						<div>
							<p class="font-medium text-foreground">No setup required</p>
							<p class="text-sm text-muted-foreground">
								Works with any existing GitHub repo instantly
							</p>
						</div>
					</div>
				</div>
			</section>

			<!-- SSG Logo Carousel -->
			<section class="mb-16">
				<p class="mb-6 text-center text-sm text-muted-foreground">
					Works with your favorite static site generator
				</p>
				<div class="relative -mx-4 sm:-mx-32">
					<!-- Gradient fade left -->
					<div
						class="pointer-events-none absolute top-0 left-0 z-10 h-full w-16 bg-gradient-to-r from-background to-transparent"
					></div>
					<!-- Gradient fade right -->
					<div
						class="pointer-events-none absolute top-0 right-0 z-10 h-full w-16 bg-gradient-to-l from-background to-transparent"
					></div>

					<div class="overflow-hidden">
						<div class="logo-carousel flex w-max gap-12 py-4">
							{#each [...ssgLogos, ...ssgLogos] as ssg, i (ssg.name + i)}
								<div
									class="flex shrink-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
								>
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
										<path d={ssg.icon} />
									</svg>
									<span class="text-sm font-medium">{ssg.name}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<p class="mt-4 text-center text-sm text-muted-foreground">
					...and any other that builds from markdown
				</p>
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
