import getDirectusInstance from '$lib/directus';
import { readItems } from '@directus/sdk';

export async function load({ fetch, url }) {
    const directus = getDirectusInstance(fetch);
    const limit = 36; // Results per page

    const pageParam = url.searchParams.get('page');
    let currentPage = parseInt(pageParam, 10);
    if (isNaN(currentPage) || currentPage < 1) {
        currentPage = 1;
    }

    // Fetch transit cards for the current page
    const transitCardsPromise = directus.request(
        readItems('transit_cards', {
            limit: limit,
            page: currentPage,
            sort: ['-binder_page_number', 'date_acquired', 'name'],
            fields: ['id', 'name', 'date_acquired', 'image', 'issuing_agency.name', 'issuing_agency.city', 'notes']
        })
    );

    // Fetch total count of transit cards
    const totalCardsCountPromise = directus.request(
        readItems('transit_cards', {
            limit: -1, // Required by Directus to count all items
            aggregate: { count: ['id'] }
        })
    );

    const [transit_cards, totalCardsDataAgg] = await Promise.all([transitCardsPromise, totalCardsCountPromise]);

    const totalCount = totalCardsDataAgg[0]?.count?.id || 0;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0;

    return {
        transit_cards: transit_cards,
        currentPage: currentPage,
        totalPages: totalPages,
        totalCount: totalCount,
        title: "Home"
    };
}