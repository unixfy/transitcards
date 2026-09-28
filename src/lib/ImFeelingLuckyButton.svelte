<script>
	import { goto } from '$app/navigation';
</script>

<!-- We use a button with goto() so the navigation is not recorded in the browser's history -->

<button
	class="btn btn-xl btn-block from-primary to-secondary border-neutral-content/20 text-secondary-content inline-flex items-center gap-2 bg-linear-to-r py-8 text-center font-mono text-lg transition-all hover:scale-103 md:py-0 md:text-xl"
	title="Click to view a random card from the collection"
	on:click={() => goto(`/feeling-lucky`, { replaceState: true })}
>
	🎲 I'm Feeling Lucky - Random Card!
</button>
