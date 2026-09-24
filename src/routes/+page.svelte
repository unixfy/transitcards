<script>
	export let data;
	import { crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let currentTime = new Date().toLocaleTimeString();
	let searchInput = data.searchQuery || '';
	let isSearching = false;
	let isLoadingMore = false;
	let cards = data.transit_cards;
	let currentPage = data.currentPage;
	let hasMoreCards = data.currentPage < data.totalPages;
	let observerTarget;
	let observer;
	$: cards = data.transit_cards;
	$: currentPage = data.currentPage;
	$: hasMoreCards = data.currentPage < data.totalPages;
	$: if (!hasMoreCards) {
		isLoadingMore = false;
	}

	onMount(() => {
		const timer = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);

		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					loadMoreCards();
				}
			},
			{ rootMargin: '200px' }
		);

		if (observerTarget) {
			observer.observe(observerTarget);
		}

		return () => {
			clearInterval(timer);
			observer?.disconnect();
		};
	});

	$: if (observer && observerTarget) {
		observer.observe(observerTarget);
	}

	async function loadMoreCards() {
		if (!hasMoreCards || isLoadingMore) {
			return;
		}

		isLoadingMore = true;
		const nextPage = currentPage + 1;
		const nextUrl = new URL('/api/transit-cards', window.location.origin);
		nextUrl.searchParams.set('page', String(nextPage));

		if (data.selectedAgency) {
			nextUrl.searchParams.set('agency', data.selectedAgency);
		}
		if (data.searchQuery) {
			nextUrl.searchParams.set('search', data.searchQuery);
		}

		try {
			const response = await fetch(`${nextUrl.pathname}${nextUrl.search}`);
			if (!response.ok) {
				return;
			}

			const nextData = await response.json();
			cards = [...cards, ...nextData.transit_cards];
			currentPage = nextData.currentPage;
			hasMoreCards = nextData.hasMore;
		} finally {
			isLoadingMore = false;
		}
	}

	async function handleSearch(e) {
		e.preventDefault();
		isSearching = true;
		const url = new URL(window.location);
		if (searchInput.trim()) {
			url.searchParams.set('search', searchInput);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.delete('page');
		await goto(url.pathname + url.search, { noScroll: true });
		isSearching = false;
	}

	async function handleAgencyChange(e) {
		const value = e.target.value;
		const url = new URL(window.location);
		if (value) {
			url.searchParams.set('agency', value);
		} else {
			url.searchParams.delete('agency');
		}
		url.searchParams.delete('page');
		await goto(url.pathname + url.search, { noScroll: true });
	}

	const [send, receive] = crossfade({
		duration: (d) => Math.sqrt(d * 200),
		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 300,
				easing: quintOut,
				css: (t) => `
          transform: ${transform} scale(${t});
          opacity: ${t}
        `
			};
		}
	});
</script>

<div class="bg-base-200 text-neutral-content py-6 md:py-8">
	<div class="container mx-auto px-3 sm:px-4">
		<div class="border-neutral-content/20 mx-auto max-w-5xl rounded-lg border bg-black/85 p-4 md:p-6">
			<div
				class="border-neutral-content/20 mb-3 flex items-center justify-between border-b pb-2 font-mono text-[11px] uppercase sm:text-xs"
			>
				<div>Transit Card Collection</div>
				<div>{currentTime}</div>
			</div>

			<div class="flex items-end justify-between gap-3">
				<div>
					<h1
						class="font-display from-primary to-secondary bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent sm:text-3xl md:text-4xl"
					>
						Alex's Transit Cards
					</h1>
					<p class="text-base-300 mt-1 font-mono text-xs uppercase sm:text-sm">Card binder view</p>
				</div>
				<div class="bg-neutral-content/5 rounded px-3 py-2 text-right font-mono uppercase">
					<div class="text-[10px] opacity-70 sm:text-xs">Total Cards</div>
					<div class="text-accent text-lg sm:text-xl">{data.totalAllCards}</div>
				</div>
			</div>
		</div>

		<div class="mx-auto mt-4 max-w-5xl">
			<a
				href="/feeling-lucky"
				class="btn btn-primary btn-lg md:btn-xl shadow-primary/30 border-primary/40 text-primary-content hover:brightness-110 w-full font-display tracking-wide"
			>
				🎲 I'm Feeling Lucky — Show a Random Card
			</a>
		</div>
	</div>
</div>

<div class="container mx-auto px-3 py-4 sm:px-4 md:py-6">
	<div class="border-neutral-content/20 mx-auto mb-4 max-w-5xl rounded-lg border bg-black/85 p-3 md:p-4">
		<form on:submit={handleSearch} class="space-y-3">
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				<div>
					<label for="agency-filter" class="mb-1 block font-mono text-xs text-white uppercase"
						>Agency</label
					>
					<select
						id="agency-filter"
						class="select select-bordered border-neutral-content/20 text-neutral-content h-10 w-full bg-black/80"
						value={data.selectedAgency || ''}
						on:change={handleAgencyChange}
					>
						<option value="">All Agencies</option>
						{#each data.agencies as agency (agency.id)}
							<option value={agency.id}>{agency.name} - {agency.city}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="search-input" class="mb-1 block font-mono text-xs text-white uppercase"
						>Search</label
					>
					<div class="flex gap-2">
						<input
							id="search-input"
							type="text"
							placeholder="Name, agency, city, notes"
							bind:value={searchInput}
							class="input input-bordered border-neutral-content/20 text-neutral-content placeholder-neutral-content/40 h-10 flex-1 bg-black/80"
						/>
						<button
							type="submit"
							class="btn btn-neutral border-neutral-content/20 h-10 bg-neutral-content/5 px-4"
							disabled={isSearching}
						>
							{#if isSearching}
								<span class="loading loading-spinner h-4 w-4"></span>
							{:else}
								Search
							{/if}
						</button>
					</div>
				</div>
			</div>

			{#if data.selectedAgency || data.searchQuery}
				<div class="flex flex-col gap-2 md:flex-row md:items-center">
					<div class="bg-neutral-content/5 rounded px-3 py-2 font-mono text-xs text-neutral-200">
						{#if data.searchQuery}
							Search: "<span class="text-neutral-content">{data.searchQuery}</span>" ·
						{/if}
						{data.totalCount} result{data.totalCount == 1 ? '' : 's'}
					</div>

					<button
						type="button"
						class="btn btn-neutral border-neutral-content/20 h-10 bg-neutral-content/5 md:ml-auto"
						on:click={async () => {
							searchInput = '';
							const url = new URL(window.location);
							url.searchParams.delete('search');
							url.searchParams.delete('agency');
							url.searchParams.delete('page');
							await goto(url.pathname + url.search, { noScroll: true });
						}}
					>
						Clear Filters
					</button>
				</div>
			{/if}
		</form>
	</div>

	<div class="mx-auto max-w-6xl">
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each cards as card (card.id)}
				<a
					href={`/card/${card.id}`}
					class="group border-neutral-content/15 block overflow-hidden rounded-xl border bg-black/70 shadow-lg transition-all hover:shadow-xl lg:hover:-translate-y-1"
					in:receive={{ key: card.id }}
					out:send={{ key: card.id }}
				>
					<div class="relative overflow-hidden">
						<div
							class="absolute inset-0 hidden items-center justify-center bg-black/25 opacity-0 backdrop-blur-sm transition-opacity lg:flex lg:group-hover:opacity-100"
						>
							<span class="text-neutral-content/90 font-mono text-xs">VIEW DETAILS</span>
						</div>
						<img
							src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=400"
							alt={card.name}
							class="aspect-[3.375/2.125] w-full object-cover"
							loading="lazy"
						/>
					</div>
					<div class="space-y-1 p-2 sm:p-3">
						<h3 class="font-display text-primary truncate text-sm leading-tight sm:text-base">{card.name}</h3>
						<p class="text-neutral-content/70 truncate font-mono text-[10px] uppercase sm:text-xs">
							{card.issuing_agency.name}
						</p>
					</div>
				</a>
			{/each}
		</div>

		{#if cards.length > 0}
			<div bind:this={observerTarget} class="mt-6 flex min-h-10 items-center justify-center">
				{#if isLoadingMore}
					<span class="loading loading-spinner loading-lg"></span>
				{:else if !hasMoreCards}
					<span class="text-neutral-content/60 font-mono text-xs uppercase">End of binder</span>
				{/if}
			</div>
		{:else}
			<div class="border-neutral-content/20 rounded-lg border bg-black/80 p-6 text-center">
				<p class="text-neutral-content/70 font-mono text-sm">Oops! No cards found.</p>
			</div>
		{/if}
	</div>
</div>
