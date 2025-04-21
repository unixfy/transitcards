import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';
export async function load({ fetch }) {
	const directus = getDirectusInstance(fetch);
	return {
		transit_cards: await directus.request(readItems('transit_cards', {sort: ['date_acquired', 'name']})),
	};
}