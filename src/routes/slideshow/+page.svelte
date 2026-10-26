<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut, cubicInOut } from 'svelte/easing';

	let { data } = $props();

	const SLIDE_DURATION = 12000; // ms each card stays on screen
	const RELOAD_AFTER = 6 * 60 * 60 * 1000; // reload periodically to pick up new cards and deploys

	const assetUrl = (image, width) =>
		`https://cms.alexwang.net/assets/${image}?format=webp&width=${width}`;

	let deck = $state([]);
	let index = $state(0);
	let tick = $state(0); // bumps on every slide change to restart the progress animation
	let paused = $state(false);
	let showHint = $state(true);
	let now = $state(null);

	// The 3D card stream takes over the card itself when WebGL is available and motion is welcome
	let canvas = $state();
	let cardSlot = $state();
	let info = $state();
	let cloud = $state.raw(null);

	let current = $derived(deck[index]);
	let upcoming = $derived(deck.length > 1 ? deck[(index + 1) % deck.length] : null);

	function shuffle(cards) {
		const shuffled = [...cards];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	function next() {
		if (index + 1 < deck.length) {
			index++;
		} else {
			// Start a fresh shuffled round without repeating the card that was just shown
			const fresh = shuffle(data.transit_cards);
			if (fresh.length > 1 && fresh[0].id === current?.id) {
				[fresh[0], fresh[fresh.length - 1]] = [fresh[fresh.length - 1], fresh[0]];
			}
			deck = fresh;
			index = 0;
		}
		tick++;
	}

	function prev() {
		index = (index - 1 + deck.length) % deck.length;
		tick++;
	}

	function handleTap(e) {
		const x = e.clientX / window.innerWidth;
		if (x < 0.3) prev();
		else if (x > 0.7) next();
		else paused = !paused;
		showHint = false;
	}

	function handleKey(e) {
		if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === ' ') {
			e.preventDefault();
			paused = !paused;
		} else return;
		showHint = false;
	}

	$effect(() => {
		if (cloud && current) cloud.feature(current);
	});

	// Where the featured card should land: the flat card's spot, which keeps its layout while hidden
	function cardTarget() {
		const figure = cardSlot?.querySelector('.card');
		if (!figure) return null;
		const slot = cardSlot.getBoundingClientRect();
		const frame = canvas.getBoundingClientRect();
		return {
			x: slot.left - frame.left + slot.width / 2,
			y: slot.top - frame.top + slot.height / 2,
			width: figure.offsetWidth
		};
	}

	// The details column, relative to the canvas, so the stream can dim behind it
	function textBox() {
		if (!info) return null;
		const box = info.getBoundingClientRect();
		const frame = canvas.getBoundingClientRect();
		return {
			left: box.left - frame.left,
			right: box.right - frame.left,
			top: box.top - frame.top,
			bottom: box.bottom - frame.top
		};
	}

	async function startCloud() {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const { hasWebGL } = await import('$lib/three/cardGeometry');
		if (!hasWebGL()) return;
		try {
			const { createCardCloud } = await import('$lib/three/cardCloud');
			if (!canvas) return;
			const instance = createCardCloud(canvas, data.transit_cards, {
				getTarget: cardTarget,
				getQuiet: textBox,
				isPaused: () => paused
			});
			instance.loadAll(deck);
			cloud = instance;
		} catch (err) {
			console.error('3D slideshow unavailable; showing the flat one', err);
		}
	}

	// Warm the cache for the next card so it is ready when it slides in
	$effect(() => {
		if (!upcoming) return;
		if (cloud) return void cloud.preload(upcoming);
		// Requested with CORS like every photo on the site, so each size is cached once
		for (const width of [1600, 64]) {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = assetUrl(upcoming.image, width);
		}
	});

	const clockTime = $derived(
		now?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
	);
	const clockDate = $derived(
		now?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
	);

	onMount(() => {
		// Shuffle on the client only so server and client markup agree
		deck = shuffle(data.transit_cards);

		now = new Date();
		const clock = setInterval(() => (now = new Date()), 1000);
		const hint = setTimeout(() => (showHint = false), 6000);
		const reload = setTimeout(() => location.reload(), RELOAD_AFTER);

		// Let the frame extend under the notch / home indicator while the slideshow is open
		const viewport = document.querySelector('meta[name="viewport"]');
		const originalViewport = viewport?.getAttribute('content');
		viewport?.setAttribute('content', `${originalViewport}, viewport-fit=cover`);

		// Keep the screen awake like a picture frame (released whenever the page is hidden)
		let wakeLock = null;
		async function requestWakeLock() {
			try {
				if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
					wakeLock = await navigator.wakeLock.request('screen');
				}
			} catch {
				// Not supported or not allowed; the slideshow still works
			}
		}
		requestWakeLock();
		document.addEventListener('visibilitychange', requestWakeLock);

		startCloud();

		return () => {
			clearInterval(clock);
			clearTimeout(hint);
			clearTimeout(reload);
			if (originalViewport) viewport.setAttribute('content', originalViewport);
			document.removeEventListener('visibilitychange', requestWakeLock);
			wakeLock?.release().catch(() => {});
			cloud?.destroy();
		};
	});

	// Cards drift in from the right and settle; the outgoing card eases off to the left
	function cardIn() {
		return {
			duration: 1600,
			easing: cubicOut,
			css: (t, u) =>
				`opacity: ${t}; transform: translate3d(${u * 48}px, 0, 0) scale(${0.94 + t * 0.06})`
		};
	}

	function cardOut() {
		return {
			duration: 1100,
			easing: cubicInOut,
			css: (t, u) =>
				`opacity: ${t}; transform: translate3d(${-u * 36}px, 0, 0) scale(${1 + u * 0.03})`
		};
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#000000" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Transit Cards" />
	<!-- Page-level background so overscroll and safe areas stay black; removed on navigation -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<style>html,body{background:#000;overflow:hidden;overscroll-behavior:none}</style>'}
</svelte:head>

<svelte:window onkeydown={handleKey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="frame" class:paused class:immersive={cloud} onclick={handleTap}>
	<!-- Ambient backdrop: a tiny copy of the current card, blurred into a wash of color -->
	<div class="ambient" aria-hidden="true">
		{#if current}
			{#key current.id}
				<img
					src={assetUrl(current.image, 64)}
					crossorigin="anonymous"
					alt=""
					in:fade={{ duration: 2400 }}
					out:fade={{ duration: 2400 }}
				/>
			{/key}
		{/if}
	</div>
	<div class="vignette" aria-hidden="true"></div>
	<canvas class="cloud" bind:this={canvas} aria-hidden="true"></canvas>

	{#if current}
		<main class="stage">
			<!-- Card -->
			<div class="card-slot" bind:this={cardSlot}>
				{#key current.id}
					<figure class="card" in:cardIn out:cardOut>
						<div class="tilt">
							<!-- The 3D card draws this photo itself; the flat one only keeps its place -->
							{#if !cloud}
								<img
									src={assetUrl(current.image, 1600)}
									alt={current.name}
									crossorigin="anonymous"
									draggable="false"
								/>
							{/if}
							<div class="sheen" aria-hidden="true"></div>
						</div>
					</figure>
				{/key}
			</div>

			<!-- Details -->
			<aside class="info" bind:this={info}>
				<div class="clock">
					{#if now}
						<span class="time">{clockTime}</span>
						<span class="date">{clockDate}</span>
					{/if}
				</div>

				<div class="details-slot">
					{#key current.id}
						<div class="details" out:fade={{ duration: 500 }}>
							<p class="eyebrow" in:fly={{ y: 14, duration: 1000, delay: 250, easing: cubicOut }}>
								{current.issuing_agency?.city}
							</p>
							<h1 class="name" in:fly={{ y: 18, duration: 1100, delay: 350, easing: cubicOut }}>
								{current.name}
							</h1>
							<p class="agency" in:fly={{ y: 14, duration: 1000, delay: 450, easing: cubicOut }}>
								{current.issuing_agency?.name}
							</p>
							{#if current.date_acquired}
								<p
									class="acquired"
									in:fly={{ y: 14, duration: 1000, delay: 550, easing: cubicOut }}
								>
									<span>Acquired</span>
									{current.date_acquired}
								</p>
							{/if}
						</div>
					{/key}
				</div>

				<div class="meta">
					<div class="progress">
						{#key tick}
							<div
								class="progress-fill"
								style:animation-duration="{SLIDE_DURATION}ms"
								onanimationend={next}
							></div>
						{/key}
					</div>
					<div class="meta-row">
						<span>{index + 1} / {deck.length}</span>
						<span class="title">{paused ? 'Paused' : "Alex's Transit Cards"}</span>
					</div>
				</div>
			</aside>
		</main>
	{/if}

	{#if showHint && current}
		<div class="hint" transition:fade={{ duration: 600 }}>
			Tap the sides to browse · tap the middle to pause
		</div>
	{/if}
</div>

<style>
	.frame {
		--pad-x: 2rem;
		--pad-y: 1.5rem;
		position: fixed;
		inset: 0;
		height: 100dvh;
		overflow: hidden;
		background: #000;
		color: rgb(255 255 255 / 0.92);
		cursor: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
	}

	/* ---------- Backdrop ---------- */

	.ambient {
		position: absolute;
		inset: -15%;
		display: grid;
		animation: breathe 40s ease-in-out infinite alternate;
	}

	.ambient img {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(48px) saturate(1.6);
		opacity: 0.55;
	}

	.vignette {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 30% 50%, transparent 0%, rgb(0 0 0 / 0.35) 55%, #000 100%),
			linear-gradient(90deg, rgb(0 0 0 / 0.1) 0%, rgb(0 0 0 / 0.55) 100%);
	}

	@keyframes breathe {
		from {
			transform: scale(1) translate3d(0, 0, 0);
		}
		to {
			transform: scale(1.12) translate3d(2%, -2%, 0);
		}
	}

	.cloud {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	/* The 3D card stands in for the flat one, which keeps its place in the layout as the target */
	.immersive .card {
		visibility: hidden;
	}

	/* ---------- Layout ---------- */

	.stage {
		position: relative;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
		align-items: center;
		gap: clamp(1.5rem, 4vw, 4rem);
		padding: max(var(--pad-y), env(safe-area-inset-top))
			max(var(--pad-x), env(safe-area-inset-right)) max(var(--pad-y), env(safe-area-inset-bottom))
			max(var(--pad-x), env(safe-area-inset-left));
		/* Slow wander so nothing sits on the same pixels for hours (OLED burn-in) */
		animation: wander 900s ease-in-out infinite alternate;
	}

	@keyframes wander {
		0% {
			transform: translate3d(-6px, -4px, 0);
		}
		50% {
			transform: translate3d(5px, 3px, 0);
		}
		100% {
			transform: translate3d(-3px, 5px, 0);
		}
	}

	/* ---------- Card ---------- */

	.card-slot {
		display: grid;
		place-items: center;
		perspective: 1400px;
	}

	.card {
		grid-area: 1 / 1;
		margin: 0;
		width: min(100%, calc((100dvh - 2 * var(--pad-y) - 2rem) * 1.588));
	}

	.tilt {
		position: relative;
		aspect-ratio: 3.375 / 2.125;
		/* ID-1 card corners: 3.18mm on an 85.6mm × 53.98mm card */
		border-radius: 3.7% / 5.9%;
		overflow: hidden;
		background: rgb(255 255 255 / 0.06);
		box-shadow:
			0 1px 0 rgb(255 255 255 / 0.12) inset,
			0 2px 4px rgb(0 0 0 / 0.3),
			0 18px 40px -8px rgb(0 0 0 / 0.65),
			0 50px 90px -20px rgb(0 0 0 / 0.7);
		transform-style: preserve-3d;
		animation: float 14s ease-in-out infinite alternate;
	}

	.tilt img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	@keyframes float {
		from {
			transform: rotateY(-7deg) rotateX(3deg) translate3d(0, 0, 0);
		}
		to {
			transform: rotateY(5deg) rotateX(-2deg) translate3d(0, -6px, 0);
		}
	}

	/* A single glint of light sweeps across each card as it arrives */
	.sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			transparent 35%,
			rgb(255 255 255 / 0.22) 48%,
			rgb(255 255 255 / 0.05) 55%,
			transparent 65%
		);
		transform: translate3d(-110%, 0, 0);
		animation: glint 2.4s 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	@keyframes glint {
		to {
			transform: translate3d(110%, 0, 0);
		}
	}

	/* ---------- Details ---------- */

	.info {
		height: 100%;
		max-height: calc((100dvh - 2 * var(--pad-y) - 2rem) * 1.1);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-width: 0;
	}

	.clock {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		font-family: var(--font-sans);
		color: rgb(255 255 255 / 0.55);
		min-height: 1.5rem;
	}

	.clock .time {
		font-family: var(--font-display);
		font-size: clamp(1rem, 2.4vw, 1.75rem);
		color: rgb(255 255 255 / 0.75);
		font-variant-numeric: tabular-nums;
	}

	.clock .date {
		font-size: clamp(0.65rem, 1.2vw, 0.85rem);
		letter-spacing: 0.02em;
	}

	.details-slot {
		display: grid;
		align-items: center;
	}

	.details {
		grid-area: 1 / 1;
	}

	.eyebrow {
		font-family: var(--font-sans);
		font-size: clamp(0.7rem, 1.35vw, 0.95rem);
		letter-spacing: 0.02em;
		background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		margin-bottom: 0.6em;
	}

	.name {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.4rem, 3.5vw, 3.25rem);
		line-height: 1.08;
		letter-spacing: -0.015em;
		color: #fff;
		text-wrap: balance;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.agency {
		margin-top: 0.9em;
		font-family: var(--font-sans);
		font-size: clamp(0.85rem, 1.7vw, 1.2rem);
		color: rgb(255 255 255 / 0.7);
	}

	.acquired {
		margin-top: 0.4em;
		font-family: var(--font-sans);
		font-size: clamp(0.65rem, 1.2vw, 0.85rem);
		color: rgb(255 255 255 / 0.45);
	}

	.acquired span {
		letter-spacing: 0.02em;
		margin-right: 0.4em;
	}

	.meta {
		font-family: var(--font-sans);
		font-size: clamp(0.6rem, 1.1vw, 0.75rem);
		color: rgb(255 255 255 / 0.4);
		letter-spacing: 0.02em;
	}

	.progress {
		height: 2px;
		border-radius: 1px;
		background: rgb(255 255 255 / 0.12);
		overflow: hidden;
		margin-bottom: 0.6rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
		transform-origin: left;
		transform: scaleX(0);
		animation-name: progress;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	.paused .progress-fill {
		animation-play-state: paused;
	}

	@keyframes progress {
		to {
			transform: scaleX(1);
		}
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-variant-numeric: tabular-nums;
	}

	.paused .meta-row .title {
		color: rgb(255 255 255 / 0.8);
	}

	.hint {
		position: absolute;
		left: 50%;
		top: max(0.75rem, env(safe-area-inset-top));
		transform: translateX(-50%);
		max-width: calc(100% - 2rem);
		text-align: center;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		font-family: var(--font-sans);
		font-size: 0.7rem;
		letter-spacing: 0.05em;
		color: rgb(255 255 255 / 0.75);
	}

	/* ---------- Portrait fallback: stack the card above its details ---------- */

	@media (orientation: portrait) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto;
			align-content: center;
			gap: 2rem;
		}

		.card {
			width: min(100%, 36rem);
		}

		.info {
			height: auto;
			max-height: none;
			gap: 1.5rem;
		}

		.clock {
			order: 3;
		}

		.name {
			font-size: clamp(1.5rem, 6.5vw, 3rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ambient,
		.stage,
		.tilt,
		.sheen {
			animation: none;
		}

		.sheen {
			display: none;
		}
	}
</style>
