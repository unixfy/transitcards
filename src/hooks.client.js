import { isNetworkError } from '$lib/connection.svelte.js';

// Lets the error page tell "you're offline" apart from a real failure
export function handleError({ error }) {
	return { message: 'Internal Error', offline: isNetworkError(error) };
}
