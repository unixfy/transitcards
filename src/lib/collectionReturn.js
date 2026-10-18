// The "I'm Feeling Lucky" button leaves the page with a full navigation, so the card page can't
// tell where the visitor came from. The collection URL (with its query params) is handed over
// through sessionStorage instead, and is consumed once so it never goes stale.
const KEY = 'collectionUrl';

export function rememberCollection(url) {
	try {
		sessionStorage.setItem(KEY, url);
	} catch {
		// storage unavailable; the card page falls back to the homepage
	}
}

// Returns the remembered collection URL (once), or null
export function takeCollection() {
	try {
		const url = sessionStorage.getItem(KEY);
		sessionStorage.removeItem(KEY);
		// Only same-site paths are ever followed
		return url?.startsWith('/') && !url.startsWith('//') ? url : null;
	} catch {
		return null;
	}
}
