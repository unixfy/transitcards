// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rememberCollection, takeCollection } from './collectionReturn.js';

describe('collectionReturn', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns null when nothing was remembered', () => {
		expect(takeCollection()).toBeNull();
	});

	it('round-trips a collection URL including its query string', () => {
		rememberCollection('/?page=3&agency=a1&search=light%20rail');
		expect(takeCollection()).toBe('/?page=3&agency=a1&search=light%20rail');
	});

	it('is consumed on first read', () => {
		rememberCollection('/?page=2');
		takeCollection();
		expect(takeCollection()).toBeNull();
	});

	it.each([['https://evil.example/'], ['//evil.example/'], ['javascript:alert(1)'], ['']])(
		'refuses non-local value %j',
		(value) => {
			sessionStorage.setItem('collectionUrl', value);
			expect(takeCollection()).toBeNull();
		}
	);

	it('swallows storage errors when remembering', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('denied');
		});
		expect(() => rememberCollection('/')).not.toThrow();
	});

	it('swallows storage errors when reading', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied');
		});
		expect(takeCollection()).toBeNull();
	});
});
