import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

export async function load({ fetch }) {
	const directus = getDirectusInstance(fetch);

	// Every card with a photo, in the grid's order: highest binder page first, newest first within
	// a page. That is front-to-back through the real binder, so sheets fill straight from this list.
	const transit_cards = await directus.request(
		readItems('transit_cards', {
			limit: -1,
			sort: ['-binder_page_number', '-date_acquired', 'name', 'id'],
			fields: [
				'id',
				'name',
				'date_acquired',
				'image',
				'binder_page_number',
				'issuing_agency.id',
				'issuing_agency.name',
				'issuing_agency.city',
				'notes'
			],
			filter: { image: { _nnull: true } }
		})
	);

	return {
		transit_cards,
		title: 'Binder',
		chromeless: true
	};
}
