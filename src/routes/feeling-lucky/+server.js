import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';
import { redirect, error } from '@sveltejs/kit';

export async function GET({ fetch }) {
    const directus = getDirectusInstance(fetch);

    // Get total count of cards
    const countResult = await directus.request(
        readItems('transit_cards', {
            limit: -1,
            aggregate: { count: ['id'] }
        })
    );

    const totalCards = countResult[0]?.count?.id || 0;
    if (totalCards === 0) {
        throw error(404, 'No cards found');
    }

    // Get a random offset
    const randomOffset = Math.floor(Math.random() * totalCards);

    // Fetch one random card
    const randomCard = await directus.request(
        readItems('transit_cards', {
            limit: 1,
            offset: randomOffset,
            fields: ['id']
        })
    );

    if (!randomCard?.[0]?.id) {
        throw error(404, 'Failed to get random card');
    }

    // Redirect to the card's page
    throw redirect(307, `/card/${randomCard[0].id}`);
}