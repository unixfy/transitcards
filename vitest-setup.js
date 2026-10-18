import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// jsdom has no layout engine: give elements a width so `bind:clientWidth` yields a usable value
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
	configurable: true,
	get() {
		return 600;
	}
});

globalThis.ResizeObserver = class {
	constructor(callback) {
		this.callback = callback;
	}
	observe(target) {
		this.callback([{ target, contentRect: { width: 600, height: 260 } }], this);
	}
	unobserve() {}
	disconnect() {}
};

// jsdom has no Web Animations API; Svelte transitions call element.animate()
if (!Element.prototype.animate) {
	Element.prototype.animate = function () {
		const animation = {
			onfinish: null,
			oncancel: null,
			currentTime: 0,
			finished: Promise.resolve(),
			cancel() {},
			finish() {},
			play() {},
			pause() {},
			reverse() {}
		};
		queueMicrotask(() => animation.onfinish?.());
		return animation;
	};
}

// A stable viewport size for scroll / tap math
Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768, writable: true });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000, writable: true });

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
