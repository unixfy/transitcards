import { describe, it, expect, vi } from 'vitest';
import { handle } from './hooks.server.js';

describe('handle', () => {
	it('resolves the event and returns the response', async () => {
		const response = new Response('ok');
		const resolve = vi.fn().mockResolvedValue(response);
		const event = { url: new URL('http://localhost/') };

		const result = await handle({ event, resolve });

		expect(resolve).toHaveBeenCalledWith(event, expect.any(Object));
		expect(result).toBe(response);
	});

	it('only serializes the content-type response header (case-insensitive)', async () => {
		const resolve = vi.fn().mockResolvedValue(new Response());
		await handle({ event: {}, resolve });

		const { filterSerializedResponseHeaders } = resolve.mock.calls[0][1];
		expect(filterSerializedResponseHeaders('content-type')).toBe(true);
		expect(filterSerializedResponseHeaders('Content-Type')).toBe(true);
		expect(filterSerializedResponseHeaders('cache-control')).toBe(false);
		expect(filterSerializedResponseHeaders('set-cookie')).toBe(false);
	});
});
