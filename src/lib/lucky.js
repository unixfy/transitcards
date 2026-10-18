import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { readItems } from '@directus/sdk';
import getDirectusInstance from '$lib/directus';
import { getPalette, assetUrl } from '$lib/palette';

// Set just before a random-card navigation so the layout can give it its own transition
let pending = false;
export const takeLucky = () => {
	const was = pending;
	pending = false;
	return was;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The detail page asks for the smallest of its 800/1200/1800 sources that covers the card
function detailWidth() {
	const css = window.innerWidth >= 1024 ? 640 : window.innerWidth;
	return [800, 1200, 1800].find((w) => w >= css * window.devicePixelRatio) ?? 1800;
}

function warmPhoto(image) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = img.onerror = resolve;
		img.src = assetUrl(image, detailWidth());
	});
}

// Pick a card in the browser and move to it without leaving the app. The photo and the card's
// colors are fetched first (capped, so a slow network never stalls the click) which lets the new
// page land fully formed instead of loading in around the transition.
export async function goLucky() {
	const total = page.data.totalAllCards;
	if (!total) throw new Error('empty collection');
	const directus = getDirectusInstance();
	let card;
	for (let attempt = 0; attempt < 3; attempt++) {
		const [candidate] = await directus.request(
			readItems('transit_cards', {
				limit: 1,
				offset: Math.floor(Math.random() * total),
				fields: ['id', 'image']
			})
		);
		card = candidate;
		if (card && card.id !== page.params.uuid) break;
	}
	if (!card) throw new Error('no card');
	await Promise.race([Promise.all([getPalette(card.image), warmPhoto(card.image)]), wait(900)]);
	pending = true;
	await goto(resolve('/card/[uuid]', { uuid: card.id }));
}
