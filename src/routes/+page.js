import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

export async function load({ fetch, url }) {
    const directus = getDirectusInstance(fetch);
    const limit = 36; // Results per page

    const pageParam = url.searchParams.get('page');
    const agencyFilter = url.searchParams.get('agency');
    const searchQuery = url.searchParams.get('search') || '';

    let currentPage = parseInt(pageParam, 10);
    if (isNaN(currentPage) || currentPage < 1) {
        currentPage = 1;
    }

    // Build filter object for server-side filtering
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
    const filter = filters.length > 1 ? { _and: filters } : (filters.length === 1 ? filters[0] : {});

    // Fetch transit cards for the current page with optional filters
    const transitCardsPromise = directus.request(
        readItems('transit_cards', {
            limit: limit,
            page: currentPage,
            sort: ['-binder_page_number', '-date_acquired', 'name'],
            fields: ['id', 'name', 'date_acquired', 'image', 'issuing_agency.id', 'issuing_agency.name', 'issuing_agency.city', 'notes'],
            ...(Object.keys(filter).length > 0 && { filter })
        })
    );

    // Fetch total count of transit cards with filters applied
    const totalResultCardsCountPromise = directus.request(
        readItems('transit_cards', {
            limit: -1,
            aggregate: { count: ['id'] },
            ...(Object.keys(filter).length > 0 && { filter })
        })
    );

    // Fetch total count of ALL transit cards (unfiltered)
    const totalAllCardsPromise = directus.request(
        readItems('transit_cards', {
            limit: -1,
            aggregate: { count: ['id'] }
        })
    );

    // Fetch all unique issuing agencies for the dropdown
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

    return {
        transit_cards: transit_cards,
        agencies: agencies,
        currentPage: currentPage,
        totalPages: totalPages,
        totalCount: totalCount,
        totalAllCards: totalAllCards,
        selectedAgency: agencyFilter || null,
        searchQuery: searchQuery,
        title: "Home"
    };
}