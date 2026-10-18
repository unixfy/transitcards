import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const request = vi.fn();
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ request })) }));
vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import { GET } from './+server.js';

async function thrown(fn) {
	try {
		await fn();
	} catch (e) {
		return e;
	}
	throw new Error('expected GET to throw');
}

describe('GET /feeling-lucky', () => {
	beforeEach(() => {
		request.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('redirects (307) to a random card using a random offset', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		request
			.mockResolvedValueOnce([{ count: { id: '10' } }])
			.mockResolvedValueOnce([{ id: 'card-uuid' }]);

		const err = await thrown(() => GET({ fetch: vi.fn() }));

		expect(err.status).toBe(307);
		expect(err.location).toBe('/card/card-uuid');
		expect(request.mock.calls[1][0].query).toEqual({
			limit: 1,
			offset: 5,
			fields: ['id']
		});
	});

	it('never produces an offset equal to the total count', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.999999);
		request.mockResolvedValueOnce([{ count: { id: 7 } }]).mockResolvedValueOnce([{ id: 'x' }]);
		await thrown(() => GET({ fetch: vi.fn() }));
		expect(request.mock.calls[1][0].query.offset).toBe(6);
	});

	it('uses offset 0 when random returns 0', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		request.mockResolvedValueOnce([{ count: { id: 3 } }]).mockResolvedValueOnce([{ id: 'x' }]);
		await thrown(() => GET({ fetch: vi.fn() }));
		expect(request.mock.calls[1][0].query.offset).toBe(0);
	});

	it('404s when the collection is empty (numeric zero) without fetching a card', async () => {
		request.mockResolvedValueOnce([{ count: { id: 0 } }]);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
		expect(err.body.message).toBe('No cards found');
		expect(request).toHaveBeenCalledTimes(1);
	});

	it("404s when Directus reports an empty collection as the string '0'", async () => {
		// Directus returns aggregate counts as strings; '0' is truthy so the early guard is
		// skipped, but the follow-up lookup still ends in a 404
		request.mockResolvedValueOnce([{ count: { id: '0' } }]).mockResolvedValueOnce([]);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
	});

	it('404s when the count aggregate is missing', async () => {
		request.mockResolvedValueOnce([]);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
	});

	it('404s when no random card comes back', async () => {
		request.mockResolvedValueOnce([{ count: { id: 5 } }]).mockResolvedValueOnce([]);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
		expect(err.body.message).toBe('Failed to get random card');
	});

	it('404s when the returned card has no id', async () => {
		request.mockResolvedValueOnce([{ count: { id: 5 } }]).mockResolvedValueOnce([{}]);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
	});

	it('404s when the card response is null', async () => {
		request.mockResolvedValueOnce([{ count: { id: 5 } }]).mockResolvedValueOnce(null);
		const err = await thrown(() => GET({ fetch: vi.fn() }));
		expect(err.status).toBe(404);
	});
});
