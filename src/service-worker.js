/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// App shell is precached per deploy; pages and data go network-first so the app still opens offline
const CACHE = `cache-${version}`;
const ASSETS = new Set([...build, ...files]);

// Card data and photos from the CMS outlive deploys, so they get their own capped cache
const CMS = 'https://cms.alexwang.net';
const CMS_CACHE = 'cms';
const CMS_LIMIT = 400;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...ASSETS]))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key !== CACHE && key !== CMS_CACHE).map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.origin === CMS) {
		event.respondWith(cms(url));
		return;
	}
	// The random-card redirect must stay random
	if (url.origin !== location.origin || url.pathname === '/feeling-lucky') return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (ASSETS.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}
			try {
				const response = await fetch(event.request);
				if (response.status === 200 && response.type === 'basic') {
					cache.put(event.request, response.clone());
				}
				return response;
			} catch (err) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});

// Photos never change at a given URL, so serve them from cache; data goes to the network first.
// Fetching with CORS even for plain <img> requests keeps one readable copy that the palette canvas can use too.
async function cms(url) {
	const cache = await caches.open(CMS_CACHE);
	const cached = () => cache.match(url.href, { ignoreVary: true });
	const isPhoto = url.pathname.startsWith('/assets/');
	if (isPhoto) {
		const hit = await cached();
		if (hit) return hit;
	}
	try {
		const response = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
		if (response.ok) {
			await cache.put(url.href, response.clone());
			trim(cache);
		}
		return response;
	} catch (err) {
		const hit = !isPhoto && (await cached());
		if (hit) return hit;
		throw err;
	}
}

// Drop the oldest entries once the cache passes its cap
async function trim(cache) {
	const keys = await cache.keys();
	await Promise.all(keys.slice(0, keys.length - CMS_LIMIT).map((key) => cache.delete(key)));
}
