import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { animate } from 'motion';
import { CARD_W, CARD_H, cardFaceGeometry, cardBodyGeometry, loadImage } from './cardGeometry';

// The physical binder, open on the page: a front cover, one clear sleeve sheet per binder page
// (ten pockets a side), and three rings at the spine. Sheets turn with a real curl, and a tapped
// card slides out of its pocket toward the viewer before the site opens it.

// The grid's thumbnail size, so a card already seen there (or in the slideshow) isn't fetched again
export const TILE_SRC_WIDTH = 400;
export const tileUrl = (image) =>
	`https://cms.alexwang.net/assets/${image}?format=webp&width=${TILE_SRC_WIDTH}`;

// World units: a letter-size sheet one unit tall, lying in the XZ plane with the spine on z
const H = 1;
const W = 8.5 / 11;
const GAP = 0.02; // between the rings' center line and the sheet's inner edge
const RING_R = 0.05;
const LAYER = 0.0016; // sheet thickness in the stacks
const HINGE_Y = 0.03;
const TILT = 68; // camera elevation in degrees
const RING_Z = [-0.3, 0, 0.3];
const HEADROOM = 0.15;

// Sheet texture size and pocket layout (pixels, spine on the left for a front side)
const TEX_W = 900;
const TEX_H = Math.round(TEX_W / W);
const HOLE_MARGIN = 0.13; // fraction of the width kept clear for the punched holes
// The rings pierce the sheet where they cross its plane
const HOLE_U = (RING_R - GAP) / W;
const OUTER_MARGIN = 0.05;
const TOP_MARGIN = 0.04;

const POCKETS_PER_SIDE = 10;

// Group cards into sheets by binder page, in the order the real binder holds them: the highest
// page number at the front. `cards` arrive in the grid's order (pages descending, newest first
// within a page), which fills each sheet's ten front pockets and then its back.
export function toSheets(cards) {
	const sheets = [];
	for (const card of cards) {
		const number = card.binder_page_number ?? null;
		let sheet = sheets[sheets.length - 1];
		if (!sheet || sheet.number !== number) sheets.push((sheet = { number, cards: [] }));
		sheet.cards.push(card);
	}
	return sheets.map(({ number, cards }) => ({
		number,
		front: cards.slice(0, POCKETS_PER_SIDE),
		back: cards.slice(POCKETS_PER_SIDE)
	}));
}

// ---------- Textures ----------

function pocketLayout(count) {
	const rows = Math.max(5, Math.ceil(count / 2));
	const usableW = 1 - HOLE_MARGIN - OUTER_MARGIN;
	const rowH = (1 - 2 * TOP_MARGIN) / rows;
	// Pockets are sized by whichever runs out first: width for two columns, or height for the rows
	const pocketH = Math.min(rowH * 0.94, ((usableW / 2) * 0.94 * W) / (CARD_W / CARD_H) / H);
	const pocketW = (pocketH * H * (CARD_W / CARD_H)) / W;
	const colGap = (usableW - 2 * pocketW) / 3;
	const rects = [];
	for (let i = 0; i < rows * 2; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		// u runs away from the spine, v down the page; both 0–1
		const u = HOLE_MARGIN + colGap + col * (pocketW + colGap);
		const v = TOP_MARGIN + row * rowH + (rowH - pocketH) / 2;
		rects.push({ u, v, w: pocketW, h: pocketH });
	}
	return rects;
}

function roundRectPath(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

// A sleeve side: pale backing, pocket seams, punched holes, and whatever cards have arrived
function makeSide(cards, mirrored) {
	const canvas = document.createElement('canvas');
	canvas.width = TEX_W;
	canvas.height = TEX_H;
	const ctx = canvas.getContext('2d');
	const rects = pocketLayout(cards.length);
	const side = {
		canvas,
		ctx,
		cards,
		rects,
		mirrored,
		images: new Map(),
		texture: null,
		empty: null
	};
	side.texture = new THREE.CanvasTexture(canvas);
	side.texture.colorSpace = THREE.SRGBColorSpace;
	side.texture.anisotropy = 8;
	paintSide(side);
	return side;
}

const toPx = (side, r) => {
	const x = side.mirrored ? (1 - r.u - r.w) * TEX_W : r.u * TEX_W;
	return [x, r.v * TEX_H, r.w * TEX_W, r.h * TEX_H];
};

// The empty sleeve is the same for every sheet with the same pocket count, so it's drawn once
const bases = new Map();
function sleeveBase(rects, mirrored) {
	const key = `${mirrored}-${rects.length}`;
	if (bases.has(key)) return bases.get(key);
	const canvas = document.createElement('canvas');
	canvas.width = TEX_W;
	canvas.height = TEX_H;
	const ctx = canvas.getContext('2d');
	paintSleeve({ ctx, rects, mirrored });
	bases.set(key, canvas);
	return canvas;
}

function paintSide(side) {
	side.ctx.drawImage(sleeveBase(side.rects, side.mirrored), 0, 0);
	side.images.forEach((img, i) => paintPocket(side, i, img));
}

function paintSleeve(side) {
	const { ctx, rects } = side;
	ctx.fillStyle = '#e9edf0';
	ctx.fillRect(0, 0, TEX_W, TEX_H);
	// Faint diagonal texture of the polypropylene
	ctx.globalAlpha = 0.05;
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 1;
	for (let i = -TEX_H; i < TEX_W; i += 7) {
		ctx.beginPath();
		ctx.moveTo(i, 0);
		ctx.lineTo(i + TEX_H, TEX_H);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
	// Punched holes along the spine edge
	const holeX = side.mirrored ? TEX_W * (1 - HOLE_U) : TEX_W * HOLE_U;
	ctx.fillStyle = '#b9c0c7';
	for (const v of RING_Z) {
		ctx.beginPath();
		ctx.arc(holeX, (0.5 + v * H) * TEX_H, TEX_W * 0.016, 0, Math.PI * 2);
		ctx.fill();
	}
	rects.forEach((r, i) => paintPocket(side, i, null));
}

function paintPocket(side, i, img) {
	const { ctx } = side;
	const [x, y, w, h] = toPx(side, side.rects[i]);
	const pad = 7;
	// The pocket itself: welded seams around a slightly darker window
	ctx.fillStyle = '#dde2e6';
	ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
	ctx.strokeStyle = 'rgba(255,255,255,0.9)';
	ctx.lineWidth = 2;
	ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
	if (!img || side.empty === i) return;
	const r = w * (3.18 / 85.6);
	// A thin offset edge reads as the card's thickness under the plastic
	roundRectPath(ctx, x + 1, y + 2.5, w, h, r);
	ctx.fillStyle = 'rgba(30, 40, 50, 0.28)';
	ctx.fill();
	ctx.save();
	roundRectPath(ctx, x, y, w, h, r);
	ctx.clip();
	const iw = img.naturalWidth;
	const ih = img.naturalHeight;
	const scale = Math.max(w / iw, h / ih);
	ctx.drawImage(img, x + (w - iw * scale) / 2, y + (h - ih * scale) / 2, iw * scale, ih * scale);
	ctx.restore();
}

function leatherCanvas(label) {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = Math.round(512 / W);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#1e2b3a';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	// Pebbled grain
	const grain = ctx.getImageData(0, 0, canvas.width, canvas.height);
	for (let i = 0; i < grain.data.length; i += 4) {
		const n = (Math.random() - 0.5) * 14;
		grain.data[i] += n;
		grain.data[i + 1] += n;
		grain.data[i + 2] += n;
	}
	ctx.putImageData(grain, 0, 0);
	// Stitched border
	ctx.setLineDash([6, 5]);
	ctx.strokeStyle = 'rgba(255,255,255,0.18)';
	ctx.lineWidth = 2;
	ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
	ctx.setLineDash([]);
	if (label) label(ctx, canvas.width, canvas.height);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 8;
	return texture;
}

// ---------- Shaders ----------

const leafVertex = /* glsl */ `
	uniform float uTheta;
	uniform float uCurl;
	uniform float uSkew;
	uniform float uLayer;
	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vWorld;
	void main() {
		float s = position.x + ${GAP.toFixed(4)};
		float zn = position.y / ${(H / 2).toFixed(4)};
		float c = uCurl * sin(uTheta) * (1.0 + uSkew * zn) / ${W.toFixed(4)};
		float a = uTheta + c * s;
		vec2 p = abs(c) < 1e-4
			? vec2(s * cos(uTheta), s * sin(uTheta))
			: vec2((sin(a) - sin(uTheta)) / c, (cos(uTheta) - cos(a)) / c);
		vec3 world = vec3(p.x, ${HINGE_Y.toFixed(4)} + p.y + uLayer, -position.y);
		vUv = vec2(position.x / ${W.toFixed(4)}, 0.5 - position.y / ${H.toFixed(4)});
		vNormal = normalize(vec3(-sin(a), cos(a), 0.0));
		vec4 w = modelMatrix * vec4(world, 1.0);
		vWorld = w.xyz;
		gl_Position = projectionMatrix * viewMatrix * w;
	}
`;

const leafFragment = /* glsl */ `
	uniform sampler2D uFront;
	uniform sampler2D uBack;
	uniform float uSleeve;
	uniform float uShade;
	uniform float uDim;
	uniform vec4 uHover;
	uniform vec3 uLight;
	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vWorld;
	void main() {
		bool front = gl_FrontFacing;
		// The back is seen from the left stack, where the spine sits on the texture's right
		vec2 uv = front ? vec2(vUv.x, 1.0 - vUv.y) : vec2(1.0 - vUv.x, 1.0 - vUv.y);
		vec4 tex = front ? texture2D(uFront, uv) : texture2D(uBack, uv);
		vec3 n = normalize(front ? vNormal : -vNormal);
		vec3 v = normalize(cameraPosition - vWorld);
		vec3 l = normalize(uLight);
		float diffuse = 0.78 + 0.22 * max(dot(n, l), 0.0);
		vec3 col = tex.rgb * diffuse;
		// The neighbor sheet lifting off casts a soft shadow from the spine outward
		col *= 1.0 - uShade * 0.38 * (1.0 - smoothstep(0.0, 0.9, vUv.x));
		// A pocket under the pointer brightens a touch
		vec2 hv = vec2(vUv.x, vUv.y);
		float hover = step(uHover.x, hv.x) * step(hv.x, uHover.z) * step(uHover.y, hv.y) * step(hv.y, uHover.w);
		col += hover * 0.1;
		// Sleeve glare: a broad sheen plus a tighter highlight that slides as the sheet bends
		vec3 h = normalize(l + v);
		float spec = pow(max(dot(n, h), 0.0), 60.0) * 0.5 + pow(max(dot(n, h), 0.0), 8.0) * 0.08;
		col += vec3(spec * uSleeve);
		col *= uDim;
		gl_FragColor = vec4(col, 1.0);
		#include <colorspace_fragment>
	}
`;

// ---------- Scene ----------

const easeOut = [0.16, 1, 0.3, 1];

export function createBinder(canvas, sheets, options) {
	const { onOpenCard, onChange, startSpread = 1, intro = false, reducedMotion = false } = options;
	// Less motion: pages still turn when asked, but quickly and without bounce
	const spring = reducedMotion ? { stiffness: 500, damping: 50 } : { stiffness: 120, damping: 20 };

	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;

	const scene = new THREE.Scene();
	const pmrem = new THREE.PMREMGenerator(renderer);
	const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environment = envTexture;

	const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 30);
	const lookAt = new THREE.Vector3();
	const light = new THREE.Vector3(-0.4, 1, 0.6);

	let cancelled = false;
	let dark = false;
	let narrow = false;
	let focusSide = 'right'; // which page a narrow screen is looking at

	// ---------- Static pieces: boards, spine, rings, shadow ----------

	const leather = leatherCanvas();
	const boardMaterial = new THREE.MeshStandardMaterial({ map: leather, roughness: 0.75 });
	const boardEdge = new THREE.MeshStandardMaterial({ color: 0x15202c, roughness: 0.8 });
	const boardW = W + GAP + 0.03;
	const boardD = H + 0.05;
	const back = new THREE.Mesh(new THREE.BoxGeometry(boardW, 0.014, boardD), [
		boardEdge,
		boardEdge,
		boardMaterial,
		boardEdge,
		boardEdge,
		boardEdge
	]);
	back.position.set(boardW / 2, -0.007, 0);
	scene.add(back);
	const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, boardD), boardEdge);
	spine.position.set(0, -0.016, 0);
	scene.add(spine);

	const metal = new THREE.MeshStandardMaterial({ color: 0xd7dce2, metalness: 1, roughness: 0.22 });
	const ringGeometry = new THREE.TorusGeometry(RING_R, 0.0045, 12, 48);
	for (const z of RING_Z) {
		const ring = new THREE.Mesh(ringGeometry, metal);
		ring.position.set(0, HINGE_Y, z);
		scene.add(ring);
	}
	const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.82), metal);
	plate.position.set(0, -0.002, 0);
	scene.add(plate);

	// Soft contact shadow under the whole binder
	const shadowCanvas = document.createElement('canvas');
	shadowCanvas.width = shadowCanvas.height = 128;
	const sctx = shadowCanvas.getContext('2d');
	const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 64);
	grad.addColorStop(0, 'rgba(0,0,0,0.5)');
	grad.addColorStop(0.55, 'rgba(0,0,0,0.3)');
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	sctx.fillStyle = grad;
	sctx.fillRect(0, 0, 128, 128);
	const shadowMaterial = new THREE.MeshBasicMaterial({
		map: new THREE.CanvasTexture(shadowCanvas),
		transparent: true,
		depthWrite: false,
		opacity: 0.5
	});
	const shadow = new THREE.Mesh(
		new THREE.PlaneGeometry(2 * (W + GAP) + 0.5, H + 0.45),
		shadowMaterial
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.y = -0.03;
	scene.add(shadow);

	// ---------- Leaves: the cover, then every sheet ----------

	const leafGeometry = new THREE.PlaneGeometry(W, H, 56, 10);
	leafGeometry.translate(W / 2, 0, 0); // x runs 0..W from the hinge

	const blankCanvas = document.createElement('canvas');
	blankCanvas.width = blankCanvas.height = 4;
	const blank = new THREE.CanvasTexture(blankCanvas);

	function makeLeaf(front, back, sleeve) {
		const uniforms = {
			uTheta: { value: 0 },
			uCurl: { value: sleeve ? 0.9 : 0 },
			uSkew: { value: 0 },
			uLayer: { value: 0 },
			uFront: { value: front },
			uBack: { value: back },
			uSleeve: { value: sleeve ? 1 : 0.25 },
			uShade: { value: 0 },
			uDim: { value: 1 },
			uHover: { value: new THREE.Vector4(-1, -1, -1, -1) },
			uLight: { value: light }
		};
		const material = new THREE.ShaderMaterial({
			vertexShader: leafVertex,
			fragmentShader: leafFragment,
			uniforms,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(leafGeometry, material);
		mesh.frustumCulled = false;
		scene.add(mesh);
		// `theta` is where the leaf's own motion has it; `shown` is where it's drawn (see layout)
		return { mesh, uniforms, theta: 0, shown: 0, motion: null, velocity: 0 };
	}

	const coverOutside = leatherCanvas((ctx, w, h) => {
		// A label-maker strip with the collection's name
		ctx.fillStyle = '#f4f1e8';
		const lw = w * 0.62;
		const lh = h * 0.07;
		ctx.fillRect((w - lw) / 2, h * 0.3, lw, lh);
		ctx.fillStyle = '#1e2b3a';
		ctx.font = `700 ${Math.round(lh * 0.48)}px "Space Grotesk", sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText("Alex's Transit Cards", w / 2, h * 0.3 + lh / 2);
	});
	// Inside the front cover, a label with the binder's own counts
	const cardCount = sheets.reduce((n, s) => n + s.front.length + s.back.length, 0);
	const coverInside = leatherCanvas((ctx, w, h) => {
		const lw = w * 0.56;
		const lh = h * 0.14;
		const x = (w - lw) / 2;
		const y = h * 0.4;
		ctx.fillStyle = '#f4f1e8';
		ctx.fillRect(x, y, lw, lh);
		ctx.fillStyle = '#1e2b3a';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `700 ${Math.round(lh * 0.26)}px "Space Grotesk", sans-serif`;
		ctx.fillText(`${cardCount} cards`, w / 2, y + lh * 0.36);
		ctx.font = `400 ${Math.round(lh * 0.17)}px "IBM Plex Sans", sans-serif`;
		ctx.fillText(`${sheets.length} pages`, w / 2, y + lh * 0.7);
	});
	const cover = makeLeaf(coverOutside, coverInside, false);
	cover.mesh.scale.set(1.02, 1, 1.03);

	const leaves = [cover];
	const sides = []; // per sheet: { front, back } once built
	for (let i = 0; i < sheets.length; i++) {
		leaves.push(makeLeaf(blank, blank, true));
		sides.push(null);
	}

	// Build (or drop) textures so only sheets near the open spread hold GPU memory
	const imageCache = new Map();
	function ensureSheet(i) {
		if (i < 0 || i >= sheets.length || sides[i]) return;
		const sheet = sheets[i];
		const pair = { front: makeSide(sheet.front, false), back: makeSide(sheet.back, true) };
		sides[i] = pair;
		const leaf = leaves[i + 1];
		leaf.uniforms.uFront.value = pair.front.texture;
		leaf.uniforms.uBack.value = pair.back.texture;
		for (const side of [pair.front, pair.back]) {
			side.cards.forEach((card, k) => {
				const load = imageCache.get(card.image) ?? loadImage(tileUrl(card.image));
				imageCache.set(card.image, load);
				load
					.then((img) => {
						if (cancelled || sides[i] !== pair) return;
						side.images.set(k, img);
						paintPocket(side, k, img);
						side.dirty = true;
					})
					.catch(() => {});
			});
		}
	}

	function releaseSheet(i) {
		const pair = sides[i];
		if (!pair) return;
		pair.front.texture.dispose();
		pair.back.texture.dispose();
		sides[i] = null;
		leaves[i + 1].uniforms.uFront.value = blank;
		leaves[i + 1].uniforms.uBack.value = blank;
	}

	// Sheets spread-2 and spread-1 are the open pages. Anything in flight keeps its photos, and
	// the wider release window stops a quick back-and-forth from rebuilding the same sheets
	function refreshTextures() {
		for (let i = 0; i < sheets.length; i++) {
			const moving = isMoving(i + 1);
			if (moving || (i >= spread - 3 && i <= spread + 1)) ensureSheet(i);
			else if (i < spread - 6 || i > spread + 3) releaseSheet(i);
		}
	}

	// ---------- Spread state ----------

	// `spread` leaves are turned to the left: 1 = cover open with sheet 1 on the right
	const maxSpread = leaves.length;
	let spread = intro ? 0 : Math.min(Math.max(startSpread, 1), maxSpread);
	for (let i = 0; i < leaves.length; i++) leaves[i].theta = i < spread ? Math.PI : 0;
	for (const leaf of leaves) leaf.shown = leaf.theta;

	const isMoving = (index) => !!leaves[index]?.motion || drag?.index === index;
	const inFlight = () => leaves.some((leaf) => leaf.shown > 0.02 && leaf.shown < Math.PI - 0.02);

	function layout() {
		const n = leaves.length;
		// Several sheets can be turning at once. A sheet can't pass the one above it in the
		// binder, so a faster one is held back (or pushed along) instead of cutting through
		for (let i = 0; i < n; i++) {
			const leaf = leaves[i];
			leaf.shown = i === 0 ? leaf.theta : Math.min(leaf.theta, leaves[i - 1].shown);
		}
		for (let i = 0; i < n; i++) {
			const leaf = leaves[i];
			const t = leaf.shown / Math.PI;
			// Resting height in each stack; turning sheets ride a little above both
			const rightY = (n - i) * LAYER;
			const leftY = i * LAYER;
			const lift = Math.sin(leaf.shown) * LAYER * 3;
			leaf.uniforms.uTheta.value = leaf.shown;
			leaf.uniforms.uLayer.value = rightY + (leftY - rightY) * t + lift;
			leaf.uniforms.uShade.value = 0;
		}
		// The sheets under a turning one darken as it lifts
		for (let i = 0; i < n; i++) {
			const lifted = leaves[i];
			if (lifted.shown <= 0 || lifted.shown >= Math.PI) continue;
			const shade = Math.sin(lifted.shown);
			const t = lifted.shown / Math.PI;
			const right = leaves[i + 1]?.uniforms.uShade;
			const left = leaves[i - 1]?.uniforms.uShade;
			if (right) right.value = Math.max(right.value, shade * (1 - t));
			if (left) left.value = Math.max(left.value, shade * t);
		}
	}

	// Spring one leaf toward a side, carrying the speed it already has, without touching any other
	function settle(index, to, velocity = leaves[index].velocity) {
		const leaf = leaves[index];
		leaf.motion?.stop();
		let lastT = performance.now();
		let lastV = leaf.theta;
		leaf.motion = animate(leaf.theta, to, {
			type: 'spring',
			...spring,
			mass: 1,
			velocity,
			restDelta: 0.001,
			onUpdate: (v) => {
				const now = performance.now();
				if (now > lastT) leaf.velocity = ((v - lastV) / (now - lastT)) * 1000;
				lastT = now;
				lastV = v;
				leaf.theta = Math.min(Math.PI, Math.max(0, v));
			},
			onComplete: () => {
				leaf.theta = to;
				leaf.velocity = 0;
				leaf.motion = null;
				refreshTextures(); // let go of sheets this one was holding on to
			}
		});
	}

	function setSpread(next) {
		// A sheet held by a finger owns the spread until it's let go
		if (drag?.active) return;
		next = Math.min(Math.max(next, 1), maxSpread);
		if (next === spread) return;
		const forward = next > spread;
		const index = forward ? spread : spread - 1;
		spread = next;
		leaves[index].uniforms.uSkew.value = 0;
		settle(index, forward ? Math.PI : 0);
		refreshTextures();
		onChange?.(spread, maxSpread);
		frameCamera(true);
	}

	// ---------- Camera ----------

	let width = 1;
	let height = 1;
	const camTarget = { x: 0, dist: 2 };
	const camNow = { x: 0, dist: 2 };
	let camMotion = null;

	function frameCamera(animated) {
		const aspect = width / height;
		const tilt = (TILT * Math.PI) / 180; // elevation of the view above the table
		const vFov = (camera.fov * Math.PI) / 180;
		const spanW = narrow ? W + GAP + 0.14 : 2 * (W + GAP) + 0.18;
		// Room above the binder for a sheet standing up mid-turn
		const spanH = (H + 0.16) * Math.sin(tilt) + 0.08 + HEADROOM * 2;
		const distW = spanW / 2 / (Math.tan(vFov / 2) * aspect);
		const distH = spanH / 2 / Math.tan(vFov / 2);
		camTarget.dist = Math.max(distW, distH);
		camTarget.x = narrow ? (focusSide === 'right' ? 1 : -1) * (GAP + W / 2) : 0;
		if (!animated) {
			camNow.x = camTarget.x;
			camNow.dist = camTarget.dist;
			return;
		}
		camMotion?.stop();
		const fromX = camNow.x;
		const fromD = camNow.dist;
		camMotion = animate(0, 1, {
			duration: reducedMotion ? 0.3 : 0.9,
			ease: easeOut,
			onUpdate: (e) => {
				camNow.x = fromX + (camTarget.x - fromX) * e;
				camNow.dist = fromD + (camTarget.dist - fromD) * e;
			}
		});
	}

	function placeCamera() {
		const tilt = (TILT * Math.PI) / 180;
		lookAt.set(camNow.x, HEADROOM, -0.03);
		camera.position.set(
			camNow.x + pointer.px * 0.04,
			Math.sin(tilt) * camNow.dist,
			Math.cos(tilt) * camNow.dist + pointer.py * 0.03
		);
		camera.lookAt(lookAt);
	}

	// ---------- Interaction ----------

	const raycaster = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const hit = new THREE.Vector3();
	const pointer = { px: 0, py: 0 };

	// Which pocket of an open page sits under a canvas point
	function pick(clientX, clientY) {
		const rect = canvas.getBoundingClientRect();
		ndc.set(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1
		);
		raycaster.setFromCamera(ndc, camera);
		plane.constant = -(HINGE_Y + leaves.length * LAYER * 0.5);
		if (!raycaster.ray.intersectPlane(plane, hit)) return null;
		const onRight = hit.x > 0;
		const u = ((onRight ? hit.x : -hit.x) - GAP) / W;
		const v = hit.z / H + 0.5;
		if (u < 0 || u > 1 || v < 0 || v > 1) return { onRight, pocket: null };
		const sheetIndex = onRight ? spread - 1 : spread - 2;
		const pair = sides[sheetIndex];
		if (!pair) return { onRight, pocket: null };
		const side = onRight ? pair.front : pair.back;
		const k = side.rects.findIndex(
			(r, idx) =>
				idx < side.cards.length && u >= r.u && u <= r.u + r.w && v >= r.v && v <= r.v + r.h
		);
		if (k < 0) return { onRight, pocket: null };
		return { onRight, sheetIndex, side, k, card: side.cards[k], rect: side.rects[k] };
	}

	let hovered = null;
	function setHover(target) {
		if (hovered?.leaf) hovered.leaf.uniforms.uHover.value.set(-1, -1, -1, -1);
		hovered = null;
		canvas.style.cursor = target?.card ? 'pointer' : drag ? 'grabbing' : 'grab';
		if (!target?.card) return;
		const leaf = leaves[target.sheetIndex + 1];
		const r = target.rect;
		// The hover rect is in the leaf's own (front-side) coordinates
		leaf.uniforms.uHover.value.set(r.u, r.v, r.u + r.w, r.v + r.h);
		hovered = { leaf };
	}

	let drag = null;
	const DRAG_START = 8;

	function onPointerDown(e) {
		if (opening || e.button > 0) return;
		const target = pick(e.clientX, e.clientY);
		drag = {
			x: e.clientX,
			y: e.clientY,
			t: performance.now(),
			active: false,
			target,
			id: e.pointerId
		};
	}

	function onPointerMove(e) {
		const rect = canvas.getBoundingClientRect();
		pointer.px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
		pointer.py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
		if (!drag) {
			if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
			return;
		}
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!drag.active) {
			if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) return;
			// Dragging left lifts the right page; dragging right brings the last one back
			const forward = dx < 0;
			const index = forward ? spread : spread - 1;
			if (index < 1 || index >= leaves.length) return (drag = null);
			if (forward && spread >= maxSpread) return (drag = null);
			// Catch the sheet where it's drawn, even mid-turn, and stop only its own motion
			const leaf = leaves[index];
			leaf.motion?.stop();
			leaf.motion = null;
			leaf.theta = leaf.shown;
			drag.active = true;
			drag.forward = forward;
			drag.index = index;
			drag.from = leaf.theta;
			// Grabbing near the top or bottom corner twists the curl that way
			drag.skew = drag.target ? ((e.clientY - rect.top) / rect.height - 0.5) * -1.2 : 0;
			canvas.setPointerCapture(e.pointerId);
			setHover(null);
		}
		const leaf = leaves[drag.index];
		const pagePx = (rect.width / (narrow ? 1 : 2)) * 0.9;
		leaf.theta = Math.min(Math.PI, Math.max(0, drag.from + (-dx / pagePx) * Math.PI));
		leaf.uniforms.uSkew.value = drag.skew;
		drag.lastTheta = drag.lastTheta ?? leaf.theta;
		const now = performance.now();
		drag.velocity =
			((leaf.theta - drag.lastTheta) / Math.max(1, now - (drag.lastT ?? now - 16))) * 1000;
		drag.lastTheta = leaf.theta;
		drag.lastT = now;
		leaf.velocity = drag.velocity;
	}

	function onPointerUp(e) {
		if (!drag) return;
		const d = drag;
		drag = null;
		if (d.active) {
			const leaf = leaves[d.index];
			const v = d.velocity || 0;
			// A flick decides on its own; otherwise the sheet goes whichever way is past halfway
			const goLeft = Math.abs(v) > 2.5 ? v > 0 : leaf.theta > Math.PI / 2;
			const nextSpread = goLeft ? d.index + 1 : d.index;
			if (narrow) focusSide = goLeft ? 'left' : 'right';
			if (nextSpread !== spread) {
				spread = nextSpread;
				refreshTextures();
				onChange?.(spread, maxSpread);
			}
			settle(d.index, goLeft ? Math.PI : 0, v);
			leaf.uniforms.uSkew.value = d.skew * 0.5;
			frameCamera(true);
			return;
		}
		// A tap: open the card under it, or on a narrow screen, look at the tapped page
		// (never through a page that's still moving)
		if (
			d.target?.card &&
			Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START &&
			!inFlight()
		) {
			openCard(d.target);
		} else if (narrow && d.target) {
			const side = d.target.onRight ? 'right' : 'left';
			if (side !== focusSide) {
				focusSide = side;
				frameCamera(true);
			}
		}
	}

	function onPointerCancel() {
		const d = drag;
		drag = null;
		// Return the sheet to whichever side the spread says it belongs on
		if (d?.active) settle(d.index, d.index < spread ? Math.PI : 0, 0);
	}

	function onPointerLeave() {
		pointer.px = pointer.py = 0;
		if (!drag) setHover(null);
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointercancel', onPointerCancel);
	canvas.addEventListener('pointerleave', onPointerLeave);

	// ---------- Pulling a card out of its pocket ----------

	let opening = null;
	const cardFace = cardFaceGeometry();
	const cardBody = cardBodyGeometry();

	function pocketWorld(target) {
		const r = target.rect;
		const u = r.u + r.w / 2;
		const v = r.v + r.h / 2;
		const x = (GAP + u * W) * (target.onRight ? 1 : -1);
		const z = (v - 0.5) * H;
		const y = HINGE_Y + leaves.length * LAYER * 0.5 + 0.004;
		return new THREE.Vector3(x, y, z);
	}

	function openCard(target) {
		const img = target.side.images.get(target.k);
		if (!img || opening) return;
		setHover(null);
		const texture = new THREE.Texture(img);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.needsUpdate = true;
		const group = new THREE.Group();
		const face = new THREE.Mesh(cardFace, new THREE.MeshBasicMaterial({ map: texture }));
		face.position.z = 0.0052;
		// Crop the photo to the card the way the pocket shows it
		const iw = img.naturalWidth;
		const ih = img.naturalHeight;
		const imageAspect = iw / ih;
		const cardAspect = CARD_W / CARD_H;
		if (imageAspect > cardAspect) {
			texture.repeat.set(cardAspect / imageAspect, 1);
			texture.offset.set((1 - cardAspect / imageAspect) / 2, 0);
		} else {
			texture.repeat.set(1, imageAspect / cardAspect);
			texture.offset.set(0, (1 - imageAspect / cardAspect) / 2);
		}
		group.add(
			new THREE.Mesh(cardBody, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 })),
			face
		);
		const pocketW = target.rect.w * W;
		group.scale.setScalar(pocketW / CARD_W);
		const from = pocketWorld(target);
		group.position.copy(from);
		group.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
		scene.add(group);

		// Empty the pocket so the card isn't in two places
		target.side.empty = target.k;
		paintPocket(target.side, target.k, null);
		target.side.texture.needsUpdate = true;

		const fromQuat = group.quaternion.clone();
		const toQuat = camera.quaternion.clone();
		const fromScale = group.scale.x;
		// Rise toward the camera until the card is about a third of the canvas wide
		const toward = new THREE.Vector3().subVectors(camera.position, from).normalize();
		const distance = from.distanceTo(camera.position);
		const travel = distance * 0.45;
		const to = from.clone().addScaledVector(toward, travel);
		to.z -= 0.08; // slide up out of the pocket's open top edge first
		opening = { group, texture, target };
		animate(0, 1, {
			duration: 0.62,
			ease: [0.3, 0.7, 0.2, 1],
			onUpdate: (e) => {
				// Slide along the page for the first part, then lift
				const slide = Math.min(1, e / 0.35);
				const rise = Math.max(0, (e - 0.15) / 0.85);
				group.position.set(
					from.x + (to.x - from.x) * rise,
					from.y + (to.y - from.y) * rise,
					from.z - 0.06 * slide + (to.z + 0.06 - from.z) * rise
				);
				group.quaternion.slerpQuaternions(fromQuat, toQuat, rise);
				group.scale.setScalar(fromScale * (1 + rise * 0.15));
			},
			onComplete: () => {
				renderer.render(scene, camera);
				onOpenCard?.(target.card, screenRect(group), tileUrl(target.card.image));
			}
		});
	}

	// The card's footprint on screen once it faces the camera
	function screenRect(group) {
		const rect = canvas.getBoundingClientRect();
		const pts = [
			[-CARD_W / 2, -CARD_H / 2],
			[CARD_W / 2, CARD_H / 2]
		].map(([x, y]) => {
			const p = new THREE.Vector3(x, y, 0).applyMatrix4(group.matrixWorld).project(camera);
			return [rect.left + ((p.x + 1) / 2) * rect.width, rect.top + ((1 - p.y) / 2) * rect.height];
		});
		return {
			left: Math.min(pts[0][0], pts[1][0]),
			top: Math.min(pts[0][1], pts[1][1]),
			width: Math.abs(pts[1][0] - pts[0][0]),
			height: Math.abs(pts[1][1] - pts[0][1])
		};
	}

	// ---------- Loop ----------

	function resize() {
		width = canvas.clientWidth || 1;
		height = canvas.clientHeight || 1;
		narrow = width / height < 1.15;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		frameCamera(false);
	}

	let frame = null;
	let visible = true;
	let lastUpload = 0;
	function render(now) {
		frame = requestAnimationFrame(render);
		// Photos land in batches, so a sheet re-uploads a few times rather than once per card
		if (now - lastUpload > 200) {
			lastUpload = now;
			for (const pair of sides) {
				for (const side of pair ? [pair.front, pair.back] : []) {
					if (side.dirty) {
						side.texture.needsUpdate = true;
						side.dirty = false;
					}
				}
			}
		}
		layout();
		placeCamera();
		const dim = dark ? 0.86 : 1;
		for (const leaf of leaves) leaf.uniforms.uDim.value = dim;
		shadowMaterial.opacity = dark ? 0.9 : 0.35;
		renderer.render(scene, camera);
	}

	function start() {
		if (frame === null && visible && !document.hidden && !cancelled)
			frame = requestAnimationFrame(render);
	}
	function stop() {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
	}

	// Only render while the binder is on screen and the tab is visible
	const io = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) start();
		else stop();
	});
	io.observe(canvas);
	const onVisibility = () => (document.hidden ? stop() : start());
	document.addEventListener('visibilitychange', onVisibility);
	const ro = new ResizeObserver(resize);
	ro.observe(canvas);

	resize();
	refreshTextures();
	start();
	onChange?.(Math.max(spread, 1), maxSpread);

	// Opening the cover on a first visit
	function playIntro() {
		if (spread !== 0) return;
		spread = 1;
		refreshTextures();
		cover.motion = animate(0, Math.PI, {
			duration: 1.6,
			ease: [0.6, 0, 0.2, 1],
			delay: 0.25,
			onUpdate: (v) => (cover.theta = v),
			onComplete: () => (cover.motion = null)
		});
	}

	return {
		next: () => {
			if (drag?.active) return;
			if (narrow && focusSide === 'left') {
				focusSide = 'right';
				return frameCamera(true);
			}
			if (narrow && spread < maxSpread) focusSide = 'left';
			setSpread(spread + 1);
		},
		prev: () => {
			if (drag?.active) return;
			if (narrow && focusSide === 'right' && spread > 1) {
				focusSide = 'left';
				return frameCamera(true);
			}
			if (narrow && spread > 1) focusSide = 'right';
			setSpread(spread - 1);
		},
		go: (s) => setSpread(s),
		playIntro,
		// The card didn't get opened after all: slide it back into its pocket
		cancelOpen() {
			if (!opening) return;
			const { group, texture, target } = opening;
			scene.remove(group);
			group.children.forEach((m) => m.material.dispose());
			texture.dispose();
			target.side.empty = null;
			paintPocket(target.side, target.k, target.side.images.get(target.k));
			target.side.texture.needsUpdate = true;
			opening = null;
		},
		setDark: (value) => (dark = value),
		get spread() {
			return spread;
		},
		destroy() {
			cancelled = true;
			stop();
			io.disconnect();
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerCancel);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			for (const leaf of leaves) leaf.motion?.stop();
			camMotion?.stop();
			for (let i = 0; i < sheets.length; i++) releaseSheet(i);
			opening?.texture.dispose();
			scene.traverse((obj) => {
				obj.geometry?.dispose();
				const mats = Array.isArray(obj.material)
					? obj.material
					: obj.material
						? [obj.material]
						: [];
				for (const m of mats) {
					m.map?.dispose();
					m.dispose();
				}
			});
			coverOutside.dispose();
			coverInside.dispose();
			leather.dispose();
			envTexture.dispose();
			pmrem.dispose();
			renderer.dispose();
		}
	};
}
