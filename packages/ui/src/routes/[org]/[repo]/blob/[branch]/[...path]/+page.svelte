<script lang="ts">
	import { page } from '$app/state';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { onDestroy, onMount } from 'svelte';
	import CodeMirror from '$lib/components/editor/CodeMirror.svelte';
	import { Octokit } from 'octokit';
	import { authClient } from '$lib/auth-client';
	import {
		GITHUB_APP_INSTALL_URL,
		commitFile
	} from '$lib/github-app';
	import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/ui/resizable';
	import { Streamdown } from 'svelte-streamdown';
	import type { PageProps } from './$types.js';

	const { data }: PageProps = $props();

	const { org, repo, branch } = $derived(page.params);
	const path = $derived(page.params.path);

	// Check if file is markdown
	const isMarkdown = $derived(
		path!.endsWith('.md') || path!.endsWith('.markdown') || path!.endsWith('.mdx') || path!.endsWith('.svx')
	);
	let showPreview = $state(true);

	const session = authClient.useSession();

	// Initialize from load function data
	let fileData = $derived(data.fileData);
	let repoData = $derived(data.repoData);
	let error = $derived<string | null>(data.error);
	let canEdit = $derived(data.canEdit);
	let needsGitHubApp = $derived(data.needsGitHubApp);
	let hasGitHubApp = $derived(data.hasGitHubApp);

	let content = $derived(data.fileData?.content ?? '');
	let originalContent = $derived(data.fileData?.content ?? '');
	let ws = $state<WebSocket | null>(null);
	let isRemoteUpdate = $state(false);
	let lastValue = $derived(data.fileData?.content ?? '');
	let remoteCursors = $state<Map<string, { position: number; color: string; userName?: string }>>(new Map());
	let remoteSelections = $state<Map<string, { from: number; to: number; color: string; userName?: string }>>(new Map());
	let myConnectionId = $state<string>('');
	let editorRef = null;
	let hasUnsavedChanges = $derived(content !== originalContent);

	// Commit dialog state
	let commitDialogOpen = $state(false);
	let commitMessage = $state('');
	let isCommitting = $state(false);
	let commitError = $state<string | null>(null);

	onMount(() => {
		// Connect WebSocket if we have file data
		if (fileData) {
			connect();
		}
	});

	function connect() {
		if (!fileData) return;

		// Only connect if user is logged in
		if (!$session.data) return;

		// Close existing connection before creating a new one
		if (ws) {
			ws.onclose = null; // Prevent reconnect logic
			ws.close();
			ws = null;
		}

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
					// Skip our own changes
					if (data.connectionId && data.connectionId === myConnectionId) {
						break;
					}

					const { from, to, insert } = data.changes;
					// Apply incremental change directly to CodeMirror
					// This also updates the bound content value
					editorRef?.applyRemoteChange({ from, to, insert });
					lastValue = content;
					break;
				}

				case 'cursor': {
					if (data.position !== undefined && data.connectionId && data.connectionId !== myConnectionId) {
						const color = getCursorColor(data.connectionId);
						remoteCursors.set(data.connectionId, {
							position: data.position,
							color,
							userName: data.userName
						});
						remoteCursors = new Map(remoteCursors);

						// If selection data is included
						if (data.selection && data.selection.from !== data.selection.to) {
							remoteSelections.set(data.connectionId, {
								from: data.selection.from,
								to: data.selection.to,
								color,
								userName: data.userName
							});
							remoteSelections = new Map(remoteSelections);
						} else {
							// No selection, remove it
							remoteSelections.delete(data.connectionId);
							remoteSelections = new Map(remoteSelections);
						}
					}
					break;
				}

				case 'cursor-leave': {
					if (data.connectionId) {
						remoteCursors.delete(data.connectionId);
						remoteCursors = new Map(remoteCursors);
						remoteSelections.delete(data.connectionId);
						remoteSelections = new Map(remoteSelections);
					}
					break;
				}
			}
		};

		ws.onclose = () => {
			// Only reconnect if still logged in
			if ($session.data) {
				setTimeout(connect, 2000);
			}
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



	function handleCursorChange(position: number, selection?: { from: number; to: number }) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		ws.send(JSON.stringify({
			type: 'cursor',
			position,
			selection,
			userName: $session.data?.user.name
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

	async function handleCommit() {
		let accessToken;

		try {
		    const response = await authClient.getAccessToken({ providerId: 'github' })
			accessToken = response.data.accessToken;
		} catch (error) {
		    console.error('Error getting access token:', error);
		    return;
		}

		if (!accessToken || !fileData || !commitMessage.trim()) {
			return;
		}

		isCommitting = true;
		commitError = null;

		try {
			const octokit = new Octokit({ auth: accessToken });
			const result = await commitFile(
				octokit,
				org,
				repo,
				path,
				branch,
				content,
				commitMessage.trim(),
				fileData.sha
			);

			// Update file data with new SHA
			fileData.sha = result.sha;
			originalContent = content;
			commitMessage = '';
			commitDialogOpen = false;
		} catch (err: any) {
			if (err.status === 409) {
				commitError = 'Conflict: The file has been modified on GitHub. Please refresh and try again.';
			} else if (err.status === 422) {
				commitError = 'The file content is unchanged or the commit message is invalid.';
			} else {
				commitError = err.message || 'Failed to commit changes';
			}
		} finally {
			isCommitting = false;
		}
	}

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<header class="mb-8 space-y-4">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="mb-2 text-3xl font-bold tracking-tight">
					{org}/{repo}
				</h1>
				{#if repoData?.description}
					<p class="text-sm text-muted-foreground">{repoData.description}</p>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if $session.data}
					<div class="flex items-center gap-2">
						<span class="text-sm text-muted-foreground">{$session.data.user.name}</span>
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
				{:else}
					<Button
						onclick={async () => {
							await authClient.signIn.social({
								provider: 'github',
								callbackURL: window.location.href,
							});
						}}
						size="sm"
					>
						Sign in with GitHub
					</Button>
				{/if}
			</div>
		</div>

		{#if fileData}
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
				{#if $session.data && !canEdit}
					<Separator orientation="vertical" class="h-4" />
					<Badge variant="secondary">Read-only</Badge>
				{/if}
			</div>
		{/if}
	</header>

	{#if error}
		<Card class="border-destructive bg-destructive/10">
			<CardHeader>
				<h2 class="text-xl font-semibold text-destructive">Failed to load file</h2>
			</CardHeader>
			<CardContent>
				<p class="text-destructive">{error}</p>
				{#if needsGitHubApp}
					<div class="mt-4 space-y-2">
						<p class="text-sm text-muted-foreground">
							{#if hasGitHubApp}
								The GitHub App is installed but doesn't have access to this repository.
								Click below to add this repository to your installation.
							{:else}
								Install our GitHub App to access private repositories with fine-grained permissions.
								You can select which specific repositories to grant access to.
							{/if}
						</p>
						<Button
							onclick={async () => {
								// Get OAuth URL with state from Better Auth
								const response = await authClient.signIn.social({
									provider: 'github',
									callbackURL: window.location.href,
									disableRedirect: true
								});

								// Extract state parameter from OAuth URL
								if (response?.data.url) {
									const oauthUrl = new URL(response.data.url);
									const state = oauthUrl.searchParams.get('state');

									window.location.href = `${GITHUB_APP_INSTALL_URL}?state=${state}`;

								}
							}}
						>
							{hasGitHubApp ? 'Configure GitHub App' : 'Install GitHub App'}
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>
	{:else if fileData && repoData}
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-4">
				<div class="flex items-center gap-3">
					<span class="font-mono text-sm font-medium">{fileData.name}</span>
					<Badge variant="outline">{repoData.language || 'Text'}</Badge>
				</div>

				<div class="flex items-center gap-2">
					{#if isMarkdown}
						<Button
							onclick={() => { showPreview = !showPreview; }}
							variant={showPreview ? 'secondary' : 'ghost'}
							size="sm"
							title={showPreview ? 'Hide preview' : 'Show preview'}
						>
							{showPreview ? 'Hide Preview' : 'Show Preview'}
						</Button>
					{/if}
					{#if canEdit}
						<Button
							onclick={() => { commitDialogOpen = true; }}
							disabled={!hasUnsavedChanges}
							size="sm"
							title={hasUnsavedChanges ? 'Commit changes to GitHub' : 'No changes to commit'}
						>
							Commit
						</Button>
						<Button
							onclick={handleReset}
							disabled={!hasUnsavedChanges}
							variant="ghost"
							size="sm"
							title={hasUnsavedChanges ? 'Reset to original GitHub content' : 'No changes to reset'}
						>
							Reset
						</Button>
					{/if}
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
				{#if isMarkdown && showPreview}
					<ResizablePaneGroup direction="horizontal" class="min-h-125">
						<ResizablePane defaultSize={50} minSize={30}>
							<CodeMirror
								bind:this={editorRef}
								bind:value={content}
								onchange={handleEditorChange}
								oncursorchange={handleCursorChange}
								remoteCursors={Array.from(remoteCursors.values())}
								remoteSelections={Array.from(remoteSelections.values())}
								readonly={!$session.data || !canEdit}
							/>
						</ResizablePane>
						<ResizableHandle withHandle />
						<ResizablePane defaultSize={50} minSize={30}>
							<div class="h-full overflow-auto bg-background p-6">
								<Streamdown
									content={content}
									baseTheme="shadcn"
								/>
							</div>
						</ResizablePane>
					</ResizablePaneGroup>
				{:else}
					<CodeMirror
						bind:this={editorRef}
						bind:value={content}
						onchange={handleEditorChange}
						oncursorchange={handleCursorChange}
						remoteCursors={Array.from(remoteCursors.values())}
						remoteSelections={Array.from(remoteSelections.values())}
						readonly={!$session.data || !canEdit}
					/>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>

<Dialog.Root bind:open={commitDialogOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Commit Changes</Dialog.Title>
			<Dialog.Description>
				Commit your changes to <span class="font-mono text-foreground">{branch}</span> branch.
			</Dialog.Description>
		</Dialog.Header>
		<Field.Field data-invalid={!!commitError}>
			<Field.Label for="commit-message">Commit message</Field.Label>
			<Input
				id="commit-message"
				bind:value={commitMessage}
				placeholder="Update {path.split('/').pop()}"
				aria-invalid={!!commitError}
				onkeydown={(e) => {
					if (e.key === 'Enter' && commitMessage.trim() && !isCommitting) {
						handleCommit();
					}
				}}
			/>
			<Field.Description>
				Describe the changes you made to this file.
			</Field.Description>
			{#if commitError}
				<Field.Error>{commitError}</Field.Error>
			{/if}
		</Field.Field>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => { commitDialogOpen = false; }}>
				Cancel
			</Button>
			<Button
				onclick={handleCommit}
				disabled={!commitMessage.trim() || isCommitting}
			>
				{isCommitting ? 'Committing...' : 'Commit'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
