<script>
    export let data;
</script>

<div class="hero bg-base-200 py-10">
  <div class="hero-content flex-col lg:flex-row">
    <img src="https://cms.alexwang.net/assets/{data.transit_card.image}" alt={data.transit_card.name} class="max-w-sm rounded-lg shadow-2xl" />
    <div class="ml-0 lg:ml-10">
      <h1 class="text-5xl font-bold">{data.transit_card.name}</h1>
      <p class="py-6">{data.transit_card.issuing_agency}</p>
      <a href="/" class="btn btn-primary">Back to Cards</a>
    </div>
  </div>
</div>