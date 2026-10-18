<script>
	import { goto } from '$app/navigation';
</script>

<!-- We use a button with goto() so the navigation is not recorded in the browser's history -->

<button
	class="btn btn-lg md:btn-xl btn-block font-display border-0 text-base text-white shadow-sm hover:brightness-110 md:text-xl"
	style="background: linear-gradient(90deg, oklch(47% 0.12 153), oklch(48% 0.13 215) 38%, oklch(50% 0.2 275) 72%, oklch(50% 0.21 350));"
	title="Click to view a random card from the collection"
	on:click={() => goto(`/feeling-lucky`, { replaceState: true })}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-6 w-6"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="18" height="18" rx="4" />
		<circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
		<circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
		<circle cx="12" cy="12" r="1" fill="currentColor" />
		<circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
		<circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
	</svg>
	<span class="md:hidden">Random card</span><span class="max-md:hidden"
		>I'm feeling lucky: show me a random card</span
	>
</button>
