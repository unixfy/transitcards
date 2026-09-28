<script>
	import { goto } from '$app/navigation';
	import ImFeelingLuckyButton from '$lib/ImFeelingLuckyButton.svelte';

	export let data;

	// Function to handle navigation
	function handleNavigation() {
		if (window.history.length > 2) {
			history.back();
		} else {
			goto('/');
		}
	}
</script>

<div
	class="border-neutral-content/20 mx-auto overflow-hidden rounded-lg border bg-black/80 mb-4 md:mb-6"
>
	<div class="items-start p-6 md:flex md:gap-6">
		<!-- Card Image Section - Now constrained and alongside content -->
		<div class="md:w-[400px] md:flex-shrink-0">
			<div class="bg-neutral-content/5 rounded-lg p-4">
				<div class="text-neutral-content/70 mb-2 font-mono text-xs">CARD IMAGE</div>
				<div class="bg-base-300 aspect-[3.375/2.125] overflow-hidden rounded">
					<img
						src="https://cms.alexwang.net/assets/{data.transit_card.image}?format=webp&width=800"
						alt={data.transit_card.name}
						class="h-full w-full object-cover"
						loading="lazy"
					/>
				</div>
			</div>
		</div>

		<!-- Card Information Section -->
		<div class="mt-6 space-y-4 md:mt-0 md:flex-grow">
			<!-- Title -->
			<div class="bg-neutral-content/5 rounded-lg p-4">
				<div class="text-neutral-content/70 mb-1 font-mono text-xs">CARD NAME</div>
				<h1 class="font-display text-primary text-2xl md:text-3xl">{data.transit_card.name}</h1>
			</div>

			<!-- Agency Info -->
			<div class="bg-neutral-content/5 rounded-lg p-4">
				<div class="space-y-3">
					<div class="font-mono">
						<div class="text-neutral-content/70 text-xs">AGENCY NAME</div>
						<div class="text-neutral-content text-lg">{data.transit_card.issuing_agency.name}</div>
					</div>
					<div class="font-mono">
						<div class="text-neutral-content/70 text-xs">LOCATION</div>
						<div class="text-neutral-content text-lg">{data.transit_card.issuing_agency.city}</div>
					</div>
					{#if data.transit_card.date_acquired}
						<div class="font-mono">
							<div class="text-neutral-content/70 text-xs">ACQUISITION DATE</div>
							<div class="text-neutral-content text-lg">{data.transit_card.date_acquired}</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Notes Section -->
			{#if data.transit_card.notes}
				<div class="bg-neutral-content/5 rounded-lg p-4">
					<div class="text-neutral-content/70 mb-2 font-mono text-xs">ADDITIONAL NOTES</div>
					<div class="prose prose-invert text-neutral-content max-w-none">
						{@html data.transit_card.notes}
					</div>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex flex-wrap gap-3 pt-4">
				<button
					on:click={handleNavigation}
					class="btn btn-block btn-lg bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20 text-neutral-content font-mono"
				>
					« Return to Collection
				</button>
			</div>
		</div>
	</div>
</div>

<ImFeelingLuckyButton/>