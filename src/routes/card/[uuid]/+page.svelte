<script>
  export let data;

  // Helper function to format the date
  function formatDate(dateString) {
      if (!dateString) return '';
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
  }
</script>

<div class="container mx-auto px-4 py-10">
  <div class="card lg:card-side bg-base-100 shadow-xl mx-auto">
      <figure class="w-full max-w-1/2 aspect-[3.375/2.125] bg-base-200 flex-shrink-0">
          <img
              src="https://cms.alexwang.net/assets/{data.transit_card.image}?format=webp&width=600"
              alt={data.transit_card.name}
              class="w-full h-full object-cover"
              loading="lazy"
          />
      </figure>
      <div class="card-body">
          <h1 class="card-title text-4xl mb-4">{data.transit_card.name}</h1>

          <div class="space-y-2 mb-4">
              <p><strong>Issuing Agency:</strong> {data.transit_card.issuing_agency.name}</p>
              <p><strong>City:</strong> {data.transit_card.issuing_agency.city}</p>
              {#if data.transit_card.date_acquired}
                  <p><strong>Acquired on:</strong> {formatDate(data.transit_card.date_acquired)}</p>
              {/if}
          </div>

          {#if data.transit_card.notes}
              <div class="prose max-w-none mb-6">
                  <h2>Notes</h2>
                  {@html data.transit_card.notes}
              </div>
          {/if}

          <div class="card-actions justify-start">
              <button type="button" class="btn btn-primary btn-lg" on:click={() => history.back()}>Back to Cards</button>
          </div>
      </div>
  </div>
</div>
