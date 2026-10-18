import { describe, it, expect, vi } from 'vitest';

vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import { readItems } from '@directus/sdk';
import { buildCardsFilter, fetchCardsPages, CARDS_PER_PAGE } from './cards.js';

describe('CARDS_PER_PAGE', () => {
	it('is 50', () => {
		expect(CARDS_PER_PAGE).toBe(50);
	});
});

describe('buildCardsFilter', () => {
	it('returns an empty object with no agency and no search', () => {
		expect(buildCardsFilter(null, '')).toEqual({});
		expect(buildCardsFilter(undefined, '')).toEqual({});
		expect(buildCardsFilter('', '')).toEqual({});
	});

	it('ignores whitespace-only search queries', () => {
		expect(buildCardsFilter(null, '   \t ')).toEqual({});
	});

	it('filters by agency id only', () => {
		expect(buildCardsFilter('abc', '')).toEqual({
			issuing_agency: { id: { _eq: 'abc' } }
		});
	});

	it('searches across name, agency name, agency city and notes with OR', () => {
		expect(buildCardsFilter(null, 'bart')).toEqual({
			_or: [
				{ name: { _icontains: 'bart' } },
				{ issuing_agency: { name: { _icontains: 'bart' } } },
				{ issuing_agency: { city: { _icontains: 'bart' } } },
				{ notes: { _icontains: 'bart' } }
			]
		});
	});

	it('passes the search query through untrimmed', () => {
		const filter = buildCardsFilter(null, ' bart ');
		expect(filter._or[0]).toEqual({ name: { _icontains: ' bart ' } });
	});

	it('combines agency and search with AND', () => {
		const filter = buildCardsFilter('abc', 'bart');
		expect(filter._and).toHaveLength(2);
		expect(filter._and[0]).toEqual({ issuing_agency: { id: { _eq: 'abc' } } });
		expect(filter._and[1]._or).toHaveLength(4);
	});
});

describe('fetchCardsPages', () => {
	const makeDirectus = () => ({ request: vi.fn(async (req) => req) });

	it('requests a single first page by default', async () => {
		const directus = makeDirectus();
		const result = await fetchCardsPages(directus, 1, {});
		expect(readItems).toHaveBeenCalledWith('transit_cards', expect.any(Object));
		expect(result.collection).toBe('transit_cards');
		expect(result.query.limit).toBe(CARDS_PER_PAGE);
		expect(result.query.offset).toBe(0);
	});

	it('offsets by whole pages', async () => {
		const { query } = await fetchCardsPages(makeDirectus(), 3, {});
		expect(query.offset).toBe(2 * CARDS_PER_PAGE);
		expect(query.limit).toBe(CARDS_PER_PAGE);
	});

	it('multiplies the limit by pageCount', async () => {
		const { query } = await fetchCardsPages(makeDirectus(), 1, {}, 4);
		expect(query.limit).toBe(4 * CARDS_PER_PAGE);
		expect(query.offset).toBe(0);
	});

	it('uses a stable sort ending in id', async () => {
		const { query } = await fetchCardsPages(makeDirectus(), 1, {});
		expect(query.sort).toEqual(['-binder_page_number', '-date_acquired', 'name', 'id']);
	});

	it('requests the fields the UI needs', async () => {
		const { query } = await fetchCardsPages(makeDirectus(), 1, {});
		expect(query.fields).toEqual([
			'id',
			'name',
			'date_acquired',
			'image',
			'issuing_agency.id',
			'issuing_agency.name',
			'issuing_agency.city',
			'notes'
		]);
	});

	it('omits the filter key when the filter is empty', async () => {
		const { query } = await fetchCardsPages(makeDirectus(), 1, {});
		expect('filter' in query).toBe(false);
	});

	it('includes the filter when non-empty', async () => {
		const filter = { name: { _icontains: 'x' } };
		const { query } = await fetchCardsPages(makeDirectus(), 1, filter);
		expect(query.filter).toBe(filter);
	});

	it('returns the directus request promise', async () => {
		const directus = { request: vi.fn().mockResolvedValue([{ id: 1 }]) };
		await expect(fetchCardsPages(directus, 1, {})).resolves.toEqual([{ id: 1 }]);
	});
});
