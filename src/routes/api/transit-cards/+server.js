import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';
import { json } from '@sveltejs/kit';

const PAGE_SIZE = 36;

export async function GET({ fetch, url }) {
	const directus = getDirectusInstance(fetch);
	const agencyFilter = url.searchParams.get('agency');
	const searchQuery = url.searchParams.get('search') || '';
	const pageParam = Number.parseInt(url.searchParams.get('page') || '1', 10);
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

	const filters = [];

	if (agencyFilter) {
		filters.push({
			issuing_agency: {
				id: { _eq: agencyFilter }
			}
		});
	}

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

	const filter = filters.length > 1 ? { _and: filters } : (filters.length === 1 ? filters[0] : {});

	const [transitCards, totalResultCardsDataAgg] = await Promise.all([
		directus.request(
			readItems('transit_cards', {
				limit: PAGE_SIZE,
				page,
				sort: ['-binder_page_number', '-date_acquired', 'name'],
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
		),
		directus.request(
			readItems('transit_cards', {
				limit: -1,
				aggregate: { count: ['id'] },
				...(Object.keys(filter).length > 0 && { filter })
			})
		)
	]);

	const totalCount = totalResultCardsDataAgg[0]?.count?.id || 0;
	const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 0;

	return json({
		transit_cards: transitCards,
		currentPage: page,
		totalPages,
		hasMore: page < totalPages
	});
}
