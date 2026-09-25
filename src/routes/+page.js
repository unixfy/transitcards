import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

export async function load({ fetch, url }) {
	const directus = getDirectusInstance(fetch);
	const limit = 36;
	const pageParam = Number.parseInt(url.searchParams.get('page') || '1', 10);
	const requestedPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
	const agencyFilter = url.searchParams.get('agency');
	const searchQuery = url.searchParams.get('search') || '';

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

	const transitCardsPromise = directus.request(
		readItems('transit_cards', {
			limit: limit * requestedPage,
			page: 1,
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
	);

	const totalResultCardsCountPromise = directus.request(
		readItems('transit_cards', {
			limit: -1,
			aggregate: { count: ['id'] },
			...(Object.keys(filter).length > 0 && { filter })
		})
	);

	const totalAllCardsPromise = directus.request(
		readItems('transit_cards', {
			limit: -1,
			aggregate: { count: ['id'] }
		})
	);

	const agenciesPromise = directus.request(
		readItems('transit_cards_agencies', {
			fields: ['id', 'name', 'city'],
			sort: ['name'],
			limit: -1
		})
	);

	const [transit_cards, totalResultCardsDataAgg, totalAllCardsDataAgg, agencies] = await Promise.all([
		transitCardsPromise,
		totalResultCardsCountPromise,
		totalAllCardsPromise,
		agenciesPromise
	]);

	const totalCount = totalResultCardsDataAgg[0]?.count?.id || 0;
	const totalAllCards = totalAllCardsDataAgg[0]?.count?.id || 0;
	const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0;
	const currentPage = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;

	return {
		transit_cards,
		agencies,
		currentPage,
		totalPages,
		totalCount,
		totalAllCards,
		selectedAgency: agencyFilter || null,
		searchQuery,
		title: 'Home'
	};
}
