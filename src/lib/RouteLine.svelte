<script>
	// A transit-map route: colored line segments joined by station dots. The colors are sampled
	// from the collection itself.
	let { class: className = '' } = $props();
	const LINES = ['#1f9d6b', '#2f7fe0', '#f08a24', '#e0457b', '#f2c230'];
</script>

<div class="flex items-center {className}" aria-hidden="true">
	{#each LINES as color, i (color)}
		<span class="h-1.5 flex-1 rounded-full" style:background={color}></span>
		{#if i < LINES.length - 1}
			<span
				class="bg-base-100 -mx-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px]"
				style:border-color={color}
			></span>
		{/if}
	{/each}
</div>
