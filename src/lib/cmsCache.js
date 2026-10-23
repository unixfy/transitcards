// Shared with the service worker, which keeps CMS data and photos in this cache for offline use
export const CMS_ORIGIN = 'https://cms.alexwang.net';
export const CMS_CACHE = 'cms';

// A server-rendered page carries the CMS responses its load functions fetched, but the browser
// never requested them itself, so the service worker never saw them. Copy them into its cache
// so the same data loads offline later. Must run before hydration, which removes those scripts.
export function saveServerFetches() {
	if (!('caches' in window)) return;
	const entries = [];
	for (const script of document.querySelectorAll('script[data-sveltekit-fetched][data-url]')) {
		const url = new URL(script.dataset.url, location.href);
		if (url.origin === CMS_ORIGIN && !('b64' in script.dataset)) {
			entries.push([url.href, script.textContent]);
		}
	}
	caches
		.open(CMS_CACHE)
		.then(async (cache) => {
			for (const [url, json] of entries) {
				try {
					const { status, statusText, headers, body } = JSON.parse(json);
					if (status !== 200) continue;
					await cache.put(url, new Response(body, { status, statusText, headers }));
				} catch {
					// a malformed entry or full storage only means that response isn't saved
				}
			}
		})
		.catch(() => {});
}

// A page loaded before the worker took over (a first visit, or a hard refresh, which skips it)
// fetched its data and photos behind the worker's back. Ask the worker to take over, then request
// the photos once more through it so they're saved too; most come straight from the HTTP cache.
export async function adoptPage() {
	const sw = navigator.serviceWorker;
	if (!sw || sw.controller) return;
	const reg = await sw.ready;
	if (!sw.controller) {
		const controlled = new Promise((r) =>
			sw.addEventListener('controllerchange', r, { once: true })
		);
		reg.active?.postMessage('CLAIM');
		await controlled;
	}
	const photos = performance
		.getEntriesByType('resource')
		.map((entry) => entry.name)
		.filter((url) => url.startsWith(CMS_ORIGIN + '/assets/'));
	for (const url of new Set(photos)) await fetch(url).catch(() => {});
}
