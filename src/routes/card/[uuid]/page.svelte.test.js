import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';

const goto = vi.fn();
const navCallbacks = [];
vi.mock('$app/navigation', () => ({
	goto: (...args) => goto(...args),
	afterNavigate: (cb) => navCallbacks.push(cb)
}));

import CardPage from './+page.svelte';

const card = (overrides = {}) => ({
	id: 'abc',
	name: 'Clipper Card',
	image: 'img-123',
	date_acquired: 'March 5, 2021',
	notes: '<p>Some <strong>notes</strong></p>',
	issuing_agency: { name: 'MTC', city: 'San Francisco' },
	...overrides
});

// Simulate SvelteKit reporting where the visitor navigated from (null = direct visit / reload)
async function navigatedFrom(href) {
	const from = href ? { url: new URL(href, 'http://localhost') } : null;
	navCallbacks.forEach((cb) => cb({ from }));
	await tick();
}

describe('card detail page', () => {
	beforeEach(() => {
		goto.mockReset();
		navCallbacks.length = 0;
		sessionStorage.clear();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows the name, agency and location', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Clipper Card');
		expect(screen.getByText('MTC')).toBeInTheDocument();
		expect(screen.getByText('San Francisco')).toBeInTheDocument();
	});

	it('renders the card image from the CMS with an alt text', () => {
		render(CardPage, { data: { transit_card: card() } });
		const img = screen.getByAltText('Clipper Card');
		expect(img).toHaveAttribute(
			'src',
			'https://cms.alexwang.net/assets/img-123?format=webp&width=800'
		);
		expect(img).toHaveAttribute('loading', 'lazy');
	});

	it('shows the acquisition date when present', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByText('ACQUISITION DATE')).toBeInTheDocument();
		expect(screen.getByText('March 5, 2021')).toBeInTheDocument();
	});

	it('hides the acquisition date section when absent', () => {
		render(CardPage, { data: { transit_card: card({ date_acquired: null }) } });
		expect(screen.queryByText('ACQUISITION DATE')).toBeNull();
	});

	it('renders notes as HTML', () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByText('ADDITIONAL NOTES')).toBeInTheDocument();
		expect(screen.getByText('notes').tagName).toBe('STRONG');
	});

	it('hides the notes section when there are none', () => {
		render(CardPage, { data: { transit_card: card({ notes: null }) } });
		expect(screen.queryByText('ADDITIONAL NOTES')).toBeNull();
	});

	it("includes the I'm Feeling Lucky button", () => {
		render(CardPage, { data: { transit_card: card() } });
		expect(screen.getByRole('button', { name: /feeling lucky/i })).toBeInTheDocument();
	});

	describe('Return to Collection', () => {
		const clickReturn = () =>
			fireEvent.click(screen.getByRole('button', { name: /return to collection/i }));

		it('goes back in history when the visitor clicked through from the collection', async () => {
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await navigatedFrom('/?page=3&agency=a1');
			await clickReturn();
			expect(back).toHaveBeenCalledTimes(1);
			expect(goto).not.toHaveBeenCalled();
		});

		it('goes straight home when opened directly, however long the history is', async () => {
			// A new-tab page or earlier sites inflate history.length; it must not matter
			Object.defineProperty(window.history, 'length', { configurable: true, value: 9 });
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await navigatedFrom(null);
			await clickReturn();
			expect(goto).toHaveBeenCalledWith('/');
			expect(back).not.toHaveBeenCalled();
		});

		it('goes home when the visitor came from another internal page', async () => {
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await navigatedFrom('/slideshow');
			await clickReturn();
			expect(goto).toHaveBeenCalledWith('/');
			expect(back).not.toHaveBeenCalled();
		});

		it('returns to the collection URL (with params) handed over by the lucky button', async () => {
			sessionStorage.setItem('collectionUrl', '/?page=4&search=bart');
			const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			render(CardPage, { data: { transit_card: card() } });
			await navigatedFrom(null);
			await clickReturn();
			expect(goto).toHaveBeenCalledWith('/?page=4&search=bart');
			expect(back).not.toHaveBeenCalled();
		});

		it('consumes the handed-over URL so it cannot go stale', () => {
			sessionStorage.setItem('collectionUrl', '/?page=4');
			render(CardPage, { data: { transit_card: card() } });
			expect(sessionStorage.getItem('collectionUrl')).toBeNull();
		});

		it('passes the collection URL on when picking another random card', async () => {
			render(CardPage, { data: { transit_card: card() } });
			await navigatedFrom('/?agency=a2&page=2');
			await fireEvent.click(screen.getByRole('button', { name: /feeling lucky/i }));
			expect(sessionStorage.getItem('collectionUrl')).toBe('/?agency=a2&page=2');
			expect(goto).toHaveBeenCalledWith('/feeling-lucky');
		});
	});
});
