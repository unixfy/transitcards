<script>
	import { navigating } from '$app/state';

	// A slow navigation gets a visible sign of life; quick ones never flash it
	let show = $state(false);

	$effect(() => {
		if (!navigating.to) return;
		const timer = setTimeout(() => (show = true), 120);
		return () => {
			clearTimeout(timer);
			show = false;
		};
	});
</script>

{#if show}
	<div class="progress" data-nav-progress role="progressbar" aria-label="Loading"></div>
{/if}

<style>
	.progress {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: 50;
		height: 4px;
		overflow: hidden;
		pointer-events: none;
	}

	/* The route line, running */
	.progress::before {
		content: '';
		position: absolute;
		inset: 0;
		width: 45%;
		background: linear-gradient(90deg, #1f9d6b, #2f7fe0, #f08a24, #e0457b);
		border-radius: 0 999px 999px 0;
		animation: run 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	@keyframes run {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(230%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress::before {
			width: 100%;
			animation: none;
		}
	}
</style>
