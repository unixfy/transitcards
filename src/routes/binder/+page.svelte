<script>
	import Binder from '$lib/Binder.svelte';

	let { data } = $props();
</script>

<Binder cards={data.transit_cards} />
