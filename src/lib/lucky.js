import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { readItems } from '@directus/sdk';
import getDirectusInstance from '$lib/directus';
import { getPalette, assetUrl, clearHeroNames } from '$lib/palette';
import { cacheCards } from '$lib/cardCache';

// Set just before a random-card navigation so the layout can give it its own transition
let pending = false;
export const takeLucky = () => {
	const was = pending;
	pending = false;
	return was;
};

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The detail page asks for the smallest of its 800/1200/1800 sources that covers the card
function detailWidth() {
	const css = window.innerWidth >= 1024 ? 640 : window.innerWidth;
	return [800, 1200, 1800].find((w) => w >= css * window.devicePixelRatio) ?? 1800;
}

// Load and decode the photo at the size the detail page will ask for
export function warmPhoto(image) {
	const img = new Image();
	img.src = assetUrl(image, detailWidth());
	return img.decode().catch(() => {});
}

// Everything a card page shows, so the page can open without another request
const CARD_FIELDS = [
	'id',
	'name',
	'date_acquired',
	'image',
	'issuing_agency.id',
	'issuing_agency.name',
	'issuing_agency.city',
	'notes'
];

async function pickCard() {
	const total = page.data.totalAllCards;
	if (!total) throw new Error('empty collection');
	const [card] = await getDirectusInstance().request(
		readItems('transit_cards', {
			limit: 1,
			offset: Math.floor(Math.random() * total),
			fields: CARD_FIELDS
		})
	);
	if (!card) throw new Error('no card');
	cacheCards([card]);
	return card;
}

// The next card is chosen, and its photo and colors fetched, while the visitor is still looking at
// this one, so a draw is instant instead of paying for the network on the click.
let next = null;

function prepare() {
	const draw = pickCard();
	const ready = draw.then((card) => Promise.all([getPalette(card.image), warmPhoto(card.image)]));
	// Failures surface where the draw is used; here they only mean "nothing prepared"
	draw.catch(() => {});
	ready.catch(() => {});
	return { draw, ready };
}

export function primeLucky() {
	if (next || navigator.connection?.saveData) return;
	next = prepare();
}

// Pick a card in the browser and move to it without leaving the app. The photo and the card's
// colors come first (capped, so a slow network never stalls the click) which lets the new page
// land fully formed instead of loading in around the transition.
export async function goLucky() {
	let attempt = next ?? prepare();
	next = null;
	let card = await attempt.draw;
	if (card.id === page.params.uuid) {
		// Prepared before we landed on this very card; draw again
		attempt = prepare();
		card = await attempt.draw;
	}
	await Promise.race([attempt.ready, wait(900)]);
	// A tile we came back from may still carry the transition name
	clearHeroNames();
	pending = true;
	await goto(resolve('/card/[uuid]', { uuid: card.id }));
}
