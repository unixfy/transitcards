import { readItems } from '@directus/sdk';
import { cacheCards } from '$lib/cardCache';

export const CARDS_PER_PAGE = 50;

// Build the Directus filter object for the homepage's agency filter and search query
export function buildCardsFilter(agencyFilter, searchQuery) {
	const filters = [];

	if (agencyFilter) {
		filters.push({
			issuing_agency: {
				id: { _eq: agencyFilter }
			}
		});
	}

	// Add server-side full-text search using OR logic across multiple fields
	// This is a workaround because Directus does not support full-text search natively
	if (searchQuery.trim()) {
		filters.push({
			_or: [
				{ name: { _icontains: searchQuery } },
				{ issuing_agency: { name: { _icontains: searchQuery } } },
				{ issuing_agency: { city: { _icontains: searchQuery } } },
				{ notes: { _icontains: searchQuery } }
			]
		});
	}

	// Combine filters with AND logic if both exist
	return filters.length > 1 ? { _and: filters } : filters.length === 1 ? filters[0] : {};
}

// Fetch `pageCount` consecutive pages of transit cards starting at `page`;
// `id` is the final sort key so pages never overlap
export async function fetchCardsPages(directus, page, filter, pageCount = 1) {
	const cards = await directus.request(
		readItems('transit_cards', {
			limit: CARDS_PER_PAGE * pageCount,
			offset: (page - 1) * CARDS_PER_PAGE,
			sort: ['-binder_page_number', '-date_acquired', 'name', 'id'],
			fields: [
				'id',
				'name',
				'date_acquired',
				'image',
				'issuing_agency.id',
				'issuing_agency.name',
				'issuing_agency.city',
				'notes'
			],
			...(Object.keys(filter).length > 0 && { filter })
		})
	);
	cacheCards(cards);
	return cards;
}
