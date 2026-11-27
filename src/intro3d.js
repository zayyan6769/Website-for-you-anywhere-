/* ===== 3D walk-in intro (Three.js) =====
   Source for the bundled script inlined in index.html (run `npm run build` after editing).
   Scroll drives a camera from the storefront, through the opening door, around the shop
   and up to a barber chair. Without WebGL the intro stays a plain hero.

   Realism comes from: physically based materials with procedural colour, bump and roughness
   maps (brick, tile, plaster, wood, leather, tin ceiling, concrete), real-time shadows,
   true mirror reflections (desktop), bloom on lamps and neon, and a lot of set dressing. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const section = document.getElementById('intro3d');
const sticky = section.querySelector('.sticky');
const canvas = document.getElementById('shopCanvas');
const small = matchMedia('(max-width: 700px)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { console.warn('3D intro disabled:', e); }
if (renderer) (document.fonts ? document.fonts.ready : Promise.resolve()).catch(() => {}).then(build);

function build() {
  const DPR = Math.min(devicePixelRatio, small ? 1.25 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 80);

  // ---------- helpers ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rb = (w, h, d, r = 0.05, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  const add = (parent, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; };
  const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // One drawing function renders a texture set: colour, bump and roughness, with identical layout.
  const texSet = (w, h, draw, repeat = [1, 1], modes = ['color', 'bump', 'rough']) => {
    const out = {};
    for (const mode of modes) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h, mode, seeded(12345));
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = ANISO;
      if (mode === 'color') t.colorSpace = THREE.SRGBColorSpace;
      out[mode] = t;
    }
    return out;
  };
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; };
  const grain = (x, w, h, r, n, a, light = false, size = 2) => { for (let i = 0; i < n; i++) { const v = light ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${a * r()})`; x.fillRect(r() * w, r() * h, 1 + r() * size, 1 + r() * size); } };
  const pbr = (set, extra = {}) => std(0xffffff, 1, 0, { map: set.color, bumpMap: set.bump, roughnessMap: set.rough, bumpScale: 1, ...extra });

  // ---------- procedural material textures ----------
  const brickSet = texSet(512, 512, (x, w, h, mode, r) => {
    const rows = 12, cols = 4, bh = h / rows, bw = w / cols, m = 5;
    x.fillStyle = mode === 'color' ? '#9c948a' : mode === 'bump' ? '#404040' : '#f0f0f0'; x.fillRect(0, 0, w, h);
    grain(x, w, h, r, 3000, 0.25);
    for (let row = 0; row < rows; row++) for (let c = 0; c <= cols; c++) {
      const a = r(), b = r(), d = r();
      const X = c * bw + (row % 2 ? bw / 2 : 0) - bw, Y = row * bh;
      if (mode === 'color') x.fillStyle = `hsl(${8 + a * 14},${38 + b * 18}%,${26 + d * 14}%)`;
      else if (mode === 'bump') x.fillStyle = `rgb(${175 + a * 50},${175 + a * 50},${175 + a * 50})`;
      else x.fillStyle = `rgb(${200 + b * 50},${200 + b * 50},${200 + b * 50})`;
      for (const dx of [0, w]) x.fillRect(X + dx + m / 2, Y + m / 2, bw - m, bh - m);
    }
    grain(x, w, h, r, 9000, mode === 'color' ? 0.35 : 0.5, false, 3);
    grain(x, w, h, r, 3000, 0.15, true, 2);
  }, [1, 1]);

  const tileSet = texSet(1024, 1024, (x, w, h, mode, r) => {
    const n = 8, s = w / n, g = 4;
    x.fillStyle = mode === 'color' ? '#8d887e' : mode === 'bump' ? '#303030' : '#e8e8e8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const dark = (i + j) % 2 === 0, v = r();
      if (mode === 'color') x.fillStyle = dark ? `rgb(${24 + v * 10},${22 + v * 9},${20 + v * 8})` : `rgb(${226 + v * 14},${216 + v * 12},${196 + v * 10})`;
      else if (mode === 'bump') x.fillStyle = '#d8d8d8';
      else x.fillStyle = `rgb(${55 + v * 40},${55 + v * 40},${55 + v * 40})`;
      x.fillRect(i * s + g / 2, j * s + g / 2, s - g, s - g);
    }
    // scuffs and wear paths
    for (let k = 0; k < 140; k++) {
      x.fillStyle = mode === 'rough' ? `rgba(255,255,255,${0.08 * r()})` : `rgba(${mode === 'color' ? '120,110,95' : '0,0,0'},${0.06 * r()})`;
      x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 60, 4 + r() * 20, r() * 3, 0, 7); x.fill();
    }
    grain(x, w, h, r, 20000, 0.12, mode === 'rough', 2);
  }, [4, 5]);

  const plasterSet = texSet(512, 512, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#e6d9bf' : mode === 'bump' ? '#808080' : '#d0d0d0'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 220; k++) { const v = r(); x.fillStyle = mode === 'color' ? `rgba(${v > .5 ? '255,250,235' : '170,150,120'},${0.05 * r()})` : `rgba(${v > .5 ? '255,255,255' : '0,0,0'},${0.08 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, 10 + r() * 70, 0, 7); x.fill(); }
    grain(x, w, h, r, 16000, 0.12, false, 2); grain(x, w, h, r, 8000, 0.1, true, 2);
  }, [2, 1]);

  const beadSet = texSet(512, 256, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#1f2a44' : mode === 'bump' ? '#c0c0c0' : '#909090'; x.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = mode === 'color' ? 'rgba(0,0,0,.45)' : mode === 'bump' ? '#202020' : '#bbbbbb'; x.fillRect(i * s, 0, 4, h);
      x.fillStyle = mode === 'color' ? 'rgba(255,255,255,.06)' : mode === 'bump' ? '#e8e8e8' : '#707070'; x.fillRect(i * s + 4, 0, 3, h);
    }
    grain(x, w, h, r, 4000, 0.15, false, 2);
  }, [6, 1]);

  const tinSet = texSet(512, 512, (x, w, h, mode, r) => {
    const n = 4, s = w / n;
    x.fillStyle = mode === 'color' ? '#ece3cf' : mode === 'bump' ? '#606060' : '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const X = i * s, Y = j * s;
      x.strokeStyle = mode === 'color' ? 'rgba(150,130,95,.5)' : mode === 'bump' ? '#e0e0e0' : '#606060'; x.lineWidth = 6; x.strokeRect(X + 10, Y + 10, s - 20, s - 20);
      x.strokeStyle = mode === 'color' ? 'rgba(150,130,95,.35)' : mode === 'bump' ? '#b0b0b0' : '#707070'; x.lineWidth = 3; x.beginPath(); x.arc(X + s / 2, Y + s / 2, s * 0.26, 0, 7); x.stroke();
      x.fillStyle = mode === 'bump' ? '#ffffff' : 'rgba(150,130,95,.5)'; x.beginPath(); x.arc(X + s / 2, Y + s / 2, s * 0.09, 0, 7); x.fill();
      for (const [cx, cy] of [[22, 22], [s - 22, 22], [22, s - 22], [s - 22, s - 22]]) { x.beginPath(); x.arc(X + cx, Y + cy, 6, 0, 7); x.fill(); }
    }
    grain(x, w, h, r, 6000, 0.12, false, 2);
  }, [6, 7]);

  const woodSet = texSet(512, 512, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#4b2e1b' : mode === 'bump' ? '#808080' : '#7a7a7a'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) {
      const y0 = r() * h, amp = 2 + r() * 6, f = 0.004 + r() * 0.01, ph = r() * 6, v = r();
      x.strokeStyle = mode === 'color' ? (v > 0.5 ? `rgba(110,70,40,${0.25 * r()})` : `rgba(25,12,6,${0.35 * r()})`) : `rgba(${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${0.2 * r()})`;
      x.lineWidth = 0.6 + r() * 2.2; x.beginPath();
      for (let X = 0; X <= w; X += 8) x.lineTo(X, y0 + Math.sin(X * f + ph) * amp);
      x.stroke();
    }
  }, [1, 1]);

  const leatherSet = texSet(256, 256, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#7a171d' : mode === 'bump' ? '#808080' : '#8a8a8a'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { x.fillStyle = mode === 'color' ? `rgba(40,0,4,${0.12 * r()})` : `rgba(0,0,0,${0.15 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, 6 + r() * 24, 0, 7); x.fill(); }
    grain(x, w, h, r, 14000, 0.35, false, 1.5); grain(x, w, h, r, 5000, 0.2, true, 1.5);
  }, [2, 2]);

  const concreteSet = texSet(512, 512, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#7f7a72' : mode === 'bump' ? '#a0a0a0' : '#e0e0e0'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(${r() > .5 ? '255,255,255' : '0,0,0'},${0.05 * r()})`; x.beginPath(); x.arc(r() * w, r() * h, 10 + r() * 50, 0, 7); x.fill(); }
    grain(x, w, h, r, 30000, 0.25, false, 2); grain(x, w, h, r, 12000, 0.2, true, 2);
    x.fillStyle = mode === 'bump' ? '#101010' : mode === 'color' ? 'rgba(30,28,25,.7)' : '#ffffff'; x.fillRect(0, 0, w, 4); x.fillRect(0, 0, 4, h);
  }, [10, 6]);

  const asphaltSet = texSet(512, 512, (x, w, h, mode, r) => {
    x.fillStyle = mode === 'color' ? '#2a2a2c' : mode === 'bump' ? '#707070' : '#d8d8d8'; x.fillRect(0, 0, w, h);
    grain(x, w, h, r, 40000, 0.5, true, 2); grain(x, w, h, r, 20000, 0.5, false, 2);
  }, [20, 4]);

  // ---------- materials ----------
  const M = {
    brick: pbr(brickSet, { bumpScale: 2.2 }),
    brickDark: (() => { const s = {}; for (const k in brickSet) { s[k] = brickSet[k].clone(); s[k].repeat.set(10, 7); s[k].needsUpdate = true; } return pbr(s, { bumpScale: 2.2, color: 0x8a7f78 }); })(),
    tile: pbr(tileSet, { bumpScale: 0.6 }),
    plaster: pbr(plasterSet, { bumpScale: 0.4 }),
    bead: pbr(beadSet, { bumpScale: 1.2 }),
    tin: pbr(tinSet, { bumpScale: 1.5, metalness: 0.35 }),
    wood: pbr(woodSet, { bumpScale: 0.4 }),
    walnut: pbr(woodSet, { bumpScale: 0.4, color: 0xc9a98a }),
    leather: new THREE.MeshPhysicalMaterial({ map: leatherSet.color, bumpMap: leatherSet.bump, bumpScale: 0.6, roughnessMap: leatherSet.rough, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: 0xff9a90, sheenRoughness: 0.5 }),
    concrete: pbr(concreteSet, { bumpScale: 1.5 }),
    asphalt: pbr(asphaltSet, { bumpScale: 1.2 }),
    chrome: std(0xffffff, 0.08, 1),
    brass: std(0xc9a253, 0.25, 1),
    agedBrass: std(0xa88a4a, 0.4, 1),
    enamel: new THREE.MeshPhysicalMaterial({ color: 0xe9e2d3, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    navyPaint: new THREE.MeshPhysicalMaterial({ color: 0x1c2640, roughness: 0.45, clearcoat: 0.4 }),
    redPaint: new THREE.MeshPhysicalMaterial({ color: 0x7e1a1f, roughness: 0.4, clearcoat: 0.6 }),
    black: std(0x111111, 0.4, 0.2),
    rubber: std(0x151515, 0.9),
    white: std(0xf4f1ea, 0.7),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false }),
    frosted: std(0xfff4dc, 0.3, 0, { emissive: 0xffd9a0, emissiveIntensity: 1.4 }),
    bulb: std(0xfff6e0, 0.2, 0, { emissive: 0xffe2a8, emissiveIntensity: 3 }),
    plant: std(0x2f6b3a, 0.75), plantLight: std(0x5d8f3c, 0.75),
    terracotta: std(0xa0522d, 0.85)
  };
  const shadowless = new Set([M.glass, M.frosted, M.bulb]);

  // ---------- sky and street ----------
  const sky = tex(16, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0c1224'); g.addColorStop(0.55, '#1d2a4a'); g.addColorStop(0.8, '#4a3e5a'); g.addColorStop(1, '#a8664a'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  scene.background = sky;
  scene.fog = new THREE.Fog(0x1d2440, 22, 48);

  const ground = (w, d, mat, x, z, y = 0) => { const m = add(scene, new THREE.PlaneGeometry(w, d), mat, x, y, z); m.rotation.x = -Math.PI / 2; return m; };
  ground(40, 14.2, M.concrete, 0, 7.1, 0.0);
  ground(60, 22, M.asphalt, 0, 25.4, -0.14);
  add(scene, rb(40, 0.16, 0.3, 0.04), std(0x8d877d, 0.85), 0, -0.06, 14.3);
  // street lamp
  const lamp = new THREE.Group(); lamp.position.set(-5.2, 0, 12.6); scene.add(lamp);
  add(lamp, new THREE.CylinderGeometry(0.09, 0.14, 0.5, 16), M.black, 0, 0.25, 0);
  add(lamp, new THREE.CylinderGeometry(0.055, 0.07, 4.4, 16), M.black, 0, 2.6, 0);
  const arm = add(lamp, new THREE.TorusGeometry(0.5, 0.035, 8, 24, Math.PI / 2), M.black, 0.5, 4.8, 0); arm.rotation.z = Math.PI / 2;
  add(lamp, new THREE.ConeGeometry(0.3, 0.32, 24, 1, true), std(0x111111, 0.4, 0.4, { side: THREE.DoubleSide }), 1.0, 5.15, 0);
  add(lamp, new THREE.SphereGeometry(0.13, 16, 12), M.bulb, 1.0, 5.02, 0);
  const streetSpot = new THREE.SpotLight(0xffc98a, 90, 22, 0.95, 0.7, 1.7); streetSpot.position.set(-4.2, 5.0, 12.6); streetSpot.target.position.set(-1.5, 0, 4); streetSpot.castShadow = true; streetSpot.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024); streetSpot.shadow.bias = -0.0004; scene.add(streetSpot, streetSpot.target);

  // ---------- storefront ----------
  const rectPath = (x1, y1, x2, y2) => { const p = new THREE.Path(); p.moveTo(x1, y1); p.lineTo(x2, y1); p.lineTo(x2, y2); p.lineTo(x1, y2); p.closePath(); return p; };
  const shape = new THREE.Shape(); shape.moveTo(-7, 0); shape.lineTo(7, 0); shape.lineTo(7, 5.6); shape.lineTo(-7, 5.6); shape.closePath();
  shape.holes.push(rectPath(-0.7, 0.04, 0.7, 2.95), rectPath(-4.8, 0.75, -1.15, 2.95), rectPath(1.15, 0.75, 4.8, 2.95));
  add(scene, new THREE.ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: false }), M.brick, 0, 0, -0.34);
  // cornice and neighbours
  add(scene, rb(14.2, 0.28, 0.5, 0.04), M.navyPaint, 0, 5.62, -0.1);
  add(scene, rb(14.4, 0.1, 0.6, 0.03), M.agedBrass, 0, 5.8, -0.08);
  for (const s of [-1, 1]) {
    add(scene, new THREE.BoxGeometry(10, 7.2, 0.5), M.brickDark, s * 12, 3.6, -0.5);
    for (const wx of [-3, 0, 3]) for (const wy of [2, 5]) {
      add(scene, rb(1.3, 1.7, 0.1, 0.02), std(0x0e1220, 0.15, 0.6), s * 12 + wx, wy, -0.22);
      add(scene, rb(1.5, 0.12, 0.2, 0.02), std(0x8a8275, 0.8), s * 12 + wx, wy - 0.92, -0.2);
    }
  }
  // shopfront joinery: bulkheads, frames, transoms
  for (const cx of [-2.975, 2.975]) {
    add(scene, rb(3.75, 0.72, 0.16, 0.03), M.navyPaint, cx, 0.39, -0.12);
    add(scene, rb(3.2, 0.42, 0.04, 0.02), M.navyPaint, cx, 0.39, -0.03);
    add(scene, rb(3.85, 0.09, 0.4, 0.02), M.walnut, cx, 0.77, -0.06);
    add(scene, rb(3.75, 0.1, 0.12, 0.02), M.navyPaint, cx, 2.45, -0.16);
    for (const dx of [-1.82, 0, 1.82]) add(scene, rb(0.09, 2.2, 0.12, 0.02), M.navyPaint, cx + dx, 1.85, -0.16);
    add(scene, new THREE.PlaneGeometry(3.6, 1.65), M.glass, cx, 1.6, -0.17);
    add(scene, new THREE.PlaneGeometry(3.6, 0.45), M.glass, cx, 2.7, -0.17);
  }
  for (const x of [-0.74, 0.74]) add(scene, rb(0.1, 2.95, 0.4, 0.02), M.navyPaint, x, 1.48, -0.12);
  add(scene, rb(1.58, 0.12, 0.4, 0.02), M.navyPaint, 0, 2.5, -0.12);
  add(scene, new THREE.PlaneGeometry(1.36, 0.4), M.glass, 0, 2.73, -0.17);
  add(scene, rb(1.5, 0.05, 0.5, 0.02), M.brass, 0, 0.03, -0.1);

  // gold-leaf window lettering, hours decal, neon OPEN
  const lettering = (l1, l2) => tex(1024, 400, (x, w, h) => {
    x.textAlign = 'center';
    const gold = x.createLinearGradient(0, 60, 0, 200); gold.addColorStop(0, '#f6e2a3'); gold.addColorStop(0.5, '#c99a3c'); gold.addColorStop(1, '#f1d98f');
    x.lineWidth = 8; x.strokeStyle = '#2a1a08'; x.font = '150px "Alfa Slab One", Georgia, serif'; x.strokeText(l1, w / 2, 190); x.fillStyle = gold; x.fillText(l1, w / 2, 190);
    x.font = '700 54px "Work Sans", Arial, sans-serif'; x.lineWidth = 5; x.strokeText(l2, w / 2, 290); x.fillStyle = '#e8cf86'; x.fillText(l2, w / 2, 290);
  });
  const decal = (t, w, h, x, y, z) => add(scene, new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.3, metalness: 0.6, depthWrite: false }), x, y, z);
  decal(lettering('HAIRCUTS', '$45  ·  FADES  ·  RAZOR FINISH'), 3.0, 1.17, -2.975, 1.95, -0.155);
  decal(lettering('BARBERS', 'WALK-INS WELCOME  ·  CASH PREFERRED'), 3.0, 1.17, 2.975, 1.95, -0.155);
  const neonOpen = tex(512, 200, (x, w, h) => {
    x.textAlign = 'center'; x.font = '120px "Alfa Slab One", Georgia, serif';
    x.shadowColor = '#ff2a1a'; x.shadowBlur = 40; x.fillStyle = '#ff6a50'; x.fillText('OPEN', w / 2, 145); x.shadowBlur = 0; x.fillStyle = '#ffd0c0'; x.fillText('OPEN', w / 2, 145);
  });
  add(scene, new THREE.PlaneGeometry(1.0, 0.39), new THREE.MeshBasicMaterial({ map: neonOpen, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 3.9, 1.2, -0.25);

  // painted wood sign with gooseneck lamps
  const signTex = tex(2048, 420, (x, w, h) => {
    x.fillStyle = '#1c2640'; x.fillRect(0, 0, w, h);
    const r = seeded(9); grain(x, w, h, r, 40000, 0.18, true, 2);
    x.strokeStyle = '#b8913f'; x.lineWidth = 16; x.strokeRect(24, 24, w - 48, h - 48); x.lineWidth = 4; x.strokeRect(52, 52, w - 104, h - 104);
    const gold = x.createLinearGradient(0, 80, 0, 270); gold.addColorStop(0, '#f8e7ae'); gold.addColorStop(0.55, '#c4923a'); gold.addColorStop(1, '#efd48a');
    x.textAlign = 'center'; x.font = '200px "Alfa Slab One", Georgia, serif';
    x.fillStyle = '#0b0f1c'; x.fillText("WYATT'S", w / 2 + 8, 258); x.fillStyle = gold; x.fillText("WYATT'S", w / 2, 250);
    x.font = '700 62px "Work Sans", Arial, sans-serif'; x.fillStyle = '#efe3c6'; x.fillText('B A R B E R S H O P   ·   E A S T   A U S T I N', w / 2, 352);
  });
  const signFace = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55, metalness: 0.1 });
  add(scene, rb(6.4, 1.32, 0.16, 0.03), [M.navyPaint, M.navyPaint, M.navyPaint, M.navyPaint, signFace, M.navyPaint].map((m, i) => i === 4 ? signFace : m), 0, 4.0, 0.05);
  const signGroup = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.24, 0.02), signFace); signGroup.position.set(0, 4.0, 0.14); scene.add(signGroup);
  for (const sx of [-2.2, 0, 2.2]) {
    const g = new THREE.Group(); g.position.set(sx, 4.9, 0.05); scene.add(g);
    const neck = add(g, new THREE.TorusGeometry(0.32, 0.018, 8, 24, Math.PI / 2), M.black, 0, 0, 0); neck.rotation.y = Math.PI / 2; neck.position.set(0, -0.02, 0.32); neck.rotation.z = Math.PI;
    const shade = add(g, new THREE.ConeGeometry(0.17, 0.2, 24, 1, true), std(0x16203a, 0.45, 0.4, { side: THREE.DoubleSide }), 0, 0.02, 0.62); shade.rotation.x = -2.3;
    add(g, new THREE.SphereGeometry(0.06, 12, 10), M.bulb, 0, -0.03, 0.6);
    const sl = new THREE.SpotLight(0xffe0b0, 14, 4, 0.9, 0.7, 1.5); sl.position.set(sx, 4.85, 0.68); sl.target.position.set(sx, 3.7, 0); scene.add(sl, sl.target);
  }

  // scalloped striped awnings
  const awnColor = tex(512, 160, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#efe4cc' : '#8e1c22'; x.fillRect(i * 32, 0, 32, h); } const r = seeded(4); grain(x, w, h, r, 6000, 0.18, false, 2); });
  const awnAlpha = tex(512, 160, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h - 26); for (let i = 0; i < 16; i++) { x.beginPath(); x.arc(i * 32 + 16, h - 26, 16, 0, Math.PI); x.fill(); } });
  awnAlpha.colorSpace = THREE.NoColorSpace;
  for (const cx of [-2.975, 2.975]) {
    const g = new THREE.PlaneGeometry(3.95, 1.4, 16, 6);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + 2) * 5) * 0.015 - (p.getY(i) + 0.7) ** 2 * 0.05); g.computeVertexNormals();
    const a = add(scene, g, std(0xffffff, 0.85, 0, { map: awnColor, alphaMap: awnAlpha, alphaTest: 0.5, side: THREE.DoubleSide }), cx, 3.35, 0.5); a.rotation.x = -1.0;
    add(scene, new THREE.CylinderGeometry(0.02, 0.02, 3.95, 8).rotateZ(Math.PI / 2), M.black, cx, 3.0, 1.06);
  }

  // the door: wood with glass, kick plate, push bar, mail slot, hours decal; hinged left, swings in
  const door = new THREE.Group(); door.position.set(-0.66, 0.05, -0.2); scene.add(door);
  add(door, rb(1.32, 1.12, 0.07, 0.015), M.redPaint, 0.66, 0.56, 0);
  add(door, rb(1.0, 0.72, 0.02, 0.01), M.redPaint, 0.66, 0.6, 0.04);
  add(door, rb(1.28, 0.24, 0.075, 0.01), M.brass, 0.66, 0.13, 0.002);
  for (const dx of [0.07, 1.25]) add(door, rb(0.14, 1.75, 0.07, 0.015), M.redPaint, dx, 1.98, 0);
  add(door, rb(1.32, 0.14, 0.07, 0.015), M.redPaint, 0.66, 2.83, 0);
  add(door, new THREE.PlaneGeometry(1.04, 1.62), M.glass, 0.66, 1.96, 0);
  add(door, rb(0.36, 0.05, 0.03, 0.01), M.brass, 0.66, 0.92, 0.05);
  const pushBar = add(door, new THREE.CylinderGeometry(0.022, 0.022, 0.9, 12).rotateZ(Math.PI / 2), M.brass, 0.66, 1.2, 0.11);
  for (const dx of [0.24, 1.08]) add(door, new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8).rotateX(Math.PI / 2), M.brass, dx, 1.2, 0.07);
  const hours = tex(512, 512, (x, w, h) => {
    x.textAlign = 'center'; x.fillStyle = '#f2e6c8';
    x.font = '700 46px "Work Sans", Arial, sans-serif'; x.fillText('HOURS', w / 2, 70);
    x.font = '500 36px "Work Sans", Arial, sans-serif';
    [['MON – FRI', '8 – 8'], ['SATURDAY', '8 – 1'], ['SUNDAY', 'CLOSED']].forEach(([d, t], i) => { x.textAlign = 'left'; x.fillText(d, 60, 160 + i * 70); x.textAlign = 'right'; x.fillText(t, w - 60, 160 + i * 70); });
    x.textAlign = 'center'; x.font = '700 34px "Work Sans", Arial, sans-serif'; x.fillStyle = '#d4b26a'; x.fillText('CASH PREFERRED', w / 2, 420);
  });
  add(door, new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: hours, transparent: true, depthWrite: false }), 0.66, 1.75, 0.012);
  add(door, new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: neonOpen, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0.66, 2.25, -0.03);

  // barber pole on a wall bracket
  const poleStripes = tex(256, 512, (x, w, h) => {
    x.fillStyle = '#fbf6ec'; x.fillRect(0, 0, w, h);
    const band = (y, color) => { x.fillStyle = color; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y - 128); x.lineTo(w, y - 84); x.lineTo(0, y + 44); x.closePath(); x.fill(); };
    for (let y = -256; y < h + 256; y += 128) { band(y, '#a3242a'); band(y + 64, '#1f2a44'); }
  });
  poleStripes.wrapS = poleStripes.wrapT = THREE.RepeatWrapping;
  const makePole = withStand => {
    const g = new THREE.Group();
    if (withStand) { add(g, new THREE.CylinderGeometry(0.28, 0.32, 0.08, 32), M.brass, 0, 0.04, 0); add(g, new THREE.CylinderGeometry(0.05, 0.07, 0.5, 16), M.brass, 0, 0.32, 0); }
    add(g, new THREE.CylinderGeometry(0.24, 0.2, 0.16, 32), M.chrome, 0, 0.6, 0);
    add(g, new THREE.SphereGeometry(0.06, 16, 10), M.chrome, 0, 0.48, 0);
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 1.4, 48, 1, true), std(0xffffff, 0.35, 0, { map: poleStripes, emissive: 0xffffff, emissiveMap: poleStripes, emissiveIntensity: 0.25 }), 0, 1.38, 0);
    add(g, new THREE.CylinderGeometry(0.2, 0.2, 1.4, 48, 1, true), M.glass, 0, 1.38, 0);
    add(g, new THREE.CylinderGeometry(0.2, 0.24, 0.16, 32), M.chrome, 0, 2.16, 0);
    add(g, new THREE.SphereGeometry(0.15, 32, 16), M.frosted, 0, 2.34, 0);
    return g;
  };
  const outPole = makePole(false); outPole.position.set(1.12, 0.35, 0.38); outPole.scale.setScalar(0.8); scene.add(outPole);
  for (const y of [0.85, 2.05]) { add(scene, rb(0.08, 0.08, 0.36, 0.02), M.chrome, 1.12, y, 0.16); add(scene, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16).rotateX(Math.PI / 2), M.chrome, 1.12, y, -0.0); }
  const poleGlow = new THREE.PointLight(0xffe0b0, 2.5, 3, 1.6); poleGlow.position.set(1.12, 2.3, 0.7); scene.add(poleGlow);

  // sidewalk bench and planter
  const bench = new THREE.Group(); bench.position.set(-3.0, 0, 0.75); scene.add(bench);
  for (let i = 0; i < 4; i++) add(bench, rb(1.8, 0.035, 0.09, 0.01), M.walnut, 0, 0.46, -0.16 + i * 0.11);
  for (let i = 0; i < 3; i++) add(bench, rb(1.8, 0.09, 0.03, 0.01), M.walnut, 0, 0.62 + i * 0.12, -0.24);
  for (const s of [-0.75, 0.75]) { add(bench, rb(0.05, 0.46, 0.4, 0.01), M.black, s, 0.23, -0.02); add(bench, rb(0.05, 0.4, 0.05, 0.01), M.black, s, 0.68, -0.25); }
  const planter = new THREE.Group(); planter.position.set(5.2, 0, 0.6); scene.add(planter);
  add(planter, rb(0.6, 0.6, 0.6, 0.04), M.navyPaint, 0, 0.3, 0);
  for (let i = 0; i < 14; i++) { const r = seeded(i + 3); add(planter, new THREE.IcosahedronGeometry(0.18 + r() * 0.08, 1), r() > .5 ? M.plant : M.plantLight, (r() - .5) * 0.4, 0.75 + r() * 0.35, (r() - .5) * 0.4); }

  // ---------- interior shell ----------
  const W = 4, D = 10, H = 3.6, Z0 = -0.34;
  const floor = add(scene, new THREE.PlaneGeometry(2 * W, D), M.tile, 0, 0.004, Z0 - D / 2); floor.rotation.x = -Math.PI / 2;
  const ceil = add(scene, new THREE.PlaneGeometry(2 * W, D), M.tin, 0, H, Z0 - D / 2); ceil.rotation.x = Math.PI / 2;
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    add(g, new THREE.PlaneGeometry(len, H - 1.2), M.plaster, 0, 1.2 + (H - 1.2) / 2, 0);
    const b = add(g, new THREE.PlaneGeometry(len, 1.2), M.bead, 0, 0.6, 0.02);
    b.material = M.bead;
    add(g, rb(len, 0.08, 0.06, 0.015), M.walnut, 0, 1.2, 0.05);
    add(g, rb(len, 0.14, 0.03, 0.01), M.walnut, 0, 0.07, 0.035);
    add(g, rb(len, 0.12, 0.08, 0.02), M.walnut, 0, H - 0.06, 0.04);
    return g;
  };
  wall(D, -W, Z0 - D / 2, Math.PI / 2);
  wall(D, W, Z0 - D / 2, -Math.PI / 2);
  const backWall = wall(2 * W, 0, Z0 - D, 0);
  // inner face of the front wall
  const inner = new THREE.Shape(); inner.moveTo(-W, 0); inner.lineTo(W, 0); inner.lineTo(W, H); inner.lineTo(-W, H); inner.closePath();
  inner.holes.push(rectPath(-0.7, 0.04, 0.7, 2.95), rectPath(-W + 0.01, 0.75, -1.15, 2.95), rectPath(1.15, 0.75, W - 0.01, 2.95));
  const innerWall = add(scene, new THREE.ShapeGeometry(inner), M.plaster, 0, 0, Z0 - 0.01); innerWall.rotation.y = Math.PI;
  innerWall.scale.x = -1;

  // ---------- barber stations (left wall) ----------
  const CHAIR_Z = [-3.2, -6.6];
  const makeChair = () => {
    const c = new THREE.Group();
    const base = add(c, new THREE.CylinderGeometry(0.5, 0.56, 0.12, 48), M.enamel, 0, 0.06, 0); base.scale.z = 0.82;
    add(c, new THREE.TorusGeometry(0.53, 0.015, 8, 48), M.chrome, 0, 0.12, 0).rotation.x = Math.PI / 2;
    add(c, new THREE.CylinderGeometry(0.11, 0.14, 0.1, 24), M.chrome, 0, 0.17, 0);
    for (let i = 0; i < 5; i++) add(c, new THREE.TorusGeometry(0.115, 0.02, 8, 24), M.rubber, 0, 0.24 + i * 0.045, 0).rotation.x = Math.PI / 2;
    add(c, new THREE.CylinderGeometry(0.1, 0.1, 0.18, 24), M.chrome, 0, 0.53, 0);
    const pedal = add(c, rb(0.26, 0.04, 0.08, 0.015), M.chrome, 0.3, 0.14, 0.25); pedal.rotation.y = -0.6;
    add(c, rb(0.96, 0.14, 0.86, 0.06), M.enamel, 0, 0.66, 0);
    add(c, rb(0.9, 0.17, 0.82, 0.08, 4), M.leather, 0, 0.81, 0.01);
    add(c, rb(0.92, 0.025, 0.84, 0.01), M.chrome, 0, 0.73, 0.01);
    const back = new THREE.Group(); back.position.set(0, 1.0, -0.4); back.rotation.x = -0.18; c.add(back);
    add(back, rb(0.92, 1.02, 0.1, 0.05), M.enamel, 0, 0.45, -0.05);
    add(back, rb(0.82, 0.92, 0.14, 0.07, 4), M.leather, 0, 0.45, 0.04);
    const tuft = std(0x4a0c10, 0.5);
    for (const bx of [-0.25, 0, 0.25]) for (const by of [0.15, 0.42, 0.69]) add(back, new THREE.SphereGeometry(0.018, 10, 8), tuft, bx, by, 0.11);
    for (const bx of [-0.125, 0.125]) for (const by of [0.285, 0.555]) add(back, new THREE.SphereGeometry(0.018, 10, 8), tuft, bx, by, 0.11);
    add(back, new THREE.CylinderGeometry(0.02, 0.02, 0.34, 10), M.chrome, 0, 1.05, -0.04);
    add(back, rb(0.46, 0.18, 0.12, 0.06, 4), M.leather, 0, 1.22, 0.0);
    add(back, new THREE.SphereGeometry(0.03, 12, 10), M.black, 0.08, 0.96, -0.04);
    for (const s of [-1, 1]) {
      add(c, rb(0.08, 0.3, 0.7, 0.03), M.enamel, s * 0.5, 0.86, 0.0);
      add(c, rb(0.14, 0.07, 0.76, 0.035), M.walnut, s * 0.53, 1.04, 0.0);
      add(c, new THREE.SphereGeometry(0.045, 16, 12), M.chrome, s * 0.53, 1.04, 0.39);
      const strut = add(c, rb(0.04, 0.04, 0.52, 0.015), M.chrome, s * 0.26, 0.47, 0.6); strut.rotation.x = 0.72;
    }
    const foot = add(c, rb(0.66, 0.035, 0.24, 0.015), M.chrome, 0, 0.27, 0.78);
    for (let i = 0; i < 7; i++) add(c, rb(0.6, 0.012, 0.012, 0.004), M.rubber, 0, 0.29, 0.69 + i * 0.03);
    const lever = add(c, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), M.chrome, -0.55, 0.85, -0.22); lever.rotation.z = 0.35;
    add(c, new THREE.SphereGeometry(0.035, 12, 10), M.black, -0.62, 1.05, -0.22);
    return c;
  };
  const contactTex = tex(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const contact = (x, z, sx, sz) => { const m = add(scene, new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }), x, 0.008, z); m.rotation.x = -Math.PI / 2; };

  const bottle = (parent, x, y, z, color, h = 0.24, r = 0.045, opacity = 0.8) => {
    add(parent, new THREE.CylinderGeometry(r, r, h, 20), new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, transparent: true, opacity, clearcoat: 1 }), x, y + h / 2, z);
    add(parent, new THREE.CylinderGeometry(r * 0.45, r * 0.6, h * 0.25, 16), M.black, x, y + h + h * 0.12, z);
  };
  const stationLabel = tex(256, 128, (x, w, h) => { x.fillStyle = '#efe3c6'; x.fillRect(0, 0, w, h); x.fillStyle = '#7e1a1f'; x.textAlign = 'center'; x.font = '700 44px "Work Sans", Arial'; x.fillText('POMADE', w / 2, 76); });

  for (const [k, z] of CHAIR_Z.entries()) {
    const st = new THREE.Group(); st.position.set(-W, 0, z); scene.add(st);
    // cabinet + counter
    add(st, rb(0.5, 0.92, 1.5, 0.02), M.walnut, 0.27, 0.48, 0);
    for (const dz of [-0.37, 0.37]) { add(st, rb(0.02, 0.36, 0.66, 0.01), M.walnut, 0.53, 0.7, dz); add(st, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8).rotateX(Math.PI / 2), M.brass, 0.56, 0.7, dz); add(st, rb(0.02, 0.36, 0.66, 0.01), M.walnut, 0.53, 0.3, dz); add(st, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8).rotateX(Math.PI / 2), M.brass, 0.56, 0.3, dz); }
    add(st, rb(0.6, 0.05, 1.62, 0.015), std(0xe8e0d0, 0.15, 0, { }), 0.3, 0.96, 0);
    // mirror with frame and sconces
    add(st, rb(0.06, 1.85, 1.38, 0.02), M.walnut, 0.03, 2.08, 0);
    add(st, rb(0.03, 1.72, 1.25, 0.01), M.agedBrass, 0.06, 2.08, 0);
    let mirror;
    if (!small) { mirror = new Reflector(new THREE.PlaneGeometry(1.15, 1.62), { clipBias: 0.003, textureWidth: 768, textureHeight: 1080, color: 0xb5bdc0 }); }
    else mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.62), new THREE.MeshPhysicalMaterial({ color: 0xc9d3d8, metalness: 1, roughness: 0.02 }));
    mirror.position.set(0.085, 2.08, 0); mirror.rotation.y = Math.PI / 2; st.add(mirror);
    for (const dz of [-0.82, 0.82]) {
      add(st, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16).rotateZ(Math.PI / 2), M.brass, 0.02, 2.55, dz);
      add(st, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8).rotateZ(Math.PI / 2), M.brass, 0.12, 2.55, dz);
      add(st, new THREE.CylinderGeometry(0.07, 0.05, 0.16, 16, 1, true), M.frosted, 0.22, 2.62, dz);
    }
    const sconce = new THREE.PointLight(0xffd8a0, 0.7, 3.5, 1.8); sconce.position.set(0.4, 2.6, 0); st.add(sconce);
    // tools on the counter
    const jarX = 0.3, top = 0.985;
    add(st, new THREE.CylinderGeometry(0.075, 0.075, 0.3, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.25, clearcoat: 1 }), jarX, top + 0.15, -0.5);
    add(st, new THREE.CylinderGeometry(0.068, 0.068, 0.22, 24), new THREE.MeshPhysicalMaterial({ color: 0x1e7fd0, roughness: 0.05, transparent: true, opacity: 0.75, emissive: 0x0a3a66, emissiveIntensity: 0.4 }), jarX, top + 0.11, -0.5);
    add(st, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 24), M.chrome, jarX, top + 0.31, -0.5);
    for (let i = 0; i < 4; i++) add(st, rb(0.006, 0.02, 0.17, 0.002), M.black, jarX - 0.03 + i * 0.02, top + 0.33, -0.5).rotation.x = 0.2;
    bottle(st, 0.22, top, -0.22, 0x8a4a12, 0.22, 0.04, 0.85);
    bottle(st, 0.32, top, -0.14, 0x2e7d32, 0.18, 0.035, 0.8);
    bottle(st, 0.2, top, 0.55, 0xf4f1ea, 0.26, 0.045, 0.95);
    const clip = add(st, rb(0.07, 0.05, 0.2, 0.024, 4), M.black, 0.36, top + 0.025, 0.18); clip.rotation.y = 0.4 + k;
    add(st, rb(0.05, 0.012, 0.03, 0.004), M.chrome, 0.36 + Math.sin(0.4 + k) * 0.11, top + 0.03, 0.18 + Math.cos(0.4 + k) * 0.11);
    const cord = new THREE.CatmullRomCurve3([V(0.36, top + 0.02, 0.06), V(0.3, top + 0.01, -0.02), V(0.42, top + 0.005, -0.1), V(0.55, top - 0.05, -0.2), V(0.56, 0.6, -0.25)]);
    add(st, new THREE.TubeGeometry(cord, 40, 0.007, 8), M.black);
    for (let i = 0; i < 4; i++) add(st, rb(0.3, 0.035, 0.22, 0.015, 2), M.white, 0.3, top + 0.02 + i * 0.036, 0.36 + (i % 2) * 0.01);
    const tin = add(st, new THREE.CylinderGeometry(0.05, 0.05, 0.035, 20), [new THREE.MeshStandardMaterial({ map: stationLabel, roughness: 0.4 }), M.brass, M.brass], 0.38, top + 0.018, -0.32);
    add(st, rb(0.18, 0.006, 0.03, 0.002), M.black, 0.26, top + 0.004, 0.02).rotation.y = 0.3;
    // the chair and floor details
    const ch = makeChair(); ch.position.set(1.65, 0, 0); ch.rotation.y = Math.PI / 2; st.add(ch);
    contact(-W + 1.65, z, 1.3, 1.3); contact(-W + 0.27, z, 0.8, 1.7);
    // cape on a hook
    add(st, new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8).rotateZ(Math.PI / 2), M.brass, 0.05, 1.62, 0.82);
    const capeG = new THREE.PlaneGeometry(0.35, 0.7, 8, 12); const cp = capeG.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 18) * 0.02 + Math.max(0, -cp.getY(i)) * 0.04); capeG.computeVertexNormals();
    const cape = add(st, capeG, std(0x1c2640, 0.85, 0, { side: THREE.DoubleSide }), 0.08, 1.3, 0.82); cape.rotation.y = Math.PI / 2;
    // hair clippings around the first chair
    if (k === 0) {
      const n = 260, hair = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.002, 0.004), std(0x2a1c12, 0.8), n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), r = seeded(77);
      for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 0.2 + r() * 0.65; q.setFromEuler(new THREE.Euler(0, r() * 6.28, 0)); m4.compose(V(1.65 + Math.cos(a) * d, 0.006, Math.sin(a) * d), q, V(0.5 + r(), 1, 1)); hair.setMatrixAt(i, m4); }
      st.add(hair);
    }
  }

  // ---------- waiting area (right wall) ----------
  const wa = new THREE.Group(); wa.position.set(W, 0, -4.9); scene.add(wa);
  add(wa, rb(0.78, 0.36, 4.3, 0.03), M.walnut, -0.42, 0.25, 0);
  for (const dz of [-2.05, 2.05]) for (const dx of [-0.75, -0.1]) add(wa, new THREE.CylinderGeometry(0.03, 0.025, 0.12, 12), M.brass, dx, 0.06, dz * 0.98);
  for (const dz of [-1.42, 0, 1.42]) {
    add(wa, rb(0.72, 0.16, 1.36, 0.07, 4), M.leather, -0.44, 0.5, dz);
    add(wa, rb(0.06, 0.04, 1.3, 0.02), std(0x4a0c10, 0.5), -0.8, 0.52, dz);
  }
  add(wa, rb(0.18, 0.62, 4.3, 0.08, 4), M.leather, -0.08, 0.86, 0);
  const tuftB = std(0x4a0c10, 0.5);
  for (let i = 0; i < 14; i++) add(wa, new THREE.SphereGeometry(0.016, 8, 6), tuftB, -0.175, 0.82 + (i % 2) * 0.16, -2.0 + i * 0.3);
  for (const dz of [-2.18, 2.18]) add(wa, rb(0.8, 0.5, 0.12, 0.04), M.walnut, -0.42, 0.6, dz);
  contact(W - 0.42, -4.9, 1.0, 4.5);
  // coffee table with magazines and a record sleeve
  const tbl = new THREE.Group(); tbl.position.set(W - 1.55, 0, -4.9); scene.add(tbl);
  add(tbl, rb(0.7, 0.05, 1.3, 0.02), M.walnut, 0, 0.45, 0);
  for (const [dx, dz] of [[-0.3, -0.58], [0.3, -0.58], [-0.3, 0.58], [0.3, 0.58]]) add(tbl, new THREE.CylinderGeometry(0.022, 0.016, 0.43, 10), M.brass, dx, 0.215, dz);
  const cover = (bg, title) => tex(256, 340, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '700 40px "Alfa Slab One", Georgia'; x.fillText(title, 16, 56); const r = seeded(bg.length * 7); for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.3})`; x.fillRect(16, 90 + i * 34, 90 + r() * 120, 12); } x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(16, 300, w - 32, 4); });
  [['#a3242a', 'GQ', -0.1, -0.25, 0.3], ['#1c2640', 'ESQ', 0.08, -0.08, -0.2], ['#c9a253', 'LIFE', -0.05, 0.35, 0.1]].forEach(([bg, t, dx, dz, ry], i) => {
    const mg = add(tbl, new THREE.BoxGeometry(0.22, 0.008, 0.29), [M.white, M.white, new THREE.MeshStandardMaterial({ map: cover(bg, t), roughness: 0.4 }), M.white, M.white, M.white], dx, 0.48 + i * 0.009, dz); mg.rotation.y = ry;
  });
  contact(W - 1.55, -4.9, 1.0, 1.6);
  // record player and speakers on a cabinet (good music)
  const rp = new THREE.Group(); rp.position.set(W - 0.35, 0, -8.6); scene.add(rp);
  add(rp, rb(0.6, 0.78, 1.5, 0.02), M.walnut, 0, 0.39, 0);
  add(rp, rb(0.5, 0.08, 0.48, 0.02), M.walnut, -0.02, 0.82, 0.25);
  const platter = add(rp, new THREE.CylinderGeometry(0.17, 0.17, 0.015, 40), M.black, -0.02, 0.87, 0.25);
  const recLabel = tex(128, 128, (x, w) => { x.fillStyle = '#111'; x.fillRect(0, 0, w, w); x.fillStyle = '#a3242a'; x.beginPath(); x.arc(w / 2, w / 2, w * 0.18, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.08)'; for (let r = 30; r < 64; r += 3) { x.beginPath(); x.arc(w / 2, w / 2, r, 0, 7); x.stroke(); } });
  add(rp, new THREE.CylinderGeometry(0.16, 0.16, 0.004, 40), [M.black, new THREE.MeshStandardMaterial({ map: recLabel, roughness: 0.3 }), M.black], -0.02, 0.88, 0.25);
  const tonearm = add(rp, new THREE.CylinderGeometry(0.006, 0.006, 0.26, 8), M.chrome, -0.14, 0.9, 0.36); tonearm.rotation.x = Math.PI / 2; tonearm.rotation.z = 0.5;
  for (const dz of [-0.45, 0.72]) {
    add(rp, rb(0.34, 0.56, 0.32, 0.02), M.walnut, -0.05, 1.06, dz);
    add(rp, new THREE.CylinderGeometry(0.1, 0.1, 0.01, 24).rotateZ(Math.PI / 2), std(0x2a2522, 0.95), -0.225, 1.0, dz);
    add(rp, new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16).rotateZ(Math.PI / 2), std(0x2a2522, 0.95), -0.225, 1.22, dz);
  }
  contact(W - 0.35, -8.6, 0.9, 1.8);
  // tall plant
  const pl = new THREE.Group(); pl.position.set(W - 0.5, 0, -1.5); scene.add(pl);
  add(pl, new THREE.CylinderGeometry(0.22, 0.17, 0.42, 24), M.terracotta, 0, 0.21, 0);
  for (let i = 0; i < 16; i++) { const r = seeded(i + 40), leaf = add(pl, rb(0.06, 0.9 + r() * 0.5, 0.012, 0.005), i % 3 ? M.plant : M.plantLight, (r() - .5) * 0.18, 0.75 + r() * 0.2, (r() - .5) * 0.18); leaf.rotation.set((r() - .5) * 0.5, r() * 3, (r() - .5) * 0.5); }
  contact(W - 0.5, -1.5, 0.6, 0.6);
  // framed vintage photos above the bench
  const photo = seedN => tex(256, 320, (x, w, h) => {
    const r = seeded(seedN); x.fillStyle = '#d8c39a'; x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, w * 0.8); g.addColorStop(0, 'rgba(120,90,50,.1)'); g.addColorStop(1, 'rgba(60,40,20,.75)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,45,25,.75)'; x.beginPath(); x.ellipse(w / 2, h * 0.42, 52, 64, 0, 0, 7); x.fill(); x.fillRect(w / 2 - 80, h * 0.6, 160, h * 0.4);
    grain(x, w, h, r, 9000, 0.25, false, 2);
  });
  [-1.2, 0, 1.2].forEach((dz, i) => {
    add(wa, rb(0.04, 0.62, 0.5, 0.01), M.black, -0.02, 2.2 + (i % 2) * 0.12, dz);
    const p = add(wa, new THREE.PlaneGeometry(0.42, 0.54), new THREE.MeshStandardMaterial({ map: photo(i + 5), roughness: 0.6 }), -0.045, 2.2 + (i % 2) * 0.12, dz); p.rotation.y = -Math.PI / 2;
  });
  const benchLight = new THREE.PointLight(0xffd8a0, 1.2, 5, 1.8); benchLight.position.set(W - 1.2, 2.6, -4.9); scene.add(benchLight);

  // ---------- back wall: neon, wall clock, shelf of products, pole ----------
  const neon = tex(1024, 320, (x, w, h) => {
    x.textAlign = 'center'; x.font = 'italic 190px "Alfa Slab One", Georgia, serif';
    x.shadowColor = '#ff2a1a'; x.shadowBlur = 50; x.fillStyle = '#ff5a44'; x.fillText("Wyatt's", w / 2, 220); x.fillText("Wyatt's", w / 2, 220);
    x.shadowBlur = 0; x.lineWidth = 6; x.strokeStyle = '#ffd6c8'; x.strokeText("Wyatt's", w / 2, 220);
  });
  add(backWall, new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: neon, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 2.75, 0.06);
  const neonLight = new THREE.PointLight(0xff4a3a, 1.2, 4, 1.8); neonLight.position.set(0, 2.75, Z0 - D + 0.5); scene.add(neonLight);
  // shelf with products
  add(backWall, rb(2.2, 0.05, 0.28, 0.015), M.walnut, 0, 1.85, 0.16);
  for (const sx of [-0.95, 0.95]) add(backWall, rb(0.04, 0.16, 0.24, 0.01), M.brass, sx, 1.76, 0.14);
  const prodCols = [0xc9a253, 0x1c2640, 0xa3242a, 0xefe3c6, 0x2e7d32, 0x8a4a12];
  for (let i = 0; i < 11; i++) {
    const r = seeded(i + 90), c = prodCols[i % prodCols.length], tall = r() > 0.45;
    if (tall) bottle(backWall, -0.95 + i * 0.19, 1.875, 0.16, c, 0.18 + r() * 0.08, 0.035, 0.9);
    else add(backWall, new THREE.CylinderGeometry(0.06, 0.06, 0.07, 20), [std(c, 0.4, 0.3), M.brass, M.brass], -0.95 + i * 0.19, 1.91, 0.16);
  }
  // working wall clock
  const clock = new THREE.Group(); clock.position.set(-2.4, 2.65, 0.06); backWall.add(clock);
  const face = tex(512, 512, (x, w) => {
    const c = w / 2; x.fillStyle = '#f4ecd8'; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
    x.fillStyle = '#1c2640'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 52px "Work Sans", Arial';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; x.fillText(String(i), c + Math.sin(a) * (c - 70), c - Math.cos(a) * (c - 70)); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? 12 : 26; x.lineWidth = i % 5 ? 3 : 7; x.strokeStyle = '#1c2640'; x.beginPath(); x.moveTo(c + Math.sin(a) * (c - 18), c - Math.cos(a) * (c - 18)); x.lineTo(c + Math.sin(a) * (c - 18 - l), c - Math.cos(a) * (c - 18 - l)); x.stroke(); }
    x.font = '32px "Alfa Slab One", Georgia'; x.fillStyle = '#a3242a'; x.fillText("WYATT'S", c, c + 90);
  });
  add(clock, new THREE.CylinderGeometry(0.36, 0.36, 0.06, 48).rotateX(Math.PI / 2), M.agedBrass, 0, 0, 0);
  add(clock, new THREE.CircleGeometry(0.32, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.4 }), 0, 0, 0.032);
  add(clock, new THREE.CircleGeometry(0.33, 48), M.glass, 0, 0, 0.045);
  const hand = (len, wdt, color) => { const g = new THREE.Group(); g.position.z = 0.036; clock.add(g); add(g, new THREE.BoxGeometry(wdt, len, 0.006), std(color, 0.4, 0.3), 0, len / 2 - 0.03, 0); return g; };
  const hH = hand(0.17, 0.018, 0x111111), hM = hand(0.25, 0.012, 0x111111), hS = hand(0.27, 0.005, 0xa3242a);
  const inPole = makePole(true); inPole.position.set(W - 0.45, 0, Z0 - D + 0.45); scene.add(inPole); contact(W - 0.45, Z0 - D + 0.45, 0.7, 0.7);

  // ---------- ceiling: fan and schoolhouse pendants ----------
  const fan = new THREE.Group(); fan.position.set(0, H, -4.9); scene.add(fan);
  add(fan, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), M.agedBrass, 0, -0.03, 0);
  add(fan, new THREE.CylinderGeometry(0.018, 0.018, 0.5, 10), M.agedBrass, 0, -0.3, 0);
  add(fan, new THREE.CylinderGeometry(0.15, 0.12, 0.16, 24), M.agedBrass, 0, -0.6, 0);
  const blades = new THREE.Group(); blades.position.y = -0.64; fan.add(blades);
  for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.rotation.y = i * Math.PI / 2; blades.add(b); add(b, rb(0.62, 0.012, 0.15, 0.005), M.walnut, 0.48, 0, 0).rotation.x = 0.12; add(b, rb(0.18, 0.02, 0.04, 0.005), M.agedBrass, 0.12, 0.0, 0); }
  add(fan, new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.frosted, 0, -0.68, 0);
  for (const z of CHAIR_Z) {
    const pg = new THREE.Group(); pg.position.set(-W + 1.65, H, z); scene.add(pg);
    add(pg, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), M.agedBrass, 0, -0.015, 0);
    add(pg, new THREE.CylinderGeometry(0.006, 0.006, 0.75, 6), M.black, 0, -0.4, 0);
    add(pg, new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16), M.agedBrass, 0, -0.8, 0);
    add(pg, new THREE.SphereGeometry(0.15, 24, 18), M.frosted, 0, -0.95, 0);
    const l = new THREE.PointLight(0xffd8a0, 2.2, 7, 1.8); l.position.set(-W + 1.65, H - 1.1, z); scene.add(l);
  }

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2a1d12, 0.18));
  const moon = new THREE.DirectionalLight(0x9fb3d9, 0.5); moon.position.set(-6, 8, 10); scene.add(moon);
  const key = new THREE.SpotLight(0xffe2b8, 16, 12, 1.15, 0.85, 1.8);
  key.position.set(0.6, H - 0.1, -3.2); key.target.position.set(-1.6, 0, -4.6);
  key.castShadow = true; key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);
  const windowSpill = new THREE.PointLight(0xffd29a, 1.2, 9, 1.8); windowSpill.position.set(0, 2.2, -1.2); scene.add(windowSpill);

  // shadows on solid meshes only
  scene.traverse(o => { if (o.isMesh && !shadowless.has(o.material) && !(o.material && o.material.transparent) && !o.isReflector) { o.castShadow = true; o.receiveShadow = true; } });
  floor.castShadow = false; ceil.castShadow = false;

  // ---------- post-processing: subtle bloom on lamps and neon ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 0.97);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- camera path (time 0..1 = scroll through the section) ----------
  const KEYS = [
    [0.00, [0, 2.0, 11.5], [0, 2.6, 0]],      // storefront with the name
    [0.12, [0, 1.7, 6.2], [0, 1.85, 0]],      // walk up to the door
    [0.30, [0, 1.6, 2.0], [0, 1.5, -3]],      // door swings open
    [0.44, [0.1, 1.7, -1.1], [0, 1.45, -6]],  // step inside
    [0.60, [0.3, 2.45, -0.8], [-0.2, 0.95, -5.2]], // look around: chairs left, bench right
    [0.72, [0.3, 2.45, -0.8], [-0.2, 0.95, -5.2]], // hold while the seat count shows
    [0.86, [0.5, 1.6, -3.2], [-2.35, 1.1, -3.2]], // walk to the first chair
    [0.94, [0.2, 1.6, -3.2], [-2.35, 1.1, -3.2]], // stop in front of it
    [1.00, [0.2, 1.6, -3.2], [-2.35, 1.1, -3.2]]
  ].map(([t, p, l]) => ({ t, p: V(...p), l: V(...l) }));
  const look = V(0, 0, 0);
  const smooth = u => u * u * (3 - 2 * u);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function pose(t) {
    let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = smooth(clamp((t - a.t) / (b.t - a.t)));
    camera.position.lerpVectors(a.p, b.p, u); look.lerpVectors(a.l, b.l, u);
    if (small && t < 0.3) camera.position.z += (1 - t / 0.3) * 2.2;
    camera.lookAt(look);
    door.rotation.y = 1.8 * smooth(clamp((t - 0.1) / 0.2));
  }

  // ---------- overlays, progress, sizing ----------
  const overlays = [...sticky.querySelectorAll('.ov')].map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to }));
  const bar = sticky.querySelector('.bar i');
  const showOverlays = t => overlays.forEach(({ el, a, b }) => {
    const f = 0.03, o = a <= 0 ? clamp((b - t) / f) : clamp(Math.min((t - a) / f, (b - t) / f));
    el.style.opacity = o.toFixed(3); el.style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`; el.classList.toggle('on', o > 0.5);
  });
  section.classList.add('live');
  const resize = () => {
    const w = sticky.clientWidth, h = sticky.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(DPR);
    bloom.setSize(Math.round(w * DPR / 2), Math.round(h * DPR / 2));
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 64 : 48; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(sticky); resize();

  const target = () => { const r = section.getBoundingClientRect(), total = section.offsetHeight - sticky.offsetHeight; return clamp(-r.top / Math.max(1, total)); };
  let shown = target(), visible = true, raf = 0;
  const clockTick = () => { const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; hS.rotation.z = -s / 60 * Math.PI * 2; hM.rotation.z = -m / 60 * Math.PI * 2; hH.rotation.z = -h / 12 * Math.PI * 2; };
  const timer = new THREE.Clock();
  function frame() {
    raf = 0; if (!visible) return;
    const dt = Math.min(timer.getDelta(), 0.05), goal = target();
    shown += (goal - shown) * (reduce ? 1 : Math.min(1, dt * 6));
    if (Math.abs(goal - shown) < 0.0002) shown = goal;
    pose(shown); showOverlays(shown); bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    if (!reduce) { poleStripes.offset.y = (poleStripes.offset.y + dt * 0.22) % 1; blades.rotation.y += dt * 1.6; platter.rotation.y -= dt * 3.5; }
    clockTick();
    composer.render();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) { timer.getDelta(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(section);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) start(); });
  pose(shown); showOverlays(shown); clockTick(); composer.render(); start();
}

// "Add your picture" in the intro opens the Style Lab's photo picker; then show the lab.
const addPic = document.getElementById('introAddPic'), fileIn = document.getElementById('fileIn');
if (addPic && fileIn) {
  let fromIntro = false;
  addPic.addEventListener('click', () => { fromIntro = true; });
  addPic.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPic.click(); } });
  fileIn.addEventListener('change', () => { if (fromIntro) { fromIntro = false; setTimeout(() => document.getElementById('style-lab').scrollIntoView({ behavior: 'smooth' }), 100); } });
}
