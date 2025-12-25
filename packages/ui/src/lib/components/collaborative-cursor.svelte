<script lang="ts">
	interface Props {
		name: string;
		color: string;
	}

	let { name, color }: Props = $props();
</script>

<span class="relative inline-flex items-center">
	<span
		class="absolute -top-5 left-0 rounded px-1 py-0.5 text-xs font-medium whitespace-nowrap text-white"
		style="background-color: {color};"
	>
		{name}
	</span>
	<span class="inline-block h-5 w-0.5 animate-pulse" style="background-color: {color};"></span>
</span>
