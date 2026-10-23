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
