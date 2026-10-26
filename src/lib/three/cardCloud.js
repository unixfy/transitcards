import * as THREE from 'three';
import { animate } from 'motion';
import {
	CARD_W,
	cardFaceGeometry,
	cardBodyGeometry,
	coverRect,
	drawCover,
	loadImage,
	eachLimited
} from './cardGeometry';

// The slideshow's 3D scene: the whole collection drifts toward the viewer like the walls of a
// tunnel seen from the front of a train, and the featured card swings out of the stream to
// settle where the flat slideshow would have shown it.

const asset = (image, width) =>
	`https://cms.alexwang.net/assets/${image}?format=webp&width=${width}`;

// One size per role, shared with the rest of the site so nothing downloads twice: the grid's
// thumbnail for the stream, and the flat slideshow's photo size for the featured card
const TILE_SRC_WIDTH = 400;
const HERO_SRC_WIDTH = 1600;

const ATLAS = 2048;
const CELL_W = 256;
const CELL_H = 164;
const TILE_W = 252;
const TILE_H = 160;
const COLS = ATLAS / CELL_W;
const ROWS = Math.floor(ATLAS / CELL_H);
const PER_ATLAS = COLS * ROWS;

const DEPTH = 90; // tunnel length; cards wrap from the far end back to the near one
const SPEED = 0.55; // units per second toward the viewer
const FOV = 30;
const HERO_DISTANCE = 3;

const cloudVertex = /* glsl */ `
	attribute vec4 aRect;
	uniform float uFar;
	varying vec2 vUv;
	varying float vFade;
	void main() {
		vUv = aRect.xy + uv * aRect.zw;
		vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
		float dist = -mv.z;
		vFade = smoothstep(uFar, uFar * 0.45, dist) * smoothstep(4.0, 11.0, dist);
		gl_Position = projectionMatrix * mv;
	}
`;

const cloudFragment = /* glsl */ `
	uniform sampler2D map;
	uniform vec4 uQuiet;
	uniform float uFeather;
	varying vec2 vUv;
	varying float vFade;
	void main() {
		vec4 tex = texture2D(map, vUv);
		vec3 col = tex.rgb;
		// Card backs are plain dark plastic tinted by the face showing through
		if (!gl_FrontFacing) col = vec3(0.07, 0.08, 0.09) + col * 0.06;
		// Keep the stream quiet behind the text (uQuiet is its box in buffer pixels, y up)
		vec2 p = gl_FragCoord.xy;
		vec2 d = max(uQuiet.xy - p, p - uQuiet.zw);
		float inside = 1.0 - smoothstep(0.0, uFeather, max(d.x, d.y));
		float dim = mix(1.0, 0.14, inside);
		// Tiles stay invisible until their photo arrives
		float a = vFade * dim * 0.78 * tex.a;
		gl_FragColor = vec4(col * a, a);
	}
`;

const heroVertex = /* glsl */ `
	uniform vec4 uRect;
	varying vec2 vUv;
	varying vec2 vCardUv;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		vCardUv = uv;
		vUv = uRect.xy + uv * uRect.zw;
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		vNormal = normalize(normalMatrix * normal);
		vView = -mv.xyz;
		gl_Position = projectionMatrix * mv;
	}
`;

const heroFragment = /* glsl */ `
	uniform sampler2D map;
	uniform float uGlint;
	uniform float uOpacity;
	varying vec2 vUv;
	varying vec2 vCardUv;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		vec3 col = texture2D(map, vUv).rgb;
		vec3 n = normalize(vNormal);
		vec3 v = normalize(vView);
		// Laminate: a faint rim as the card turns, and one band of light crossing as it lands
		float rim = pow(1.0 - abs(dot(n, v)), 3.0) * 0.35;
		float band = vCardUv.x * 0.8 + vCardUv.y * 0.45;
		float glint = smoothstep(0.16, 0.0, abs(band - uGlint)) * 0.2
			+ smoothstep(0.03, 0.0, abs(band - uGlint - 0.12)) * 0.08;
		col += vec3(rim + glint);
		gl_FragColor = vec4(col * uOpacity, uOpacity);
	}
`;

function rand(seed) {
	// Small deterministic PRNG so the tunnel looks the same on every reload
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const easeOutExpo = [0.16, 1, 0.3, 1];
const easeInOut = [0.65, 0, 0.35, 1];

export function createCardCloud(canvas, cards, { getTarget, getQuiet, isPaused = () => false }) {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true,
		powerPreference: 'high-performance'
	});
	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders pass photo colors straight through

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, DEPTH + 10);

	let cancelled = false;
	const random = rand(cards.length * 7919);

	// ---------- Atlases: every card as a small tile, filled in as photos arrive ----------

	const atlases = [];
	const atlasCount = Math.ceil(cards.length / PER_ATLAS);
	for (let a = 0; a < atlasCount; a++) {
		const c = document.createElement('canvas');
		c.width = c.height = ATLAS;
		const texture = new THREE.CanvasTexture(c);
		texture.anisotropy = 4;
		texture.colorSpace = THREE.NoColorSpace;
		// Uploaded once while empty; photos are then copied into their own tiles on the GPU
		renderer.initTexture(texture);
		atlases.push({ texture });
	}

	// Photos waiting to be copied into their tile, a few per frame
	const tileCanvas = document.createElement('canvas');
	tileCanvas.width = TILE_W;
	tileCanvas.height = TILE_H;
	const tileCtx = tileCanvas.getContext('2d');
	const tileSource = new THREE.Texture(tileCanvas);
	const tilePosition = new THREE.Vector2();
	const pendingTiles = [];
	const TILES_PER_FRAME = 6;

	function flushTiles() {
		const batch = pendingTiles.splice(0, TILES_PER_FRAME);
		batch.forEach(({ slot, img }, i) => {
			const atlas = atlases[slot.atlas];
			tileCtx.clearRect(0, 0, TILE_W, TILE_H);
			drawCover(tileCtx, img, 0, 0, TILE_W, TILE_H);
			// Rebuild mipmaps once per atlas per batch, on its last tile
			atlas.texture.generateMipmaps = !batch
				.slice(i + 1)
				.some((later) => later.slot.atlas === slot.atlas);
			tilePosition.set(slot.x, ATLAS - slot.y - TILE_H);
			renderer.copyTextureToTexture(tileSource, atlas.texture, null, tilePosition);
		});
		for (const atlas of atlases) atlas.texture.generateMipmaps = true;
	}

	const slots = cards.map((card, i) => {
		const a = Math.floor(i / PER_ATLAS);
		const k = i % PER_ATLAS;
		const col = k % COLS;
		const row = Math.floor(k / COLS);
		const x = col * CELL_W + (CELL_W - TILE_W) / 2;
		const y = row * CELL_H + (CELL_H - TILE_H) / 2;
		// UVs flip vertically: canvas rows run downward, texture v runs upward
		const rect = [x / ATLAS, 1 - (y + TILE_H) / ATLAS, TILE_W / ATLAS, TILE_H / ATLAS];
		return { card, atlas: a, index: k, x, y, rect };
	});
	const slotById = new Map(slots.map((s) => [s.card.id, s]));

	// ---------- The stream ----------

	const faceGeometry = cardFaceGeometry();
	const quiet = { value: new THREE.Vector4(0, 0, 0, 0) };
	const feather = { value: 120 };
	const meshes = atlases.map((atlas, a) => {
		const members = slots.filter((s) => s.atlas === a);
		const geometry = faceGeometry.clone();
		const rects = new Float32Array(members.length * 4);
		members.forEach((s, j) => rects.set(s.rect, j * 4));
		geometry.setAttribute('aRect', new THREE.InstancedBufferAttribute(rects, 4));
		const material = new THREE.ShaderMaterial({
			vertexShader: cloudVertex,
			fragmentShader: cloudFragment,
			uniforms: {
				map: { value: atlas.texture },
				uFar: { value: DEPTH },
				uQuiet: quiet,
				uFeather: feather
			},
			side: THREE.DoubleSide,
			transparent: true,
			premultipliedAlpha: true
		});
		const mesh = new THREE.InstancedMesh(geometry, material, members.length);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.frustumCulled = false;
		scene.add(mesh);
		members.forEach((s, j) => (s.instance = j));
		return mesh;
	});

	// Each card gets a place on the tunnel wall and a slow tumble of its own
	for (const s of slots) {
		const angle = random() * Math.PI * 2;
		const radius = 2.4 + Math.pow(random(), 0.7) * 5;
		s.home = {
			x: Math.cos(angle) * radius,
			y: Math.sin(angle) * radius * 0.72,
			z0: random() * DEPTH,
			spin: (random() - 0.5) * 0.35,
			tiltX: (random() - 0.5) * 1.1,
			tiltY: (random() - 0.5) * 1.3,
			phase: random() * Math.PI * 2,
			// Lean toward the axis so faces read as they pass
			lean: -angle
		};
		s.hidden = false;
	}

	const tmpPos = new THREE.Vector3();
	const tmpQuat = new THREE.Quaternion();
	const tmpEuler = new THREE.Euler();
	const tmpScale = new THREE.Vector3(1, 1, 1);
	const zero = new THREE.Vector3(0, 0, 0);
	const tmpMatrix = new THREE.Matrix4();

	function streamPose(s, t, pos, quat) {
		const h = s.home;
		const z = -DEPTH + ((h.z0 + t * SPEED) % DEPTH);
		pos.set(h.x, h.y, z);
		tmpEuler.set(
			h.tiltX + Math.sin(t * 0.21 + h.phase) * 0.25,
			h.tiltY + Math.cos(t * 0.17 + h.phase) * 0.3 + Math.cos(h.lean) * 0.35,
			h.spin * t * 0.4 + h.phase * 0.2
		);
		quat.setFromEuler(tmpEuler);
	}

	// ---------- The featured card ----------

	const bodyGeometry = cardBodyGeometry();

	function makeHero() {
		const group = new THREE.Group();
		const uniforms = {
			map: { value: atlases[0].texture },
			uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
			uGlint: { value: -1 },
			uOpacity: { value: 1 }
		};
		const face = new THREE.Mesh(
			faceGeometry,
			new THREE.ShaderMaterial({
				vertexShader: heroVertex,
				fragmentShader: heroFragment,
				uniforms,
				transparent: true,
				premultipliedAlpha: true
			})
		);
		face.position.z = 0.0052;
		// Each hero has its own body so it can fade along with the face
		const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x23282f, transparent: true });
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		group.add(body, face);
		group.visible = false;
		scene.add(group);
		const hero = { group, uniforms, bodyMaterial, slot: null, hiRes: null, motion: null };
		hero.setOpacity = (o) => {
			uniforms.uOpacity.value = o;
			bodyMaterial.opacity = o;
		};
		return Object.assign(hero, { glint: null, state: 'idle' });
	}

	const heroes = [makeHero(), makeHero()];
	let active = null; // the hero currently featured

	function setInstance(s, matrix) {
		meshes[s.atlas].setMatrixAt(s.instance, matrix);
	}

	// Where the featured card rests, swaying gently like the flat slideshow's card
	const floatEuler = new THREE.Euler();
	function restPose(pos, quat, scale, t) {
		targetPose(pos, quat, scale);
		pos.y += Math.sin(t * 0.45) * 0.012;
		floatEuler.set(Math.sin(t * 0.37) * 0.05, Math.sin(t * 0.29) * 0.11, 0);
		quat.setFromEuler(floatEuler);
	}

	// How visible a card is at this spot in the stream (the stream shader's fade, on the CPU), so
	// the featured card can leave and rejoin the stream without popping
	const projected = new THREE.Vector3();
	const smooth = (e0, e1, x) => {
		const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
		return k * k * (3 - 2 * k);
	};
	function streamAlpha(pos) {
		const dist = -pos.z;
		const fade = smooth(DEPTH, DEPTH * 0.45, dist) * smooth(4, 11, dist);
		projected.copy(pos).project(camera);
		const r = renderer.getPixelRatio();
		const px = ((projected.x + 1) / 2) * width * r;
		const py = ((projected.y + 1) / 2) * height * r;
		const q = quiet.value;
		const d = Math.max(q.x - px, px - q.z, q.y - py, py - q.w);
		const dim = 1 - 0.86 * (1 - smooth(0, feather.value, d));
		return fade * dim * 0.78;
	}

	function targetPose(pos, quat, scale) {
		const target = getTarget?.();
		const h = 2 * HERO_DISTANCE * Math.tan((FOV * Math.PI) / 360);
		const perPx = h / height;
		if (target) {
			pos.set((target.x - width / 2) * perPx, -(target.y - height / 2) * perPx, -HERO_DISTANCE);
			// A touch smaller than the slot leaves room for the float's lean
			scale.setScalar((target.width * perPx * 0.94) / CARD_W);
		} else {
			pos.set(0, 0, -HERO_DISTANCE);
			scale.setScalar((width * 0.5 * perPx) / CARD_W);
		}
		quat.identity();
	}

	function useHiRes(hero, card) {
		loadImage(asset(card.image, HERO_SRC_WIDTH))
			.then((img) => {
				// Compare ids: the page hands over a reactive proxy of the card, not the same object
				if (cancelled || hero.slot?.card.id !== card.id) return;
				const texture = new THREE.Texture(img);
				texture.colorSpace = THREE.NoColorSpace;
				texture.anisotropy = 8;
				texture.needsUpdate = true;
				hero.hiRes?.dispose();
				hero.hiRes = texture;
				hero.uniforms.map.value = texture;
				hero.uniforms.uRect.value.set(...coverRect(img.naturalWidth, img.naturalHeight));
			})
			.catch(() => {});
	}

	function release(hero) {
		hero.motion?.stop();
		hero.glint?.stop();
		hero.group.visible = false;
		if (hero.slot) hero.slot.hidden = false;
		hero.slot = null;
		hero.hiRes?.dispose();
		hero.hiRes = null;
		hero.state = 'idle';
	}

	// Send the featured card back into the stream, aiming at where its place has drifted to
	function sendBack(hero) {
		hero.motion?.stop();
		hero.glint?.stop();
		hero.state = 'leaving';
		const fromPos = hero.group.position.clone();
		const fromQuat = hero.group.quaternion.clone();
		const fromScale = hero.group.scale.x;
		const livePos = new THREE.Vector3();
		const liveQuat = new THREE.Quaternion();
		hero.motion = animate(0, 1, {
			duration: 2.2,
			ease: easeInOut,
			onUpdate: (e) => {
				streamPose(hero.slot, clock, livePos, liveQuat);
				hero.group.position.lerpVectors(fromPos, livePos, e);
				// Arc away to the side rather than shrinking straight back
				hero.group.position.x -= Math.sin(e * Math.PI) * 0.6;
				hero.group.quaternion.slerpQuaternions(fromQuat, liveQuat, e);
				hero.group.scale.setScalar(fromScale + (1 - fromScale) * e);
				// Dim to exactly how the stream draws that card, so the hand-off is invisible
				hero.setOpacity(1 + (streamAlpha(livePos) - 1) * smooth(0.45, 1, e));
			},
			onComplete: () => release(hero)
		});
	}

	function feature(card) {
		const slot = slotById.get(card?.id);
		if (!slot || active?.slot === slot) return;
		if (active) sendBack(active);
		const hero =
			heroes.find((h) => h !== active && h.state !== 'leaving') ?? heroes.find((h) => h !== active);
		release(hero);
		active = hero;
		hero.slot = slot;
		hero.state = 'arriving';
		slot.hidden = true;
		hero.uniforms.map.value = atlases[slot.atlas].texture;
		hero.uniforms.uRect.value.set(...slot.rect);
		hero.uniforms.uGlint.value = -1;
		useHiRes(hero, card);
		loadTile(slot); // make sure its tile is first in line

		const fromPos = new THREE.Vector3();
		const fromQuat = new THREE.Quaternion();
		streamPose(slot, clock, fromPos, fromQuat);
		hero.group.position.copy(fromPos);
		hero.group.quaternion.copy(fromQuat);
		hero.group.scale.setScalar(1);
		// Start exactly as faint as the stream drew it, then come up to full strength
		const fromAlpha = streamAlpha(fromPos);
		hero.setOpacity(fromAlpha);
		hero.group.visible = true;

		const toPos = new THREE.Vector3();
		const toQuat = new THREE.Quaternion();
		const toScale = new THREE.Vector3();
		const control = new THREE.Vector3();
		const a = new THREE.Vector3();
		const b = new THREE.Vector3();
		hero.arrival = 0;
		hero.motion = animate(0, 1, {
			duration: 2.8,
			ease: easeOutExpo,
			onUpdate: (e) => {
				restPose(toPos, toQuat, toScale, clock);
				// Swing in on a curve: out past the tunnel wall, then into place
				control.set(
					(fromPos.x + toPos.x) / 2 + Math.sign(fromPos.x || 1) * 1.2,
					(fromPos.y + toPos.y) / 2 + 0.5,
					(fromPos.z + toPos.z) / 2
				);
				a.lerpVectors(fromPos, control, e);
				b.lerpVectors(control, toPos, e);
				hero.group.position.lerpVectors(a, b, e);
				hero.group.quaternion.slerpQuaternions(fromQuat, toQuat, e);
				hero.group.scale.setScalar(1 + (toScale.x - 1) * e);
				hero.setOpacity(fromAlpha + (1 - fromAlpha) * smooth(0, 0.45, e));
				hero.arrival = e;
			},
			onComplete: () => {
				hero.state = 'shown';
				hero.glint = animate(-0.6, 1.9, {
					duration: 2.2,
					ease: [0.4, 0, 0.2, 1],
					onUpdate: (g) => (hero.uniforms.uGlint.value = g)
				});
			}
		});
	}

	function holdPose(hero, t) {
		restPose(hero.group.position, hero.group.quaternion, hero.group.scale, t);
	}

	// ---------- Photo loading ----------

	const requested = new Set();
	function loadTile(slot) {
		if (requested.has(slot)) return Promise.resolve();
		requested.add(slot);
		return loadImage(asset(slot.card.image, TILE_SRC_WIDTH)).then((img) => {
			if (cancelled) return;
			// The featured card's tile jumps the queue
			if (slot.hidden) pendingTiles.unshift({ slot, img });
			else pendingTiles.push({ slot, img });
		});
	}

	function loadAll(order) {
		const queue = order.map((card) => slotById.get(card.id)).filter(Boolean);
		eachLimited(queue, 6, loadTile, () => cancelled);
	}

	// ---------- Frame loop ----------

	let width = 1;
	let height = 1;
	function resize() {
		width = canvas.clientWidth || window.innerWidth;
		height = canvas.clientHeight || window.innerHeight;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		feather.value = 140 * renderer.getPixelRatio();
		updateQuiet();
	}

	function updateQuiet() {
		const box = getQuiet?.();
		if (!box) return;
		const r = renderer.getPixelRatio();
		const pad = 24;
		quiet.value.set(
			(box.left - pad) * r,
			(height - box.bottom - pad) * r,
			(box.right + pad) * r,
			(height - box.top + pad) * r
		);
	}

	let clock = 0;
	let last = performance.now();
	let frame = null;
	let lastUpload = 0;

	function render(now) {
		frame = requestAnimationFrame(render);
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		// Pausing slows the stream to a crawl instead of freezing it
		clock += dt * (isPaused() ? 0.15 : 1);

		if (now - lastUpload > 250) {
			updateQuiet(); // the text block changes size from card to card
			lastUpload = now;
		}
		if (pendingTiles.length) flushTiles();

		for (const s of slots) {
			if (s.hidden) {
				tmpMatrix.compose(zero, tmpQuat.identity(), tmpScale.setScalar(0));
			} else {
				streamPose(s, clock, tmpPos, tmpQuat);
				tmpMatrix.compose(tmpPos, tmpQuat, tmpScale.setScalar(1));
			}
			setInstance(s, tmpMatrix);
		}
		for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;

		for (const hero of heroes) {
			if (hero.state === 'shown') holdPose(hero, clock);
		}

		renderer.render(scene, camera);
	}

	function start() {
		if (frame !== null || cancelled) return;
		last = performance.now();
		frame = requestAnimationFrame(render);
	}

	function stop() {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
	}

	// Nothing renders while the tab is hidden
	const onVisibility = () => (document.hidden ? stop() : start());
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('resize', resize);
	resize();
	start();

	return {
		feature,
		loadAll,
		// Fetch the next card's full photo ahead of its turn (the browser keeps it cached)
		preload: (card) => loadImage(asset(card.image, HERO_SRC_WIDTH)).catch(() => {}),
		destroy() {
			cancelled = true;
			stop();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('resize', resize);
			for (const hero of heroes) release(hero);
			for (const atlas of atlases) atlas.texture.dispose();
			for (const mesh of meshes) {
				mesh.geometry.dispose();
				mesh.material.dispose();
			}
			faceGeometry.dispose();
			bodyGeometry.dispose();
			for (const hero of heroes) {
				hero.bodyMaterial.dispose();
				hero.group.children[1].material.dispose();
			}
			pendingTiles.length = 0;
			renderer.dispose();
		}
	};
}
