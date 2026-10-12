import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

// Helper function to format the date
function formatDate(dateString) {
	if (!dateString) return null;
	const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
	return new Date(dateString).toLocaleDateString(undefined, options);
}

export async function load({ fetch }) {
	const directus = getDirectusInstance(fetch);

	// Fetch every card that has an image; the slideshow shuffles them on the client
	const transit_cards = await directus.request(
		readItems('transit_cards', {
			limit: -1,
			fields: [
				'id',
				'name',
				'date_acquired',
				'image',
				'issuing_agency.name',
				'issuing_agency.city'
			],
			filter: { image: { _nnull: true } }
		})
	);

	return {
		transit_cards: transit_cards.map((card) => ({
			...card,
			date_acquired: formatDate(card.date_acquired)
		})),
		title: 'Slideshow',
		chromeless: true
	};
}
