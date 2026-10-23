import { isNetworkError } from '$lib/connection.svelte.js';

// Lets the error page tell "you're offline" apart from a real failure
export function handleError({ error, message }) {
	console.error(error);
	return { message, offline: isNetworkError(error) };
}
