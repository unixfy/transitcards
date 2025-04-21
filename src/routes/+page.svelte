<script>
  export let data;
</script>

<div class="hero bg-base-200 py-10">
  <div class="hero-content text-center">
    <div class="max-w-lg">
      <h1 class="text-5xl font-bold">Welcome to Transit Card Manager</h1>
      <p class="py-6">
        Keep track of all your transit cards in one place. Click on a card to view more details.
      </p>
    </div>
  </div>
</div>

<div class="container mx-auto py-10">
  <h2 class="text-3xl font-bold mb-6">My Transit Cards</h2>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
    {#each data.transit_cards as card}
      <a href={`/card/${card.id}`} class="card bg-base-100 shadow-xl hover:shadow-2xl hover:scale-105 transition-all">
        <figure>
          <img src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=400" alt={card.name} class="w-full aspect-[3.375/2.125] object-cover" loading="lazy" />
        </figure>
        <div class="card-body">
          <h3 class="card-title">{card.name}</h3>
            <p>{card.issuing_agency} - {card.city}</p>
        </div>
      </a>
    {/each}
  </div>
</div>
