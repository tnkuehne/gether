<script lang="ts">
	import { getFileContent, getRepoMetadata } from './data.remote';
	import { page } from '$app/state';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { buttonVariants } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Separator } from '$lib/components/ui/separator';
	import { onMount, onDestroy } from 'svelte';

	const { org, repo, branch } = $derived(page.params);
	const path = $derived(page.params.path);

	const fileData = await getFileContent({ org, repo, branch, path });
	const repoData = await getRepoMetadata({ org, repo });

	let content = $state(fileData.content);
	let ws = $state<WebSocket | null>(null);
	let isRemoteUpdate = $state(false);
	let lastValue = $state(fileData.content);

	function connect() {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/${org}/${repo}/blob/${branch}/${path}/ws`;

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			// Request initial content and send our content to initialize DO if needed
			ws?.send(JSON.stringify({ type: 'init', content: fileData.content }));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case 'init': {
					// Only update content if DO has content (not empty)
					// This prevents overwriting GitHub content with empty DO state
					if (data.content) {
						isRemoteUpdate = true;
						content = data.content;
						lastValue = data.content;
						isRemoteUpdate = false;
					}
					break;
				}

				case 'change': {
					// Apply remote changes
					isRemoteUpdate = true;
					const { from, to, insert } = data.changes;
					const before = content.slice(0, from);
					const after = content.slice(to);
					content = before + insert + after;
					lastValue = content;
					isRemoteUpdate = false;
					break;
				}
			}
		};

		ws.onclose = () => {
			// Attempt reconnection after 2 seconds
			setTimeout(connect, 2000);
		};

		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	}

	function handleInput(event: Event) {
		if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const target = (event.target) as HTMLTextAreaElement;
		const newValue = target.value;

		// Simple diff: find where the change occurred
		let from = 0;
		while (from < lastValue.length && from < newValue.length && lastValue[from] === newValue[from]) {
			from++;
		}

		let lastEnd = lastValue.length;
		let newEnd = newValue.length;
		while (lastEnd > from && newEnd > from && lastValue[lastEnd - 1] === newValue[newEnd - 1]) {
			lastEnd--;
			newEnd--;
		}

		const insert = newValue.slice(from, newEnd);

		// Send change
		ws.send(JSON.stringify({
			type: 'change',
			changes: { from, to: lastEnd, insert }
		}));

		lastValue = newValue;
	}

	onMount(() => {
		connect();
	});

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});
</script>

<svelte:boundary>
	{#snippet failed(error)}
		<div class="container mx-auto max-w-7xl px-4 py-8">
			<Card class="border-destructive bg-destructive/10">
				<CardHeader>
					<h2 class="text-xl font-semibold text-destructive">Failed to load file</h2>
				</CardHeader>
				<CardContent>
					<p class="text-destructive">{String(error?.message || error)}</p>
				</CardContent>
			</Card>
		</div>
	{/snippet}

	<div class="container mx-auto max-w-7xl px-4 py-8">
		<header class="mb-8 space-y-4">
			<div>
				<h1 class="mb-2 text-3xl font-bold tracking-tight">
					{org}/{repo}
				</h1>
				{#if repoData.description}
					<p class="text-sm text-muted-foreground">{repoData.description}</p>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<span class="font-mono">
					<Badge
						variant="secondary"
						class="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
					>
						{branch}
					</Badge>
					<span class="mx-2">/</span>
					<span class="text-foreground">{path}</span>
				</span>
				<Separator orientation="vertical" class="h-4" />
				<span>{(fileData.size / 1024).toFixed(2)} KB</span>
				<Separator orientation="vertical" class="h-4" />
				<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
					>{fileData.sha.substring(0, 7)}</code
				>
			</div>
		</header>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-4">
				<div class="flex items-center gap-3">
					<span class="font-mono text-sm font-medium">{fileData.name}</span>
					<Badge variant="outline">{repoData.language || 'Text'}</Badge>
				</div>

				<div class="flex items-center gap-2">
					<a
						href={fileData.downloadUrl}
						download
						class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					>
						Download
					</a>
					<a
						href={fileData.url}
						target="_blank"
						rel="noopener noreferrer"
						class={buttonVariants({ variant: 'ghost', size: 'sm' })}
					>
						View on GitHub →
					</a>
				</div>
			</CardHeader>

			<Separator />

			<CardContent class="p-0">
				<Textarea
					bind:value={content}
					oninput={handleInput}
					class="min-h-150 w-full resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
					placeholder="Edit your markdown/mdx here..."
					spellcheck="false"
				/>
			</CardContent>
		</Card>
	</div>
</svelte:boundary>
