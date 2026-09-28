import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

export async function load({ fetch, url }) {
    const directus = getDirectusInstance(fetch);
    // Fetch total count of ALL transit cards (unfiltered)
    const totalAllCardsPromise = await directus.request(
        readItems('transit_cards', {
            limit: -1,
            aggregate: { count: ['id'] }
        })
    );

    return {
        totalAllCards: totalAllCardsPromise[0]?.count?.id || 0
    }
}