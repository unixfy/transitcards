import * as THREE from 'three';

// ID-1 card proportions (85.6mm × 53.98mm, 3.18mm corners, 0.76mm thick), one unit wide
export const CARD_W = 1;
export const CARD_H = 53.98 / 85.6;
export const CARD_R = 3.18 / 85.6;
export const CARD_T = 0.76 / 85.6;

function roundedRect(w, h, r) {
	const s = new THREE.Shape();
	const x = -w / 2;
	const y = -h / 2;
	s.moveTo(x + r, y);
	s.lineTo(x + w - r, y);
	s.quadraticCurveTo(x + w, y, x + w, y + r);
	s.lineTo(x + w, y + h - r);
	s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - r);
	s.lineTo(x, y + r);
	s.quadraticCurveTo(x, y, x + r, y);
	return s;
}

// The printed face: a flat rounded rectangle with 0–1 UVs across the whole card
export function cardFaceGeometry(w = CARD_W, h = CARD_H, r = CARD_R) {
	const geometry = new THREE.ShapeGeometry(roundedRect(w, h, r), 6);
	const pos = geometry.attributes.position;
	const uv = geometry.attributes.uv;
	for (let i = 0; i < pos.count; i++) {
		uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
	}
	return geometry;
}

// The plastic body behind the face, centered on z = 0
export function cardBodyGeometry() {
	const geometry = new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_H, CARD_R), {
		depth: CARD_T,
		bevelEnabled: false,
		curveSegments: 6
	});
	geometry.translate(0, 0, -CARD_T / 2);
	return geometry;
}

// UV rect that crops an image of the given size to the card's aspect, like object-fit: cover
export function coverRect(width, height, aspect = CARD_W / CARD_H) {
	const imageAspect = width / height;
	if (imageAspect > aspect) {
		const w = aspect / imageAspect;
		return [(1 - w) / 2, 0, w, 1];
	}
	const h = imageAspect / aspect;
	return [0, (1 - h) / 2, 1, h];
}

// Draw an image into a canvas region, cropped to fill it
export function drawCover(ctx, img, x, y, w, h) {
	const [u, v, uw, vh] = coverRect(img.naturalWidth, img.naturalHeight, w / h);
	const iw = img.naturalWidth;
	const ih = img.naturalHeight;
	ctx.drawImage(img, u * iw, v * ih, uw * iw, vh * ih, x, y, w, h);
}

export function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';
		// Decode off the main thread before handing it over, so the GPU upload doesn't stall a frame
		img.onload = () =>
			img.decode().then(
				() => resolve(img),
				() => resolve(img)
			);
		img.onerror = reject;
		img.src = src;
	});
}

// Run `task` over `items` with at most `limit` in flight
export async function eachLimited(items, limit, task, isCancelled) {
	let next = 0;
	const worker = async () => {
		while (next < items.length && !isCancelled()) {
			const item = items[next++];
			try {
				await task(item);
			} catch {
				// a missing photo leaves its placeholder in place
			}
		}
	};
	await Promise.all(Array.from({ length: limit }, worker));
}

export function hasWebGL() {
	try {
		const gl = document.createElement('canvas').getContext('webgl2');
		// Hand the probe context straight back; browsers cap how many can be open
		gl?.getExtension('WEBGL_lose_context')?.loseContext();
		return !!gl;
	} catch {
		return false;
	}
}
