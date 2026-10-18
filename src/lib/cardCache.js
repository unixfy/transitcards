// Cards the visitor has already been shown (the grid loads everything a detail page needs), so
// opening one never waits on the network for data we already hold. Browser only: the server
// renders every request fresh.
import { browser } from '$app/environment';

const cards = new Map();

export function cacheCards(list) {
	if (!browser) return;
	for (const card of list) cards.set(card.id, card);
}

export const getCachedCard = (id) => (browser ? cards.get(id) : undefined);
