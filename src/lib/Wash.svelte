<script>
	import { wash } from './palette';

	// Two fixed layers swap in turn; fading opacity stays on the compositor, so a color change
	// never restyles or repaints the page.
	let layers = $state([
		{ c1: 'hsl(153 70% 42%)', c2: 'hsl(221 80% 52%)' },
		{ c1: 'hsl(153 70% 42%)', c2: 'hsl(221 80% 52%)' }
	]);
	let front = $state(0);
	let current = null;

	$effect(() => {
		const unsubscribe = wash.subscribe((palette) => {
			if (current && current.c1 === palette.c1 && current.c2 === palette.c2) return;
			const back = current === null ? front : 1 - front;
			layers[back] = palette;
			front = back;
			current = palette;
		});
		return unsubscribe;
	});
</script>

{#each layers as layer, i (i)}
	<div class="layer" class:on={front === i} style:--a={layer.c1} style:--b={layer.c2}></div>
{/each}

<style>
	.layer {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 1.2s ease;
		will-change: opacity;
		background:
			radial-gradient(
				56rem 38rem at 8% -8%,
				color-mix(in oklab, var(--a) 26%, transparent),
				transparent 70%
			),
			radial-gradient(
				48rem 34rem at 100% 2%,
				color-mix(in oklab, var(--b) 22%, transparent),
				transparent 70%
			),
			radial-gradient(
				44rem 30rem at 55% 112%,
				color-mix(in oklab, var(--a) 14%, transparent),
				transparent 70%
			);
	}

	.layer.on {
		opacity: 1;
	}

	:global([data-theme='emerald-dark']) .layer {
		background:
			radial-gradient(
				56rem 38rem at 8% -8%,
				color-mix(in oklab, var(--a) 34%, transparent),
				transparent 70%
			),
			radial-gradient(
				48rem 34rem at 100% 2%,
				color-mix(in oklab, var(--b) 30%, transparent),
				transparent 70%
			),
			radial-gradient(
				44rem 30rem at 55% 112%,
				color-mix(in oklab, var(--a) 18%, transparent),
				transparent 70%
			);
	}

	@media (prefers-reduced-motion: reduce) {
		.layer {
			transition: none;
		}
	}
</style>
