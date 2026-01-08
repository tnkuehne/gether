<script lang="ts">
	import { cn } from "$lib/utils.js";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import CloudIcon from "@lucide/svelte/icons/cloud";
	import CloudOffIcon from "@lucide/svelte/icons/cloud-off";

	type ConnectionStatus = "connected" | "connecting" | "disconnected";

	interface Props {
		status: ConnectionStatus;
		class?: string;
	}

	let { status, class: className }: Props = $props();

	const statusConfig = {
		connected: {
			label: "Synced",
			description: "Your changes are being saved",
			dotColor: "bg-emerald-500",
			iconColor: "text-emerald-600 dark:text-emerald-400",
		},
		connecting: {
			label: "Connecting",
			description: "Establishing connection...",
			dotColor: "bg-amber-500",
			iconColor: "text-amber-600 dark:text-amber-400",
		},
		disconnected: {
			label: "Offline",
			description: "Changes will sync when reconnected",
			dotColor: "bg-red-500",
			iconColor: "text-red-600 dark:text-red-400",
		},
	};

	const config = $derived(statusConfig[status]);
</script>

<Tooltip.Root>
	<Tooltip.Trigger
		class={cn(
			"flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50",
			className,
		)}
	>
		{#if status === "disconnected"}
			<CloudOffIcon class={cn("size-3.5", config.iconColor)} />
		{:else}
			<div class="relative">
				<CloudIcon class={cn("size-3.5", config.iconColor)} />
				{#if status === "connecting"}
					<span
						class={cn(
							"absolute -top-0.5 -right-0.5 size-1.5 rounded-full",
							config.dotColor,
							"animate-pulse",
						)}
					></span>
				{/if}
			</div>
		{/if}
		<span class="hidden sm:inline">{config.label}</span>
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom" class="text-xs">
		<p class="font-medium">{config.label}</p>
		<p class="text-muted-foreground">{config.description}</p>
	</Tooltip.Content>
</Tooltip.Root>
