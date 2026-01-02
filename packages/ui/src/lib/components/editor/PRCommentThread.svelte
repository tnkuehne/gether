<script lang="ts">
	import * as Popover from "$lib/components/ui/popover";
	import * as Avatar from "$lib/components/ui/avatar";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Textarea } from "$lib/components/ui/textarea";
	import type { PRCommentThread, PRComment } from "$lib/github-app";
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Send from "@lucide/svelte/icons/send";

	let {
		thread,
		open = $bindable(false),
		onReply = undefined as
			| ((commentId: number, body: string) => Promise<PRComment | null>)
			| undefined,
		canComment = false,
	}: {
		thread: PRCommentThread;
		open?: boolean;
		onReply?: (commentId: number, body: string) => Promise<PRComment | null>;
		canComment?: boolean;
	} = $props();

	let replyText = $state("");
	let isSubmitting = $state(false);

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		return date.toLocaleDateString();
	}

	async function handleReply() {
		if (!replyText.trim() || !onReply || isSubmitting) return;

		isSubmitting = true;
		try {
			// Reply to the first comment in the thread (which starts the conversation)
			const firstComment = thread.comments[0];
			const newComment = await onReply(firstComment.id, replyText.trim());
			if (newComment) {
				replyText = "";
			}
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
				title="{thread.comments.length} comment{thread.comments.length > 1 ? 's' : ''}"
			>
				<MessageSquare class="size-3.5 text-blue-600 dark:text-blue-400" />
				<span class="text-muted-foreground">{thread.comments.length}</span>
			</button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content class="w-96 p-0" align="start" sideOffset={8}>
		<div class="max-h-96 overflow-y-auto">
			<div class="border-b bg-muted/30 px-4 py-2">
				<div class="flex items-center gap-2 text-sm">
					<MessageSquare class="size-4" />
					<span class="font-medium">
						{thread.comments.length} comment{thread.comments.length > 1 ? "s" : ""}
					</span>
					<Badge variant="secondary" class="ml-auto text-xs">Line {thread.line}</Badge>
				</div>
			</div>

			<div class="divide-y">
				{#each thread.comments as comment (comment.id)}
					<div class="p-4">
						<div class="mb-2 flex items-start gap-3">
							<Avatar.Root class="size-8">
								<Avatar.Image src={comment.user.avatar_url} alt={comment.user.login} />
								<Avatar.Fallback>{comment.user.login[0].toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>

							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">{comment.user.login}</span>
									<span class="text-xs text-muted-foreground">
										{formatDate(comment.created_at)}
									</span>
								</div>
							</div>
						</div>

						<div class="ml-11 text-sm break-words whitespace-pre-wrap">
							{comment.body}
						</div>
					</div>
				{/each}
			</div>

			{#if canComment && onReply}
				<div class="border-t bg-muted/10 p-3">
					<div class="flex gap-2">
						<Textarea
							bind:value={replyText}
							placeholder="Write a reply..."
							class="min-h-[60px] resize-none text-sm"
							onkeydown={(e) => {
								if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									handleReply();
								}
							}}
						/>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span class="text-xs text-muted-foreground">Ctrl+Enter to submit</span>
						<Button onclick={handleReply} disabled={!replyText.trim() || isSubmitting} size="sm">
							{#if isSubmitting}
								Sending...
							{:else}
								<Send class="mr-1 size-3" />
								Reply
							{/if}
						</Button>
					</div>
				</div>
			{:else}
				<div class="border-t bg-muted/10 px-4 py-2">
					<a
						href={thread.comments[0].html_url}
						target="_blank"
						rel="noopener noreferrer external"
						data-sveltekit-reload
						class="text-xs text-blue-600 hover:underline dark:text-blue-400"
					>
						View on GitHub →
					</a>
				</div>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
