// Where "Return to Collection" goes: the collection (the grid or the binder) exactly as the
// visitor left it, even after drawing more cards or reloading. Kept in sessionStorage so it survives reloads in the tab.
import { goto } from '$app/navigation';

const KEY = 'collectionReturn';

// SvelteKit numbers each history entry it creates; that index survives reloads with the entry
const historyIndex = () => history.state?.['sveltekit:history'];

function read() {
	try {
		return JSON.parse(sessionStorage.getItem(KEY)) ?? null;
	} catch {
		return null;
	}
}

function write(value) {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(value));
	} catch {
		// storage unavailable (private mode); Return falls back to the collection's first page
	}
}

// Called as the visitor leaves the grid or the binder for a card
export function rememberCollection() {
	write({
		path: location.pathname,
		search: location.search,
		index: historyIndex(),
		scrollY: Math.round(window.scrollY)
	});
}

export function returnToCollection() {
	const saved = read();
	const here = historyIndex();
	// Step straight back to the collection's own history entry, past any cards drawn since, so
	// the browser and the page snapshot bring back every loaded page and the scroll position
	// (A page loaded in full numbers its entry from the clock, so the gap must fit in this tab's history)
	const steps = here - saved?.index;
	if (Number.isInteger(steps) && steps > 0 && steps < history.length) {
		history.go(-steps);
		return;
	}
	// Opened from a link or a new tab: load the same view of the collection, then scroll back
	if (saved) write({ ...saved, restore: true });
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- the app is served from the root
	goto((saved?.path ?? '/') + (saved?.search ?? ''));
}

// The scroll position to restore when the collection loads from a Return without history
export function takeReturnScroll(search) {
	const saved = read();
	if (!saved?.restore || saved.path !== '/' || saved.search !== search) return null;
	write({ ...saved, restore: false });
	return saved.scrollY;
}
