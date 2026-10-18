import { describe, it, expect, vi, beforeEach } from 'vitest';

const rest = vi.fn(() => 'rest-ext');
const client = { with: vi.fn(() => 'client-with-rest') };
const createDirectus = vi.fn(() => client);

vi.mock('@directus/sdk', () => ({
	createDirectus: (...args) => createDirectus(...args),
	rest: (...args) => rest(...args)
}));

import getDirectusInstance from './directus.js';

describe('getDirectusInstance', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('points at the CMS and adds the REST extension', () => {
		const result = getDirectusInstance();
		expect(createDirectus).toHaveBeenCalledWith('https://cms.alexwang.net', {});
		expect(client.with).toHaveBeenCalledWith('rest-ext');
		expect(result).toBe('client-with-rest');
	});

	it('uses the default global fetch when none is passed', () => {
		getDirectusInstance();
		expect(createDirectus.mock.calls[0][1]).toEqual({});
	});

	it('injects a custom fetch (SvelteKit load fetch) when provided', () => {
		const fetch = vi.fn();
		getDirectusInstance(fetch);
		expect(createDirectus).toHaveBeenCalledWith('https://cms.alexwang.net', {
			globals: { fetch }
		});
	});
});
