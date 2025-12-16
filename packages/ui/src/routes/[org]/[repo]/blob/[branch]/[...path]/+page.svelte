<script lang="ts">
	import { page } from '$app/state';
	import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { onDestroy } from 'svelte';
	import CodeMirror from '$lib/components/editor/CodeMirror.svelte';
	import { Octokit } from 'octokit';
	import { authClient } from '$lib/auth-client';

	const { org, repo, branch } = $derived(page.params);
	const path = $derived(page.params.path);

	const session = authClient.useSession();

	let fileData = $state<any>(null);
	let repoData = $state<any>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let canEdit = $state(false);
	let needsGitHubApp = $state(false);
	let gitHubAppInstallUrl = $state<string | null>(null);
	let hasGitHubApp = $state(false);

	let content = $state('');
	let originalContent = $state('');
	let ws = $state<WebSocket | null>(null);
	let isRemoteUpdate = $state(false);
	let lastValue = $state('');
	let remoteCursors = $state<Map<string, { position: number; color: string; userName?: string }>>(new Map());
	let remoteSelections = $state<Map<string, { from: number; to: number; color: string; userName?: string }>>(new Map());
	let myConnectionId = $state<string>('');
	let editorRef: any = null;
	let hasUnsavedChanges = $derived(content !== originalContent);

	// Get GitHub access token from Better Auth (basic OAuth for login)
	let githubToken = $state<string | undefined>(undefined);

	// Check GitHub App installation status
	async function checkGitHubAppStatus() {
		if (!$session.data) return;

		try {
			const response = await fetch('/api/github-app');
			if (response.ok) {
				const data = await response.json();
				hasGitHubApp = data.installed;
				gitHubAppInstallUrl = data.installUrl;
			}
		} catch (err) {
			console.error('Failed to check GitHub App status:', err);
		}
	}

	$effect(() => {
		if (!$session.data) {
			githubToken = undefined;
			hasGitHubApp = false;
			return;
		}

		// Check GitHub App installation status
		checkGitHubAppStatus();

		// Get OAuth token
		authClient.getAccessToken({ providerId: 'github' })
			.then(response => {
				githubToken = response?.data?.accessToken;
			})
			.catch((err) => {
				console.error('getAccessToken error:', err);
				githubToken = undefined;
			});
	});

	async function fetchFileContent(octokit: Octokit) {
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
			throw new Error('Path is a directory, not a file');
		} else {
			throw new Error('Invalid file type');
		}
	}

	async function fetchRepoMetadata(octokit: Octokit) {
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
	}

	async function checkWritePermission(octokit: Octokit) {
		try {
			const { data: userData } = await octokit.rest.users.getAuthenticated();

			// If user is the repo owner, they have write access
			if (userData.login.toLowerCase() === org.toLowerCase()) {
				canEdit = true;
				return;
			}

			// Otherwise, check collaborator permissions
			try {
				const { data: permissionData } = await octokit.rest.repos.getCollaboratorPermissionLevel({
					owner: org,
					repo: repo,
					username: userData.login
				});

				canEdit =
					permissionData.permission === 'admin' ||
					permissionData.permission === 'write' ||
					permissionData.permission === 'maintain';
			} catch (err: any) {
				// If 403, user is not a collaborator
				canEdit = false;
			}
		} catch (err: any) {
			canEdit = false;
		}
	}

	// Fetch GitHub data when auth token changes
	$effect(() => {
		// Skip if we're not authenticated yet (token still loading)
		if ($session.data && !githubToken) {
			return;
		}

		loading = true;
		error = null;
		canEdit = false;
		needsGitHubApp = false;

		const octokit = new Octokit(githubToken ? { auth: githubToken } : undefined);

		Promise.all([
			fetchFileContent(octokit),
			fetchRepoMetadata(octokit)
		])
			.then(async () => {
				if (githubToken) {
					await checkWritePermission(octokit);
				}
				loading = false;
				connect();
			})
			.catch((err: any) => {
				if (err.status === 404) {
					// Could be a private repo we don't have access to
					if ($session.data && githubToken) {
						needsGitHubApp = true;
						error = 'This appears to be a private repository. Install the GitHub App to grant access.';
					} else {
						error = 'File or repository not found';
					}
				} else if (err.status === 403) {
					error = 'Rate limit exceeded or access denied';
				} else {
					error = err.message || 'Failed to fetch';
				}
				loading = false;
			});
	});



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
					// Skip our own changes
					if (data.connectionId && data.connectionId === myConnectionId) {
						break;
					}

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

	{#if loading}
		<Card>
			<CardContent class="py-8">
				<p class="text-center text-muted-foreground">Loading file from GitHub...</p>
			</CardContent>
		</Card>
	{:else if error}
		<Card class="border-destructive bg-destructive/10">
			<CardHeader>
				<h2 class="text-xl font-semibold text-destructive">Failed to load file</h2>
			</CardHeader>
			<CardContent>
				<p class="text-destructive">{error}</p>
				{#if needsGitHubApp && gitHubAppInstallUrl}
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

									if (state && gitHubAppInstallUrl) {
										// Append state to GitHub App install URL
										window.location.href = `${gitHubAppInstallUrl}?state=${state}`;
									}
								}
							}}
						>
							{hasGitHubApp ? 'Configure GitHub App' : 'Install GitHub App'}
						</Button>
					</div>
				{:else if needsGitHubApp}
					<div class="mt-4">
						<p class="text-sm text-muted-foreground">
							GitHub App is not configured. Please set GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY.
						</p>
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
					remoteSelections={Array.from(remoteSelections.values())}
					readonly={!$session.data || !canEdit}
				/>
			</CardContent>
		</Card>
	{/if}
</div>
