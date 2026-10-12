<script>
	export let data;
	import { crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount, tick } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import getDirectusInstance from '$lib/directus';
	import { buildCardsFilter, fetchCardsPage } from '$lib/cards';
	import ImFeelingLuckyButton from '$lib/ImFeelingLuckyButton.svelte';
	import AcquisitionChart from '$lib/AcquisitionChart.svelte';

	let searchInput = data.searchQuery || '';
	let isSearching = false;

	// Start loading the next page when the sentinel is this close to the bottom of the viewport
	const LOAD_AHEAD_PX = 800;

	// Infinite scroll state: `pages` is a contiguous, ascending range of loaded result pages
	let pages = [];
	let loadedFrom = null; // the `data` object `pages` was built from
	let generation = 0; // bumped on every reset so stale in-flight fetches are discarded
	let filterKey = '';
	let urlPage = null; // page number currently shown in the address bar
	let loadingMore = false;
	let loadingEarlier = false;
	let loadError = false;
	let sentinel;

	// Start over whenever load() returns new data (a fresh navigation or a filter change)
	$: if (data !== loadedFrom) {
		// eslint-disable-next-line no-useless-assignment -- read by this reactive block on the next update
		loadedFrom = data;
		generation++;
		filterKey = JSON.stringify([data.selectedAgency, data.searchQuery]);
		pages = [{ pageNum: data.currentPage, cards: data.transit_cards }];
		urlPage = data.currentPage;
		loadingMore = loadingEarlier = loadError = false;
	}

	$: firstLoadedPage = pages[0].pageNum;
	$: lastLoadedPage = pages[pages.length - 1].pageNum;
	$: hasEarlier = firstLoadedPage > 1 && firstLoadedPage <= data.totalPages;
	$: hasMore = lastLoadedPage < data.totalPages;
	$: items = flattenPages(pages);

	// Flatten loaded pages into one list, marking the first card of each page and skipping duplicates
	function flattenPages(pages) {
		const seen = {};
		const result = [];
		for (const { pageNum, cards } of pages) {
			let pageStart = pageNum;
			for (const card of cards) {
				if (seen[card.id]) continue;
				seen[card.id] = true;
				result.push({ card, pageStart });
				pageStart = null;
			}
		}
		return result;
	}

	function pageHref(pageNum) {
		return `?page=${pageNum}${data.selectedAgency ? `&agency=${data.selectedAgency}` : ''}${
			data.searchQuery ? `&search=${encodeURIComponent(data.searchQuery)}` : ''
		}`;
	}

	function fetchPage(pageNum) {
		const filter = buildCardsFilter(data.selectedAgency, data.searchQuery || '');
		return fetchCardsPage(getDirectusInstance(), pageNum, filter);
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		const gen = generation;
		const pageNum = lastLoadedPage + 1;
		loadingMore = true;
		loadError = false;
		try {
			const cards = await fetchPage(pageNum);
			if (gen !== generation) return;
			pages = [...pages, { pageNum, cards }];
			loadingMore = false;
			// Keep going if the new cards didn't fill the viewport
			await tick();
			maybeLoadMore();
		} catch (err) {
			if (gen !== generation) return;
			console.error('Failed to load more cards', err);
			loadingMore = false;
			loadError = true;
		}
	}

	async function loadEarlier() {
		if (loadingEarlier || !hasEarlier) return;
		const gen = generation;
		const pageNum = firstLoadedPage - 1;
		loadingEarlier = true;
		try {
			const cards = await fetchPage(pageNum);
			if (gen !== generation) return;
			// Keep the cards already on screen in place while the earlier page is inserted above them
			const anchor = document.querySelector(`[data-page-start="${firstLoadedPage}"]`);
			const before = anchor?.getBoundingClientRect().top;
			pages = [{ pageNum, cards }, ...pages];
			loadingEarlier = false;
			await tick();
			if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
		} catch (err) {
			if (gen !== generation) return;
			console.error('Failed to load earlier cards', err);
			loadingEarlier = false;
		}
	}

	function maybeLoadMore() {
		if (!sentinel || loadError) return;
		if (sentinel.getBoundingClientRect().top < window.innerHeight + LOAD_AHEAD_PX) loadMore();
	}

	// Keep `?page=` in the address bar in sync with the page of cards being viewed, so that
	// reloading or sharing the URL lands on the same spot
	function updateUrlPage() {
		if (navigating.type) return;
		let visible = firstLoadedPage;
		for (const el of document.querySelectorAll('[data-page-start]')) {
			if (el.getBoundingClientRect().top > window.innerHeight / 3) break;
			visible = Number(el.dataset.pageStart);
		}
		if (visible === urlPage) return;
		urlPage = visible;
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(visible));
		replaceState(url, page.state);
	}

	onMount(() => {
		let frame = null;
		const onScroll = () => {
			if (frame !== null) return;
			frame = requestAnimationFrame(() => {
				frame = null;
				updateUrlPage();
				maybeLoadMore();
			});
		};
		addEventListener('scroll', onScroll, { passive: true });
		addEventListener('resize', onScroll);
		onScroll();
		return () => {
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onScroll);
			if (frame !== null) cancelAnimationFrame(frame);
		};
	});

	// When returning via the back button (or reloading), bring back every loaded page and the
	// scroll position. SvelteKit restores scroll before snapshots, so scroll is re-applied here.
	export const snapshot = {
		capture: () => ({ filterKey, pages, scrollY: window.scrollY }),
		restore: async (value) => {
			if (!value || value.filterKey !== filterKey) return;
			generation++;
			pages = value.pages;
			loadingMore = loadingEarlier = loadError = false;
			await tick();
			window.scrollTo(0, value.scrollY);
		}
	};

	// Handle search form submission
	async function handleSearch(e) {
		e.preventDefault();
		isSearching = true;
		const url = new URL(window.location);
		if (searchInput.trim()) {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		await goto(url.pathname + url.search, { noScroll: true });
		isSearching = false;
	}

	// Handle agency filter change
	async function handleAgencyChange(e) {
		const value = e.target.value;
		const url = new URL(window.location);
		if (value) {
			url.searchParams.set('agency', value);
		} else {
			url.searchParams.delete('agency');
		}
		url.searchParams.set('page', '1');
		await goto(url.pathname + url.search, { noScroll: true });
	}

	const [send, receive] = crossfade({
		duration: (d) => Math.sqrt(d * 200), // Adjust duration as needed
		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 300, // Fallback duration
				easing: quintOut,
				css: (t) => `
          transform: ${transform} scale(${t});
          opacity: ${t}
        `
			};
		}
	});
</script>

<div class="flex flex-col gap-4 md:gap-6">
	<!-- I'm feeling lucky button -->
	<ImFeelingLuckyButton />

	<!-- Search & Filter Section -->
	<div class="w-full rounded-lg border bg-black/80 p-6">
		<form on:submit={handleSearch} class="space-y-4">
			<!-- Filter by Agency Dropdown -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="agency-filter" class="mb-2 block font-mono text-white uppercase"
						>Filter by Agency</label
					>
					<select
						id="agency-filter"
						class="select select-bordered border-neutral-content/20 text-neutral-content w-full bg-black/80"
						value={data.selectedAgency || ''}
						on:change={handleAgencyChange}
					>
						<option value="">All Agencies</option>
						{#each data.agencies as agency (agency.id)}
							<option value={agency.id}>{agency.name} - {agency.city}</option>
						{/each}
					</select>
				</div>

				<!-- Server-Side Full-Text Search -->
				<div>
					<label for="search-input" class="mb-2 block font-mono text-white uppercase"
						>Search Cards</label
					>
					<div class="flex gap-2">
						<input
							id="search-input"
							type="text"
							placeholder="Search by name, agency, city, or notes..."
							bind:value={searchInput}
							class="input input-bordered border-neutral-content/20 text-neutral-content placeholder-neutral-content/40 flex-1 bg-black/80"
						/>
						<button
							type="submit"
							class="btn btn-neutral bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20"
							disabled={isSearching}
						>
							{#if isSearching}
								<span class="loading loading-spinner h-5 w-5"></span>
							{:else}
								Search
							{/if}
						</button>
					</div>
				</div>
			</div>

			{#if data.selectedAgency || data.searchQuery}
				<div class="flex flex-col md:flex-row">
					<div class="bg-neutral-content/5 flex items-center justify-between rounded p-3">
						<span class="text-neutral-content/70 font-mono">
							{#if data.searchQuery}
								Search: "<span class="text-neutral-content">{data.searchQuery}</span>" -
							{/if}
							{data.totalCount} result{data.totalCount == 1 ? '' : 's'} found
						</span>
					</div>

					<button
						type="button"
						class="btn btn-neutral bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20 mt-3 md:mt-0 md:ml-auto"
						on:click={async () => {
							searchInput = '';
							const url = new URL(window.location);
							url.searchParams.delete('search');
							url.searchParams.delete('agency');
							url.searchParams.set('page', '1');
							await goto(url.pathname + url.search, { noScroll: true });
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
							></line></svg
						>

						Clear All Filters
					</button>
				</div>
			{/if}
		</form>
	</div>

	<!-- Collection growth graph (follows the active filters) -->
	<AcquisitionChart counts={data.acquisitionCounts} earliest={data.earliestAcquired} />

	{#if hasEarlier}
		<div class="flex justify-center">
			<a
				href={pageHref(firstLoadedPage - 1)}
				class="btn btn-neutral bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20 lg:btn-xl"
				on:click|preventDefault={loadEarlier}
			>
				{#if loadingEarlier}
					<span class="loading loading-spinner h-5 w-5"></span>
				{/if}
				Load earlier cards
			</a>
		</div>
	{/if}

	{#if items.length > 0}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each items as { card, pageStart } (card.id)}
				<a
					href={`/card/${card.id}`}
					data-page-start={pageStart}
					class="group border-neutral-content/20 block overflow-hidden rounded-xl border bg-black/80 shadow-xl transition-all hover:shadow-2xl lg:hover:-translate-y-3 lg:hover:scale-105"
					in:receive={{ key: card.id }}
					out:send={{ key: card.id }}
				>
					<!-- Card Image with Transit-style Frame -->
					<div class="bg-neutral-content/8 skeleton relative overflow-hidden rounded-xl">
						<div
							class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 opacity-0 backdrop-blur-sm transition-opacity lg:group-hover:opacity-100"
						>
							<span class="text-neutral-content/90 font-mono">VIEW DETAILS →</span>
						</div>
						<img
							src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=400"
							alt={card.name}
							class="aspect-[3.375/2.125] w-full object-cover"
							loading="lazy"
						/>
					</div>

					<div class="space-y-1 p-3">
						<!-- Card Information -->
						<h3 class="font-display text-primary text-md leading-5 font-bold">{card.name}</h3>
						<p class="text-neutral-content font-mono text-xs leading-4">
							{card.issuing_agency.name} ({card.issuing_agency.city})
						</p>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Infinite scroll sentinel: loads the next page as it nears the viewport, and works as a plain link without JS -->
	{#if hasMore}
		<div class="mt-8 flex justify-center">
			<a
				bind:this={sentinel}
				href={pageHref(lastLoadedPage + 1)}
				class="btn btn-neutral bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20 lg:btn-xl"
				on:click|preventDefault={loadMore}
			>
				{#if loadingMore}
					<span class="loading loading-spinner h-5 w-5"></span>
					Loading…
				{:else if loadError}
					Couldn't load more cards. Retry
				{:else}
					Load more cards
				{/if}
			</a>
		</div>
	{:else if items.length === 0}
		<div class="border-neutral-content/20 rounded-lg border bg-black/80 p-6 text-center">
			<p class="text-neutral-content/70 font-mono text-lg">
				Oops! No cards found. Try adjusting your search or filters.
			</p>
		</div>
	{/if}
</div>
