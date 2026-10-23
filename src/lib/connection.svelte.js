import { browser } from '$app/environment';

// Whether the browser thinks it is online, plus a short note for the visitor (see PwaStatus.svelte)
export const connection = $state({ online: true, note: '' });

let noteTimer;

export function notify(note, ms = 4000) {
	connection.note = note;
	clearTimeout(noteTimer);
	noteTimer = setTimeout(() => (connection.note = ''), ms);
}

// navigator.onLine stays true on a network with no internet, so a failed fetch counts too.
// Browsers word it differently: "Failed to fetch", "NetworkError when…", "Load failed".
export const isNetworkError = (err) =>
	(browser && !navigator.onLine) ||
	(err instanceof TypeError && /fetch|network|load failed/i.test(err.message));

if (browser) {
	connection.online = navigator.onLine;
	addEventListener('offline', () => (connection.online = false));
	addEventListener('online', () => {
		connection.online = true;
		notify('Back online', 2500);
	});
}
