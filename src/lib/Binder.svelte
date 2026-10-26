<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { cacheCards } from '$lib/cardCache';
	import { clearHeroNames, setHeroId } from '$lib/palette';
	import { rememberCollection } from '$lib/collectionReturn';

	// The binder itself, in 3D, filling the page: the same collection the way it sits on the shelf.
	// `cards` come in front-to-back binder order (see the route's loader).
	let { cards } = $props();

	// Survives leaving for a card and coming back, so the binder stays open at the same pages
	let remembered = globalThis.__binderSpread ?? null;

	let canvas = $state();
	let binder = $state.raw(null);
	let failed = $state(false);
	let spread = $state(1);
	let maxSpread = $state(1);
	let sheets = $state.raw([]);
	let handoff = $state(null); // the card photo carried into the detail page's morph

	// Which binder pages a spread shows: the back of one sheet on the left, the next on the right
	const label = $derived.by(() => {
		const left = sheets[spread - 2]?.number;
		const right = sheets[spread - 1]?.number;
		if (left && right) return `Pages ${left} and ${right}`;
		if (right) return `Page ${right}`;
		if (left) return `Page ${left}`;
		return '';
	});

	function open(card, rect, src) {
		globalThis.__binderSpread = binder?.spread ?? spread;
		// "Return to Collection" on the card page comes back here
		rememberCollection();
		clearHeroNames();
		setHeroId(card.id);
		handoff = { src, rect, name: card.name };
		// Let the overlay paint before the view transition snapshots the page
		requestAnimationFrame(async () => {
			try {
				await goto(`/card/${card.id}`);
			} catch {
				// handled below like any navigation that didn't land
			}
			// Offline, the layout may keep the visitor here; put the card back in its pocket
			if (!location.pathname.startsWith('/card/')) {
				handoff = null;
				binder?.cancelOpen();
			}
		});
	}

	onMount(() => {
		let destroyed = false;
		const isDark = () => document.documentElement.dataset.theme === 'emerald-dark';
		const themeWatch = new MutationObserver(() => binder?.setDark(isDark()));
		themeWatch.observe(document.documentElement, { attributeFilter: ['data-theme'] });

		(async () => {
			const { hasWebGL } = await import('$lib/three/cardGeometry');
			if (!hasWebGL()) return (failed = true);
			try {
				const { createBinder, toSheets } = await import('$lib/three/binder');
				// The cover labels are drawn with the site's fonts
				await document.fonts?.ready;
				if (destroyed || !canvas) return;
				cacheCards(cards);
				sheets = toSheets(cards);
				const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
				let firstVisit = true;
				try {
					firstVisit = !sessionStorage.getItem('binderOpened');
					sessionStorage.setItem('binderOpened', '1');
				} catch {
					// storage unavailable; the cover opens every time
				}
				binder = createBinder(canvas, sheets, {
					startSpread: remembered ?? 1,
					intro: firstVisit && remembered === null && !reducedMotion,
					reducedMotion,
					onOpenCard: open,
					onChange: (s, max) => {
						spread = s;
						maxSpread = max;
					}
				});
				binder.setDark(isDark());
				binder.playIntro();
			} catch (err) {
				console.error('The 3D binder could not start', err);
				failed = true;
			}
		})();

		return () => {
			destroyed = true;
			themeWatch.disconnect();
			binder?.destroy();
		};
	});

	// The binder owns the page, so the arrow keys turn it from anywhere
	function onKey(e) {
		if (!binder || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
		if (e.key === 'ArrowRight') binder.next();
		else if (e.key === 'ArrowLeft') binder.prev();
		else return;
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="page">
	<header class="bar">
		<a href="/" class="btn btn-ghost btn-lg md:btn-md">
			<svg
				viewBox="0 0 24 24"
				class="h-5 w-5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg
			>
			Collection
		</a>
		<h1 class="title">Alex's Transit Cards</h1>
	</header>

	{#if failed}
		<div class="fallback" role="alert">
			<p>This browser can't draw the 3D binder.</p>
			<a href="/" class="btn btn-soft">Browse the collection instead</a>
		</div>
	{:else}
		<main class="stage" class:ready={binder} aria-label="The binder">
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
		</main>

		<footer class="controls">
			<div class="turn" role="toolbar" aria-label="Turn the binder's pages">
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-lg"
					aria-label="Previous page"
					disabled={!binder || spread <= 1}
					onclick={() => binder.prev()}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-6 w-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg
					>
				</button>
				<p class="caption tnum" aria-live="polite">
					{#if binder}{label}{:else}Opening the binder…{/if}
				</p>
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-lg"
					aria-label="Next page"
					disabled={!binder || spread >= maxSpread}
					onclick={() => binder.next()}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-6 w-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg
					>
				</button>
			</div>
			<p class="hint">Drag a page to turn it. Tap a card to take it out.</p>
		</footer>
	{/if}
</div>

{#if handoff}
	<img
		class="handoff"
		src={handoff.src}
		alt={handoff.name}
		crossorigin="anonymous"
		style:left="{handoff.rect.left}px"
		style:top="{handoff.rect.top}px"
		style:width="{handoff.rect.width}px"
		style:height="{handoff.rect.height}px"
	/>
{/if}

<style>
	/* A lit desk for the binder to lie on, in the site's own ground colors */
	.page {
		--desk: oklch(96% 0.01 160);
		--desk-edge: oklch(90% 0.015 170);
		position: fixed;
		inset: 0;
		height: 100dvh;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		background: radial-gradient(120% 90% at 50% 45%, var(--desk) 40%, var(--desk-edge) 100%);
		color: var(--color-base-content);
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
			env(safe-area-inset-left);
	}

	:global([data-theme='emerald-dark']) .page {
		--desk: #10161d;
		--desk-edge: #05080b;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 1rem;
	}

	.title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1rem;
		color: var(--brand);
		padding-right: 0.5rem;
	}

	.stage {
		min-height: 0;
		display: grid;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		/* Vertical swipes are left to the browser; horizontal ones turn pages */
		touch-action: pan-y;
		opacity: 0;
		transform: translate3d(0, 12px, 0);
		transition:
			opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.ready canvas {
		opacity: 1;
		transform: none;
	}

	.controls {
		display: grid;
		justify-items: center;
		gap: 0.125rem;
		padding: 0.25rem 1rem 1rem;
	}

	.turn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.caption {
		min-width: 10rem;
		text-align: center;
		font-family: var(--font-display);
		font-size: 1.05rem;
	}

	.hint {
		font-size: 0.8rem;
		color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
	}

	.fallback {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1rem;
		padding: 1rem;
		text-align: center;
	}

	.handoff {
		position: fixed;
		z-index: 50;
		object-fit: cover;
		border-radius: 3.7% / 5.9%;
		view-transition-name: card-hero;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		canvas {
			transition: none;
			transform: none;
		}
	}
</style>
