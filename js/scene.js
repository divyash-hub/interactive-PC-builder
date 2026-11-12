// 3D bench: a procedurally modelled PC whose parts follow the build.
// Units are centimetres. +x = front of the case, +y = up, +z = toward the glass side panel.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const THEMES = {
  light: { bg: '#eceef2', ped: '#d9dde3', ring: '#b4bcc7', ringGlow: 0, grid: '#cdd2da', accent: '#3b5bfd', ghost: '#8a94a3', hemi: 1.15, key: 2.3, fill: 1500, bloomAt: 2.6, glow: 2.6 },
  dark:  { bg: '#0f1217', ped: '#12171d', ring: '#8fd3ff', ringGlow: 1.2, grid: '#243142', accent: '#8fd3ff', ghost: '#5d6f84', hemi: 0.8, key: 2.3, fill: 2600, bloomAt: 1.0, glow: 1 },
};
const FAULT = new THREE.Color('#ff5a5f');
const RGB_OFF = new THREE.Color('#dfe5ec');
const RGB_ON = new THREE.Color('#30353d');
const ZERO = new THREE.Vector3();

// ---------- materials ----------
const std = (color, roughness = 0.5, metalness = 0.2, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const MAT = {
  pcbGreen: std('#1f4a35', 0.5, 0.2),
  heatsink: std('#c3c8d0', 0.26, 0.95),
  alu: std('#cfd3da', 0.3, 1.0),
  gunmetal: std('#3d424b', 0.34, 0.85),
  vrm: std('#2d323a', 0.38, 0.8),
  black: std('#17191e', 0.55, 0.3),
  plastic: std('#22252b', 0.62, 0.08),
  rubber: std('#0e0f12', 0.85, 0.0),
  silver: std('#d6dae0', 0.2, 1.0),
  copper: std('#c4834f', 0.28, 1.0),
  gold: std('#d4a64a', 0.3, 1.0),
  blade: std('#2b2f36', 0.5, 0.05, { side: THREE.DoubleSide }),
  bladeWhite: std('#e6e9ee', 0.5, 0.05, { side: THREE.DoubleSide }),
  fanFrame: std('#1d2025', 0.55, 0.1),
  fanFrameWhite: std('#eceef2', 0.55, 0.1),
  wood: std('#8d623e', 0.72, 0.0),
  sleeveBlack: std('#1b1d22', 0.8, 0.05),
  sleeveWhite: std('#e7eaee', 0.8, 0.05),
  nvidia: std('#c6cbd2', 0.32, 0.95),
  radeon: std('#26292f', 0.42, 0.6),
  // Diffusers look frosted white when off and glow when the PC is powered on.
  rgb: new THREE.MeshStandardMaterial({ color: '#dfe5ec', emissive: new THREE.Color('#000'), emissiveIntensity: 0, roughness: 0.35, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.035, depthWrite: false, envMapIntensity: 0.1,
  }),
  ghostLine: new THREE.LineBasicMaterial({ color: '#8a94a3', transparent: true, opacity: 0.6 }),
  ghostFill: new THREE.MeshBasicMaterial({ color: '#3b5bfd', transparent: true, opacity: 0, depthWrite: false }),
};

// ---------- cached geometry + textures (built once, shared by every part) ----------
const GEO = new Map();
function geo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); g.userData.cached = true; GEO.set(key, g); }
  return g;
}
const f2 = n => Math.round(n * 100) / 100;
function box(w, h, d, mat, r = 0) {
  w = f2(w); h = f2(h); d = f2(d);
  const rr = r > 0 ? f2(Math.min(r, w / 2, h / 2, d / 2)) : 0;
  const g = geo(`b${w}|${h}|${d}|${rr}`, () => (rr > 0 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d)));
  return new THREE.Mesh(g, mat);
}
function cyl(r, h, mat, seg = 20) {
  return new THREE.Mesh(geo(`c${f2(r)}|${f2(h)}|${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg)), mat);
}
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TEX = {};
function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// Motherboard PCB with faint traces and silkscreen boxes.
function pcbMat() {
  return MAT.pcb ||= std('#ffffff', 0.55, 0.25, {
    map: canvasTex(512, 512, (g, w, h) => {
      const rnd = seeded(11);
      g.fillStyle = '#1c2129'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#272e39'; g.lineWidth = 2;
      for (let i = 0; i < 150; i++) {
        let x = rnd() * w, y = rnd() * h;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { if (rnd() < 0.5) x += (rnd() - 0.5) * 160; else y += (rnd() - 0.5) * 160; g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = '#323a47';
      for (let i = 0; i < 260; i++) g.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 6, 2 + rnd() * 3);
      g.strokeStyle = 'rgba(205,215,230,.22)'; g.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) g.strokeRect(rnd() * w, rnd() * h, 18 + rnd() * 60, 10 + rnd() * 30);
    }),
  });
}
// Perforated panel patterns: white = metal, black = hole.
function patternTex(kind) {
  return TEX[kind] ||= canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000';
    if (kind === 'slots') { for (let i = 0; i < 4; i++) g.fillRect(i * 16 + 5, 0, 7, h); return; }
    for (const [x, y] of [[16, 16], [48, 16], [0, 48], [32, 48], [64, 48]]) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); }
  }, { repeat: true, srgb: false });
}
function finTex() {
  return TEX.fins ||= canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#2a2e35'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a616c';
    for (let i = 0; i < 16; i++) g.fillRect(0, i * 4, w, 1.4);
  }, { repeat: true });
}

const LABELS = new Map();
function label(text, width, height, { w = 512, h = 96, color = '#e9edf3', font = '600 52px Geist, sans-serif', align = 'left' } = {}) {
  const key = [text, w, h, color, font, align].join('|');
  let mat = LABELS.get(key);
  if (!mat) {
    const map = canvasTex(w, h, (g) => {
      g.fillStyle = color; g.font = font; g.textBaseline = 'middle'; g.textAlign = align;
      g.fillText(text, align === 'center' ? w / 2 : 18, h / 2 + 2);
    });
    mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
    LABELS.set(key, mat);
  }
  return new THREE.Mesh(geo(`p${f2(width)}|${f2(height)}`, () => new THREE.PlaneGeometry(width, height)), mat);
}

// ---------- fans ----------
function fanGeo(size) {
  return {
    frame: geo(`fanframe${size}`, () => {
      const h = size / 2, r = size * 0.465, rc = size * 0.09;
      const s = new THREE.Shape();
      s.moveTo(-h + rc, -h); s.lineTo(h - rc, -h); s.quadraticCurveTo(h, -h, h, -h + rc); s.lineTo(h, h - rc);
      s.quadraticCurveTo(h, h, h - rc, h); s.lineTo(-h + rc, h); s.quadraticCurveTo(-h, h, -h, h - rc); s.lineTo(-h, -h + rc);
      s.quadraticCurveTo(-h, -h, -h + rc, -h);
      const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: false, curveSegments: 20 });
      g.translate(0, 0, -1.25);
      return g;
    }),
    blade: geo(`fanblade${size}`, () => {
      const rh = size * 0.17, ro = size * 0.445;
      const b = new THREE.Shape();
      b.moveTo(rh, -size * 0.05);
      b.quadraticCurveTo((rh + ro) / 2, -size * 0.11, ro, -size * 0.03);
      b.quadraticCurveTo(ro * 1.02, size * 0.1, ro * 0.82, size * 0.15);
      b.quadraticCurveTo((rh + ro) / 2, size * 0.1, rh, size * 0.07);
      return new THREE.ShapeGeometry(b, 6);
    }),
    hub: geo(`fanhub${size}`, () => new THREE.CylinderGeometry(size * 0.17, size * 0.17, 1.8, 28).rotateX(Math.PI / 2)),
    ring: geo(`fanring${size}`, () => new THREE.TorusGeometry(size * 0.462, size * 0.012, 6, 48)),
  };
}
// A fan facing +z.
function fan(size, { ring = true, white = false, blades = 9 } = {}) {
  const G = fanGeo(size);
  const g = new THREE.Group();
  const fm = white ? MAT.fanFrameWhite : MAT.fanFrame;
  g.add(new THREE.Mesh(G.frame, fm));
  const rotor = new THREE.Group();
  rotor.add(new THREE.Mesh(G.hub, fm));
  const bm = white ? MAT.bladeWhite : MAT.blade;
  for (let i = 0; i < blades; i++) {
    const m = new THREE.Mesh(G.blade, bm);
    m.rotation.order = 'ZYX';
    m.rotation.set(0.42, 0, (i / blades) * Math.PI * 2);
    rotor.add(m);
  }
  g.add(rotor);
  if (ring) {
    const r = new THREE.Mesh(G.ring, MAT.rgb);
    r.position.z = 1.3;
    g.add(r);
  }
  g.userData.rotor = rotor;
  return g;
}

// ---------- layout ----------
const MOBO_DIMS = { ATX: [24.4, 30.5], mATX: [24.4, 24.4], ITX: [17, 17] };
function caseDims(cs) {
  if (!cs) return { W: 44, H: 47, D: 22, shroud: 10, rearCh: 0, size: 'mid' };
  const [W, H, D] = cs.dims;
  const dual = cs.size === 'dual';
  return { W, H, D, size: cs.size, shroud: cs.size === 'itx' || dual ? 0 : cs.size === 'matx' ? 9 : 10, rearCh: dual ? D - 20 : 0 };
}
function gpuDims(gp) {
  return { len: gp.length / 10, thick: gp.tdp < 150 ? 4 : gp.tdp < 260 ? 5 : 6.2, H: gp.tdp > 280 ? 13.6 : 12.2 };
}

function layout(rr) {
  const C = caseDims(rr.case);
  const size = C.size;
  const form = rr.mobo?.form || (size === 'itx' ? 'ITX' : size === 'matx' ? 'mATX' : 'ATX');
  const [mw, mh] = MOBO_DIMS[form];
  const itx = form === 'ITX';
  const x0 = -C.W / 2 + 3;
  const top = C.H / 2 - (size === 'itx' ? 3 : 6);
  const z = -C.D / 2 + C.rearCh + 1.6;
  const cpu = new THREE.Vector3(x0 + (itx ? 7.5 : 11), top - (itx ? 6 : 8), z);
  const slotY = top - (itx ? 15 : 17.5);
  const zc = C.rearCh / 2; // centre of the main chamber
  // Power supply: bottom-rear in a shroud, behind the board in dual-chamber cases, upright at the front in ITX.
  let psu, psuRot = new THREE.Euler(), psuSize = [15, 8.6, 14];
  if (C.rearCh) {
    psu = new THREE.Vector3(C.W / 2 - 10, -C.H / 2 + 8.5, -C.D / 2 + C.rearCh / 2);
    psuRot = new THREE.Euler(Math.PI / 2, 0, 0); psuSize = [15, 14, 8.6];
  } else if (size === 'itx') {
    psu = new THREE.Vector3(C.W / 2 - 5.6, C.H / 2 - 9, zc);
    psuRot = new THREE.Euler(0, 0, Math.PI / 2); psuSize = [8.6, 15, 14];
  } else {
    psu = new THREE.Vector3(-C.W / 2 + 9.5, -C.H / 2 + 4.9, -C.D / 2 + 8.2);
  }
  const sataY = C.shroud ? -C.H / 2 + C.shroud + 0.9 : -C.H / 2 + 1.4;
  return {
    size, C, form, mw, mh, x0, top, z, zc, itx,
    mobo: new THREE.Vector3(x0, top, z),
    cpu,
    ram: new THREE.Vector3(cpu.x + (itx ? 5.6 : 6.4), top - 2, z),
    dimms: rr.mobo?.dimms || (itx ? 2 : 4),
    gpu: new THREE.Vector3(x0 - 0.5, slotY, z),
    m2: [new THREE.Vector3(cpu.x, top - (itx ? 11 : 12.8), z), new THREE.Vector3(cpu.x + 4, slotY - 8.5, z), new THREE.Vector3(cpu.x + 4, slotY - 4.2, z)],
    psu, psuRot, psuSize,
    sata: [new THREE.Vector3(C.W / 2 - 10, sataY, zc + 1.5), new THREE.Vector3(C.W / 2 - 10, sataY + 2.8, zc + 1.5)],
    radTop: C.H / 2 - 2.6,
  };
}

// ---------- part builders ----------
function buildMobo(m, L) {
  const g = new THREE.Group();
  const { mw, mh, itx } = L;
  const cx = L.cpu.x - L.x0, cy = L.cpu.y - L.top;
  g.add(at(box(mw, mh, 0.16, pcbMat()), mw / 2, -mh / 2, 0.08));
  // socket frame + retention lever
  g.add(at(box(5.8, 5.8, 0.28, MAT.alu, 0.1), cx, cy, 0.28));
  g.add(at(box(4.4, 4.4, 0.3, MAT.black), cx, cy, 0.3));
  const lever = cyl(0.11, 5.4, MAT.silver, 8);
  g.add(at(lever, cx + 3.3, cy, 0.42));
  // VRM heatsinks with fins
  const vw = Math.min(10, cx + 3.5);
  g.add(at(box(vw, 2.7, 2.4, MAT.vrm, 0.25), vw / 2 + 1.0, cy + 4.6, 1.3));
  for (let i = 0; i < 5; i++) g.add(at(box(vw - 0.8, 0.16, 0.45, MAT.gunmetal), vw / 2 + 1.0, cy + 3.6 + i * 0.5, 2.7));
  g.add(at(box(2.7, 9.5, 2.4, MAT.vrm, 0.25), cx - 5.3, cy - 0.6, 1.3));
  g.add(at(box(0.5, 7.5, 0.06, MAT.alu), cx - 5.3, cy - 0.6, 2.53));
  // rear I/O cover with a light strip
  g.add(at(box(3.4, 9.5, 3.4, MAT.plastic, 0.4), 1.8, -4.8, 1.8));
  g.add(at(box(0.2, 7, 0.2, MAT.rgb), 3.55, -4.8, 3.0));
  // memory slots with latches
  for (let i = 0; i < L.dimms; i++) {
    const x = (L.ram.x - L.x0) + i * 0.9;
    g.add(at(box(0.55, 13.3, 0.7, MAT.black), x, -2 - 6.65, 0.45));
    g.add(at(box(0.62, 0.7, 1.0, MAT.plastic), x, -2 - 13.3 - 0.2, 0.55));
  }
  // PCIe slots
  const sy = L.gpu.y - L.top;
  g.add(at(box(9, 0.75, 0.95, MAT.silver), 6.5, sy, 0.55));
  if (!itx) {
    g.add(at(box(9, 0.6, 0.8, MAT.black), 6.5, sy - (L.form === 'ATX' ? 8 : 6.5), 0.5));
    g.add(at(box(2.6, 0.6, 0.8, MAT.black), 2.3, sy - 2.6, 0.5));
    // chipset heatsink
    g.add(at(box(6.5, 6, 1.1, MAT.vrm, 0.3), mw - 5.5, -mh + 5, 0.7));
    g.add(at(box(6.5, 0.4, 0.05, MAT.alu), mw - 5.5, -mh + 3.6, 1.28));
    for (let i = 0; i < 4; i++) g.add(at(box(0.6, 0.8, 1.1, MAT.plastic), mw - 0.6, -mh + 9 + i * 1.0, 0.65));
    const t = label(m.chipset, 5, 1, { font: '700 60px Geist, sans-serif', color: '#c9cfd9' });
    g.add(at(t, mw - 4, -mh + 1.2, 0.18));
  }
  // power connectors, CMOS battery, audio capacitors
  g.add(at(box(1.3, 5.2, 1.6, MAT.plastic), mw - 1, -9, 0.9));
  g.add(at(box(2.2, 1.0, 1.3, MAT.plastic), 2.6, -0.9, 0.75));
  const bat = cyl(1.0, 0.3, MAT.silver, 24);
  bat.rotation.x = Math.PI / 2;
  g.add(at(bat, itx ? mw - 3 : mw - 10, itx ? -mh + 3 : -mh + 11, 0.32));
  for (let i = 0; i < 4; i++) {
    const c = cyl(0.3, 0.9, MAT.gold, 12);
    c.rotation.x = Math.PI / 2;
    g.add(at(c, 1.2 + (i % 2) * 0.8, -mh + 2.2 + Math.floor(i / 2) * 0.8, 0.6));
  }
  return g;
}

function buildCpu(c) {
  const g = new THREE.Group();
  const intel = c.brand === 'Intel';
  g.add(at(box(intel ? 3.75 : 4, intel ? 4.5 : 4, 0.25, MAT.pcbGreen), 0, 0, 0.45));
  g.add(at(box(intel ? 3.2 : 3.4, intel ? 3.8 : 3.4, 0.35, MAT.silver, 0.15), 0, 0, 0.75));
  const t = label(intel ? 'intel' : 'RYZEN', 2.6, 0.62, { w: 256, h: 64, font: '700 44px Geist, sans-serif', color: '#7b818c', align: 'center' });
  g.add(at(t, 0, 0.5, 0.93));
  return g;
}

function buildAirCooler(c) {
  const g = new THREE.Group();
  const h = c.height / 10;
  g.add(at(box(4, 4, 0.9, MAT.copper, 0.1), 0, 0, 1.4));
  const fans = [];
  if (h < 6) { // low profile
    for (let i = 0; i < 9; i++) g.add(at(box(9, 9, 0.08, MAT.heatsink), 0, 0, 2 + i * 0.12));
    const f = fan(9, { ring: false });
    f.position.z = h + 0.3;
    g.add(f); fans.push(f);
    g.userData.fans = fans;
    return g;
  }
  const dual = h > 16.5;
  const stacks = dual ? [-3.4, 3.4] : [0];
  const fins = Math.min(44, Math.floor((h - 3) / 0.3));
  const fw = dual ? 4.6 : 5.2;
  const inst = new THREE.InstancedMesh(geo(`fin${fw}`, () => new THREE.BoxGeometry(fw, 12.4, 0.07)), MAT.heatsink, fins * stacks.length);
  const mtx = new THREE.Matrix4();
  let n = 0;
  for (const sx of stacks) for (let i = 0; i < fins; i++) inst.setMatrixAt(n++, mtx.makeTranslation(sx, 0, 3 + i * ((h - 3.6) / fins)));
  g.add(inst);
  for (const sx of stacks) {
    g.add(at(box(fw + 0.2, 12.6, 0.45, MAT.black, 0.15), sx, 0, h - 0.2));
    g.add(at(box(fw + 0.2, 0.25, 0.25, MAT.rgb), sx, 6.3, h));
  }
  // heatpipes: up through the stacks, capped on top
  for (let i = 0; i < 4; i++) {
    for (const sx of dual ? [-3.4, 3.4] : [0]) {
      const p = cyl(0.3, h - 1.5, MAT.copper, 10);
      p.rotation.x = Math.PI / 2;
      g.add(at(p, sx + (i - 1.5) * (dual ? 0.9 : 1.1), 0, (h + 1.5) / 2));
    }
  }
  const xs = dual ? [0, 3.4 + fw / 2 + 1.4] : [fw / 2 + 1.3];
  for (const fx of xs) {
    const f = fan(12, { ring: true });
    f.rotation.y = Math.PI / 2;
    f.position.set(fx, 0, 3 + (h - 3) / 2);
    g.add(f); fans.push(f);
  }
  g.userData.fans = fans;
  return g;
}

function buildAio(c, L) {
  const g = new THREE.Group();
  const pump = cyl(3.1, 3.4, MAT.black, 40);
  pump.rotation.x = Math.PI / 2;
  pump.position.z = 2.6;
  g.add(pump);
  const ring = new THREE.Mesh(geo('pumpring', () => new THREE.TorusGeometry(2.7, 0.16, 10, 48)), MAT.rgb);
  ring.position.z = 4.35;
  g.add(ring);
  const cap = cyl(2.45, 0.2, MAT.gunmetal, 40);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 4.35;
  g.add(cap);
  // radiator, expressed relative to the CPU
  const len = c.rad / 10 + 1.6;
  const rx = L.size === 'itx' ? -L.C.W / 2 + 3 + len / 2 : L.C.W / 2 - 3 - len / 2;
  const rp = new THREE.Vector3(rx - L.cpu.x, L.radTop - L.cpu.y, L.zc + 1.2 - L.cpu.z);
  const fm = std('#ffffff', 0.6, 0.4, { map: finTex().clone() });
  fm.map.repeat.set(1, 6); fm.map.needsUpdate = true;
  fm.userData.own = true;
  g.add(at(box(len - 3, 2.7, 12, fm), rp.x, rp.y, rp.z));
  g.add(at(box(1.5, 3, 12.4, MAT.black, 0.2), rp.x - len / 2 + 0.75, rp.y, rp.z));
  g.add(at(box(1.5, 3, 12.4, MAT.black, 0.2), rp.x + len / 2 - 0.75, rp.y, rp.z));
  const fans = [];
  const n = c.rad / 120;
  for (let i = 0; i < n; i++) {
    const f = fan(11.6, { ring: true });
    f.rotation.x = Math.PI / 2;
    f.position.set(rp.x - len / 2 + 0.8 + 6 + i * 12, rp.y - 2.7, rp.z);
    g.add(f); fans.push(f);
  }
  // tubes to the end tank nearest the pump
  const endX = rp.x > 0 ? rp.x - len / 2 + 0.8 : rp.x + len / 2 - 0.8;
  for (const dz of [-1, 1]) {
    const pts = [
      new THREE.Vector3(1.6, dz, 3.2),
      new THREE.Vector3(4.5, dz * 1.2, 6.5),
      new THREE.Vector3(endX + (rp.x > 0 ? 2 : -2), rp.y - 5, rp.z + dz * 2 + 2),
      new THREE.Vector3(endX, rp.y - 0.6, rp.z + dz * 2.4),
    ];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.5, 10, false), MAT.sleeveBlack);
    g.add(tube);
  }
  g.userData.fans = fans;
  return g;
}

function buildRam(r, L) {
  const g = new THREE.Group();
  const slots = L.dimms === 2 ? [0, 1] : r.sticks === 4 ? [0, 1, 2, 3] : [1, 3];
  const rgb = r.type === 'DDR5' && r.speed >= 6000;
  for (const s of slots) {
    const x = s * 0.9;
    g.add(at(box(0.16, 13.3, 3.0, MAT.pcbGreen), x, -6.65, 2.2));
    g.add(at(box(0.62, 13.3, 3.2, MAT.gunmetal, 0.08), x, -6.65, 2.3));
    g.add(at(box(0.64, 12.2, 0.05, MAT.alu), x, -6.65, 1.9));
    if (rgb) g.add(at(box(0.66, 13.1, 0.55, MAT.rgb, 0.1), x, -6.65, 4.1));
    else g.add(at(box(0.66, 13.1, 0.3, MAT.black, 0.1), x, -6.65, 3.95));
  }
  return g;
}

function buildGpu(gp) {
  const g = new THREE.Group();
  const { len, thick, H } = gpuDims(gp);
  const nv = gp.brand === 'NVIDIA';
  const shell = nv ? MAT.nvidia : MAT.radeon;
  // shroud: card body, plus a darker inset band on the edge facing the glass
  g.add(at(box(len, thick - 0.6, H, shell, 0.5), len / 2, -thick / 2 - 0.2, H / 2 + 0.4));
  g.add(at(box(len * 0.9, thick - 1.7, 0.08, nv ? MAT.black : MAT.gunmetal), len / 2, -thick / 2 - 0.2, H + 0.42));
  // backplate on top
  g.add(at(box(len - 0.4, 0.25, H - 0.4, nv ? MAT.black : MAT.gunmetal, 0.1), len / 2, 0.15, H / 2 + 0.4));
  // PCIe bracket with display outputs
  g.add(at(box(0.2, thick + 1.2, 2.2, MAT.silver), 0.1, -thick / 2, 1.2));
  for (let i = 0; i < 3; i++) g.add(at(box(0.22, 0.6, 1.0, MAT.black), 0.1, -0.9 - i * 1.1, 1.3));
  // fans underneath
  const n = len > 28 ? 3 : 2;
  const fs = Math.min(9.6, (len - 1.5) / n - 0.4);
  const fans = [];
  for (let i = 0; i < n; i++) {
    const f = fan(fs, { ring: false, blades: 11 });
    f.rotation.x = Math.PI / 2;
    f.position.set(len / 2 + (i - (n - 1) / 2) * (fs + 0.4), -thick - 0.05, H / 2 + 0.4);
    g.add(f); fans.push(f);
  }
  // glowing logo strip and name on the edge facing the glass
  g.add(at(box(len * 0.5, 0.28, 0.1, MAT.rgb), len * 0.38, -1.0, H + 0.48));
  const brandText = gp.name.replace(/^(NVIDIA|AMD|Intel) /, '').replace(/ \d+GB$/, '').toUpperCase();
  const t = label(brandText, Math.min(len * 0.6, 16), 1.6, { w: 768, h: 96, font: '700 54px Geist, sans-serif', color: nv ? '#2a2e35' : '#e3e7ee' });
  g.add(at(t, len * 0.55, -thick / 2 - 0.5, H + 0.47));
  // power connector
  g.add(at(box(2, 0.8, 1.2, MAT.black), len * 0.6, 0.6, H - 1));
  g.userData.fans = fans;
  return g;
}

function buildPsu(p) {
  const g = new THREE.Group();
  g.add(box(15, 8.6, 14, MAT.black, 0.4));
  g.add(at(label(`${p.watts}W`, 6, 1.6, { font: '700 70px Geist, sans-serif', color: '#e3e7ee' }), 2.5, 1.5, 7.02));
  g.add(at(label(`80+ ${p.rating}`, 6, 1.1, { color: '#9aa3b0' }), 2.5, -0.3, 7.02));
  g.add(at(box(14.4, 0.15, 0.1, MAT.rgb), 0, -3.6, 7.02));
  // fan grille underneath
  const grille = new THREE.Mesh(geo('psugrille', () => new THREE.TorusGeometry(5.6, 0.18, 6, 40)), MAT.gunmetal);
  grille.rotation.x = Math.PI / 2;
  g.add(at(grille, 0, -4.32, 0));
  // modular sockets at the front
  for (let i = 0; i < 6; i++) g.add(at(box(0.15, 1.1, 1.8, MAT.plastic), 7.55, 2.2 - Math.floor(i / 3) * 2.2, -4 + (i % 3) * 3));
  return g;
}

function buildM2(d) {
  const g = new THREE.Group();
  g.add(at(box(8, 2.2, 0.15, MAT.pcbGreen), 0, 0, 0.5));
  g.add(at(box(7.6, 2.3, 0.55, MAT.gunmetal, 0.12), 0, 0, 0.85));
  const brand = d.name.split(' ')[0].toUpperCase();
  g.add(at(label(brand, 3.2, 0.7, { font: '700 64px Geist, sans-serif', w: 384, color: '#e3e7ee' }), 1.4, 0.35, 1.14));
  g.add(at(label(`${d.size >= 1000 ? d.size / 1000 + 'TB' : d.size + 'GB'}`, 2.4, 0.8, { font: '700 70px Geist, sans-serif', w: 256, color: '#8fd3ff' }), -2.2, -0.45, 1.14));
  return g;
}

function buildSata(d) {
  const g = new THREE.Group();
  if (d.read < 300) {
    g.add(box(14.7, 2.6, 10.2, MAT.alu, 0.2));
    g.add(at(box(9, 0.05, 7.5, MAT.black), -1.5, 1.32, 0));
    const t = label('2TB HDD', 4, 1, { font: '700 60px Geist, sans-serif', w: 384 });
    t.rotation.x = -Math.PI / 2;
    g.add(at(t, -1.5, 1.36, 0));
  } else {
    g.add(box(10, 0.7, 7, MAT.black, 0.15));
    const t = label('SSD', 3, 1, { font: '700 64px Geist, sans-serif', w: 256 });
    t.rotation.x = -Math.PI / 2;
    g.add(at(t, -2, 0.37, 0));
  }
  return g;
}

// Sleeved power cables from the power supply to the board and graphics card.
function buildCables(rr, L) {
  const g = new THREE.Group();
  const light = new THREE.Color(rr.case?.color || '#222').getHSL({}).l > 0.5;
  const mat = light ? MAT.sleeveWhite : MAT.sleeveBlack;
  const { x0, mw, top, z, C } = L;
  const behind = z - 2.2; // behind the motherboard tray
  const floor = C.shroud ? -C.H / 2 + C.shroud : -C.H / 2 + 2;
  const tube = (pts, r) => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 10, false), mat));
  const gx = x0 + Math.min(mw + 2.4, C.W - 6.5);
  // 24-pin
  tube([new THREE.Vector3(x0 + mw - 0.4, top - 9, z + 1.7), new THREE.Vector3(gx - 0.8, top - 9.1, z + 1.5), new THREE.Vector3(gx, top - 9.6, z + 0.2), new THREE.Vector3(gx + 0.1, top - 10.4, behind)], 0.8);
  // CPU power along the top edge
  tube([new THREE.Vector3(x0 + 2.6, top - 0.6, z + 1.5), new THREE.Vector3(x0 + 2.6, top + 1.6, z + 1.2), new THREE.Vector3(x0 + 3.4, top + 2.4, behind)], 0.5);
  // graphics card power: up out of the connector, then down past the card's edge into the shroud
  if (rr.gpu) {
    const { len, H } = gpuDims(rr.gpu);
    const cx = L.gpu.x + len * 0.6, cy = L.gpu.y + 1.0, cz = L.gpu.z + H - 1;
    tube([
      new THREE.Vector3(cx, cy - 0.2, cz), new THREE.Vector3(cx + 0.3, cy + 0.9, cz + 0.9), new THREE.Vector3(cx + 0.8, cy + 0.4, cz + 2.0),
      new THREE.Vector3(cx + 1.2, (cy + floor) / 2, cz + 2.1), new THREE.Vector3(cx + 1.4, floor + 0.6, cz + 1.2),
      new THREE.Vector3(cx + 1.4, floor - 2, C.shroud ? cz : behind),
    ], 0.45);
  }
  return g;
}

function meshPanelMat(color, w, h, kind) {
  const t = patternTex(kind).clone();
  t.repeat.set(w / (kind === 'slots' ? 3 : 1.3), h / (kind === 'slots' ? 30 : 1.3));
  t.needsUpdate = true;
  const m = std(color, 0.5, 0.4, { alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide });
  m.userData.own = true;
  return m;
}

function placeFans(cs, L, white) {
  const { W, H, shroud } = L.C;
  const out = { all: [], top: [] };
  for (const [where, count, s] of cs.fans) {
    const pitch = s + 0.4;
    const avail = where === 'front' ? H - shroud - 3 : where === 'top' ? W - 8 : where === 'bottom' ? W - 21 : s;
    const k = Math.max(0, Math.min(count, Math.floor(avail / pitch)));
    for (let i = 0; i < k; i++) {
      const f = fan(s, { ring: !!cs.rgb, white });
      if (where === 'front') {
        f.rotation.y = Math.PI / 2;
        const mid = (H / 2 - 1.5 + (-H / 2 + shroud + 1.5)) / 2;
        f.position.set(W / 2 - 2.6, mid + ((k - 1) / 2 - i) * pitch, L.zc);
      } else if (where === 'rear') {
        f.rotation.y = -Math.PI / 2;
        f.position.set(-W / 2 + 1.8, L.top - s / 2 - 1, L.zc);
      } else {
        f.rotation.x = -Math.PI / 2;
        const x = L.size === 'itx' ? -W / 2 + 3 + s / 2 + i * pitch : W / 2 - 4 - s / 2 - i * pitch;
        f.position.set(x, where === 'top' ? H / 2 - 2 : -H / 2 + 2.2, L.zc);
        if (where === 'top') out.top.push(f);
      }
      out.all.push(f);
    }
  }
  return out;
}

function buildCase(cs, L, accent) {
  const g = new THREE.Group();
  const { W, H, D, shroud, rearCh } = L.C;
  const light = new THREE.Color(cs.color).getHSL({}).l > 0.5;
  const shell = std(cs.color, 0.5, 0.35);
  const inner = std(light ? '#e4e7eb' : '#1d2026', 0.75, 0.2);
  const fade = [shell, inner];
  for (const m of fade) m.userData.own = true;
  const T = 0.5;
  // back wall / motherboard tray
  g.add(at(box(W, H, T, rearCh ? shell : inner), 0, 0, -D / 2 + T / 2));
  if (rearCh) g.add(at(box(W - 1, H - 1, 0.3, inner), 0, 0, -D / 2 + rearCh));
  // top (perforated when fans or a radiator live there), bottom, rear
  const topMesh = cs.fans.some(f => f[0] === 'top') || L.size === 'itx';
  const topMat = topMesh ? meshPanelMat(cs.color, W, D, 'holes') : shell;
  if (topMesh) fade.push(topMat);
  g.add(at(box(W, T, D, topMat, 0.2), 0, H / 2 - T / 2, 0));
  g.add(at(box(W, T, D, shell, 0.2), 0, -H / 2 + T / 2, 0));
  g.add(at(box(T, H, D, shell), -W / 2 + T / 2, 0, 0));
  g.add(at(box(0.1, 16.5, 4.6, MAT.black), -W / 2 - 0.02, L.top - 8.5, L.z + 2.4));
  // front
  if (cs.front === 'glass') {
    g.add(at(box(0.3, H - 1, D - 1, MAT.glass), W / 2 - 0.15, 0, 0));
    g.add(at(box(0.6, H, 0.6, shell), W / 2 - 0.3, 0, -D / 2 + 0.3));
  } else {
    const fm = meshPanelMat(cs.front === 'wood' ? '#26272b' : cs.color, D, H, cs.front === 'grille' ? 'slots' : 'holes');
    fade.push(fm);
    g.add(at(box(1, H, D, fm, 0.3), W / 2 - 0.5, 0, 0));
    if (cs.front === 'wood') {
      const wood = MAT.wood;
      for (let i = 0; i < 12; i++) g.add(at(box(0.5, H - 4, 0.8, wood, 0.1), W / 2 + 0.2, 0, -D / 2 + 2 + i * ((D - 4) / 11)));
    }
  }
  // rear slot covers
  const slots = L.size === 'itx' ? 2 : L.size === 'matx' ? 4 : 7;
  for (let i = 0; i < slots; i++) g.add(at(box(0.2, 0.9, 10, MAT.silver), -W / 2 + 0.6, L.gpu.y - i * 2 + 0.8, L.z + 4.4));
  // power supply shroud with the case name
  if (shroud) {
    g.add(at(box(W - 1.2, 0.4, D - 1, shell), 0.2, -H / 2 + shroud, 0));
    g.add(at(box(W * 0.55, shroud - 0.4, 0.4, shell), -W / 2 + W * 0.275 + 0.5, -H / 2 + shroud / 2, D / 2 - 0.7));
    const t = label(cs.name.split(' ').slice(-2).join(' '), 9, 1.4, { color: light ? '#5d6470' : '#8e97a5', font: '700 56px Geist, sans-serif' });
    g.add(at(t, -W / 2 + 6.5, -H / 2 + shroud / 2, D / 2 - 0.48));
  }
  // feet
  for (const fx of [-W / 2 + 3, W / 2 - 3]) for (const fz of [-D / 2 + 3, D / 2 - 3]) g.add(at(box(4, 1, 2, MAT.rubber, 0.3), fx, -H / 2 - 0.5, fz));
  // fans that come in the box
  const fans = placeFans(cs, L, light);
  fans.all.forEach(f => g.add(f));
  // glass side panel (slides away in the pulled-apart view)
  const glass = new THREE.Group();
  glass.add(at(box(W - 0.6, H - 0.6, 0.3, MAT.glass), 0, 0, 0));
  const fr = std(light ? '#d9dce1' : '#0f1013', 0.5, 0.4);
  fr.userData.own = true;
  fade.push(fr);
  glass.add(at(box(W - 0.6, 0.7, 0.32, fr), 0, H / 2 - 0.65, 0));
  glass.add(at(box(W - 0.6, 0.7, 0.32, fr), 0, -H / 2 + 0.65, 0));
  glass.add(at(box(0.7, H - 0.6, 0.32, fr), -W / 2 + 0.65, 0, 0));
  glass.position.z = D / 2 - 0.15;
  g.add(glass);
  // outline shown in see-through mode
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false }));
  edges.userData.own = true;
  g.add(edges);
  Object.assign(g.userData, { glass, fans: fans.all, topFans: fans.top, fade, edges, shellish: true });
  return g;
}

// Inverse of three's ACES filmic tone mapping (r160), solved numerically.
function aces(v, exposure) {
  const s = exposure / 0.6;
  const r = v.x * s, g = v.y * s, b = v.z * s;
  const i = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.076 * r + 0.90834 * g + 0.01566 * b, 0.0284 * r + 0.13383 * g + 0.83777 * b];
  const f = i.map(x => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));
  return new THREE.Vector3(
    1.60475 * f[0] - 0.53108 * f[1] - 0.07367 * f[2],
    -0.10208 * f[0] + 1.10813 * f[1] - 0.00605 * f[2],
    -0.00327 * f[0] - 0.07276 * f[1] + 1.07602 * f[2],
  );
}
function untonemapped(hex, exposure) {
  const c = new THREE.Color(hex); // linear
  const want = new THREE.Vector3(c.r, c.g, c.b);
  const x = want.clone();
  for (let i = 0; i < 60; i++) x.add(want.clone().sub(aces(x, exposure))).max(new THREE.Vector3());
  return new THREE.Color(x.x, x.y, x.z);
}

// ---------- ghosts (where an empty part will go) ----------
function ghostBox(w, h, d) {
  const g = new THREE.Group();
  const bg = geo(`gh${f2(w)}|${f2(h)}|${f2(d)}`, () => new THREE.BoxGeometry(w, h, d));
  g.add(new THREE.LineSegments(geo(`ge${f2(w)}|${f2(h)}|${f2(d)}`, () => new THREE.EdgesGeometry(bg)), MAT.ghostLine.clone()));
  const fill = new THREE.Mesh(bg, MAT.ghostFill.clone());
  g.add(fill);
  g.userData.fill = fill;
  return g;
}
function ghostSpec(key, L) {
  switch (key) {
    case 'case': return { size: [L.C.W, L.C.H, L.C.D], pos: new THREE.Vector3(0, 0, 0) };
    case 'mobo': return { size: [L.mw, L.mh, 0.3], pos: new THREE.Vector3(L.x0 + L.mw / 2, L.top - L.mh / 2, L.z + 0.15) };
    case 'cpu': return { size: [4, 4, 0.8], pos: L.cpu.clone().add(new THREE.Vector3(0, 0, 0.6)) };
    case 'cooler': return { size: [7, 12.4, 14], pos: L.cpu.clone().add(new THREE.Vector3(0.8, 0, 8.5)) };
    case 'ram': return { size: [L.dimms * 0.9, 13.3, 3.6], pos: L.ram.clone().add(new THREE.Vector3(L.dimms * 0.45 - 0.45, -6.65, 2.2)) };
    case 'gpu': return { size: [28, 5, 12.5], pos: L.gpu.clone().add(new THREE.Vector3(14, -2.6, 6.6)) };
    case 'storage': return { size: [8, 2.3, 0.8], pos: L.m2[0].clone().add(new THREE.Vector3(0, 0, 0.7)) };
    case 'psu': return { size: L.psuSize, pos: L.psu.clone() };
  }
}

function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && !o.geometry.userData.cached) o.geometry.dispose();
    const ms = [].concat(o.material || []);
    for (const m of ms) if (m.userData?.own) { m.alphaMap?.dispose(); m.map?.dispose(); m.dispose(); }
  });
}

// ---------- the scene ----------
export function createBench(canvas, { onHover, onPick, onReady, theme = 'light', still = false } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let dpr = Math.min(devicePixelRatio, coarse ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog('#000', 170, 380);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(34, 1, 1, 1000);
  const HOME = { pos: new THREE.Vector3(30, 36, 132), target: new THREE.Vector3(0, 22, 0) };
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 35;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI * 0.56;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
  let userMoved = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; userMoved = true; });

  // lights
  const hemi = new THREE.HemisphereLight('#ffffff', '#cfd5de', 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff6ee', 2.2);
  key.position.set(40, 90, 70);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 260 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rimA = new THREE.PointLight('#ffffff', 500, 220, 2);
  rimA.position.set(-60, 40, -40);
  const rimB = new THREE.PointLight('#cfe8ff', 320, 220, 2);
  rimB.position.set(60, -5, -30);
  scene.add(rimA, rimB);
  const inside = new THREE.PointLight('#ffffff', 0, 60, 2);
  scene.add(inside);
  // work light through the glass, so parts read clearly even when the PC is off
  // soft light inside the case, near the front-top, so parts stand off the back wall
  const innerFill = new THREE.PointLight('#eef6ff', 70, 55, 2);
  scene.add(innerFill);
  const fill = new THREE.SpotLight('#ffffff', 1600, 170, 0.36, 0.7, 2);
  fill.position.set(10, 55, 95);
  scene.add(fill, fill.target);

  // pedestal + floor grid
  const ped = new THREE.Group();
  const pedMat = std('#d9dde3', 0.95, 0.0);
  const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(34, 35, 1.6, 96), pedMat);
  pedTop.position.y = -1.5;
  ped.add(pedTop);
  const ringMat = new THREE.MeshStandardMaterial({ color: '#b4bcc7', emissive: new THREE.Color('#8fd3ff'), emissiveIntensity: 0, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(34.2, 0.16, 8, 160), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.7;
  ped.add(ring);
  const sh = canvasTex(128, 128, (g) => {
    const sg = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    sg.addColorStop(0, 'rgba(10,12,16,.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.fillRect(0, 0, 128, 128);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(76, 50), new THREE.MeshBasicMaterial({ map: sh, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  ped.add(shadow);
  let grid = null;
  scene.add(ped);

  const root = new THREE.Group();
  scene.add(root);

  // Always render through the composer (with MSAA) so colours never shift when the PC powers on;
  // the bloom pass itself only runs while it's powered.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: coarse ? 2 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.45, 1.0);
  bloom.enabled = false;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // state
  const live = new Map(); // key -> {group, cat, target, rot, explode, sig}
  const dying = [];
  const ghosts = new Map();
  let L = layout({ storage: [] });
  let exploded = 0, explodeTarget = 0, xray = 0, xrayTarget = 0;
  let powered = 0, powerTarget = 0;
  let focusCat = null, hoverCat = null, dragCat = null, dragOk = true, faultCat = null;
  let aio = false;
  const accent = new THREE.Color('#3b5bfd');
  let T = THEMES.light;
  const helper = new THREE.Box3Helper(new THREE.Box3(), accent);
  helper.material.transparent = true;
  helper.material.depthTest = false;
  helper.visible = false;
  scene.add(helper);
  let needsRender = true, shadowDirty = true;

  const EXPLODE = {
    case: ZERO, mobo: ZERO, cpu: new THREE.Vector3(0, 0, 7),
    cooler: new THREE.Vector3(-2, 12, 20), ram: new THREE.Vector3(5, 9, 13), gpu: new THREE.Vector3(6, -3, 22),
    storage: new THREE.Vector3(2, 0, 9), sata: new THREE.Vector3(10, 3, 18), psu: new THREE.Vector3(-4, -3, 26),
  };

  function setGhosts(rr) {
    for (const g of ghosts.values()) root.remove(g);
    ghosts.clear();
    for (const k of ['case', 'mobo', 'cpu', 'cooler', 'ram', 'gpu', 'storage', 'psu']) {
      const filled = k === 'storage' ? rr.storage.length > 0 : !!rr[k];
      if (filled) continue;
      const spec = ghostSpec(k, L);
      const gb = ghostBox(...spec.size);
      gb.position.copy(spec.pos);
      gb.traverse(o => { o.userData.cat = k; });
      gb.children[0].material.color.set(T.ghost);
      root.add(gb);
      ghosts.set(k, gb);
    }
  }

  function spawn(key, w, { fly = true } = {}) {
    const { group, cat } = w;
    group.traverse(o => {
      o.userData.cat = cat;
      if (o.isMesh) {
        const basic = o.material?.isMeshBasicMaterial || o.material === MAT.glass;
        o.castShadow = !basic && cat !== 'case';
        o.receiveShadow = !basic;
      }
    });
    const rot = w.rot || new THREE.Euler();
    const entry = { key, group, cat, target: w.pos.clone(), rot, explode: (w.ex || ZERO).clone(), sig: w.sig };
    if (fly) {
      group.position.copy(w.pos).add(new THREE.Vector3(10, 26, 46));
      group.scale.setScalar(0.4);
      group.rotation.set(rot.x + 0.4, rot.y - 0.6, rot.z + 0.2);
    } else {
      group.position.copy(w.pos);
      group.rotation.copy(rot);
    }
    root.add(group);
    live.set(key, entry);
  }

  function kill(key, { fly = true } = {}) {
    const e = live.get(key);
    if (!e) return;
    live.delete(key);
    if (!fly) { root.remove(e.group); disposeGroup(e.group); return; }
    e.target = e.group.position.clone().add(new THREE.Vector3(0, 20, 50));
    dying.push(e);
  }

  // Keep the whole case in view when its size changes (unless the user has moved the camera).
  function frameCase(animate) {
    const s = Math.max(L.C.H, L.C.W * 0.85) / 47;
    const target = new THREE.Vector3(0, L.C.H / 2 + 1, 0);
    const pos = target.clone().add(new THREE.Vector3(32, 16, 140).multiplyScalar(Math.max(0.72, s)));
    HOME.pos.copy(pos); HOME.target.copy(target);
    if (!userMoved) tweenTo(HOME.pos, HOME.target, animate ? 800 : 0);
  }
  function tweenTo(pos, target, ms) {
    const from = camera.position.clone(), ft = controls.target.clone();
    const start = performance.now();
    const step = () => {
      const p = ms ? Math.min(1, (performance.now() - start) / ms) : 1;
      const k = 1 - Math.pow(1 - p, 3);
      camera.position.lerpVectors(from, pos, k);
      controls.target.lerpVectors(ft, target, k);
      needsRender = true;
      if (p < 1) requestAnimationFrame(step);
    };
    step();
  }

  let prevCaseKey = null;
  function update(rr) {
    L = layout(rr);
    root.position.y = L.C.H / 2 + 1;
    const caseKey = `${L.C.W}|${L.C.H}`;
    if (caseKey !== prevCaseKey) { frameCase(prevCaseKey !== null); prevCaseKey = caseKey; }
    aio = rr.cooler?.kind === 'aio';

    const want = new Map();
    const geoKey = `${L.size}|${L.C.W}|${L.form}|${L.dimms}`;
    const add = (k, id, cat, make, pos, ex, rot) => want.set(k, { sig: `${id}|${geoKey}`, cat, make, pos, ex, rot });
    if (rr.case) add('case', `${rr.case.id}:${rr.case.color}`, 'case', () => buildCase(rr.case, L, accent), ZERO, EXPLODE.case);
    if (rr.mobo) add('mobo', rr.mobo.id, 'mobo', () => buildMobo(rr.mobo, L), L.mobo, EXPLODE.mobo);
    if (rr.cpu) add('cpu', rr.cpu.id, 'cpu', () => buildCpu(rr.cpu), L.cpu, EXPLODE.cpu);
    if (rr.cooler) add('cooler', rr.cooler.id, 'cooler', () => (aio ? buildAio(rr.cooler, L) : buildAirCooler(rr.cooler)), L.cpu, aio ? new THREE.Vector3(0, 8, 12) : EXPLODE.cooler);
    if (rr.ram) add('ram', rr.ram.id, 'ram', () => buildRam(rr.ram, L), L.ram, EXPLODE.ram);
    if (rr.gpu) add('gpu', rr.gpu.id, 'gpu', () => buildGpu(rr.gpu), L.gpu, EXPLODE.gpu);
    if (rr.psu) add('psu', rr.psu.id, 'psu', () => buildPsu(rr.psu), L.psu, EXPLODE.psu, L.psuRot);
    if (rr.psu && rr.mobo) add('cables', `${rr.psu.id}:${rr.mobo.id}:${rr.gpu?.id}:${rr.case?.color}`, 'psu', () => buildCables(rr, L), ZERO, ZERO);
    let mi = 0, si = 0;
    for (const d of rr.storage) {
      if (d.kind === 'm2') { const i = mi++; add(`m2:${d.id}`, d.id + i, 'storage', () => buildM2(d), L.m2[Math.min(i, 2)], EXPLODE.storage); }
      else { const i = si++; add(`sata:${d.id}`, d.id + i, 'storage', () => buildSata(d), L.sata[Math.min(i, 1)].clone().add(new THREE.Vector3(0, d.read < 300 ? 1 : 0, 0)), EXPLODE.sata); }
    }

    const replaced = new Set();
    for (const [k, e] of [...live]) {
      const w = want.get(k);
      if (!w) kill(k, { fly: k !== 'cables' });
      else if (w.sig !== e.sig) {
        const sameId = w.sig.split('|')[0] === e.sig.split('|')[0];
        if (sameId || k === 'cables') replaced.add(k);
        kill(k, { fly: !sameId && k !== 'cables' });
      }
    }
    for (const [k, w] of want) {
      const e = live.get(k);
      if (e && e.sig === w.sig) { e.target.copy(w.pos); continue; }
      spawn(k, { ...w, group: w.make() }, { fly: !replaced.has(k) && k !== 'cables' });
    }
    const cs = live.get('case');
    if (cs) cs.group.userData.topFans.forEach(f => { f.visible = !aio; });
    setGhosts(rr);
    needsRender = true; shadowDirty = true;
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = [];
    for (const e of live.values()) objs.push(e.group);
    for (const g of ghosts.values()) objs.push(g.userData.fill);
    const hits = ray.intersectObjects(objs, true).filter(h => h.object.userData.cat && h.object.material !== MAT.glass && !h.object.isLineSegments);
    const nonCase = hits.find(h => h.object.userData.cat !== 'case');
    const hit = nonCase || hits[0];
    return hit ? hit.object.userData.cat : null;
  }
  let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 5) return;
    const cat = pickAt(e.clientX, e.clientY);
    if (cat) onPick?.(cat);
  });
  let hoverQueued = null;
  canvas.addEventListener('pointermove', e => {
    if (e.buttons || e.pointerType === 'touch') return;
    // raycast at most once per frame
    if (!hoverQueued) requestAnimationFrame(() => {
      const { x, y } = hoverQueued; hoverQueued = null;
      const cat = pickAt(x, y);
      if (cat !== hoverCat) { hoverCat = cat; canvas.style.cursor = cat ? 'pointer' : 'grab'; needsRender = true; }
      onHover?.(cat, x, y);
    });
    hoverQueued = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => { hoverCat = null; onHover?.(null); });
  controls.addEventListener('change', () => { needsRender = true; });

  // ---------- resize + visibility ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 46 : 34;
    camera.zoom = w / h < 0.8 ? 0.8 : 1;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  let onScreen = true;
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; needsRender = true; }).observe(canvas);

  // ---------- theme ----------
  function setTheme(name) {
    T = THEMES[name] || THEMES.light;
    // The whole frame is tone mapped, so pick the background that comes out as exactly the theme colour.
    scene.background.copy(untonemapped(T.bg, renderer.toneMappingExposure));
    scene.fog.color.copy(scene.background);
    pedMat.color.set(T.ped);
    ringMat.color.set(T.ring);
    ringMat.emissiveIntensity = T.ringGlow;
    hemi.intensity = T.hemi;
    hemi.groundColor.set(name === 'dark' ? '#10151c' : '#cfd5de');
    key.intensity = T.key;
    fill.intensity = T.fill;
    accent.set(T.accent);
    MAT.ghostLine.color.set(T.ghost);
    for (const g of ghosts.values()) g.children[0].material.color.set(T.ghost);
    for (const e of live.values()) e.group.userData.edges?.material.color.copy(accent);
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
    grid = new THREE.PolarGridHelper(130, 16, 7, 96, T.grid, T.grid);
    grid.material.transparent = true;
    grid.material.opacity = name === 'dark' ? 0.55 : 0.5;
    grid.position.y = -2.4;
    scene.add(grid);
    needsRender = true;
  }
  setTheme(theme);

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);
  // still: no animation at all (used to render the press thumbnail)
  const reduce = still || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frameNo = 0, slow = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!onScreen || document.hidden) return;
    frameNo++;
    const t = clock.elapsedTime;
    const k = still ? 1 : 1 - Math.exp(-dt * (reduce ? 40 : 7));
    let busy = false;
    const ease = (v, to, rate) => { const n = v + (to - v) * rate; if (Math.abs(to - n) > 1e-4) busy = true; return Math.abs(to - n) > 1e-4 ? n : to; };
    exploded = ease(exploded, explodeTarget, k);
    xray = ease(xray, Math.max(xrayTarget, explodeTarget), k);
    powered = ease(powered, powerTarget, still ? 1 : 1 - Math.exp(-dt * 3));

    let moving = false;
    for (const e of live.values()) {
      tmp.copy(e.target).addScaledVector(e.explode, exploded);
      if (e.cat === hoverCat && e.cat !== 'case' && !dragCat && exploded < 0.5) tmp.z += 1.2;
      if (e.group.position.distanceToSquared(tmp) > 1e-5 || Math.abs(e.group.scale.x - 1) > 1e-4 || Math.abs(e.group.rotation.x - e.rot.x) > 1e-4) moving = true;
      e.group.position.lerp(tmp, k);
      e.group.scale.lerp(ONE, k);
      e.group.rotation.x += (e.rot.x - e.group.rotation.x) * k;
      e.group.rotation.y += (e.rot.y - e.group.rotation.y) * k;
      e.group.rotation.z += (e.rot.z - e.group.rotation.z) * k;
      if (e.key === 'cables') e.group.visible = exploded < 0.05;
      const u = e.group.userData;
      if (u.shellish) {
        u.glass.position.z = L.C.D / 2 - 0.15 + exploded * 28;
        u.glass.position.y = exploded * 8;
        u.glass.rotation.y = -exploded * 0.35;
        for (const m of u.fade) {
          const o = 1 - 0.84 * xray;
          const tr = o < 0.999;
          if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
          m.opacity = o;
        }
        u.edges.material.opacity = xray * 0.9;
        u.edges.visible = xray > 0.01;
      }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const e = dying[i];
      moving = true;
      e.group.position.lerp(e.target, k * 0.8);
      e.group.scale.multiplyScalar(1 - k * 0.9);
      if (e.group.scale.x < 0.03) { root.remove(e.group); disposeGroup(e.group); dying.splice(i, 1); }
    }
    if (moving) { busy = true; shadowDirty = true; }

    // fans
    const spin = powered * (reduce ? 0.1 : 1);
    if (spin > 0.001) { busy = true; for (const e of live.values()) for (const f of e.group.userData.fans || []) f.userData.rotor.rotation.z += dt * 16 * spin; }

    // RGB: off-white when off, colour cycle when powered, red when something's wrong
    const hue = (0.58 + Math.sin(t * 0.35) * 0.14 + 1) % 1;
    if (faultCat) { MAT.rgb.emissive.copy(FAULT); busy = true; }
    else if (powered > 0.02) MAT.rgb.emissive.setHSL(hue, 0.9, 0.5);
    else MAT.rgb.emissive.setRGB(0, 0, 0);
    // darken the diffuser as it lights up so the colour reads instead of washing out to white
    MAT.rgb.color.lerpColors(RGB_OFF, RGB_ON, Math.max(powered, faultCat ? 1 : 0));
    MAT.rgb.emissiveIntensity = (powered * 1.7 + (faultCat ? 1.4 + Math.sin(t * 10) * 0.8 : 0)) * T.glow;
    inside.intensity = powered * 140;
    inside.position.set(0, root.position.y + 5, 2);
    innerFill.position.set(L.C.W / 2 - 7, root.position.y + L.C.H / 2 - 7, L.C.D / 2 - 3);
    inside.color.copy(MAT.rgb.emissive);
    fill.target.position.set(0, root.position.y, 0);
    // The glow threshold depends on the theme: a light background is itself brighter than 1.0 before tone mapping.
    bloom.threshold = T.bloomAt;
    bloom.strength = powered * 0.55 + (faultCat ? 0.3 : 0);
    bloom.enabled = powered > 0.01 || !!faultCat;

    // ghosts pulse; highlight the focused / dragged slot
    let pulsing = false;
    for (const [cat, g] of ghosts) {
      const hot = cat === dragCat || cat === focusCat || cat === hoverCat;
      const line = g.children[0].material;
      line.color.copy(cat === dragCat && !dragOk ? FAULT : hot ? accent : line.color.set(T.ghost));
      line.opacity = hot ? 0.8 + Math.sin(t * 6) * 0.2 : 0.45;
      g.userData.fill.material.color.copy(accent);
      g.userData.fill.material.opacity = cat === dragCat ? 0.14 + Math.sin(t * 6) * 0.05 : hot ? 0.07 : 0;
      g.visible = exploded < 0.5 || cat === 'case';
      if (hot && !reduce) pulsing = true;
    }
    const hc = dragCat || hoverCat || focusCat;
    const hk = hc && hc !== 'case' && !ghosts.has(hc) ? [...live.values()].find(e => e.cat === hc && e.key !== 'cables') : null;
    if (hk) {
      helper.box.setFromObject(hk.group);
      helper.box.expandByScalar(0.4);
      helper.material.color.copy(dragCat && !dragOk ? FAULT : accent);
      helper.material.opacity = 0.55 + (reduce ? 0 : Math.sin(t * 5) * 0.25);
      helper.visible = true;
      if (!reduce) pulsing = true;
    } else helper.visible = false;

    if (controls.update()) busy = true;
    // Idle: draw nothing. A gentle pulse alone only needs ~30fps.
    if (!busy && !needsRender && !(pulsing && frameNo % 2 === 0)) return;
    needsRender = false;
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    composer.render();

    // Drop resolution on slow devices instead of stuttering.
    if (busy && dt > 1 / 38) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 50 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); slow = 0; }
  }
  requestAnimationFrame(frame);
  onReady?.();

  return {
    update,
    setTheme,
    setFocus(cat) { focusCat = cat; needsRender = true; },
    setDrag(cat, ok = true) { dragCat = cat; dragOk = ok; if (cat) controls.autoRotate = false; needsRender = true; },
    setExploded(on) { explodeTarget = on ? 1 : 0; },
    setXray(on) { xrayTarget = on ? 1 : 0; },
    setPowered(on) { powerTarget = on ? 1 : 0; if (on) faultCat = null; },
    setFault(cat) { faultCat = cat; if (cat) setTimeout(() => { faultCat = null; needsRender = true; }, 2600); },
    resetView() { userMoved = false; tweenTo(HOME.pos, HOME.target, 700); },
    setAutoRotate(on) { controls.autoRotate = on; needsRender = true; },
    get autoRotate() { return controls.autoRotate; },
    canvasRect: () => canvas.getBoundingClientRect(),
  };
}
