import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn();
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ request })) }));
vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import { load } from './+page.js';

const makeUrl = (qs = '') => new URL(`http://localhost/${qs}`);

// Route each directus request to canned data based on its query shape
function mockDirectus({
	cards = [],
	count = [{ count: { id: 0 } }],
	agencies = [],
	acquisitions = [],
	earliest = []
} = {}) {
	request.mockImplementation(async (req) => {
		const { collection, query } = req;
		if (collection === 'transit_cards_agencies') return agencies;
		if (query.groupBy) return acquisitions;
		if (query.aggregate) return count;
		if (query.limit === 1 && query.fields?.[0]?.startsWith('year(')) return earliest;
		return cards;
	});
}

const requestsFor = (predicate) => request.mock.calls.map(([r]) => r).filter(predicate);

describe('home page load', () => {
	beforeEach(() => {
		request.mockReset();
	});

	it('returns defaults for an empty collection', async () => {
		mockDirectus();
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data).toEqual({
			transit_cards: [],
			agencies: [],
			currentPage: 1,
			totalPages: 0,
			totalCount: 0,
			selectedAgency: null,
			searchQuery: '',
			acquisitionCounts: [],
			earliestAcquired: null,
			title: 'Home'
		});
	});

	it('computes total pages from the filtered count', async () => {
		mockDirectus({ count: [{ count: { id: '101' } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.totalCount).toBe('101');
		expect(data.totalPages).toBe(3);
	});

	it('returns exactly one page when the count equals the page size', async () => {
		mockDirectus({ count: [{ count: { id: 50 } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.totalPages).toBe(1);
	});

	it.each([['?page=abc'], ['?page=0'], ['?page=-3'], ['']])(
		'treats invalid page %j as page 1',
		async (qs) => {
			mockDirectus({ count: [{ count: { id: 200 } }] });
			const data = await load({ fetch: vi.fn(), url: makeUrl(qs) });
			expect(data.currentPage).toBe(1);
		}
	);

	it('fetches every page up to the current one', async () => {
		mockDirectus({ count: [{ count: { id: 500 } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl('?page=3') });
		expect(data.currentPage).toBe(3);
		const [cardsReq] = requestsFor((r) => r.query.sort && r.query.offset === 0);
		expect(cardsReq.query.limit).toBe(150);
	});

	it('clamps a page past the end to the last page', async () => {
		mockDirectus({ count: [{ count: { id: 120 } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl('?page=99') });
		expect(data.totalPages).toBe(3);
		expect(data.currentPage).toBe(3);
	});

	it('clamps to page 1 when there are no results', async () => {
		mockDirectus({ count: [{ count: { id: 0 } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl('?page=5') });
		expect(data.currentPage).toBe(1);
	});

	it('handles an empty count aggregate', async () => {
		mockDirectus({ count: [] });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.totalCount).toBe(0);
		expect(data.totalPages).toBe(0);
	});

	it('passes agency and search filters to cards, count and acquisition queries', async () => {
		mockDirectus({ count: [{ count: { id: 1 } }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl('?agency=a1&search=bart') });

		expect(data.selectedAgency).toBe('a1');
		expect(data.searchQuery).toBe('bart');

		const filtered = requestsFor((r) => r.collection === 'transit_cards' && r.query.filter?._and);
		// cards list, filtered count and acquisition groups
		expect(filtered).toHaveLength(3);
	});

	it('does not filter the earliest-acquired query', async () => {
		mockDirectus();
		await load({ fetch: vi.fn(), url: makeUrl('?agency=a1&search=bart') });
		const [earliestReq] = requestsFor((r) => r.query.fields?.[0] === 'year(date_acquired)');
		expect(earliestReq.query.filter).toEqual({ date_acquired: { _nnull: true } });
		expect(earliestReq.query.sort).toEqual(['date_acquired']);
		expect(earliestReq.query.limit).toBe(1);
	});

	it('omits the filter from unfiltered count and acquisition queries', async () => {
		mockDirectus();
		await load({ fetch: vi.fn(), url: makeUrl() });
		const aggregates = requestsFor((r) => r.query.aggregate);
		expect(aggregates).toHaveLength(2);
		for (const r of aggregates) expect('filter' in r.query).toBe(false);
	});

	it('loads agencies sorted by name for the dropdown', async () => {
		const agencies = [{ id: '1', name: 'BART', city: 'Oakland' }];
		mockDirectus({ agencies });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.agencies).toBe(agencies);
		const [req] = requestsFor((r) => r.collection === 'transit_cards_agencies');
		expect(req.query).toEqual({ fields: ['id', 'name', 'city'], sort: ['name'], limit: -1 });
	});

	it('converts acquisition groups into numeric date parts and counts', async () => {
		mockDirectus({
			acquisitions: [
				{
					date_acquired_year: '2020',
					date_acquired_month: '3',
					date_acquired_day: '15',
					count: { id: '4' }
				},
				{
					date_acquired_year: null,
					date_acquired_month: null,
					date_acquired_day: null,
					count: { id: '2' }
				},
				{ date_acquired_year: 2021, date_acquired_month: 1, date_acquired_day: 1 }
			]
		});
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.acquisitionCounts).toEqual([
			{ date: [2020, 3, 15], count: 4 },
			{ date: null, count: 2 },
			{ date: [2021, 1, 1], count: 0 }
		]);
	});

	it('returns the earliest acquired date as numeric parts', async () => {
		mockDirectus({
			earliest: [{ date_acquired_year: '2018', date_acquired_month: '07', date_acquired_day: '04' }]
		});
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.earliestAcquired).toEqual([2018, 7, 4]);
	});

	it('returns null earliest date when the row has no year', async () => {
		mockDirectus({ earliest: [{ date_acquired_year: null }] });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.earliestAcquired).toBeNull();
	});

	it('returns the fetched cards unchanged', async () => {
		const cards = [{ id: 'a' }, { id: 'b' }];
		mockDirectus({ cards });
		const data = await load({ fetch: vi.fn(), url: makeUrl() });
		expect(data.transit_cards).toBe(cards);
	});

	it('propagates directus errors', async () => {
		request.mockRejectedValue(new Error('down'));
		await expect(load({ fetch: vi.fn(), url: makeUrl() })).rejects.toThrow('down');
	});
});
