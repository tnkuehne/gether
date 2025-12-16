<script lang="ts">
	import { page } from '$app/state';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { onMount, onDestroy } from 'svelte';
	import CodeMirror from '$lib/components/editor/CodeMirror.svelte';
	import { Octokit } from 'octokit';

	const { org, repo, branch } = $derived(page.params);
	const path = $derived(page.params.path);

	let fileData = $state<any>(null);
	let repoData = $state<any>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let content = $state('');
	let originalContent = $state(''); // Store original GitHub content
	let ws = $state<WebSocket | null>(null);
	let isRemoteUpdate = $state(false);
	let lastValue = $state('');
	let remoteCursors = $state<Map<string, { position: number; color: string }>>(new Map());
	let myConnectionId = $state<string>('');
	let editorRef: any = null;
	let hasUnsavedChanges = $derived(content !== originalContent);

	async function fetchGitHubData() {
		try {
			const octokit = new Octokit();

			// Fetch file content
			const { data: fileResponse } = await octokit.rest.repos.getContent({
				owner: org,
				repo: repo,
				path: path,
				ref: branch
			});

			if ('content' in fileResponse && fileResponse.type === 'file') {
				const decodedContent = atob(fileResponse.content);

				fileData = {
					content: decodedContent,
					url: fileResponse.html_url,
					downloadUrl: fileResponse.download_url,
					sha: fileResponse.sha,
					size: fileResponse.size,
					name: fileResponse.name
				};

				content = decodedContent;
				originalContent = decodedContent;
				lastValue = decodedContent;
			} else if (Array.isArray(fileResponse)) {
				error = 'Path is a directory, not a file';
				loading = false;
				return;
			} else {
				error = 'Invalid file type';
				loading = false;
				return;
			}

			// Fetch repo metadata
			const { data: repoResponse } = await octokit.rest.repos.get({
				owner: org,
				repo: repo
			});

			repoData = {
				name: repoResponse.name,
				fullName: repoResponse.full_name,
				description: repoResponse.description,
				defaultBranch: repoResponse.default_branch,
				isPrivate: repoResponse.private,
				stars: repoResponse.stargazers_count,
				forks: repoResponse.forks_count,
				language: repoResponse.language,
				updatedAt: repoResponse.updated_at,
				htmlUrl: repoResponse.html_url
			};

			loading = false;

			// Connect to WebSocket after data is loaded
			connect();
		} catch (err: any) {
			if (err.status === 404) {
				error = 'File or repository not found';
			} else if (err.status === 403) {
				error = 'Rate limit exceeded or access denied';
			} else {
				error = `Failed to fetch: ${err.message}`;
			}
			loading = false;
		}
	}

	function connect() {
		if (!fileData) return;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/${org}/${repo}/blob/${branch}/${path}/ws`;

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			ws?.send(JSON.stringify({ type: 'init', content: content }));
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			switch (data.type) {
				case 'init': {
					if (data.connectionId) {
						myConnectionId = data.connectionId;
					}

					if (data.content) {
						isRemoteUpdate = true;
						content = data.content;
						lastValue = data.content;
						isRemoteUpdate = false;
					}
					break;
				}

				case 'change': {
					isRemoteUpdate = true;
					const { from, to, insert } = data.changes;
					const before = content.slice(0, from);
					const after = content.slice(to);
					content = before + insert + after;
					lastValue = content;
					isRemoteUpdate = false;
					break;
				}

				case 'cursor': {
					if (data.position !== undefined && data.connectionId && data.connectionId !== myConnectionId) {
						const color = getCursorColor(data.connectionId);
						remoteCursors.set(data.connectionId, { position: data.position, color });
						remoteCursors = new Map(remoteCursors);
					}
					break;
				}

				case 'cursor-leave': {
					if (data.connectionId) {
						remoteCursors.delete(data.connectionId);
						remoteCursors = new Map(remoteCursors);
					}
					break;
				}
			}
		};

		ws.onclose = () => {
			setTimeout(connect, 2000);
		};

		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	}

	function handleEditorChange(newValue: string) {
		if (isRemoteUpdate || !ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

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
		fetchGitHubData();
	});

	function handleCursorChange(position: number) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		ws.send(JSON.stringify({
			type: 'cursor',
			position
		}));
	}

	function getCursorColor(connectionId: string): string {
		const colors = [
			'rgba(59, 130, 246, 0.8)',   // blue
			'rgba(239, 68, 68, 0.8)',    // red
			'rgba(16, 185, 129, 0.8)',   // green
			'rgba(245, 158, 11, 0.8)',   // orange
			'rgba(139, 92, 246, 0.8)',   // purple
			'rgba(236, 72, 153, 0.8)',   // pink
			'rgba(20, 184, 166, 0.8)',   // teal
		];

		let hash = 0;
		for (let i = 0; i < connectionId.length; i++) {
			hash = connectionId.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	function handleReset() {
		if (confirm('Are you sure you want to reset to the original GitHub content? All unsaved changes will be lost.')) {
			isRemoteUpdate = true;
			content = originalContent;
			lastValue = originalContent;
			isRemoteUpdate = false;

			// Broadcast the reset to other connected clients
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({
					type: 'change',
					changes: { from: 0, to: lastValue.length, insert: originalContent }
				}));
			}
		}
	}

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});
</script>

{#if loading}
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<Card>
			<CardContent class="py-8">
				<p class="text-center text-muted-foreground">Loading file from GitHub...</p>
			</CardContent>
		</Card>
	</div>
{:else if error}
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<Card class="border-destructive bg-destructive/10">
			<CardHeader>
				<h2 class="text-xl font-semibold text-destructive">Failed to load file</h2>
			</CardHeader>
			<CardContent>
				<p class="text-destructive">{error}</p>
			</CardContent>
		</Card>
	</div>
{:else if fileData && repoData}
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
					<Button
						onclick={handleReset}
						disabled={!hasUnsavedChanges}
						variant="ghost"
						size="sm"
						title={hasUnsavedChanges ? 'Reset to original GitHub content' : 'No changes to reset'}
					>
						Reset
					</Button>
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
				<CodeMirror
					bind:this={editorRef}
					bind:value={content}
					onchange={handleEditorChange}
					oncursorchange={handleCursorChange}
					remoteCursors={Array.from(remoteCursors.values())}
				/>
			</CardContent>
		</Card>
	</div>
{/if}
