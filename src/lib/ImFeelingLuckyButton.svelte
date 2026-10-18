<script>
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { goLucky, primeLucky } from '$lib/lucky';

	let busy = $state(false);
	let onCard = $derived(page.route.id === '/card/[uuid]');

	async function lucky(event) {
		event?.preventDefault();
		if (busy) return;
		busy = true;
		try {
			await goLucky();
		} catch {
			// The server route picks a card the old way if anything above fails
			window.location.href = '/feeling-lucky';
		} finally {
			busy = false;
		}
	}

	// Choose the next card in the background once the page has settled
	onMount(() => {
		const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 800));
		idle(primeLucky);
	});

	// R draws another card, unless the visitor is typing somewhere
	function onKeydown(event) {
		if (event.key.toLowerCase() !== 'r' || event.repeat) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target;
		if (target.closest?.('input, textarea, select, [contenteditable]')) return;
		lucky(event);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- A real link, so it still works without JavaScript; with it, the card is drawn in the browser -->
<a
	href="/feeling-lucky"
	data-sveltekit-reload
	data-sveltekit-preload-data="off"
	onclick={lucky}
	aria-busy={busy}
	class="btn btn-lg md:btn-xl btn-block font-display border-0 text-base text-white shadow-sm hover:brightness-110 md:text-xl"
	style="background: linear-gradient(90deg, oklch(47% 0.12 153), oklch(48% 0.13 215) 38%, oklch(50% 0.2 275) 72%, oklch(50% 0.21 350));"
	title="Draw a random card from the collection (press R)"
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-6 w-6 {busy ? 'animate-spin motion-reduce:animate-none' : ''}"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="18" height="18" rx="4" />
		<circle cx="8.5" cy="8.5" r="1" fill="currentColor" />
		<circle cx="15.5" cy="8.5" r="1" fill="currentColor" />
		<circle cx="12" cy="12" r="1" fill="currentColor" />
		<circle cx="8.5" cy="15.5" r="1" fill="currentColor" />
		<circle cx="15.5" cy="15.5" r="1" fill="currentColor" />
	</svg>
	<span role="status">
		{#if busy}
			Finding a card…
		{:else if onCard}
			Show me another card
		{:else}
			<span class="md:hidden">Random card</span><span class="max-md:hidden"
				>I'm feeling lucky: show me a random card</span
			>
		{/if}
	</span>
	{#if !busy}
		<kbd class="kbd kbd-sm text-base-content max-md:hidden" aria-hidden="true">R</kbd>
	{/if}
</a>
