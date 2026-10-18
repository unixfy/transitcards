<script>
	import '../app.css';
	import { page } from '$app/stores';

	const COPY = {
		400: {
			title: 'That card number is not right',
			body: "The link doesn't look like one of the cards in the binder. It may have been cut short when it was copied."
		},
		404: {
			title: 'This stop is not on the route',
			body: "There's nothing at this address. The card may have moved, or the link may have a typo."
		},
		500: {
			title: 'The line is down for a moment',
			body: 'Something went wrong while fetching the collection. Give it a minute and try again.'
		}
	};

	const LINES = ['#1f9d6b', '#2f7fe0', '#f08a24', '#e0457b'];

	let status = $derived($page.status);
	let copy = $derived(
		COPY[status] ??
			(status >= 500
				? COPY[500]
				: {
						title: 'Something is off the route',
						body: 'This page could not be shown. Head back to the collection and keep browsing.'
					})
	);
</script>

<svelte:head>
	<title>{status} | Alex's Transit Cards</title>
</svelte:head>

<main class="mx-auto flex min-h-[60vh] max-w-3xl items-center py-6 md:py-14">
	<section class="card card-border bg-base-100 w-full overflow-hidden">
		<div class="card-body gap-0 p-6 md:p-12">
			<p
				class="font-display tnum text-8xl leading-none font-bold tracking-tighter text-(--brand) md:text-9xl"
				aria-label="Error {status}"
			>
				{status}
			</p>

			<!-- A route that runs out of track -->
			<div class="my-6 flex items-center md:my-8" aria-hidden="true">
				{#each LINES as color (color)}
					<span class="h-1.5 flex-1 rounded-full" style:background={color}></span>
					<span
						class="bg-base-100 -mx-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-[3px]"
						style:border-color={color}
					></span>
				{/each}
				<span class="border-base-content/30 h-0 flex-[1.5] border-t-[6px] border-dotted"></span>
				<span
					class="border-base-content/40 -ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-[3px] border-dashed"
				>
					<span class="bg-base-content/40 h-2 w-2 rounded-full"></span>
				</span>
			</div>

			<h1 class="font-display text-3xl leading-tight font-bold md:text-4xl">{copy.title}</h1>
			<p class="text-base-content/80 mt-3 max-w-[60ch] text-lg">{copy.body}</p>

			<div class="mt-8 flex flex-col gap-3 sm:flex-row">
				<a
					href="/"
					class="btn btn-lg font-display border-0 text-white shadow-sm hover:brightness-110"
					style="background: var(--brand-solid);"
				>
					Back to the collection
				</a>
			</div>
		</div>
	</section>
</main>
