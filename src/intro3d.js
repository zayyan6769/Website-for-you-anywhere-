/* ===== 3D walk-in intro (Three.js) =====
   Source for the bundled script inlined in index.html (run `npm run build` after editing).
   Scroll drives a camera from the storefront, through the opening door, around the shop
   and up to a barber chair. Without WebGL or the CDN, the intro stays a plain hero. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const section = document.getElementById('intro3d');
const sticky = section.querySelector('.sticky');
const canvas = document.getElementById('shopCanvas');
const small = matchMedia('(max-width: 700px)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { console.warn('3D intro disabled:', e); }
if (renderer) (document.fonts ? document.fonts.ready : Promise.resolve()).catch(() => {}).then(build);

function build() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2338);
  scene.fog = new THREE.Fog(0x1b2338, 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);

  // ---------- helpers & materials ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rb = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
  const add = (parent, g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; };
  const tex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x9b1f26, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const chrome = std(0xffffff, 0.12, 1);
  const brass = std(0xc9a253, 0.28, 1);
  const navy = std(0x1f2a44, 0.5, 0.1);
  const wood = std(0x5a3a22, 0.5);
  const cream = std(0xefe2c6, 0.85);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xfff3dd, roughness: 0.05, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });

  // ---------- outside: sidewalk, storefront, sign, awnings, door ----------
  const sidewalk = add(scene, new THREE.PlaneGeometry(40, 16), std(0x5f5a54, 0.95), 0, 0, 8); sidewalk.rotation.x = -Math.PI / 2;
  add(scene, new THREE.BoxGeometry(40, 0.14, 0.3), std(0x7a746c, 0.9), 0, 0.07, 14);

  const brick = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#d9c9a6'; x.fillRect(0, 0, w, h);
    const rows = 8, bh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 4; c++) {
      const off = r % 2 ? 32 : 0, shade = 225 + ((r * 7 + c * 13) % 5) * 5;
      x.fillStyle = `rgb(${shade},${shade - 14},${shade - 40})`; x.fillRect(c * 64 + off + 2, r * bh + 2, 60, bh - 4);
    }
  });
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping; brick.repeat.set(0.6, 0.6);
  const rect = (x1, y1, x2, y2) => { const p = new THREE.Path(); p.moveTo(x1, y1); p.lineTo(x2, y1); p.lineTo(x2, y2); p.lineTo(x1, y2); p.closePath(); return p; };
  const shape = new THREE.Shape(); shape.moveTo(-7, 0); shape.lineTo(7, 0); shape.lineTo(7, 5.2); shape.lineTo(-7, 5.2); shape.closePath();
  shape.holes.push(rect(-0.65, 0.06, 0.65, 2.5), rect(-4.7, 0.9, -1.3, 2.7), rect(1.3, 0.9, 4.7, 2.7));
  add(scene, new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), std(0xffffff, 0.9, 0, { map: brick }), 0, 0, -0.3);

  // trims
  for (const [x1, x2] of [[-7, -0.75], [0.75, 7]]) add(scene, new THREE.BoxGeometry(x2 - x1, 0.55, 0.36), navy, (x1 + x2) / 2, 0.27, -0.1);
  for (const cx of [-3, 3]) {
    add(scene, new THREE.BoxGeometry(3.6, 0.1, 0.42), brass, cx, 0.86, -0.05);            // sill
    add(scene, new THREE.BoxGeometry(3.5, 0.08, 0.06), navy, cx, 2.68, -0.16);            // head
    add(scene, new THREE.BoxGeometry(0.06, 1.8, 0.06), navy, cx, 1.8, -0.16);             // mullion
    add(scene, new THREE.PlaneGeometry(3.4, 1.8), glass, cx, 1.8, -0.15);
  }
  for (const x of [-0.7, 0.7]) add(scene, new THREE.BoxGeometry(0.1, 2.5, 0.38), wood, x, 1.25, -0.1);
  add(scene, new THREE.BoxGeometry(1.5, 0.12, 0.38), wood, 0, 2.55, -0.1);
  add(scene, new THREE.BoxGeometry(1.3, 0.04, 0.4), brass, 0, 0.05, -0.1);

  // gold-leaf window lettering
  const lettering = (lines) => tex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.fillStyle = '#d4b26a'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 4;
    x.font = '64px "Alfa Slab One", Georgia, serif'; x.fillText(lines[0], w / 2, 110);
    x.font = '600 34px "Work Sans", Arial, sans-serif'; x.fillText(lines[1], w / 2, 175);
  });
  for (const [cx, lines] of [[-3, ['HAIRCUTS', '$45 · 30 MIN']], [3, ['WALK-INS', 'WELCOME · CASH PREFERRED']]]) {
    add(scene, new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: lettering(lines), transparent: true, depthWrite: false }), cx, 1.85, -0.13);
  }

  // shop sign
  const signTex = tex(1024, 220, (x, w, h) => {
    x.fillStyle = '#1f2a44'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c9a253'; x.lineWidth = 10; x.strokeRect(14, 14, w - 28, h - 28);
    x.textAlign = 'center'; x.fillStyle = '#e6c77c';
    x.font = '96px "Alfa Slab One", Georgia, serif'; x.fillText("WYATT'S", w / 2, 118);
    x.font = '700 34px "Work Sans", Arial, sans-serif'; x.fillStyle = '#f4ead5'; x.fillText('B A R B E R S H O P   ·   A U S T I N ,  T X', w / 2, 178);
  });
  const signMats = [navy, navy, navy, navy, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 }), navy];
  add(scene, new THREE.BoxGeometry(5.6, 1.2, 0.14), signMats, 0, 3.75, 0.08);
  const signLight = new THREE.SpotLight(0xffe0b0, 30, 8, 0.7, 0.6); signLight.position.set(0, 5.4, 2.2); signLight.target.position.set(0, 3.7, 0); scene.add(signLight, signLight.target);

  // striped awnings
  const stripesTex = tex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4ead5' : '#a3242a'; x.fillRect(i * 32, 0, 32, h); } });
  for (const cx of [-3, 3]) { const a = add(scene, new THREE.PlaneGeometry(3.8, 1.25), std(0xffffff, 0.8, 0, { map: stripesTex, side: THREE.DoubleSide }), cx, 3.0, 0.42); a.rotation.x = -1.0; }

  // the door (hinged on the left, swings inward)
  const door = new THREE.Group(); door.position.set(-0.62, 0.06, -0.16); scene.add(door);
  const doorRed = new THREE.MeshPhysicalMaterial({ color: 0x8e1c22, roughness: 0.35, clearcoat: 0.6 });
  add(door, rb(1.24, 1.16, 0.07, 0.02), doorRed, 0.62, 0.58, 0);
  add(door, rb(0.12, 1.28, 0.07, 0.02), doorRed, 0.06, 1.8, 0);
  add(door, rb(0.12, 1.28, 0.07, 0.02), doorRed, 1.18, 1.8, 0);
  add(door, rb(1.24, 0.1, 0.07, 0.02), doorRed, 0.62, 2.39, 0);
  add(door, new THREE.PlaneGeometry(1.0, 1.2), glass, 0.62, 1.78, 0);
  const openTex = tex(256, 110, (x, w, h) => { x.fillStyle = '#151d31'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff5a4f'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#ff6a5f'; x.shadowColor = '#ff3b30'; x.shadowBlur = 18; x.textAlign = 'center'; x.font = '64px "Alfa Slab One", Georgia, serif'; x.fillText('OPEN', w / 2, 80); });
  add(door, new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshBasicMaterial({ map: openTex }), 0.62, 1.72, 0.04);
  add(door, new THREE.CylinderGeometry(0.025, 0.025, 0.28, 12), brass, 1.08, 1.12, 0.08);

  // ---------- barber pole ----------
  const poleStripes = tex(256, 512, (x, w, h) => {
    x.fillStyle = '#fbf6ec'; x.fillRect(0, 0, w, h);
    const band = (y, color) => { x.fillStyle = color; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y - 128); x.lineTo(w, y - 84); x.lineTo(0, y + 44); x.closePath(); x.fill(); };
    for (let y = -256; y < h + 256; y += 128) { band(y, '#a3242a'); band(y + 64, '#1f2a44'); }
  });
  poleStripes.wrapS = poleStripes.wrapT = THREE.RepeatWrapping;
  const makePole = (withStand) => {
    const g = new THREE.Group();
    if (withStand) { add(g, new THREE.CylinderGeometry(0.28, 0.32, 0.08, 32), brass, 0, 0.04, 0); add(g, new THREE.CylinderGeometry(0.06, 0.08, 0.5, 16), brass, 0, 0.32, 0); }
    add(g, new THREE.CylinderGeometry(0.24, 0.21, 0.14, 32), brass, 0, 0.6, 0);
    add(g, new THREE.CylinderGeometry(0.165, 0.165, 1.4, 48, 1, true), std(0xffffff, 0.35, 0, { map: poleStripes }), 0, 1.37, 0);
    add(g, new THREE.CylinderGeometry(0.2, 0.2, 1.4, 48, 1, true), glass, 0, 1.37, 0);
    add(g, new THREE.CylinderGeometry(0.21, 0.24, 0.14, 32), brass, 0, 2.14, 0);
    add(g, new THREE.SphereGeometry(0.14, 32, 16), std(0xfff6e0, 0.2, 0, { emissive: 0xffe2a8, emissiveIntensity: 1.8 }), 0, 2.31, 0);
    return g;
  };
  const outPole = makePole(false); outPole.position.set(1.02, 0.2, 0.32); outPole.scale.setScalar(0.85); scene.add(outPole);
  add(scene, new THREE.BoxGeometry(0.1, 0.1, 0.3), brass, 1.02, 0.75, 0.15);
  add(scene, new THREE.BoxGeometry(0.1, 0.1, 0.3), brass, 1.02, 2.05, 0.15);

  // ---------- inside the shop ----------
  const W = 4, D = 10, H = 3.6;
  const checker = tex(512, 512, (x, w) => { const n = 8, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#efe4cc' : '#1d1a16'; x.fillRect(i * s, j * s, s, s); } });
  checker.wrapS = checker.wrapT = THREE.RepeatWrapping; checker.repeat.set(4, 5);
  const floor = add(scene, new THREE.PlaneGeometry(2 * W, D), std(0xffffff, 0.28, 0.05, { map: checker }), 0, 0.005, -D / 2 - 0.3); floor.rotation.x = -Math.PI / 2;
  const ceil = add(scene, new THREE.PlaneGeometry(2 * W, D), std(0x3a2616, 0.8), 0, H, -D / 2 - 0.3); ceil.rotation.x = Math.PI / 2;
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    add(g, new THREE.PlaneGeometry(len, H - 1.15), cream, 0, 1.15 + (H - 1.15) / 2, 0);
    add(g, new THREE.BoxGeometry(len, 1.15, 0.05), navy, 0, 0.575, 0.02);
    add(g, new THREE.BoxGeometry(len, 0.06, 0.08), brass, 0, 1.17, 0.04);
    return g;
  };
  wall(D, -W, -D / 2 - 0.3, Math.PI / 2);
  wall(D, W, -D / 2 - 0.3, -Math.PI / 2);
  const back = wall(2 * W, 0, -D - 0.3, 0);

  // round shop badge on the back wall
  const badgeTex = tex(512, 512, (x, w) => {
    const c = w / 2; x.fillStyle = '#1f2a44'; x.beginPath(); x.arc(c, c, c - 4, 0, 7); x.fill();
    x.strokeStyle = '#c9a253'; x.lineWidth = 14; x.beginPath(); x.arc(c, c, c - 26, 0, 7); x.stroke();
    x.fillStyle = '#f4ead5'; x.beginPath(); x.arc(c, c, c - 110, 0, 7); x.fill();
    x.textAlign = 'center'; x.fillStyle = '#e6c77c'; x.font = '62px "Alfa Slab One", Georgia, serif'; x.fillText("WYATT'S", c, 92);
    x.fillStyle = '#a3242a'; x.font = '44px "Alfa Slab One", Georgia, serif'; x.fillText('BARBER', c, c + 6); x.fillText('SHOP', c, c + 56);
    x.fillStyle = '#e6c77c'; x.font = '700 30px "Work Sans", Arial, sans-serif'; x.fillText('AUSTIN · TX', c, w - 60);
  });
  add(back, new THREE.CircleGeometry(0.85, 64), std(0xffffff, 0.5, 0, { map: badgeTex }), 0, 2.35, 0.03);

  // barber chairs with mirrors and counters (left wall)
  const makeChair = () => {
    const c = new THREE.Group();
    add(c, new THREE.CylinderGeometry(0.5, 0.56, 0.1, 40), chrome, 0, 0.05, 0);
    add(c, new THREE.CylinderGeometry(0.12, 0.15, 0.52, 24), chrome, 0, 0.34, 0);
    add(c, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), navy, 0, 0.62, 0);
    add(c, rb(0.98, 0.22, 0.88, 0.09), leather, 0, 0.77, 0);
    const bk = add(c, rb(0.92, 1.0, 0.18, 0.09), leather, 0, 1.36, -0.42); bk.rotation.x = -0.16;
    const tuft = std(0x5c1216, 0.4);
    for (const bx of [-0.24, 0, 0.24]) for (const by of [-0.2, 0.12, 0.4]) add(bk, new THREE.SphereGeometry(0.024, 10, 8), tuft, bx, by, 0.09);
    add(c, new THREE.CylinderGeometry(0.024, 0.024, 0.24, 10), chrome, 0, 1.9, -0.54);
    add(c, rb(0.5, 0.22, 0.15, 0.07), leather, 0, 2.04, -0.56);
    for (const s of [-1, 1]) {
      add(c, rb(0.15, 0.09, 0.8, 0.04), wood, s * 0.58, 1.05, 0.02);
      add(c, new THREE.CylinderGeometry(0.026, 0.026, 0.28, 10), chrome, s * 0.58, 0.91, 0.3);
      add(c, rb(0.04, 0.28, 0.84, 0.02), chrome, s * 0.51, 0.76, 0);
      const st = add(c, rb(0.05, 0.05, 0.52, 0.02), chrome, s * 0.28, 0.5, 0.56); st.rotation.x = 0.75;
    }
    add(c, rb(0.68, 0.04, 0.22, 0.02), chrome, 0, 0.3, 0.74);
    return c;
  };
  const mirror = new THREE.MeshPhysicalMaterial({ color: 0xc9d3d8, metalness: 1, roughness: 0.03 });
  const CHAIR_Z = [-3.2, -6.6];
  for (const z of CHAIR_Z) {
    add(scene, rb(0.06, 1.75, 1.3, 0.02), brass, -W + 0.04, 2.0, z);
    add(scene, new THREE.BoxGeometry(0.02, 1.6, 1.15), mirror, -W + 0.08, 2.0, z);
    add(scene, rb(0.5, 0.08, 1.5, 0.02), wood, -W + 0.27, 1.06, z);
    add(scene, rb(0.46, 0.98, 1.4, 0.03), navy, -W + 0.26, 0.5, z);
    [[0x2e7d32, -0.45], [0xc9a253, -0.25], [0x1565c0, 0.4]].forEach(([col, dz]) => add(scene, new THREE.CylinderGeometry(0.05, 0.05, 0.24, 16), std(col, 0.2, 0.1, { transparent: true, opacity: 0.85 }), -W + 0.24, 1.22, z + dz));
    const ch = makeChair(); ch.position.set(-2.35, 0, z); ch.rotation.y = Math.PI / 2; scene.add(ch);
    // pendant lamp
    add(scene, new THREE.CylinderGeometry(0.01, 0.01, 0.8, 6), std(0x111111), -2.35, H - 0.4, z);
    add(scene, new THREE.ConeGeometry(0.3, 0.3, 32, 1, true), std(0xc9a253, 0.3, 1, { side: THREE.DoubleSide }), -2.35, H - 0.92, z);
    add(scene, new THREE.SphereGeometry(0.09, 16, 12), std(0xfff6e0, 0.2, 0, { emissive: 0xffe2a8, emissiveIntensity: 2 }), -2.35, H - 1.02, z);
    const l = new THREE.PointLight(0xffd8a0, 9, 7, 1.6); l.position.set(-2.35, H - 1.15, z); scene.add(l);
  }

  // waiting bench with 3 seats (right wall) + plant
  add(scene, rb(0.8, 0.42, 4.3, 0.04), wood, W - 0.45, 0.21, -4.9);
  for (const z of [-3.45, -4.9, -6.35]) add(scene, rb(0.74, 0.16, 1.32, 0.07), leather, W - 0.45, 0.5, z);
  add(scene, rb(0.16, 0.8, 4.3, 0.07), leather, W - 0.1, 0.95, -4.9);
  add(scene, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24), wood, W - 0.5, 0.62, -7.6);
  add(scene, new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), brass, W - 0.5, 0.3, -7.6);
  add(scene, new THREE.CylinderGeometry(0.16, 0.12, 0.28, 16), std(0xa3242a, 0.6), W - 0.5, 0.78, -7.6);
  for (const [dx, dy, dz, r] of [[0, 1.08, 0, 0.2], [0.1, 1.2, 0.08, 0.15], [-0.1, 1.16, -0.06, 0.16]]) add(scene, new THREE.SphereGeometry(r, 14, 10), std(0x2f6b45, 0.8), W - 0.5 + dx, dy, -7.6 + dz);
  const benchLight = new THREE.PointLight(0xffd8a0, 6, 7, 1.6); benchLight.position.set(W - 1.2, H - 0.6, -4.9); scene.add(benchLight);

  // a standing pole in the back corner
  const inPole = makePole(true); inPole.position.set(-W + 0.55, 0, -D + 0.4); scene.add(inPole);

  // lights: dusky sky outside, warm room inside, a street lamp on the sidewalk
  scene.add(new THREE.HemisphereLight(0xffe8c8, 0x2a1d12, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb3d9, 0.6); moon.position.set(-6, 8, 10); scene.add(moon);
  const street = new THREE.PointLight(0xffc98a, 18, 14, 1.5); street.position.set(-5, 4.2, 5); scene.add(street);
  const fill = new THREE.PointLight(0xffe2b8, 4, 8, 1.5); fill.position.set(0, H - 0.4, -2); scene.add(fill);

  // ---------- camera path (time 0..1 = scroll through the section) ----------
  const KEYS = [
    [0.00, [0, 1.9, 10.5], [0, 2.4, 0]],      // storefront with the name
    [0.12, [0, 1.7, 6.2], [0, 1.8, 0]],       // walk up to the door
    [0.30, [0, 1.6, 2.0], [0, 1.5, -3]],      // door swings open
    [0.44, [0.1, 1.7, -1.1], [0, 1.45, -6]],  // step inside
    [0.60, [0.2, 2.5, -0.9], [0, 0.9, -5.2]], // look around: chairs left, bench right
    [0.72, [0.2, 2.5, -0.9], [0, 0.9, -5.2]], // hold while the seat count shows
    [0.86, [0.5, 1.55, -3.2], [-2.35, 1.05, -3.2]], // walk to the first chair
    [0.94, [0.15, 1.6, -3.2], [-2.35, 1.1, -3.2]], // stop in front of it
    [1.00, [0.15, 1.6, -3.2], [-2.35, 1.1, -3.2]]
  ].map(([t, p, l]) => ({ t, p: V(...p), l: V(...l) }));
  const look = V(0, 0, 0);
  const smooth = u => u * u * (3 - 2 * u);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function pose(t) {
    let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1], u = smooth(clamp((t - a.t) / (b.t - a.t)));
    camera.position.lerpVectors(a.p, b.p, u); look.lerpVectors(a.l, b.l, u);
    if (small && t < 0.3) camera.position.z += (1 - t / 0.3) * 2.2; // step back a little on narrow screens
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
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 64 : 48; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(sticky); resize();

  const target = () => { const r = section.getBoundingClientRect(), total = section.offsetHeight - sticky.offsetHeight; return clamp(-r.top / Math.max(1, total)); };
  let shown = target(), visible = true, raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = 0; if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), goal = target();
    shown += (goal - shown) * (reduce ? 1 : Math.min(1, dt * 6));
    if (Math.abs(goal - shown) < 0.0002) shown = goal;
    pose(shown); showOverlays(shown); bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    if (!reduce) poleStripes.offset.y = (poleStripes.offset.y + dt * 0.22) % 1;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) { clock.getDelta(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(section);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) start(); });
  pose(shown); showOverlays(shown); renderer.render(scene, camera); start();
}

// "Add your picture" in the intro opens the Style Lab's photo picker; then show the lab.
const addPic = document.getElementById('introAddPic'), fileIn = document.getElementById('fileIn');
if (addPic && fileIn) {
  let fromIntro = false;
  addPic.addEventListener('click', () => { fromIntro = true; });
  addPic.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addPic.click(); } });
  fileIn.addEventListener('change', () => { if (fromIntro) { fromIntro = false; setTimeout(() => document.getElementById('style-lab').scrollIntoView({ behavior: 'smooth' }), 100); } });
}
