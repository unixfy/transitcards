<script>
	import '../app.css';
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import RouteLine from '$lib/RouteLine.svelte';
	import Wash from '$lib/Wash.svelte';
	import NavProgress from '$lib/NavProgress.svelte';
	import { takeLucky } from '$lib/lucky';
	import { page } from '$app/stores';
	let { data, children } = $props();

	const supportsTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

	let dark = $state(false);

	// Morph the tapped card between grid and detail where the browser can; otherwise a plain fade
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const lucky = takeLucky();
		return new Promise((resolve) => {
			const update = async () => {
				resolve();
				await navigation.complete;
			};
			// A drawn card gets its own motion (see app.css); older browsers get the plain morph
			if (lucky && window.ViewTransition && 'types' in ViewTransition.prototype) {
				document.startViewTransition({ update, types: ['lucky'] });
			} else {
				document.startViewTransition(update);
			}
		});
	});

	onMount(() => {
		dark = document.documentElement.dataset.theme === 'emerald-dark';
	});

	function toggleTheme() {
		dark = !dark;
		const theme = dark ? 'emerald-dark' : 'emerald';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// storage unavailable; the theme still applies for this visit
		}
	}
</script>

<svelte:head>
	{#if $page.route.id === '/card/[uuid]'}
		<!-- Card pages start tint-free so there is no flash of the default colors -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html '<style>html:root{--wash-1:transparent;--wash-2:transparent}</style>'}
	{/if}
	{#if $page.data.title}
		<title>{$page.data.title} | Alex's Transit Cards</title>
	{:else}
		<title>Alex's Transit Cards</title>
	{/if}
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

{#if $page.data.chromeless}
	<!-- Full-screen routes (e.g. the slideshow) render without the site chrome -->
	{@render children()}
{:else}
	<div class="site-bg">
		<NavProgress />
		<Wash neutral={$page.route.id === '/card/[uuid]'} />
		<div class="container mx-auto px-3 py-3 md:px-4 md:py-8">
			<!-- Jumbotron -->
			<header class="card card-border bg-base-100 mb-3 overflow-hidden md:mb-6">
				<div class="card-body flex-row items-center justify-between gap-3 p-4 md:items-end md:p-8">
					<div>
						<a href="/" class="block">
							<h1
								class="font-display bg-gradient-to-r from-(--brand) to-(--brand-2) bg-clip-text text-2xl leading-tight font-bold tracking-tight text-transparent min-[420px]:text-3xl md:text-5xl"
							>
								Alex's Transit Cards
							</h1>
						</a>
						<div class="text-base-content/80 tnum mt-1 text-sm md:mt-2 md:text-xl">
							<span class="text-base-content">{data.totalAllCards}</span> total cards
						</div>
					</div>
					<div class="flex items-center gap-1">
						<a
							href="/slideshow"
							class="btn btn-ghost btn-lg md:btn-md max-md:btn-square"
							title="Watch the collection as a full-screen slideshow"
							aria-label="Slideshow"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true"
								><path d="M8 5v14l11-7z" /></svg
							>
							<span class="max-md:hidden">Slideshow</span>
						</a>
						<label
							class="btn btn-ghost btn-square btn-lg swap swap-rotate md:btn-md"
							title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
						>
							<input
								type="checkbox"
								checked={dark}
								onchange={toggleTheme}
								aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
							/>
							<!-- sun: shown while dark mode is on -->
							<svg
								class="swap-on h-5 w-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								aria-hidden="true"
								><circle cx="12" cy="12" r="4" /><path
									d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
								/></svg
							>
							<!-- moon: shown while light mode is on -->
							<svg
								class="swap-off h-5 w-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg
							>
						</label>
					</div>
				</div>
				<RouteLine class="px-4 pb-4 md:px-8 md:pb-6" />
			</header>

			{#key $page.url.pathname}
				<div in:fade={{ duration: supportsTransitions ? 0 : 300 }}>
					{@render children()}
				</div>
			{/key}
		</div>
	</div>
{/if}
