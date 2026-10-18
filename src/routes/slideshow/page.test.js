import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn();
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ request })) }));
vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import { load } from './+page.js';

const fmt = (iso) =>
	new Date(iso).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});

describe('slideshow load', () => {
	beforeEach(() => {
		request.mockReset();
	});

	it('requests every card that has an image', async () => {
		request.mockResolvedValueOnce([]);
		await load({ fetch: vi.fn() });
		expect(request).toHaveBeenCalledWith({
			collection: 'transit_cards',
			query: {
				limit: -1,
				fields: [
					'id',
					'name',
					'date_acquired',
					'image',
					'issuing_agency.name',
					'issuing_agency.city'
				],
				filter: { image: { _nnull: true } }
			}
		});
	});

	it('marks the page chromeless and titles it', async () => {
		request.mockResolvedValueOnce([]);
		const data = await load({ fetch: vi.fn() });
		expect(data.chromeless).toBe(true);
		expect(data.title).toBe('Slideshow');
		expect(data.transit_cards).toEqual([]);
	});

	it('formats acquisition dates and keeps the other fields', async () => {
		request.mockResolvedValueOnce([
			{ id: 'a', name: 'A', image: 'i', date_acquired: '2022-12-31' },
			{ id: 'b', name: 'B', image: 'j', date_acquired: null }
		]);
		const data = await load({ fetch: vi.fn() });
		expect(data.transit_cards[0]).toEqual({
			id: 'a',
			name: 'A',
			image: 'i',
			date_acquired: fmt('2022-12-31')
		});
		expect(data.transit_cards[1].date_acquired).toBeNull();
		expect(data.transit_cards[1].id).toBe('b');
	});
});
