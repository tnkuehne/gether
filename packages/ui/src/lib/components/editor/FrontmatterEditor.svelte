<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import { Label } from "$lib/components/ui/label";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { FrontmatterField } from "$lib/frontmatter";

	let {
		fields = $bindable([]),
		readonly = false,
		onchange = undefined as ((fields: FrontmatterField[]) => void) | undefined,
	}: {
		fields?: FrontmatterField[];
		readonly?: boolean;
		onchange?: (fields: FrontmatterField[]) => void;
	} = $props();

	let isOpen = $state(true);
	let newFieldKey = $state("");
	let newFieldValue = $state("");
	let showAddField = $state(false);

	function handleFieldChange(index: number, value: string) {
		const updatedFields = [...fields];
		updatedFields[index] = { ...updatedFields[index], value };
		fields = updatedFields;
		onchange?.(updatedFields);
	}

	function handleRemoveField(index: number) {
		const updatedFields = fields.filter((_, i) => i !== index);
		fields = updatedFields;
		onchange?.(updatedFields);
	}

	function handleAddField() {
		if (!newFieldKey.trim()) return;

		const newField: FrontmatterField = {
			key: newFieldKey.trim(),
			value: newFieldValue,
			type: "string",
		};

		const updatedFields = [...fields, newField];
		fields = updatedFields;
		onchange?.(updatedFields);

		// Reset form
		newFieldKey = "";
		newFieldValue = "";
		showAddField = false;
	}

	function getTypeBadgeVariant(
		type: FrontmatterField["type"],
	): "default" | "secondary" | "outline" {
		switch (type) {
			case "boolean":
				return "default";
			case "number":
				return "secondary";
			case "date":
				return "outline";
			case "array":
				return "secondary";
			default:
				return "outline";
		}
	}

	function formatArrayValue(value: string): string {
		// If it's a JSON array, parse and display nicely
		if (value.startsWith("[")) {
			try {
				const arr = JSON.parse(value);
				if (Array.isArray(arr)) {
					return arr.join(", ");
				}
			} catch {
				// Return as-is if parsing fails
			}
		}
		return value;
	}

	function parseArrayInput(value: string): string {
		// Convert comma-separated input to JSON array
		const items = value
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s);
		return JSON.stringify(items);
	}
</script>

{#if fields.length > 0}
	<Collapsible.Root bind:open={isOpen} class="border-b bg-muted/30">
		<div class="flex items-center justify-between px-4 py-2">
			<Collapsible.Trigger class="flex items-center gap-2 text-sm font-medium hover:underline">
				<svg
					class="h-4 w-4 transition-transform {isOpen ? 'rotate-90' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				Frontmatter
				<Badge variant="secondary" class="ml-1 text-xs">{fields.length}</Badge>
			</Collapsible.Trigger>

			{#if !readonly}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => {
						showAddField = !showAddField;
					}}
				>
					{showAddField ? "Cancel" : "Add Field"}
				</Button>
			{/if}
		</div>

		<Collapsible.Content>
			<div class="px-4 pb-4">
				{#if showAddField && !readonly}
					<div class="mb-4 rounded-md border bg-background p-3">
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr_auto]">
							<div>
								<Label for="new-field-key" class="mb-1 text-xs">Key</Label>
								<Input
									id="new-field-key"
									bind:value={newFieldKey}
									placeholder="field name"
									class="h-8 text-sm"
								/>
							</div>
							<div>
								<Label for="new-field-value" class="mb-1 text-xs">Value</Label>
								<Input
									id="new-field-value"
									bind:value={newFieldValue}
									placeholder="value"
									class="h-8 text-sm"
								/>
							</div>
							<div class="flex items-end">
								<Button size="sm" onclick={handleAddField} disabled={!newFieldKey.trim()}>
									Add
								</Button>
							</div>
						</div>
					</div>
				{/if}

				<div class="grid gap-3">
					{#each fields as field, index (field.key + index)}
						<div
							class="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(100px,200px)_1fr_auto]"
						>
							<div class="flex items-center gap-2">
								<Label
									for="field-{index}"
									class="min-w-0 truncate text-sm font-medium text-muted-foreground"
								>
									{field.key}
								</Label>
								<Badge variant={getTypeBadgeVariant(field.type)} class="shrink-0 text-[10px]">
									{field.type}
								</Badge>
							</div>

							<div class="min-w-0 flex-1 overflow-hidden">
								{#if readonly}
									<div class="rounded-md bg-muted/50 px-3 py-1.5 text-sm">
										{#if field.type === "array"}
											{formatArrayValue(field.value)}
										{:else if field.type === "boolean"}
											<Badge variant={field.value === "true" ? "default" : "secondary"}>
												{field.value}
											</Badge>
										{:else}
											{field.value || "(empty)"}
										{/if}
									</div>
								{:else if field.type === "boolean"}
									<div class="flex gap-2">
										<Button
											variant={field.value === "true" ? "default" : "outline"}
											size="sm"
											onclick={() => handleFieldChange(index, "true")}
										>
											true
										</Button>
										<Button
											variant={field.value === "false" ? "default" : "outline"}
											size="sm"
											onclick={() => handleFieldChange(index, "false")}
										>
											false
										</Button>
									</div>
								{:else if field.type === "array"}
									<Input
										id="field-{index}"
										value={formatArrayValue(field.value)}
										onchange={(e) => {
											const target = e.target as HTMLInputElement;
											handleFieldChange(index, parseArrayInput(target.value));
										}}
										placeholder="item1, item2, item3"
										class="h-8 text-sm"
									/>
								{:else if field.type === "date"}
									<Input
										id="field-{index}"
										type="date"
										value={field.value.split("T")[0]}
										onchange={(e) => {
											const target = e.target as HTMLInputElement;
											handleFieldChange(index, target.value);
										}}
										class="h-8 min-w-0 text-sm"
									/>
								{:else if field.type === "number"}
									<Input
										id="field-{index}"
										type="number"
										value={field.value}
										oninput={(e) => {
											const target = e.target as HTMLInputElement;
											handleFieldChange(index, target.value);
										}}
										class="h-8 text-sm"
									/>
								{:else}
									<Input
										id="field-{index}"
										value={field.value}
										oninput={(e) => {
											const target = e.target as HTMLInputElement;
											handleFieldChange(index, target.value);
										}}
										class="h-8 text-sm"
									/>
								{/if}
							</div>

							{#if !readonly}
								<Button
									variant="ghost"
									size="sm"
									class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
									onclick={() => handleRemoveField(index)}
									title="Remove field"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/if}
