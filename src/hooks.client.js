import { isNetworkError } from '$lib/connection.svelte.js';
import { saveServerFetches } from '$lib/cmsCache';

// Runs before hydration, while the server's CMS responses are still in the page
export function init() {
	saveServerFetches();
}

// Lets the error page tell "you're offline" apart from a real failure
export function handleError({ error, message }) {
	console.error(error);
	return { message, offline: isNetworkError(error) };
}
