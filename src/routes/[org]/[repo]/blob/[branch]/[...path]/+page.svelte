<script>
	import { getFileContent, getRepoMetadata } from './data.remote';
	import { page } from '$app/state';

	const { org, repo, branch } = $derived(page.params);
	const path = $derived(page.params.path);

	const fileData = await getFileContent({ org, repo, branch, path });
	const repoData = await getRepoMetadata({ org, repo });

	let content = $state(fileData.content);
</script>

<svelte:boundary>
	{#snippet failed(error)}
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<div class="rounded-lg border border-red-200 bg-red-50 p-6">
				<h2 class="mb-2 text-xl font-semibold text-red-900">Failed to load file</h2>
				<p class="text-red-700">{String(error?.message || error)}</p>
			</div>
		</div>
	{/snippet}

	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<header class="mb-8">
			<div class="mb-4">
				<h1 class="mb-1 text-3xl font-bold text-gray-900">
					{org}/{repo}
				</h1>
				{#if repoData.description}
					<p class="text-sm text-gray-600">{repoData.description}</p>
				{/if}
			</div>
			<div class="flex items-center gap-4 text-sm text-gray-600">
				<span class="font-mono">
					<span class="font-semibold text-green-600">{branch}</span>
					<span class="mx-2 text-gray-400">/</span>
					<span class="text-gray-700">{path}</span>
				</span>
				<span class="text-gray-400">•</span>
				<span>{(fileData.size / 1024).toFixed(2)} KB</span>
				<span class="text-gray-400">•</span>
				<span class="font-mono text-xs text-gray-500">{fileData.sha.substring(0, 7)}</span>
			</div>
		</header>

		<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
			<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
				<div class="flex items-center gap-3">
					<span class="font-mono text-sm font-medium text-gray-900">{fileData.name}</span>
					<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
						{repoData.language || 'Text'}
					</span>
				</div>
				<div class="flex items-center gap-3">
					<a
						href={fileData.downloadUrl}
						download
						class="text-sm font-medium text-gray-600 hover:text-gray-900"
					>
						Download
					</a>
					<a
						href={fileData.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
					>
						View on GitHub →
					</a>
				</div>
			</div>

			<textarea
				bind:value={content}
				class="h-150 w-full resize-none border-0 p-6 font-mono text-sm leading-6 text-gray-900 focus:outline-none"
				placeholder="Edit your markdown/mdx here..."
				spellcheck="false"
			></textarea>
		</div>
	</div>
</svelte:boundary>
