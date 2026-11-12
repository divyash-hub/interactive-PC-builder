import { PARTS, CATEGORIES, GAMES, AFFILIATE, CASE_SIZES } from './data.js';

export const byId = (cat, id) => PARTS[cat]?.find(p => p.id === id) || null;

// A build stores ids; resolve to part objects.
export function resolve(build) {
  const r = {};
  for (const c of CATEGORIES) {
    if (c.multi) r[c.key] = (build[c.key] || []).map(id => byId(c.key, id)).filter(Boolean);
    else r[c.key] = build[c.key] ? byId(c.key, build[c.key]) : null;
  }
  // A case can come in several colours; apply the chosen one.
  const v = r.case && build.color && r.case.colors.find(x => x.key === build.color);
  if (v) r.case = { ...r.case, color: v.hex, img: v.img, bg: v.bg, colorKey: v.key };
  return r;
}

export function total(r, cur) {
  let t = 0;
  for (const c of CATEGORIES) {
    const v = r[c.key];
    if (Array.isArray(v)) v.forEach(p => (t += p.price[cur]));
    else if (v) t += v.price[cur];
  }
  return t;
}

export function powerDraw(r) {
  let w = 45; // board, fans, peripherals
  if (r.cpu) w += r.cpu.draw;
  if (r.gpu) w += r.gpu.tdp;
  if (r.ram) w += r.ram.sticks * 4;
  w += (r.storage || []).reduce((s, d) => s + (d.kind === 'm2' ? 7 : 6), 0);
  if (r.cooler?.kind === 'aio') w += 10;
  return Math.round(w);
}

export const recommendedPsu = draw => Math.ceil((draw * 1.4) / 50) * 50;

// Why can't `part` go into this build? Returns array of {level, msg}.
// Used both for whole-build checks and for greying out catalog items.
export function conflictsFor(cat, part, r) {
  const out = [];
  const err = (msg, key = msg) => out.push({ level: 'error', msg, key });
  const warn = (msg, key = msg) => out.push({ level: 'warn', msg, key });
  const { cpu, mobo, ram, gpu, cooler, psu } = r;
  const cs = r.case;

  if (cat === 'cpu') {
    if (mobo && mobo.socket !== part.socket) err(`${part.socket} chip won't fit the ${mobo.socket} socket on your board`, 'socket');
    if (ram && !part.mem.includes(ram.type)) err(`Doesn't support ${ram.type} memory`, 'cpumem');
  }
  if (cat === 'mobo') {
    if (cpu && cpu.socket !== part.socket) err(`${part.socket} board, but your CPU is ${cpu.socket}`, 'socket');
    if (ram && ram.type !== part.mem) err(`Takes ${part.mem}, your memory is ${ram.type}`, 'memtype');
    if (cs && !cs.forms.includes(part.form)) err(`${part.form} board won't fit in the ${cs.name}`, 'form');
    const m2 = (r.storage || []).filter(d => d.kind === 'm2').length;
    if (m2 > part.m2) err(`Only ${part.m2} M.2 slots, you have ${m2} NVMe drives`);
  }
  if (cat === 'ram') {
    if (mobo && mobo.mem !== part.type) err(`Your board takes ${mobo.mem}, this is ${part.type}`, 'memtype');
    else if (cpu && !cpu.mem.includes(part.type)) err(`${cpu.name} doesn't support ${part.type}`, 'cpumem');
    if (mobo && part.sticks > mobo.dimms) err(`Needs ${part.sticks} slots, board has ${mobo.dimms}`);
  }
  if (cat === 'gpu') {
    if (cs && part.length > cs.gpuMax) err(`${part.length}mm long; ${cs.name} fits ${cs.gpuMax}mm`, 'gpulen');
  }
  if (cat === 'cooler') {
    if (cs && part.kind === 'air' && part.height > cs.coolerMax) err(`${part.height}mm tall; case clearance is ${cs.coolerMax}mm`, 'coolh');
    if (cs && part.kind === 'aio' && part.rad > cs.radMax) err(`${part.rad}mm radiator; case fits up to ${cs.radMax}mm`, 'rad');
    if (cpu && part.rating < cpu.tdp) warn(`Rated ${part.rating}W, your CPU can pull ${cpu.tdp}W`);
  }
  if (cat === 'case') {
    if (mobo && !part.forms.includes(mobo.form)) err(`Doesn't take ${mobo.form} boards`, 'form');
    if (gpu && gpu.length > part.gpuMax) err(`GPU is ${gpu.length}mm, case fits ${part.gpuMax}mm`, 'gpulen');
    if (cooler?.kind === 'air' && cooler.height > part.coolerMax) err(`Cooler is ${cooler.height}mm, case fits ${part.coolerMax}mm`, 'coolh');
    if (cooler?.kind === 'aio' && cooler.rad > part.radMax) err(`${cooler.rad}mm radiator won't mount, max ${part.radMax}mm`, 'rad');
  }
  if (cat === 'psu') {
    const draw = powerDraw(r);
    if (part.watts < draw) err(`${part.watts}W is below the ~${draw}W this build can draw`);
    else if (part.watts < draw * 1.25) warn(`Tight: ~${draw}W load on ${part.watts}W, aim for ${recommendedPsu(draw)}W`);
  }
  if (cat === 'storage') {
    if (part.kind === 'm2' && mobo) {
      const used = (r.storage || []).filter(d => d.kind === 'm2').length;
      if (used >= mobo.m2) err(`All ${mobo.m2} M.2 slots are taken`);
    }
    if ((r.storage || []).length >= 3) err('Three drives max in this planner');
  }
  return out;
}

// Whole-build issues (each installed part checked against the others).
export function checkBuild(r) {
  const issues = [];
  const seen = new Set();
  const add = (cat, list) => list.forEach(i => {
    const k = i.key || i.msg;
    if (!seen.has(k)) { seen.add(k); issues.push({ ...i, cat }); }
  });
  const others = (skip) => ({ ...r, [skip]: skip === 'storage' ? [] : null });
  for (const c of CATEGORIES) {
    if (c.key === 'storage') continue;
    const part = r[c.key];
    if (part) add(c.key, conflictsFor(c.key, part, others(c.key)));
  }
  // Missing-part notes
  if (r.cpu && !r.cpu.igpu && !r.gpu) issues.push({ cat: 'gpu', level: 'error', msg: `${r.cpu.name} has no integrated graphics, add a graphics card for display output` });
  if (r.cpu && !r.cooler && !r.cpu.boxCooler) issues.push({ cat: 'cooler', level: 'error', msg: `${r.cpu.name} ships without a cooler, add one` });
  if (r.ram && r.ram.size < 32 && r.gpu && r.gpu.score > 170) issues.push({ cat: 'ram', level: 'warn', msg: '16GB can hitch in newer games on a GPU this fast; 32GB is the safe pick' });
  if (r.case && !r.case.fanCount) issues.push({ cat: 'case', level: 'warn', msg: `The ${r.case.name} comes with no fans. Add at least three, or your parts will run hot` });
  else if (r.case && r.case.fanCount < 2 && r.gpu && r.gpu.tdp > 280) issues.push({ cat: 'case', level: 'warn', msg: `Only ${r.case.fanCount} fan in the box. A card this hot is happier with one or two more` });
  if (r.gpu && r.gpu.vram <= 8 && r.gpu.score >= 110) issues.push({ cat: 'gpu', level: 'warn', msg: '8GB of VRAM limits texture settings in some 2025+ games' });
  return issues;
}

export function missingRequired(r) {
  const miss = [];
  for (const c of CATEGORIES) {
    const v = r[c.key];
    const empty = Array.isArray(v) ? v.length === 0 : !v;
    if (c.required && empty) miss.push(c);
  }
  if (r.cpu && !r.cpu.igpu && !r.gpu) miss.push(CATEGORIES.find(c => c.key === 'gpu'));
  if (r.cpu && !r.cpu.boxCooler && !r.cooler) miss.push(CATEGORIES.find(c => c.key === 'cooler'));
  return miss;
}

// ----- Performance model -----
export const RES = { '1080p': 1, '1440p': 0.68, '4K': 0.37 };
const IGPU_SCORE = 18;

export function gpuScore(r) {
  if (r.gpu) return r.gpu.score;
  if (r.cpu?.igpu) return IGPU_SCORE;
  return 0;
}

export function fps(game, r, res) {
  if (!r.cpu) return 0;
  const g = gpuScore(r);
  if (!g) return 0;
  // Memory: faster DDR5 helps CPU-bound titles a bit; 16GB costs a little in heavy games
  let memMul = 1;
  if (r.ram) {
    if (r.ram.type === 'DDR4') memMul *= 0.97;
    if (r.ram.size < 32 && game.gpu < 100) memMul *= 0.96;
  }
  // GPU bound fps; esports titles scale sub-linearly with resolution
  const resMul = game.kind === 'Esports' ? Math.pow(RES[res], 0.55) : RES[res];
  const vramPenalty = r.gpu && r.gpu.vram <= 8 && res !== '1080p' && game.gpu < 100 ? 0.85 : 1;
  const gpuFps = (game.gpu * g / 100) * resMul * vramPenalty;
  const cpuFps = game.cpu * r.cpu.game / 100 * memMul;
  let f = Math.min(gpuFps, cpuFps);
  if (game.cap) f = Math.min(f, game.cap);
  return Math.max(0, Math.round(f));
}

export function verdict(f, cap) {
  if (f === 0) return { key: 'none', label: 'Won’t run' };
  if (cap && f >= cap) return { key: 'max', label: 'Locked at cap' };
  if (f < 30) return { key: 'bad', label: 'Unplayable' };
  if (f < 55) return { key: 'meh', label: 'Playable' };
  if (f < 120) return { key: 'good', label: 'Smooth' };
  return { key: 'great', label: 'High refresh' };
}

// Which part is holding the build back at this resolution?
export function bottleneck(r, res) {
  if (!r.cpu || !gpuScore(r)) return null;
  let cpuBound = 0, n = 0;
  for (const g of GAMES) {
    if (g.cap) continue;
    const resMul = g.kind === 'Esports' ? Math.pow(RES[res], 0.55) : RES[res];
    const gpuFps = g.gpu * gpuScore(r) / 100 * resMul;
    const cpuFps = g.cpu * r.cpu.game / 100;
    if (cpuFps < gpuFps * 0.92) cpuBound++;
    n++;
  }
  const share = cpuBound / n;
  if (share >= 0.5) return { part: 'cpu', share, msg: `CPU limits ${Math.round(share * 100)}% of tested games at ${res}. A faster processor will raise fps more than a faster GPU.` };
  if (share <= 0.15) return { part: 'gpu', share, msg: `GPU-limited at ${res}, which is what you want. Upgrade the graphics card first when you need more fps.` };
  return { part: 'balanced', share, msg: `Well balanced at ${res}: CPU and GPU limit fps in roughly equal measure.` };
}

// Simple workload scores, 0–100
export function workloadScores(r) {
  const cpuMt = r.cpu?.mt || 0;
  const g = gpuScore(r);
  const ram = r.ram?.size || 0;
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  return [
    { key: 'gaming',    label: 'Gaming',               v: clamp((g / 260) * 75 + ((r.cpu?.game || 0) / 142) * 25) },
    { key: 'streaming', label: 'Gaming + streaming',   v: clamp((g / 260) * 55 + (cpuMt / 290) * 45) },
    { key: 'editing',   label: 'Video & photo editing',v: clamp((cpuMt / 290) * 55 + (g / 260) * 25 + Math.min(ram, 64) / 64 * 20) },
    { key: 'dev',       label: 'Coding & compiling',   v: clamp((cpuMt / 290) * 70 + Math.min(ram, 64) / 64 * 30) },
    { key: 'ai',        label: 'Local AI models',      v: clamp(((r.gpu?.vram || 0) / 32) * 60 + (g / 360) * 30 + Math.min(ram, 64) / 64 * 10) },
  ];
}

// ----- Auto-build: best scoring build within budget -----
const cheapest = (list) => list.slice().sort((a, b) => a.price.inr - b.price.inr)[0];

export function autoBuild({ budget, cur, use, brand }) {
  const price = x => x.price[cur];
  const cpus = PARTS.cpu.filter(c => brand === 'any' || c.brand.toLowerCase() === brand);
  const gpus = [null, ...PARTS.gpu];
  let best = null;

  for (const cpu of cpus) {
    for (const gpu of gpus) {
      if (!gpu && !cpu.igpu) continue;
      if (!gpu && use === 'gaming') continue;
      if (gpu && use === 'office' && cpu.igpu) continue; // integrated graphics is plenty
      const memType = cpu.mem.includes('DDR5') ? ['DDR5', 'DDR4'] : ['DDR4'];
      for (const mt of memType) {
        const mobos = PARTS.mobo.filter(m => m.socket === cpu.socket && m.mem === mt);
        if (!mobos.length) continue;
        const mobo = mobos.slice().sort((a, b) => price(a) - price(b))[0];
        const lowBudget = budget < (cur === 'inr' ? 75000 : 800);
        const wantRam = use === 'office' || lowBudget ? 16 : 32;
        const ramList = PARTS.ram.filter(x => x.type === mt).sort((a, b) => price(a) - price(b));
        const ram = ramList.find(x => x.size >= wantRam) || ramList[ramList.length - 1];
        const storage = PARTS.storage.filter(s => s.kind === 'm2' && s.size >= 1000).sort((a, b) => price(a) - price(b))[0];
        const partial = { cpu, gpu, mobo, ram, storage: [storage], cooler: null, psu: null, case: null };
        let cooler = null;
        if (!cpu.boxCooler || cpu.tdp > 100) {
          cooler = PARTS.cooler.filter(c => c.rating >= cpu.tdp && c.kind === 'air').sort((a, b) => price(a) - price(b))[0];
        }
        partial.cooler = cooler;
        const draw = powerDraw(partial);
        const psu = PARTS.psu.filter(x => x.watts >= draw * 1.3).sort((a, b) => price(a) - price(b))[0];
        if (!psu) continue;
        const cs = PARTS.case.filter(c => c.forms.includes(mobo.form) && (!gpu || gpu.length <= c.gpuMax) && (!cooler || cooler.height <= c.coolerMax))
          .sort((a, b) => price(a) - price(b))[0];
        if (!cs) continue;
        const build = { ...partial, psu, case: cs };
        const cost = total(build, cur);
        if (cost > budget) continue;
        const gs = gpu ? gpu.score : IGPU_SCORE;
        let score;
        if (use === 'gaming') score = Math.min(gs, cpu.game * 2.1) * 1 + cpu.game * 0.35;
        else if (use === 'creator') score = cpu.mt * 0.7 + gs * 0.35;
        else score = Math.min(cpu.mt, 110) + Math.min(gs, 60) * 0.2 - (cost / budget) * 60; // everyday: good enough, cheaper wins
        score += (mt === 'DDR5' ? 3 : 0);
        if (!best || score > best.score || (score === best.score && cost < best.cost)) best = { score, cost, build };
      }
    }
  }
  if (!best) return null;

  // Spend leftovers on quality-of-life upgrades, in priority order
  const b = best.build;
  const upgrade = (cat, candidates) => {
    for (const c of candidates) {
      const curCost = total(b, cur);
      const old = b[cat];
      const delta = price(c) - (Array.isArray(old) ? price(old[0]) : old ? price(old) : 0);
      if (delta <= 0) continue;
      if (curCost + delta > budget) continue;
      const trial = { ...b, [cat]: Array.isArray(old) ? [c] : c };
      if (conflictsFor(cat, c, { ...trial, [cat]: Array.isArray(old) ? [] : null }).some(i => i.level === 'error')) continue;
      b[cat] = Array.isArray(old) ? [c] : c;
      return true;
    }
    return false;
  };
  upgrade('storage', PARTS.storage.filter(s => s.kind === 'm2' && s.size >= 2000).sort((a, b2) => price(a) - price(b2)));
  if (use !== 'office') upgrade('case', PARTS.case.filter(c => ['lancool216', 'north', 'h5flow'].includes(c.id)).sort((a, b2) => price(b2) - price(a)));
  if (b.cpu.tdp > 100 || use === 'creator') upgrade('cooler', PARTS.cooler.filter(c => c.rating >= b.cpu.tdp + 40).sort((a, b2) => price(a) - price(b2)));
  if (use === 'creator') upgrade('ram', PARTS.ram.filter(x => x.type === b.ram.type && x.size === 64));
  upgrade('psu', PARTS.psu.filter(x => x.rating === 'Gold' && x.watts >= recommendedPsu(powerDraw(b))).sort((a, b2) => price(a) - price(b2)));

  return {
    cpu: b.cpu.id, mobo: b.mobo.id, ram: b.ram.id, gpu: b.gpu?.id || null,
    storage: b.storage.map(s => s.id), cooler: b.cooler?.id || null, psu: b.psu.id, case: b.case.id,
  };
}

// ----- Links, money, sharing -----
export function buyUrl(part, cur) {
  const host = cur === 'inr' ? 'https://www.amazon.in/s' : 'https://www.amazon.com/s';
  const shade = part.colors?.length > 1 ? ' ' + part.colors.find(v => v.key === part.colorKey).name : '';
  const q = new URLSearchParams({ k: part.name.replace(/\(.*?\)/g, '').trim() + shade });
  if (AFFILIATE[cur]) q.set('tag', AFFILIATE[cur]);
  return `${host}?${q}`;
}

export function money(v, cur) {
  return new Intl.NumberFormat(cur === 'inr' ? 'en-IN' : 'en-US', {
    style: 'currency', currency: cur === 'inr' ? 'INR' : 'USD', maximumFractionDigits: 0,
  }).format(v);
}

export function encodeBuild(build) {
  const parts = [];
  for (const c of CATEGORIES) {
    const v = build[c.key];
    if (Array.isArray(v) ? v.length : v) parts.push(`${c.key}=${Array.isArray(v) ? v.join('+') : v}`);
  }
  if (build.case && build.color) parts.push(`color=${build.color}`);
  return parts.join('&');
}

export function decodeBuild(str) {
  const b = emptyBuild();
  for (const kv of str.split('&')) {
    const [k, v] = kv.split('=');
    if (k === 'color') { b.color = v || null; continue; }
    const cat = CATEGORIES.find(c => c.key === k);
    if (!cat || !v) continue;
    if (cat.multi) b[k] = v.split('+').filter(id => byId(k, id)).slice(0, cat.multi);
    else if (byId(k, v)) b[k] = v;
  }
  if (!b.case || !byId('case', b.case).colors.some(x => x.key === b.color)) b.color = null;
  return b;
}

export function emptyBuild() {
  const b = {};
  for (const c of CATEGORIES) b[c.key] = c.multi ? [] : null;
  b.color = null;
  return b;
}

export function specLine(cat, x) {
  switch (cat) {
    case 'cpu': return `${x.cores}C/${x.threads}T · ${x.boost} GHz · ${x.socket}${x.igpu ? '' : ' · no iGPU'}`;
    case 'mobo': return `${x.socket} · ${x.form} · ${x.mem} · ${x.m2}× M.2`;
    case 'ram': return `${x.type}-${x.speed} · ${x.size}GB`;
    case 'gpu': return `${x.vram}GB · ${x.length}mm · ${x.tdp}W`;
    case 'storage': return `${x.size >= 1000 ? x.size / 1000 + 'TB' : x.size + 'GB'} · ${x.kind === 'm2' ? 'M.2 NVMe' : 'SATA'} · ${x.read.toLocaleString()} MB/s`;
    case 'cooler': return x.kind === 'air' ? `Air · ${x.height}mm tall · ${x.rating}W` : `${x.rad}mm liquid · ${x.rating}W`;
    case 'psu': return `${x.watts}W · 80+ ${x.rating} · ${x.modular === 'No' ? 'non-modular' : 'modular'}`;
    case 'case': return `${CASE_SIZES[x.size]} · ${x.fanCount ? `${x.fanCount} fans included` : 'no fans included'} · GPU up to ${x.gpuMax}mm`;
  }
  return '';
}

// Headline perf number used for sorting the catalog
export function perfOf(cat, x) {
  switch (cat) {
    case 'cpu': return x.game * 2 + x.mt;
    case 'gpu': return x.score;
    case 'ram': return x.size * 100 + x.speed / 100;
    case 'storage': return x.read + x.size;
    case 'psu': return x.watts;
    case 'cooler': return x.rating;
    case 'case': return x.gpuMax;
    case 'mobo': return x.m2 * 10 + (x.form === 'ATX' ? 5 : 0);
  }
  return 0;
}

// Smallest budget (in `step`s) that produces any build for these choices.
export function minimumBudget({ cur, use, brand }) {
  const step = cur === 'inr' ? 5000 : 50;
  for (let b = step; b <= (cur === 'inr' ? 600000 : 6000); b += step) {
    if (autoBuild({ budget: b, cur, use, brand })) return b;
  }
  return null;
}
