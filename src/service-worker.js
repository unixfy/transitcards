/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// App shell is precached per deploy; pages and data go network-first so the app still opens offline
const CACHE = `cache-${version}`;
const ASSETS = new Set([...build, ...files]);

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
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	// Leave the CMS images and the random-card redirect to the network
	if (event.request.method !== 'GET' || url.origin !== location.origin) return;
	if (url.pathname === '/feeling-lucky') return;

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
