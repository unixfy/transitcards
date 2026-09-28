<script>
	import '../app.css';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	let { data, children } = $props();
</script>

<svelte:head>
	{#if $page.data.title}
		<title>{$page.data.title} | Alex's Transit Cards</title>
	{:else}
		<title>Alex's Transit Cards</title>
	{/if}
	<title>Alex's Transit Cards</title>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Jumbotron -->
	<div class="container mx-auto mb-4 rounded rounded-lg bg-black/80 p-6 uppercase md:mb-6">
		<h1
			class="font-display from-primary to-secondary bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent md:text-5xl"
		>
			Alex's Transit Cards
		</h1>
		<div class="text-base-300 mt-2 font-mono text-2xl md:text-3xl">
			{data.totalAllCards} total cards
		</div>
	</div>

	{#key $page.url.pathname}
		<div in:fade={{ duration: 300 }}>
			{@render children()}
		</div>
	{/key}
</div>
