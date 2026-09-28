<script>
	export let data;
	import { crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let currentTime = new Date().toLocaleTimeString();
	let searchInput = data.searchQuery || '';
	let isSearching = false;

	onMount(() => {
		const timer = setInterval(() => {
			currentTime = new Date().toLocaleTimeString();
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	});

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
		fallback(node, params) {
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

<div class="container mx-auto flex flex-col gap-4 px-4 py-8 md:gap-6">
	<!-- Jumbotron -->
	<div class="rounded rounded-lg bg-black/80 p-6 uppercase">
		<h1
			class="font-display from-primary to-secondary bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent md:text-5xl"
		>
			Alex's Transit Cards
		</h1>
		<div class="text-base-300 mt-2 font-mono text-2xl md:text-3xl">
			{data.totalAllCards} total cards
		</div>
	</div>

	<!-- I'm feeling lucky button -->
	<div class="text-center">
		<a
			href="/feeling-lucky"
			class="btn btn-xl btn-block from-primary to-secondary border-neutral-content/20 text-secondary-content inline-flex items-center gap-2 bg-linear-to-r py-8 font-mono text-lg transition-all hover:scale-103 md:py-0 md:text-xl"
		>
			🎲 I'm Feeling Lucky - Random Card!
		</a>
	</div>

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

	{#if data.totalPages >= 1}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each data.transit_cards as card (card.id)}
				<a
					href={`/card/${card.id}`}
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

	<!-- Pagination Controls -->
	{#if data.totalPages > 1}
		<div class="join mt-8 flex justify-center">
			<!-- Previous Button -->
			{#if data.currentPage > 1}
				<a
					href="?page={data.currentPage - 1}{data.selectedAgency
						? `&agency=${data.selectedAgency}`
						: ''}{data.searchQuery ? `&search=${encodeURIComponent(data.searchQuery)}` : ''}"
					class="join-item btn lg:btn-xl">« Prev</a
				>
			{:else}
				<button class="join-item btn btn-disabled lg:btn-xl">« Prev</button>
			{/if}

			<!-- Page Number Buttons -->
			{#each Array(data.totalPages) as _, i}
				{@const pageNum = i + 1}
				{#if pageNum === data.currentPage}
					<button class="join-item btn lg:btn-xl btn-active">{pageNum}</button>
				{:else if pageNum === 1 || pageNum === data.totalPages || (pageNum >= data.currentPage - 2 && pageNum <= data.currentPage + 2)}
					<a
						href="?page={pageNum}{data.selectedAgency
							? `&agency=${data.selectedAgency}`
							: ''}{data.searchQuery ? `&search=${encodeURIComponent(data.searchQuery)}` : ''}"
						class="join-item btn lg:btn-xl">{pageNum}</a
					>
				{:else if (pageNum === data.currentPage - 3 && pageNum > 1 && data.currentPage - 3 !== 1) || (pageNum === data.currentPage + 3 && pageNum < data.totalPages && data.currentPage + 3 !== data.totalPages)}
					<button class="join-item btn lg:btn-xl btn-disabled">...</button>
				{/if}
			{/each}

			<!-- Next Button -->
			{#if data.currentPage < data.totalPages}
				<a
					href="?page={data.currentPage + 1}{data.selectedAgency
						? `&agency=${data.selectedAgency}`
						: ''}{data.searchQuery ? `&search=${encodeURIComponent(data.searchQuery)}` : ''}"
					class="join-item btn lg:btn-xl">Next »</a
				>
			{:else}
				<button class="join-item btn btn-disabled lg:btn-xl">Next »</button>
			{/if}
		</div>
	{:else if data.transit_cards.length === 0}
		<div class="border-neutral-content/20 rounded-lg border bg-black/80 p-6 text-center">
			<p class="text-neutral-content/70 font-mono text-lg">
				Oops! No cards found. Try adjusting your search or filters.
			</p>
		</div>
	{/if}
</div>
