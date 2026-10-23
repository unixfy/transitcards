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
			// The start page too, so the installed app opens offline even if it was never reloaded;
			// a failure there shouldn't stop the worker from installing
			.then((cache) => Promise.all([cache.addAll([...ASSETS]), cache.add('/').catch(() => {})]))
	);
});

// A new version waits until the page's update prompt says to take over (see PwaStatus.svelte)
self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
		event.respondWith(cms(event, url));
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
					event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
				}
				return response;
			} catch (err) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				// A page never visited gets a friendly offline page instead of the browser's own
				if (event.request.mode === 'navigate') {
					const offline = await cache.match('/offline.html');
					// Rewrapped: a host that redirected /offline.html would leave a response
					// that browsers refuse to use for a navigation
					if (offline) return new Response(offline.body, { headers: offline.headers });
				}
				throw err;
			}
		})()
	);
});

// Photos never change at a given URL, so serve them from cache; data goes to the network first.
// Fetching with CORS even for plain <img> requests keeps one readable copy that the palette canvas can use too.
async function cms(event, url) {
	const cache = await caches.open(CMS_CACHE);
	const cached = () => cache.match(url.href, { ignoreVary: true });
	const isPhoto = url.pathname.startsWith('/assets/');
	if (isPhoto) {
		const hit = await cached();
		if (hit) return hit;
	}
	let response;
	try {
		response = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
	} catch {
		const hit = !isPhoto && (await cached());
		if (hit) return hit;
		// Offline, or the CMS left out CORS headers: let the browser make its own request
		return fetch(event.request);
	}
	// The slideshow's large photos would crowd out the ones the grid and card pages need
	const fromSlideshow = new URL(event.request.referrer || location.href).pathname === '/slideshow';
	if (response.ok && !fromSlideshow) {
		event.waitUntil(
			cache
				.put(url.href, response.clone())
				.then(() => trim(cache))
				.catch(() => {})
		);
	}
	return response;
}

// Drop the oldest entries once the cache passes its cap
async function trim(cache) {
	const keys = await cache.keys();
	await Promise.all(keys.slice(0, keys.length - CMS_LIMIT).map((key) => cache.delete(key)));
}
