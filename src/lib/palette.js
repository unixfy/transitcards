import { writable } from 'svelte/store';

// Pulls two vivid colors out of a card's photo so the page around it can wear them.
// The CMS echoes the requesting origin in its CORS headers, which lets a canvas read the pixels;
// if that ever fails, callers get the house palette instead.

const SIZE = 32;
const cache = new Map();

export const FALLBACK = { c1: 'hsl(153 70% 42%)', c2: 'hsl(221 80% 52%)' };

export const assetUrl = (image, width) =>
	`https://cms.alexwang.net/assets/${image}?format=webp&width=${width}`;

function toHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return [0, 0, l];
	const s = d / (1 - Math.abs(2 * l - 1));
	let h;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	return [(h * 60 + 360) % 360, s, l];
}

function pick(data) {
	// Twelve hue bins, each weighted by how saturated and mid-tone its pixels are
	const bins = Array.from({ length: 12 }, () => ({ w: 0, h: 0, x: 0, y: 0, s: 0 }));
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 200) continue;
		const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
		const w = s * s * (1 - Math.abs(2 * l - 1));
		if (w < 0.04) continue;
		const bin = bins[Math.floor(h / 30) % 12];
		bin.w += w;
		bin.x += Math.cos((h * Math.PI) / 180) * w;
		bin.y += Math.sin((h * Math.PI) / 180) * w;
		bin.s += s * w;
	}
	const ranked = bins
		.filter((b) => b.w > 0)
		.map((b) => ({
			w: b.w,
			h: ((Math.atan2(b.y, b.x) * 180) / Math.PI + 360) % 360,
			s: b.s / b.w
		}))
		.sort((a, b) => b.w - a.w);
	if (!ranked.length) return FALLBACK;
	const first = ranked[0];
	const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
	const second = ranked.find((c) => hueGap(c.h, first.h) >= 40) ?? {
		h: (first.h + 40) % 360,
		s: first.s
	};
	const css = ({ h, s }) =>
		`hsl(${Math.round(h)} ${Math.round(Math.min(0.9, Math.max(0.6, s)) * 100)}% 50%)`;
	return { c1: css(first), c2: css(second) };
}

export function getPalette(image) {
	if (!cache.has(image)) {
		cache.set(
			image,
			new Promise((resolve) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = () => {
					try {
						const canvas = document.createElement('canvas');
						canvas.width = SIZE;
						canvas.height = Math.round((SIZE * img.naturalHeight) / img.naturalWidth) || SIZE;
						const ctx = canvas.getContext('2d', { willReadFrequently: true });
						ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
						resolve(pick(ctx.getImageData(0, 0, canvas.width, canvas.height).data));
					} catch {
						resolve(FALLBACK);
					}
				};
				img.onerror = () => resolve(FALLBACK);
				img.src = assetUrl(image, SIZE);
			})
		);
	}
	return cache.get(image);
}

// The page ground picks up the colors of whichever card is in focus
export const wash = writable(FALLBACK);

export function setWash(palette) {
	const root = document.documentElement.style;
	root.setProperty('--wash-1', palette?.c1 ?? FALLBACK.c1);
	root.setProperty('--wash-2', palette?.c2 ?? FALLBACK.c2);
	wash.set(palette ?? FALLBACK);
}

export function clearWash() {
	const root = document.documentElement.style;
	root.removeProperty('--wash-1');
	root.removeProperty('--wash-2');
	wash.set(FALLBACK);
}

// Which card's photo is currently named for the view transition between grid and detail
let heroId = null;
export const getHeroId = () => heroId;
export const setHeroId = (id) => (heroId = id);
