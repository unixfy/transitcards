<script>
	import { onMount } from 'svelte';
	import { updated } from '$app/state';
	import { connection } from '$lib/connection.svelte.js';

	// A new version's service worker waits until the visitor agrees to reload, so open pages
	// never lose the files they were built with
	let registration = $state(null);
	let waiting = $state(null);
	let reloading = false;

	onMount(async () => {
		const sw = navigator.serviceWorker;
		if (!sw) return;
		const reg = await sw.ready;
		registration = reg;
		// The very first install has no controller and nothing to replace
		if (reg.waiting && sw.controller) waiting = reg.waiting;
		reg.addEventListener('updatefound', () => {
			const worker = reg.installing;
			worker?.addEventListener('statechange', () => {
				if (worker.state === 'installed' && sw.controller) waiting = worker;
			});
		});
	});

	// SvelteKit polls for a new deploy (see svelte.config.js); fetch its worker when one appears
	$effect(() => {
		if (updated.current) registration?.update().catch(() => {});
	});

	function refresh() {
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (reloading) return;
			reloading = true;
			location.reload();
		});
		waiting.postMessage('SKIP_WAITING');
	}
</script>

<div class="toast toast-center toast-bottom z-50" role="status">
	{#if waiting}
		<div class="alert bg-base-100 shadow-lg">
			<span>A new version is ready.</span>
			<button class="btn btn-sm btn-ghost" onclick={() => (waiting = null)}>Later</button>
			<button
				class="btn btn-sm border-0 text-white"
				style="background: var(--brand-solid);"
				onclick={refresh}>Refresh</button
			>
		</div>
	{/if}
	{#if connection.note}
		<div class="alert bg-base-100 shadow-lg">{connection.note}</div>
	{:else if !connection.online}
		<div class="alert bg-base-100 shadow-lg">You're offline. Showing saved cards.</div>
	{/if}
</div>
