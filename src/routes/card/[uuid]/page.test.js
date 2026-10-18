import { describe, it, expect, vi, beforeEach } from 'vitest';

const request = vi.fn();
vi.mock('$lib/directus', () => ({ default: vi.fn(() => ({ request })) }));
vi.mock('@directus/sdk', () => ({
	readItems: vi.fn((collection, query) => ({ collection, query }))
}));

import { load } from './+page.js';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

async function loadError(params) {
	try {
		await load({ fetch: vi.fn(), params });
	} catch (e) {
		return e;
	}
	throw new Error('expected load to throw');
}

describe('card page load', () => {
	beforeEach(() => {
		request.mockReset();
	});

	describe('UUID validation', () => {
		it.each([
			['not-a-uuid'],
			[''],
			['123e4567-e89b-12d3-a456-426614174000'], // version 1, not 4
			['123e4567-e89b-42d3-c456-426614174000'], // invalid variant
			['123e4567e89b42d3a456426614174000'], // no dashes
			[`${UUID}extra`],
			[`x${UUID}`]
		])('rejects %j with a 400 before hitting the CMS', async (uuid) => {
			const err = await loadError({ uuid });
			expect(err.status).toBe(400);
			expect(err.body.message).toBe('Invalid card UUID');
			expect(request).not.toHaveBeenCalled();
		});

		it('accepts uppercase UUIDs', async () => {
			request.mockResolvedValueOnce([{ id: UUID, name: 'X' }]);
			const data = await load({ fetch: vi.fn(), params: { uuid: UUID.toUpperCase() } });
			expect(data.transit_card.id).toBe(UUID);
		});
	});

	it('queries the card by id with the display fields', async () => {
		request.mockResolvedValueOnce([{ id: UUID, name: 'X' }]);
		await load({ fetch: vi.fn(), params: { uuid: UUID } });
		expect(request).toHaveBeenCalledWith({
			collection: 'transit_cards',
			query: {
				filter: { id: { _eq: UUID } },
				fields: [
					'id',
					'name',
					'date_acquired',
					'image',
					'issuing_agency.name',
					'issuing_agency.city',
					'notes'
				]
			}
		});
	});

	it('404s when no card matches', async () => {
		request.mockResolvedValueOnce([]);
		const err = await loadError({ uuid: UUID });
		expect(err.status).toBe(404);
		expect(err.body.message).toBe('Transit card not found');
	});

	it('500s when more than one card matches', async () => {
		request.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
		const err = await loadError({ uuid: UUID });
		expect(err.status).toBe(500);
		expect(err.body.message).toBe('Unexpected number of results');
	});

	it('returns the card with a long-form UTC date and the name as title', async () => {
		request.mockResolvedValueOnce([{ id: UUID, name: 'Clipper', date_acquired: '2021-03-05' }]);
		const data = await load({ fetch: vi.fn(), params: { uuid: UUID } });
		expect(data.title).toBe('Clipper');
		// Locale-independent checks: the day must not shift with the time zone
		expect(data.transit_card.date_acquired).toMatch(/2021/);
		expect(data.transit_card.date_acquired).toMatch(/5/);
		expect(data.transit_card.date_acquired).not.toBe('2021-03-05');
	});

	it('formats dates in UTC regardless of the local time zone', async () => {
		const expected = new Date('2021-03-01').toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		});
		request.mockResolvedValueOnce([{ id: UUID, name: 'A', date_acquired: '2021-03-01' }]);
		const data = await load({ fetch: vi.fn(), params: { uuid: UUID } });
		expect(data.transit_card.date_acquired).toBe(expected);
	});

	it('leaves a missing date untouched', async () => {
		request.mockResolvedValueOnce([{ id: UUID, name: 'A', date_acquired: null }]);
		const data = await load({ fetch: vi.fn(), params: { uuid: UUID } });
		expect(data.transit_card.date_acquired).toBeNull();
	});

	it('falls back to a generic title when the card has no name', async () => {
		request.mockResolvedValueOnce([{ id: UUID, name: '' }]);
		const data = await load({ fetch: vi.fn(), params: { uuid: UUID } });
		expect(data.title).toBe('Transit Card Details');
	});
});
