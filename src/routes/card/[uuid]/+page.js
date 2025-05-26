import { error } from '@sveltejs/kit';
import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

export async function load({ fetch, params }) {
    const directus = getDirectusInstance(fetch);

    // return 400 if uuid is invalid
    if (!isValidUUID(params.uuid)) {
        error(400, 'Invalid card UUID');
    }

    const response = await directus.request(
        readItems('transit_cards', { filter: { id: { "_eq": params.uuid } }, fields: ['id', 'name', 'date_acquired', 'image', 'issuing_agency.name', 'issuing_agency.city', 'notes'] })
    );

    // Handle cases based on the response
    if (response.length === 0) {
        // No results found, return 404
        error(404, 'Transit card not found');
    } else if (response.length > 1) {
        // More than one result, return 500
        error(500, 'Unexpected number of results');
    } else {
        // Exactly one result, return the item
        return {
            transit_card: response[0],
            title: response[0].name || 'Transit Card Details'
        };
    }
}