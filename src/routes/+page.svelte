<script>
  export let data;
  import { crossfade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

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

<div class="hero bg-base-200 py-10">
  <div class="hero-content text-center">
    <div class="max-w-4xl">
      <h1 class="text-5xl font-bold font-display">Welcome to Alex's Transit Cards</h1>
      <p class="py-6">
        A listing of all the transit cards in my collection. Click on a card to view more details.
      </p>
    </div>
  </div>
</div>

<div class="container px-4 mx-auto py-10">
  <h2 class="text-3xl font-bold font-display mb-6">My Transit Cards ({data.totalCount} cards)</h2>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
    {#each data.transit_cards as card (card.id)}
      <a
        href={`/card/${card.id}`}
        class="card bg-base-100 shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
        in:receive={{ key: card.id }}
        out:send={{ key: card.id }}
      >
        <figure>
          <img src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=400" alt={card.name} class="w-full aspect-[3.375/2.125] object-cover" loading="lazy" />
        </figure>
        <div class="card-body">
          <h3 class="card-title font-display">{card.name}</h3>
            <p>{card.issuing_agency.name} - {card.issuing_agency.city}</p>
        </div>
      </a>
    {/each}
  </div>

  <!-- Pagination Controls -->
  {#if data.totalPages > 1}
    <div class="join mt-8 flex justify-center">
      <!-- Previous Button -->
      {#if data.currentPage > 1}
        <a href="?page={data.currentPage - 1}" class="join-item btn">« Prev</a>
      {:else}
        <button class="join-item btn btn-disabled">« Prev</button>
      {/if}

      <!-- Page Number Buttons -->
      {#each Array(data.totalPages) as _, i}
        {@const pageNum = i + 1}
        {#if pageNum === data.currentPage}
          <button class="join-item btn btn-active">{pageNum}</button>
        {:else if pageNum === 1 || pageNum === data.totalPages || (pageNum >= data.currentPage - 2 && pageNum <= data.currentPage + 2)}
          <a href="?page={pageNum}" class="join-item btn">{pageNum}</a>
        {:else if (pageNum === data.currentPage - 3 && pageNum > 1 && data.currentPage - 3 !== 1) || (pageNum === data.currentPage + 3 && pageNum < data.totalPages && data.currentPage + 3 !== data.totalPages)}
          <button class="join-item btn btn-disabled">...</button>
        {/if}
      {/each}

      <!-- Next Button -->
      {#if data.currentPage < data.totalPages}
        <a href="?page={data.currentPage + 1}" class="join-item btn">Next »</a>
      {:else}
        <button class="join-item btn btn-disabled">Next »</button>
      {/if}
    </div>
  {/if}
</div>
