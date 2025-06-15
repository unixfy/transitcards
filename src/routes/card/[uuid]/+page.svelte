<script>
	import { goto } from '$app/navigation';

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

<div class="container mx-auto px-4 py-10">
  <div class="bg-black/80 border border-neutral-content/20 rounded-lg overflow-hidden max-w-6xl mx-auto">
    <!-- Transit Board Header -->
    <div class="border-neutral-content/20 px-6 py-3 flex items-center justify-between border-b font-mono text-sm uppercase">
      <div class="flex items-center gap-2">
        <span class="text-success">●</span> 
        <span class="text-neutral-content">CARD DETAILS</span>
      </div>
    </div>

    <div class="p-6 md:flex md:gap-6 items-start">
      <!-- Card Image Section - Now constrained and alongside content -->
      <div class="md:w-[400px] md:flex-shrink-0">
        <div class="bg-neutral-content/5 rounded-lg p-4">
          <div class="font-mono text-xs text-neutral-content/70 mb-2">CARD IMAGE</div>
          <div class="aspect-[3.375/2.125] rounded overflow-hidden bg-base-300">
            <img
              src="https://cms.alexwang.net/assets/{data.transit_card.image}?format=webp&width=800"
              alt={data.transit_card.name}
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <!-- Card Information Section -->
      <div class="space-y-4 mt-6 md:mt-0 md:flex-grow">
        <!-- Title -->
        <div class="bg-neutral-content/5 rounded-lg p-4">
          <div class="font-mono text-xs text-neutral-content/70 mb-1">CARD NAME</div>
          <h1 class="font-display text-3xl md:text-4xl text-primary">{data.transit_card.name}</h1>
        </div>

        <!-- Agency Info -->
        <div class="bg-neutral-content/5 rounded-lg p-4">
          <div class="font-mono text-xs text-neutral-content/70 mb-2">ISSUING AGENCY DETAILS</div>
          <div class="space-y-3">
            <div class="font-mono">
              <div class="text-xs text-neutral-content/70">AGENCY NAME</div>
              <div class="text-lg text-neutral-content">{data.transit_card.issuing_agency.name}</div>
            </div>
            <div class="font-mono">
              <div class="text-xs text-neutral-content/70">LOCATION</div>
              <div class="text-lg text-neutral-content">{data.transit_card.issuing_agency.city}</div>
            </div>
            {#if data.transit_card.date_acquired}
              <div class="font-mono">
                <div class="text-xs text-neutral-content/70">ACQUISITION DATE</div>
                <div class="text-lg text-neutral-content">{data.transit_card.date_acquired}</div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Notes Section -->
        {#if data.transit_card.notes}
          <div class="bg-neutral-content/5 rounded-lg p-4">
            <div class="font-mono text-xs text-neutral-content/70 mb-2">ADDITIONAL NOTES</div>
            <div class="prose prose-invert max-w-none text-neutral-content">
              {@html data.transit_card.notes}
            </div>
          </div>
        {/if}

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-3 pt-4">
          <button 
            on:click={handleNavigation}
            class="btn btn-lg bg-neutral-content/5 hover:bg-neutral-content/10 border-neutral-content/20 font-mono text-neutral-content"
          >
            « Return to Collection
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
