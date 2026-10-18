import { describe, it, expect, vi } from 'vitest';

const request = vi.fn();
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ request })) }));
vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import getDirectusInstance from '$lib/directus';
import { load } from './+layout.js';

describe('root layout load', () => {
	it('returns the total unfiltered card count', async () => {
		request.mockResolvedValueOnce([{ count: { id: '42' } }]);
		const fetch = vi.fn();

		const result = await load({ fetch });

		expect(getDirectusInstance).toHaveBeenCalledWith(fetch);
		expect(request).toHaveBeenCalledWith({
			collection: 'transit_cards',
			query: { limit: -1, aggregate: { count: ['id'] } }
		});
		expect(result).toEqual({ totalAllCards: '42' });
	});

	it('falls back to 0 when the aggregate is empty', async () => {
		request.mockResolvedValueOnce([]);
		expect(await load({ fetch: vi.fn() })).toEqual({ totalAllCards: 0 });
	});

	it('falls back to 0 when the count is missing', async () => {
		request.mockResolvedValueOnce([{}]);
		expect(await load({ fetch: vi.fn() })).toEqual({ totalAllCards: 0 });
	});

	it('propagates directus errors', async () => {
		request.mockRejectedValueOnce(new Error('boom'));
		await expect(load({ fetch: vi.fn() })).rejects.toThrow('boom');
	});
});
