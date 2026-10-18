<script>
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import ImFeelingLuckyButton from '$lib/ImFeelingLuckyButton.svelte';
	import { getPalette, setWash, clearWash, setHeroId } from '$lib/palette';

	let { data } = $props();

	let card = $derived(data.transit_card);
	let stage = $state();
	let tilt = $state();

	// The page ground takes on this card's colors, and the photo is named so the grid tile morphs into it
	$effect(() => {
		setHeroId(card.id);
		let current = true;
		getPalette(card.image).then((palette) => current && setWash(palette));
		return () => (current = false);
	});
	onDestroy(() => typeof document !== 'undefined' && clearWash());

	const MAX_TILT = 14; // degrees

	// Function to handle navigation
	function handleNavigation() {
		if (window.history.length > 2) {
			history.back();
		} else {
			goto('/');
		}
	}

	// Tilt the card toward a point (0..1 across the card) and slide the foil and glare with it.
	// Writes are batched into one frame, and only transforms change, so it stays on the compositor.
	let frame = 0;
	function pose(nx, ny) {
		if (frame) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = 0;
			const w = stage.clientWidth;
			const h = stage.clientHeight;
			const s = tilt.style;
			s.setProperty('--ry', `${(nx - 0.5) * 2 * MAX_TILT}deg`);
			s.setProperty('--rx', `${(0.5 - ny) * 2 * MAX_TILT}deg`);
			s.setProperty('--fx', `${(0.5 - nx) * w * 0.9}px`);
			s.setProperty('--fy', `${(0.5 - ny) * h * 0.5}px`);
			s.setProperty('--gx', `${nx * w}px`);
			s.setProperty('--gy', `${ny * h}px`);
			tilt.dataset.active = 'true';
		});
	}

	function onMove(e) {
		if (e.pointerType === 'touch' && !e.isPrimary) return;
		const rect = stage.getBoundingClientRect();
		pose((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
	}

	function onLeave() {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		tilt.dataset.active = 'false';
		for (const prop of ['--rx', '--ry']) tilt.style.setProperty(prop, '0deg');
	}

	// On phones the card also leans with the device. The listener goes on straight away: Android
	// delivers events outright, while iOS stays silent until a tap on the card grants permission.
	let motionOn = false;
	let baseline = null;
	function onOrientation(e) {
		if (e.gamma == null || e.beta == null) return;
		baseline ??= { g: e.gamma, b: e.beta };
		const clamp = (v) => Math.max(0, Math.min(1, v));
		pose(clamp(0.5 + (e.gamma - baseline.g) / 50), clamp(0.5 + (e.beta - baseline.b) / 50));
	}
	function enableMotion() {
		if (motionOn) return;
		motionOn = true;
		window.addEventListener('deviceorientation', onOrientation);
	}
	async function onTap() {
		if (motionOn || !matchMedia('(hover: none)').matches) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const Orientation = window.DeviceOrientationEvent;
		if (typeof Orientation?.requestPermission === 'function') {
			try {
				if ((await Orientation.requestPermission()) === 'granted') enableMotion();
			} catch {
				// declined or unavailable; touch tilt still works
			}
		}
	}
	onMount(() => {
		const Orientation = window.DeviceOrientationEvent;
		const touch = matchMedia('(hover: none)').matches;
		const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (touch && !calm && Orientation) {
			enableMotion();
		}
		return () => {
			window.removeEventListener('deviceorientation', onOrientation);
			if (frame) cancelAnimationFrame(frame);
		};
	});
</script>

<div class="-mx-3 overflow-x-clip px-3 md:-mx-4 md:px-4">
	<div class="lg:flex lg:items-start lg:gap-12">
		<!-- The card, front and centre -->
		<section
			class="px-1 py-6 lg:sticky lg:top-6 lg:w-[58%] lg:flex-shrink-0 lg:py-4"
			style="background: radial-gradient(70% 75% at 45% 52%, color-mix(in oklab, var(--wash-1) 38%, transparent), transparent 72%), radial-gradient(40% 45% at 82% 70%, color-mix(in oklab, var(--wash-2) 28%, transparent), transparent 62%);"
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={stage}
				class="relative mx-auto w-full [perspective:1400px]"
				onpointermove={onMove}
				onpointerleave={onLeave}
				onpointercancel={onLeave}
				onclick={onTap}
				style="touch-action: pan-y;"
			>
				<div
					bind:this={tilt}
					data-active="false"
					style:view-transition-name="card-hero"
					class="tilt motion-fancy relative aspect-[3.375/2.125] w-full rounded-[3.5%/5.5%] shadow-[0_28px_36px_-18px_rgb(0_0_0/0.5)] [transform-style:preserve-3d]"
				>
					<img
						src="https://cms.alexwang.net/assets/{card.image}?format=webp&width=1200"
						srcset="
							https://cms.alexwang.net/assets/{card.image}?format=webp&width=800 800w,
							https://cms.alexwang.net/assets/{card.image}?format=webp&width=1200 1200w,
							https://cms.alexwang.net/assets/{card.image}?format=webp&width=1800 1800w
						"
						sizes="(min-width: 1024px) 640px, 100vw"
						alt={card.name}
						class="skeleton h-full w-full rounded-[3.5%/5.5%] object-cover"
					/>
					<div class="foil rounded-[3.5%/5.5%]" aria-hidden="true"><i></i><b></b></div>
				</div>
			</div>
		</section>

		<!-- Details -->
		<div class="min-w-0 flex-grow pt-2 lg:py-4">
			<h1 class="font-display text-base-content text-3xl leading-tight font-bold md:text-4xl">
				{card.name}
			</h1>
			<div
				class="mt-3 h-1.5 w-28 rounded-full"
				style="background: linear-gradient(90deg, var(--wash-1), var(--wash-2));"
				aria-hidden="true"
			></div>

			<dl class="divide-base-content/15 border-base-content/15 mt-6 divide-y border-y">
				<div class="flex items-baseline justify-between gap-6 py-3">
					<dt class="text-base-content/80">Agency</dt>
					<dd class="text-right text-lg font-medium">{card.issuing_agency.name}</dd>
				</div>
				<div class="flex items-baseline justify-between gap-6 py-3">
					<dt class="text-base-content/80">Location</dt>
					<dd class="text-right text-lg font-medium">{card.issuing_agency.city}</dd>
				</div>
				{#if card.date_acquired}
					<div class="flex items-baseline justify-between gap-6 py-3">
						<dt class="text-base-content/80">Acquired</dt>
						<dd class="tnum text-right text-lg font-medium">{card.date_acquired}</dd>
					</div>
				{/if}
			</dl>

			{#if card.notes}
				<section class="mt-6">
					<h2 class="font-display text-xl font-bold">Notes</h2>
					<div class="prose text-base-content mt-2 max-w-prose">
						<!-- Notes come from our own Directus CMS and are trusted HTML -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html card.notes}
					</div>
				</section>
			{/if}

			<div class="pt-8">
				<button onclick={handleNavigation} class="btn btn-soft btn-block btn-lg">
					« Return to Collection
				</button>
			</div>
		</div>
	</div>

	<div class="mt-8">
		<ImFeelingLuckyButton />
	</div>
</div>

<style>
	.tilt {
		--rx: 0deg;
		--ry: 0deg;
		transform: rotateX(var(--rx)) rotateY(var(--ry));
		transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
		will-change: transform;
	}
	.tilt[data-active='true'] {
		/* Follow the pointer closely while it is over the card */
		transition: transform 0.08s linear;
	}
	.tilt[data-active='true'] .foil {
		opacity: 1;
	}
</style>
