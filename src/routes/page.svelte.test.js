import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

const mocks = vi.hoisted(() => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	afterNavigateCallbacks: [],
	fetchCardsPages: vi.fn(),
	appState: {
		page: { url: new URL('http://localhost/'), state: {} },
		navigating: { type: null }
	}
}));

vi.mock('$app/navigation', () => ({
	goto: (...a) => mocks.goto(...a),
	replaceState: (...a) => mocks.replaceState(...a),
	afterNavigate: (cb) => mocks.afterNavigateCallbacks.push(cb)
}));
vi.mock('$app/state', () => ({
	get page() {
		return mocks.appState.page;
	},
	get navigating() {
		return mocks.appState.navigating;
	}
}));
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ marker: 'directus' })) }));
vi.mock('$lib/cards', async (importOriginal) => ({
	...(await importOriginal()),
	fetchCardsPages: (...a) => mocks.fetchCardsPages(...a)
}));

import HomePage from './+page.svelte';
import { CARDS_PER_PAGE } from '$lib/cards';

const makeCards = (count, start = 0) =>
	Array.from({ length: count }, (_, i) => ({
		id: `card-${start + i}`,
		name: `Card ${start + i}`,
		image: `img-${start + i}`,
		issuing_agency: { id: 'ag', name: 'Agency', city: 'City' }
	}));

const makeData = (overrides = {}) => ({
	transit_cards: makeCards(3),
	agencies: [
		{ id: 'a1', name: 'BART', city: 'Oakland' },
		{ id: 'a2', name: 'Muni', city: 'San Francisco' }
	],
	currentPage: 1,
	totalPages: 1,
	totalCount: 3,
	selectedAgency: null,
	searchQuery: '',
	acquisitionCounts: [],
	earliestAcquired: null,
	title: 'Home',
	...overrides
});

// Large data set: `pages` full pages are already loaded, out of `totalPages`
const pagedData = (pages, totalPages, overrides = {}) =>
	makeData({
		transit_cards: makeCards(pages * CARDS_PER_PAGE),
		currentPage: pages,
		totalPages,
		totalCount: totalPages * CARDS_PER_PAGE,
		...overrides
	});

function setUrl(search = '') {
	mocks.appState.page = { url: new URL(`http://localhost/${search}`), state: { s: 1 } };
}

describe('home page', () => {
	beforeEach(() => {
		mocks.goto.mockReset().mockResolvedValue(undefined);
		mocks.replaceState.mockReset();
		mocks.fetchCardsPages.mockReset();
		mocks.afterNavigateCallbacks.length = 0;
		mocks.appState.navigating = { type: null };
		setUrl();
		window.scrollTo = vi.fn();
		window.history.replaceState({}, '', '/');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('card grid', () => {
		it('renders a linked tile for each card', () => {
			render(HomePage, { data: makeData() });
			const links = screen
				.getAllByRole('link')
				.filter((a) => a.getAttribute('href').startsWith('/card/'));
			expect(links.map((a) => a.getAttribute('href'))).toEqual([
				'/card/card-0',
				'/card/card-1',
				'/card/card-2'
			]);
			expect(screen.getByRole('heading', { name: 'Card 1' })).toBeInTheDocument();
			expect(screen.getAllByText('Agency (City)')).toHaveLength(3);
		});

		it('loads thumbnails from the CMS lazily', () => {
			render(HomePage, { data: makeData() });
			const img = screen.getByAltText('Card 0');
			expect(img).toHaveAttribute(
				'src',
				'https://cms.alexwang.net/assets/img-0?format=webp&width=400'
			);
			expect(img).toHaveAttribute('loading', 'lazy');
		});

		it('marks the first card of each page', () => {
			render(HomePage, { data: pagedData(2, 2) });
			const starts = [...document.querySelectorAll('[data-page-start]')].map(
				(el) => el.dataset.pageStart
			);
			expect(starts).toEqual(['1', '2']);
			expect(document.querySelector('[data-page-start="2"]')).toHaveAttribute(
				'href',
				`/card/card-${CARDS_PER_PAGE}`
			);
		});

		it('skips duplicate cards across pages', () => {
			const dup = makeCards(CARDS_PER_PAGE + 1);
			dup[CARDS_PER_PAGE] = { ...dup[0] }; // page 2's only card repeats page 1's first
			render(HomePage, { data: makeData({ transit_cards: dup, currentPage: 2, totalPages: 2 }) });
			expect(screen.getAllByRole('heading', { name: 'Card 0' })).toHaveLength(1);
			// Page 2 contributed nothing, so no page-2 marker exists
			expect(document.querySelector('[data-page-start="2"]')).toBeNull();
		});

		it('shows an empty state when nothing matches', () => {
			render(HomePage, {
				data: makeData({ transit_cards: [], totalCount: 0, totalPages: 0 })
			});
			expect(screen.getByText(/No cards found/)).toBeInTheDocument();
			expect(screen.queryByText('Load more cards')).toBeNull();
		});

		it('renders the acquisition chart and lucky button', () => {
			render(HomePage, { data: makeData() });
			expect(screen.getByText(/Cards Over Time/)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /feeling lucky/i })).toBeInTheDocument();
		});
	});

	describe('filters UI', () => {
		it('lists agencies in the dropdown', () => {
			render(HomePage, { data: makeData() });
			const select = screen.getByLabelText('Filter by Agency');
			expect([...select.options].map((o) => o.textContent)).toEqual([
				'All Agencies',
				'BART - Oakland',
				'Muni - San Francisco'
			]);
			expect(select).toHaveValue('');
		});

		it('preselects the active agency', () => {
			render(HomePage, { data: makeData({ selectedAgency: 'a2' }) });
			expect(screen.getByLabelText('Filter by Agency')).toHaveValue('a2');
		});

		it('prefills the search box from the query', () => {
			render(HomePage, { data: makeData({ searchQuery: 'bart' }) });
			expect(screen.getByLabelText('Search Cards')).toHaveValue('bart');
		});

		it('hides the filter summary without filters', () => {
			render(HomePage, { data: makeData() });
			expect(screen.queryByText(/results? found/)).toBeNull();
			expect(screen.queryByRole('button', { name: /clear all filters/i })).toBeNull();
		});

		it('summarizes an agency filter (plural)', () => {
			render(HomePage, { data: makeData({ selectedAgency: 'a1', totalCount: 3 }) });
			expect(screen.getByText(/3 results found/)).toBeInTheDocument();
		});

		it('summarizes a search (singular)', () => {
			render(HomePage, { data: makeData({ searchQuery: 'bart', totalCount: 1 }) });
			expect(screen.getByText(/1 result found/)).toBeInTheDocument();
			expect(screen.getByText('bart')).toBeInTheDocument();
		});
	});

	describe('search and filter navigation', () => {
		it('submits a search, resetting to page 1', async () => {
			window.history.replaceState({}, '', '/?page=4&agency=a1');
			render(HomePage, { data: makeData() });
			await fireEvent.input(screen.getByLabelText('Search Cards'), {
				target: { value: 'light rail' }
			});
			await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
			expect(mocks.goto).toHaveBeenCalledTimes(1);
			const [href, opts] = mocks.goto.mock.calls[0];
			const url = new URL(href, 'http://localhost');
			expect(url.pathname).toBe('/');
			expect(url.searchParams.get('search')).toBe('light rail');
			expect(url.searchParams.get('page')).toBe('1');
			expect(url.searchParams.get('agency')).toBe('a1');
			expect(opts).toEqual({ noScroll: true });
		});

		it('removes the search param when the input is blank', async () => {
			window.history.replaceState({}, '', '/?search=old');
			render(HomePage, { data: makeData({ searchQuery: 'old' }) });
			await fireEvent.input(screen.getByLabelText('Search Cards'), { target: { value: '   ' } });
			await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
			const url = new URL(mocks.goto.mock.calls[0][0], 'http://localhost');
			expect(url.searchParams.has('search')).toBe(false);
			expect(url.searchParams.get('page')).toBe('1');
		});

		it('shows a spinner and disables the button while searching', async () => {
			let finish;
			mocks.goto.mockReturnValue(new Promise((r) => (finish = r)));
			render(HomePage, { data: makeData() });
			await fireEvent.click(screen.getByRole('button', { name: 'Search' }));
			const button = document.querySelector('button[type="submit"]');
			expect(button).toBeDisabled();
			expect(button.querySelector('.loading')).not.toBeNull();
			finish();
			await waitFor(() => expect(button).not.toBeDisabled());
			expect(button).toHaveTextContent('Search');
		});

		it('applies an agency filter, resetting to page 1', async () => {
			window.history.replaceState({}, '', '/?page=3');
			render(HomePage, { data: makeData() });
			await fireEvent.change(screen.getByLabelText('Filter by Agency'), {
				target: { value: 'a2' }
			});
			const [href, opts] = mocks.goto.mock.calls[0];
			const url = new URL(href, 'http://localhost');
			expect(url.searchParams.get('agency')).toBe('a2');
			expect(url.searchParams.get('page')).toBe('1');
			expect(opts).toEqual({ noScroll: true });
		});

		it('removes the agency filter when "All Agencies" is chosen', async () => {
			window.history.replaceState({}, '', '/?agency=a1&search=x');
			render(HomePage, { data: makeData({ selectedAgency: 'a1' }) });
			await fireEvent.change(screen.getByLabelText('Filter by Agency'), { target: { value: '' } });
			const url = new URL(mocks.goto.mock.calls[0][0], 'http://localhost');
			expect(url.searchParams.has('agency')).toBe(false);
			expect(url.searchParams.get('search')).toBe('x');
		});

		it('clears all filters', async () => {
			window.history.replaceState({}, '', '/?agency=a1&search=x&page=2');
			render(HomePage, { data: makeData({ selectedAgency: 'a1', searchQuery: 'x' }) });
			await fireEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
			expect(screen.getByLabelText('Search Cards')).toHaveValue('');
			expect(mocks.goto).toHaveBeenCalledWith('/?page=1', { noScroll: true });
		});
	});

	describe('infinite scroll', () => {
		const sentinelLink = () => screen.getByRole('link', { name: /load more cards|loading|retry/i });

		it('shows a plain link to the next page when more pages exist', () => {
			render(HomePage, { data: pagedData(1, 3) });
			expect(sentinelLink()).toHaveAttribute('href', '?page=2');
		});

		it('keeps filters in the next-page link', () => {
			render(HomePage, {
				data: pagedData(1, 3, { selectedAgency: 'a1', searchQuery: 'a b&c' })
			});
			expect(sentinelLink()).toHaveAttribute('href', '?page=2&agency=a1&search=a%20b%26c');
		});

		it('hides the button on the last page', () => {
			render(HomePage, { data: pagedData(2, 2) });
			expect(screen.queryByText('Load more cards')).toBeNull();
		});

		it('loads and appends the next page when clicked', async () => {
			mocks.fetchCardsPages.mockResolvedValue(makeCards(5, 1000));
			render(HomePage, {
				data: pagedData(1, 2, { selectedAgency: 'a1', searchQuery: 'q' })
			});
			await fireEvent.click(sentinelLink());
			await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 1004' })).toBeVisible());

			const [directus, page, filter] = mocks.fetchCardsPages.mock.calls[0];
			expect(directus).toEqual({ marker: 'directus' });
			expect(page).toBe(2);
			expect(filter._and).toHaveLength(2);
			// All pages loaded now
			expect(screen.queryByText('Load more cards')).toBeNull();
			expect(document.querySelector('[data-page-start="2"]')).toHaveAttribute(
				'href',
				'/card/card-1000'
			);
		});

		it('shows a loading state and ignores repeat clicks while fetching', async () => {
			let resolve;
			mocks.fetchCardsPages.mockReturnValue(new Promise((r) => (resolve = r)));
			render(HomePage, { data: pagedData(1, 3) });
			await fireEvent.click(sentinelLink());
			expect(screen.getByText('Loading…')).toBeInTheDocument();
			await fireEvent.click(sentinelLink());
			expect(mocks.fetchCardsPages).toHaveBeenCalledTimes(1);
			resolve(makeCards(2, 2000));
			await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
		});

		it('shows an error with retry, and recovers on retry', async () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mocks.fetchCardsPages.mockRejectedValueOnce(new Error('network'));
			render(HomePage, { data: pagedData(1, 2) });
			await fireEvent.click(sentinelLink());
			await waitFor(() =>
				expect(screen.getByText(/Couldn't load more cards. Retry/)).toBeInTheDocument()
			);
			expect(spy).toHaveBeenCalledWith('Failed to load more cards', expect.any(Error));

			mocks.fetchCardsPages.mockResolvedValueOnce(makeCards(1, 3000));
			await fireEvent.click(sentinelLink());
			await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 3000' })).toBeVisible());
			expect(screen.queryByText(/Couldn't load/)).toBeNull();
		});

		it('discards an in-flight page when the data changes underneath it', async () => {
			let resolve;
			mocks.fetchCardsPages.mockReturnValue(new Promise((r) => (resolve = r)));
			const view = render(HomePage, { data: pagedData(1, 3) });
			await fireEvent.click(sentinelLink());
			await view.rerender({ data: makeData({ searchQuery: 'new', transit_cards: makeCards(2) }) });
			resolve(makeCards(2, 5000));
			await tick();
			await tick();
			expect(screen.queryByRole('heading', { name: 'Card 5000' })).toBeNull();
			expect(screen.getByRole('heading', { name: 'Card 1' })).toBeInTheDocument();
		});

		it('discards an in-flight failure when the data changes underneath it', async () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
			let reject;
			mocks.fetchCardsPages.mockReturnValue(new Promise((_, r) => (reject = r)));
			const view = render(HomePage, { data: pagedData(1, 3) });
			await fireEvent.click(sentinelLink());
			await view.rerender({ data: pagedData(1, 3, { searchQuery: 'other' }) });
			reject(new Error('late'));
			await tick();
			await tick();
			expect(spy).not.toHaveBeenCalled();
			expect(screen.queryByText(/Couldn't load/)).toBeNull();
		});

		it('rebuilds the list when new data arrives', async () => {
			const view = render(HomePage, { data: makeData() });
			await view.rerender({
				data: makeData({ transit_cards: makeCards(1, 77), totalCount: 1 })
			});
			expect(screen.queryByRole('heading', { name: 'Card 0' })).toBeNull();
			expect(screen.getByRole('heading', { name: 'Card 77' })).toBeInTheDocument();
		});

		it('auto-loads when the sentinel is near the viewport', async () => {
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
				top: 100,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			});
			mocks.fetchCardsPages.mockResolvedValue(makeCards(1, 9000));
			render(HomePage, { data: pagedData(1, 2) });
			await waitFor(() => expect(mocks.fetchCardsPages).toHaveBeenCalledTimes(1));
			await waitFor(() => expect(screen.getByRole('heading', { name: 'Card 9000' })).toBeVisible());
		});

		it('keeps loading until the viewport is filled', async () => {
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			});
			mocks.fetchCardsPages.mockImplementation(async (_d, page) => makeCards(1, 100 * page));
			render(HomePage, { data: pagedData(1, 4) });
			await waitFor(() => expect(mocks.fetchCardsPages).toHaveBeenCalledTimes(3));
			expect(mocks.fetchCardsPages.mock.calls.map((c) => c[1])).toEqual([2, 3, 4]);
		});

		it('does not auto-load when the sentinel is far below the viewport', async () => {
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
				top: 100000,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			});
			render(HomePage, { data: pagedData(1, 2) });
			await new Promise((r) => setTimeout(r, 50));
			expect(mocks.fetchCardsPages).not.toHaveBeenCalled();
		});

		it('does not auto-retry after an error', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			});
			mocks.fetchCardsPages.mockRejectedValue(new Error('nope'));
			render(HomePage, { data: pagedData(1, 3) });
			await waitFor(() => expect(screen.getByText(/Retry/)).toBeInTheDocument());
			await new Promise((r) => setTimeout(r, 50));
			expect(mocks.fetchCardsPages).toHaveBeenCalledTimes(1);
		});

		it('re-checks on scroll and resize, throttled to animation frames', async () => {
			let top = 100000;
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
				top,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			}));
			mocks.fetchCardsPages.mockResolvedValue(makeCards(1, 8000));
			render(HomePage, { data: pagedData(1, 2) });
			await new Promise((r) => setTimeout(r, 30));
			expect(mocks.fetchCardsPages).not.toHaveBeenCalled();

			top = 0;
			window.dispatchEvent(new Event('scroll'));
			window.dispatchEvent(new Event('resize')); // coalesced into the same frame
			await waitFor(() => expect(mocks.fetchCardsPages).toHaveBeenCalledTimes(1));
		});

		it('removes its window listeners on unmount', () => {
			const remove = vi.spyOn(window, 'removeEventListener');
			const view = render(HomePage, { data: makeData() });
			view.unmount();
			const types = remove.mock.calls.map((c) => c[0]);
			expect(types).toContain('scroll');
			expect(types).toContain('resize');
		});

		it('cancels a pending animation frame on unmount', () => {
			const cancel = vi.spyOn(window, 'cancelAnimationFrame');
			const view = render(HomePage, { data: makeData() });
			// onMount scheduled a frame that has not fired yet
			view.unmount();
			expect(cancel).toHaveBeenCalled();
		});
	});

	describe('address bar sync', () => {
		const rect = (top) => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0 });

		function mockPageTops(tops) {
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
				const start = this.dataset?.pageStart;
				return rect(start && tops[start] !== undefined ? tops[start] : 100000);
			});
		}

		it('writes ?page=N once page N scrolls into view', async () => {
			mockPageTops({ 1: -2000, 2: 10 });
			render(HomePage, { data: pagedData(2, 2) });
			await waitFor(() => expect(mocks.replaceState).toHaveBeenCalledTimes(1));
			const [url, state] = mocks.replaceState.mock.calls[0];
			expect(url.searchParams.get('page')).toBe('2');
			expect(state).toEqual({ s: 1 });
		});

		it('does not rewrite the URL when already on the visible page', async () => {
			setUrl('?page=2');
			mockPageTops({ 1: -2000, 2: 10 });
			render(HomePage, { data: pagedData(2, 2) });
			await new Promise((r) => setTimeout(r, 50));
			expect(mocks.replaceState).not.toHaveBeenCalled();
		});

		it('corrects an out-of-range ?page= back to the visible page', async () => {
			setUrl('?page=99');
			mockPageTops({ 1: 10 });
			render(HomePage, { data: makeData() });
			await waitFor(() => expect(mocks.replaceState).toHaveBeenCalled());
			expect(mocks.replaceState.mock.calls[0][0].searchParams.get('page')).toBe('1');
		});

		it('does nothing while a navigation is in flight', async () => {
			mocks.appState.navigating = { type: 'link' };
			mockPageTops({ 1: -2000, 2: 10 });
			render(HomePage, { data: pagedData(2, 2) });
			await new Promise((r) => setTimeout(r, 50));
			expect(mocks.replaceState).not.toHaveBeenCalled();
		});
	});

	describe('after navigation', () => {
		const run = (type) => mocks.afterNavigateCallbacks.forEach((cb) => cb({ type }));

		it('scrolls to the landed-on page when it is not page 1', () => {
			vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
				top: 500,
				left: 0,
				right: 0,
				bottom: 0,
				width: 0,
				height: 0
			});
			window.scrollY = 100;
			render(HomePage, { data: pagedData(2, 2) });
			run('enter');
			expect(window.scrollTo).toHaveBeenCalledWith(0, 500 + 100 - 16);
		});

		it('leaves back/forward navigation to the snapshot', () => {
			render(HomePage, { data: pagedData(2, 2) });
			run('popstate');
			expect(window.scrollTo).not.toHaveBeenCalled();
		});

		it('does not scroll when landing on page 1', () => {
			render(HomePage, { data: makeData() });
			run('link');
			expect(window.scrollTo).not.toHaveBeenCalled();
		});
	});

	describe('snapshot', () => {
		it('captures loaded pages, filter key and scroll position', () => {
			window.scrollY = 321;
			const view = render(HomePage, {
				data: pagedData(2, 3, { selectedAgency: 'a1', searchQuery: 'q' })
			});
			const snap = view.component.snapshot.capture();
			expect(snap.filterKey).toBe(JSON.stringify(['a1', 'q']));
			expect(snap.pages.map((p) => p.pageNum)).toEqual([1, 2]);
			expect(snap.scrollY).toBe(321);
		});

		it('restores previously loaded pages and scroll position', async () => {
			const view = render(HomePage, { data: pagedData(1, 3) });
			const restored = {
				filterKey: JSON.stringify([null, '']),
				pages: [
					{ pageNum: 1, cards: makeCards(2) },
					{ pageNum: 2, cards: makeCards(2, 500) },
					{ pageNum: 3, cards: makeCards(2, 600) }
				],
				scrollY: 1234
			};
			await view.component.snapshot.restore(restored);
			expect(screen.getByRole('heading', { name: 'Card 600' })).toBeInTheDocument();
			expect(window.scrollTo).toHaveBeenCalledWith(0, 1234);
			expect(screen.queryByText('Load more cards')).toBeNull();
		});

		it('ignores a snapshot taken under different filters', async () => {
			const view = render(HomePage, { data: makeData() });
			await view.component.snapshot.restore({
				filterKey: JSON.stringify(['other', 'x']),
				pages: [{ pageNum: 1, cards: makeCards(1, 700) }],
				scrollY: 50
			});
			expect(screen.queryByRole('heading', { name: 'Card 700' })).toBeNull();
			expect(window.scrollTo).not.toHaveBeenCalled();
		});

		it('ignores an empty snapshot', async () => {
			const view = render(HomePage, { data: makeData() });
			await view.component.snapshot.restore(undefined);
			expect(window.scrollTo).not.toHaveBeenCalled();
		});
	});
});
