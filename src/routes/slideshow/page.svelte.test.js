import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import SlideshowPage from './+page.svelte';

const makeCards = (count) =>
	Array.from({ length: count }, (_, i) => ({
		id: `c${i}`,
		name: `Card ${i}`,
		image: `img-${i}`,
		date_acquired: i % 2 === 0 ? `January ${i + 1}, 2020` : null,
		issuing_agency: { name: `Agency ${i}`, city: `City ${i}` }
	}));

const flush = async () => {
	await vi.advanceTimersByTimeAsync(0);
	await tick();
};

// Math.random() ≈ 1 makes the Fisher–Yates shuffle a no-op, so the deck keeps its input order
const keepOrder = () => vi.spyOn(Math, 'random').mockReturnValue(0.999999);

const counter = () => document.querySelector('.meta-row span').textContent;
const title = () => document.querySelector('.meta-row .title').textContent;
const tap = (clientX) => fireEvent.click(document.querySelector('.frame'), { clientX });

describe('slideshow page', () => {
	let images;
	let viewport;

	beforeEach(() => {
		vi.useFakeTimers();
		keepOrder();
		images = [];
		vi.stubGlobal(
			'Image',
			class {
				set src(value) {
					images.push(value);
				}
			}
		);
		viewport = document.createElement('meta');
		viewport.name = 'viewport';
		viewport.content = 'width=device-width, initial-scale=1';
		document.head.appendChild(viewport);
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible'
		});
		delete navigator.wakeLock;
	});

	afterEach(() => {
		viewport.remove();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe('rendering', () => {
		it('renders no stage or hint when there are no cards', async () => {
			render(SlideshowPage, { data: { transit_cards: [] } });
			await flush();
			expect(document.querySelector('.stage')).toBeNull();
			expect(screen.queryByText(/Tap the sides/)).toBeNull();
		});

		it('shows the first card with its details', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Card 0');
			expect(document.querySelector('.eyebrow')).toHaveTextContent('City 0');
			expect(document.querySelector('.agency')).toHaveTextContent('Agency 0');
			expect(document.querySelector('.acquired')).toHaveTextContent('Acquired January 1, 2020');
			expect(counter()).toBe('1 / 3');
			expect(title()).toBe("Alex's Transit Cards");
		});

		it('omits the acquired line for cards without a date', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			await flush();
			expect(screen.getAllByRole('heading', { level: 1 }).at(-1)).toHaveTextContent('Card 1');
			expect(document.querySelector('.details:last-child .acquired')).toBeNull();
		});

		it('loads the large image and the tiny ambient backdrop from the CMS', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(screen.getByAltText('Card 0')).toHaveAttribute(
				'src',
				'https://cms.alexwang.net/assets/img-0?format=webp&width=1600'
			);
			expect(document.querySelector('.ambient img')).toHaveAttribute(
				'src',
				'https://cms.alexwang.net/assets/img-0?format=webp&width=64'
			);
		});

		it('adds mobile web-app meta tags to the head', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(1) } });
			await flush();
			expect(document.head.querySelector('meta[name="theme-color"]')).toHaveAttribute(
				'content',
				'#000000'
			);
			expect(
				document.head.querySelector('meta[name="apple-mobile-web-app-capable"]')
			).not.toBeNull();
			expect(
				document.head.querySelector('meta[name="apple-mobile-web-app-title"]')
			).toHaveAttribute('content', 'Transit Cards');
		});
	});

	describe('preloading', () => {
		it('warms the cache for the upcoming card', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			expect(images).toEqual([
				'https://cms.alexwang.net/assets/img-1?format=webp&width=1600',
				'https://cms.alexwang.net/assets/img-1?format=webp&width=64'
			]);
		});

		it('does not preload when there is only one card', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(1) } });
			await flush();
			expect(images).toEqual([]);
		});
	});

	describe('navigation', () => {
		it('advances with ArrowRight and goes back with ArrowLeft', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			expect(counter()).toBe('2 / 3');
			await fireEvent.keyDown(window, { key: 'ArrowLeft' });
			expect(counter()).toBe('1 / 3');
		});

		it('wraps backwards from the first card to the last', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowLeft' });
			expect(counter()).toBe('3 / 3');
		});

		it('starts a fresh shuffled round after the last card', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			expect(counter()).toBe('3 / 3');
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			expect(counter()).toBe('1 / 3');
		});

		it('never repeats the card just shown when reshuffling', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowRight' }); // now on Card 1 (last)
			// Math.random() = 0 reverses the deck, which would put Card 1 first again
			vi.spyOn(Math, 'random').mockReturnValue(0);
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			await flush();
			expect(counter()).toBe('1 / 2');
			expect(screen.getAllByRole('heading', { level: 1 }).at(-1)).toHaveTextContent('Card 0');
		});

		it('keeps a single card on screen when advancing', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(1) } });
			await flush();
			await fireEvent.keyDown(window, { key: 'ArrowRight' });
			expect(counter()).toBe('1 / 1');
			await fireEvent.keyDown(window, { key: 'ArrowLeft' });
			expect(counter()).toBe('1 / 1');
		});

		it('advances automatically when the progress animation ends', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
			await flush();
			const fill = document.querySelector('.progress-fill');
			expect(fill.style.animationDuration).toBe('12000ms');
			await fireEvent.animationEnd(fill);
			expect(counter()).toBe('2 / 3');
			// A new progress bar replaces the old one for the new slide
			expect(document.querySelector('.progress-fill')).not.toBe(fill);
		});

		describe('taps', () => {
			it('goes back on the left side', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				await tap(100);
				expect(counter()).toBe('3 / 3');
			});

			it('advances on the right side', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				await tap(900);
				expect(counter()).toBe('2 / 3');
			});

			it('toggles pause in the middle', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				await tap(500);
				expect(title()).toBe('Paused');
				expect(document.querySelector('.frame')).toHaveClass('paused');
				await tap(500);
				expect(title()).toBe("Alex's Transit Cards");
				expect(document.querySelector('.frame')).not.toHaveClass('paused');
			});

			it('dismisses the hint', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				expect(screen.getByText(/Tap the sides/)).toBeInTheDocument();
				await tap(500);
				await flush();
				await vi.advanceTimersByTimeAsync(1000);
				expect(screen.queryByText(/Tap the sides/)).toBeNull();
			});
		});

		describe('keyboard', () => {
			it('toggles pause with space and prevents page scroll', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
				window.dispatchEvent(event);
				await tick();
				expect(event.defaultPrevented).toBe(true);
				expect(title()).toBe('Paused');
				window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
				await tick();
				expect(title()).toBe("Alex's Transit Cards");
			});

			it('ignores other keys and keeps the hint', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				await fireEvent.keyDown(window, { key: 'a' });
				expect(counter()).toBe('1 / 3');
				expect(screen.getByText(/Tap the sides/)).toBeInTheDocument();
			});

			it('dismisses the hint on a handled key', async () => {
				render(SlideshowPage, { data: { transit_cards: makeCards(3) } });
				await flush();
				await fireEvent.keyDown(window, { key: 'ArrowRight' });
				await vi.advanceTimersByTimeAsync(1000);
				expect(screen.queryByText(/Tap the sides/)).toBeNull();
			});
		});
	});

	describe('timers', () => {
		it('hides the hint after six seconds', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(screen.getByText(/Tap the sides/)).toBeInTheDocument();
			await vi.advanceTimersByTimeAsync(6100);
			expect(screen.queryByText(/Tap the sides/)).toBeNull();
		});

		it('shows and updates the clock every second', async () => {
			vi.setSystemTime(new Date(2024, 0, 2, 9, 5, 0));
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			const expectedTime = (d) =>
				d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
			const expectedDate = (d) =>
				d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
			expect(document.querySelector('.clock .time')).toHaveTextContent(
				expectedTime(new Date(2024, 0, 2, 9, 5))
			);
			expect(document.querySelector('.clock .date')).toHaveTextContent(
				expectedDate(new Date(2024, 0, 2))
			);

			await vi.advanceTimersByTimeAsync(60 * 1000);
			expect(document.querySelector('.clock .time')).toHaveTextContent(
				expectedTime(new Date(2024, 0, 2, 9, 6))
			);
		});

		it('reloads the page after six hours', async () => {
			const reload = vi.fn();
			vi.stubGlobal('location', { ...window.location, reload });
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			vi.advanceTimersByTime(6 * 60 * 60 * 1000 - 1000);
			expect(reload).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1000);
			expect(reload).toHaveBeenCalledTimes(1);
		});

		it('clears its timers on unmount', async () => {
			const reload = vi.fn();
			vi.stubGlobal('location', { ...window.location, reload });
			const view = render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			view.unmount();
			vi.advanceTimersByTime(7 * 60 * 60 * 1000);
			expect(reload).not.toHaveBeenCalled();
		});
	});

	describe('viewport', () => {
		it('extends under the notch while open and restores on unmount', async () => {
			const view = render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(viewport.content).toBe('width=device-width, initial-scale=1, viewport-fit=cover');
			view.unmount();
			expect(viewport.content).toBe('width=device-width, initial-scale=1');
		});

		it('copes with a page that has no viewport meta', async () => {
			viewport.remove();
			const view = render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(() => view.unmount()).not.toThrow();
			document.head.appendChild(viewport);
		});
	});

	describe('wake lock', () => {
		function stubWakeLock() {
			const sentinel = { release: vi.fn().mockResolvedValue(undefined) };
			const request = vi.fn().mockResolvedValue(sentinel);
			Object.defineProperty(navigator, 'wakeLock', {
				configurable: true,
				value: { request }
			});
			return { sentinel, request };
		}

		it('requests a screen wake lock while visible', async () => {
			const { request } = stubWakeLock();
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(request).toHaveBeenCalledWith('screen');
		});

		it('re-requests the lock when the page becomes visible again', async () => {
			const { request } = stubWakeLock();
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			document.dispatchEvent(new Event('visibilitychange'));
			await flush();
			expect(request).toHaveBeenCalledTimes(2);
		});

		it('does not request a lock while the page is hidden', async () => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => 'hidden'
			});
			const { request } = stubWakeLock();
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(request).not.toHaveBeenCalled();
		});

		it('releases the lock on unmount', async () => {
			const { sentinel } = stubWakeLock();
			const view = render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			view.unmount();
			expect(sentinel.release).toHaveBeenCalledTimes(1);
		});

		it('survives a rejected request and a failing release', async () => {
			const { request, sentinel } = stubWakeLock();
			request.mockRejectedValueOnce(new Error('denied'));
			const view = render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			// Second attempt succeeds, but releasing it fails
			sentinel.release.mockRejectedValue(new Error('gone'));
			document.dispatchEvent(new Event('visibilitychange'));
			await flush();
			expect(() => view.unmount()).not.toThrow();
			await flush();
		});

		it('works without the Wake Lock API', async () => {
			render(SlideshowPage, { data: { transit_cards: makeCards(2) } });
			await flush();
			expect(counter()).toBe('1 / 2');
		});
	});
});
