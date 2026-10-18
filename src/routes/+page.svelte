<script>
	export let data;
	import { crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount, tick } from 'svelte';
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import getDirectusInstance from '$lib/directus';
	import { buildCardsFilter, fetchCardsPages, CARDS_PER_PAGE } from '$lib/cards';
	import ImFeelingLuckyButton from '$lib/ImFeelingLuckyButton.svelte';
	import AcquisitionChart from '$lib/AcquisitionChart.svelte';
	import { getPalette, setWash, getHeroId, setHeroId } from '$lib/palette';

	let searchInput = data.searchQuery || '';
	let isSearching = false;

	// Start loading the next page when the sentinel is this close to the bottom of the viewport
	const LOAD_AHEAD_PX = 800;

	// Infinite scroll state: `pages` holds every loaded result page, starting from page 1
	let pages = [];
	let loadedFrom = null; // the `data` object `pages` was built from
	let generation = 0; // bumped on every reset so stale in-flight fetches are discarded
	let filterKey = '';
	let urlPage = null; // page number currently shown in the address bar
	let loadingMore = false;
	let loadError = false;
	let sentinel;

	// Start over whenever load() returns new data (a fresh navigation or a filter change)
	$: if (data !== loadedFrom) {
		// eslint-disable-next-line no-useless-assignment -- read by this reactive block on the next update
		loadedFrom = data;
		generation++;
		filterKey = JSON.stringify([data.selectedAgency, data.searchQuery]);
		// load() returns pages 1 through currentPage together; split them back into pages
		pages = [];
		for (let pageNum = 1; pageNum <= data.currentPage; pageNum++) {
			const start = (pageNum - 1) * CARDS_PER_PAGE;
			pages.push({ pageNum, cards: data.transit_cards.slice(start, start + CARDS_PER_PAGE) });
		}
		// Read from the URL itself so an out-of-range ?page= gets corrected on the first scroll check
		urlPage = Number(page.url.searchParams.get('page')) || 1;
		loadingMore = loadError = false;
	}

	$: lastLoadedPage = pages[pages.length - 1].pageNum;
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
		return fetchCardsPages(getDirectusInstance(), pageNum, filter);
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

	function maybeLoadMore() {
		if (!sentinel || loadError) return;
		if (sentinel.getBoundingClientRect().top < window.innerHeight + LOAD_AHEAD_PX) loadMore();
	}

	// Keep `?page=` in the address bar in sync with the page of cards being viewed, so that
	// reloading or sharing the URL lands on the same spot
	function updateUrlPage() {
		if (navigating.type) return;
		let visible = 1;
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

	// Each tile borrows its card's colors on hover and
	// tints the page ground while it sits in the middle of the viewport
	let washObserver;
	let washTimer;

	function tile(node, card) {
		let palette;
		const onEnter = async () => {
			palette ??= await getPalette(card.image);
			node.style.setProperty('--c1', palette.c1);
			node.style.setProperty('--c2', palette.c2);
		};
		node.addEventListener('pointerenter', onEnter);
		node.__card = card;
		washObserver?.observe(node);
		return {
			destroy() {
				node.removeEventListener('pointerenter', onEnter);
				washObserver?.unobserve(node);
			}
		};
	}

	// The shimmering placeholder keeps animating behind loaded photos unless it is taken away
	function loaded(img) {
		const done = () => img.closest('figure')?.classList.remove('skeleton');
		if (img.complete) done();
		else img.addEventListener('load', done, { once: true });
	}

	// Name the tapped photo so the browser can morph it into the detail page
	function heroOnClick(e, card) {
		for (const el of document.querySelectorAll('[data-hero]')) {
			el.style.viewTransitionName = '';
			el.removeAttribute('data-hero');
		}
		const img = e.currentTarget.querySelector('img');
		img.style.viewTransitionName = 'card-hero';
		img.dataset.hero = '';
		setHeroId(card.id);
	}

	// Card details are hidden unless the visitor opts in; the choice is remembered
	let showInfo = false;

	function toggleInfo() {
		showInfo = !showInfo;
		try {
			localStorage.setItem('showCardInfo', showInfo ? '1' : '0');
		} catch {
			// storage unavailable (private mode); the toggle still works for this visit
		}
	}

	onMount(() => {
		washObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target.__card) {
						// Wait for the scroll to settle so a fast flick doesn't trigger a color change per card
						const card = entry.target.__card;
						clearTimeout(washTimer);
						washTimer = setTimeout(() => getPalette(card.image).then(setWash), 260);
					}
				}
			},
			{ rootMargin: '-42% 0px -42% 0px' }
		);
		for (const el of document.querySelectorAll('[data-tile]')) washObserver.observe(el);
		try {
			showInfo = localStorage.getItem('showCardInfo') === '1';
		} catch {
			// ignore
		}
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
			washObserver?.disconnect();
			clearTimeout(washTimer);
			removeEventListener('scroll', onScroll);
			removeEventListener('resize', onScroll);
			if (frame !== null) cancelAnimationFrame(frame);
		};
	});

	// Landing on ?page=N (a link, a typed URL or a fresh tab) starts the view at page N, with the
	// earlier pages above it. Back/forward is left to the snapshot below, which runs afterwards.
	afterNavigate(({ type }) => {
		if (type === 'popstate' || data.currentPage <= 1) return;
		const pageStart = document.querySelector(`[data-page-start="${data.currentPage}"]`);
		if (pageStart) window.scrollTo(0, pageStart.getBoundingClientRect().top + window.scrollY - 16);
	});

	// When returning via the back button (or reloading), bring back every loaded page and the
	// scroll position. SvelteKit restores scroll before snapshots, so scroll is re-applied here.
	export const snapshot = {
		capture: () => ({ filterKey, pages, scrollY: window.scrollY }),
		restore: async (value) => {
			if (!value || value.filterKey !== filterKey) return;
			generation++;
			pages = value.pages;
			loadingMore = loadError = false;
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
		// Opacity only: scaling dozens of tiles at once is what makes a freshly loaded page stutter
		fallback() {
			return { duration: 240, easing: quintOut, css: (t) => `opacity: ${t}` };
		}
	});
</script>

<div class="flex flex-col gap-3 md:gap-6">
	<!-- I'm feeling lucky button -->
	<ImFeelingLuckyButton />

	<!-- Search & Filter Section -->
	<div class="card card-border bg-base-100 w-full">
		<form on:submit={handleSearch} class="card-body gap-3 p-3 md:p-6">
			<div class="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
				<!-- Filter by Agency Dropdown -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend text-sm max-md:sr-only">Filter by Agency</legend>
					<select
						id="agency-filter"
						class="select w-full"
						value={data.selectedAgency || ''}
						on:change={handleAgencyChange}
					>
						<option value="">All Agencies</option>
						{#each data.agencies as agency (agency.id)}
							<option value={agency.id}>{agency.name} - {agency.city}</option>
						{/each}
					</select>
				</fieldset>

				<!-- Server-Side Full-Text Search -->
				<fieldset class="fieldset">
					<legend class="fieldset-legend text-sm max-md:sr-only">Search Cards</legend>
					<div class="join w-full">
						<input
							id="search-input"
							type="text"
							aria-label="Search cards"
							placeholder="Search by name, agency, city, or notes..."
							bind:value={searchInput}
							class="input join-item placeholder:text-base-content/80 w-full"
						/>
						<button
							type="submit"
							class="btn join-item border-0 bg-(--brand-solid) text-white hover:brightness-110"
							disabled={isSearching}
						>
							{#if isSearching}
								<span class="loading loading-spinner"></span>
							{:else}
								Search
							{/if}
						</button>
					</div>
				</fieldset>
			</div>

			{#if data.selectedAgency || data.searchQuery}
				<div class="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
					<div role="status" class="alert alert-soft py-2">
						<span>
							{#if data.searchQuery}
								Search: "<span class="font-bold">{data.searchQuery}</span>" -
							{/if}
							{data.totalCount} result{data.totalCount == 1 ? '' : 's'} found
						</span>
					</div>

					<button
						type="button"
						class="btn btn-soft md:ml-auto"
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
							width="20"
							height="20"
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

	{#if items.length > 0}
		<label class="label text-base-content/80 -mt-1 cursor-pointer justify-end gap-3 text-sm">
			Card info
			<input
				type="checkbox"
				role="switch"
				class="toggle toggle-primary toggle-lg md:toggle-md"
				checked={showInfo}
				on:change={toggleInfo}
			/>
		</label>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
			{#each items as { card, pageStart } (card.id)}
				<!--
					The slot keeps the card's image footprint, so hover growth and the expanding info
					never shift the grid. With info toggled on, the tile flows normally instead.
				-->
				<div
					class="group relative {showInfo
						? 'flex'
						: 'aspect-[3.375/2.125]'} lg:focus-within:z-20 lg:hover:z-20"
					data-tile
					data-page-start={pageStart}
					style="--c1: var(--brand); --c2: var(--brand-2);"
					use:tile={card}
					in:receive={{ key: card.id }}
					out:send={{ key: card.id }}
				>
					<a
						href={`/card/${card.id}`}
						aria-label={card.name}
						on:click={(e) => heroOnClick(e, card)}
						class="motion-fancy card card-border bg-base-100 overflow-hidden shadow-sm transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none {showInfo
							? 'w-full'
							: 'absolute inset-x-0 top-0'} lg:hover:scale-[1.12] lg:hover:border-(--c1) lg:hover:shadow-[0_24px_34px_-14px_color-mix(in_oklab,var(--c1)_65%,transparent)] lg:focus-visible:scale-[1.12]"
					>
						<figure class="skeleton relative">
							<img
								src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=400"
								alt={card.name}
								class="aspect-[3.375/2.125] w-full rounded-none object-cover"
								use:loaded
								loading="lazy"
								style:view-transition-name={getHeroId() === card.id ? 'card-hero' : null}
							/>
						</figure>

						<!-- Card info: always shown when toggled on, otherwise it expands out on hover -->
						<div
							class="grid transition-[grid-template-rows] duration-300 ease-out {showInfo
								? 'flex-1 grid-rows-[1fr]'
								: 'grid-rows-[0fr] lg:group-focus-within:grid-rows-[1fr] lg:group-hover:grid-rows-[1fr]'}"
						>
							<div class="overflow-hidden">
								<div class="card-body gap-1 p-3">
									<h3 class="card-title font-display text-base leading-5 text-(--brand)">
										{card.name}
									</h3>
									<p class="text-xs leading-4">
										{card.issuing_agency.name} ({card.issuing_agency.city})
									</p>
								</div>
							</div>
						</div>
					</a>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Infinite scroll sentinel: loads the next page as it nears the viewport, and works as a plain link without JS -->
	{#if hasMore}
		<div class="mt-8 flex justify-center">
			<a
				bind:this={sentinel}
				href={pageHref(lastLoadedPage + 1)}
				class="btn btn-soft lg:btn-xl"
				on:click|preventDefault={loadMore}
			>
				{#if loadingMore}
					<span class="loading loading-spinner"></span>
					Loading…
				{:else if loadError}
					Couldn't load more cards. Retry
				{:else}
					Load more cards
				{/if}
			</a>
		</div>
	{:else if items.length === 0}
		<div role="alert" class="alert alert-soft justify-center text-lg">
			<span>Oops! No cards found. Try adjusting your search or filters.</span>
		</div>
	{/if}
</div>
