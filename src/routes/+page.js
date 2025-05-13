import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';
export async function load({ fetch }) {
	const directus = getDirectusInstance(fetch);
	return {
		transit_cards: await directus.request(readItems('transit_cards', { sort: ['-binder_page_number', 'date_acquired', 'name'], fields: ['id', 'name', 'date_acquired', 'image', 'issuing_agency.name', 'issuing_agency.city', 'notes'] })),
		count_transit_cards: await directus.request(readItems('transit_cards', { limit: -1, aggregate: { count: ['id'] } }))
	};
}