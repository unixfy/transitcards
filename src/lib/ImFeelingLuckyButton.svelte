<script>
	import { goto } from '$app/navigation';
	import { rememberCollection } from '$lib/collectionReturn';

	// Where "Return to Collection" should lead after the random card; set by the card page,
	// otherwise the homepage we're on is the collection
	export let returnTo = null;

	function feelingLucky() {
		const collection =
			returnTo ?? (location.pathname === '/' ? location.pathname + location.search : null);
		if (collection) rememberCollection(collection);
		goto(`/feeling-lucky`);
	}
</script>

<!-- A random card is a normal navigation so the page we came from stays in the browser's history -->

<button
	class="btn btn-xl btn-block from-primary to-secondary border-neutral-content/20 text-secondary-content font-display inline-flex items-center gap-2 bg-linear-to-r py-8 text-center text-lg transition-all hover:scale-103 md:py-0 md:text-xl"
	title="Click to view a random card from the collection"
	on:click={feelingLucky}
>
	🎲 I'm Feeling Lucky - Random Card!
</button>
