import { PARTS, CATEGORIES, GAMES, PRESETS, CATALOG_UPDATED } from './data.js';
import {
  byId, resolve, total, powerDraw, recommendedPsu, conflictsFor, checkBuild,
  fps, verdict, bottleneck, autoBuild, buyUrl, money,
  encodeBuild, decodeBuild, emptyBuild, specLine, perfOf, minimumBudget,
} from './engine.js';
import { sound } from './sound.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  // Falls back to keys from the project's old name so nobody loses saved builds.
  get(k, d) { try { const v = localStorage.getItem(k) ?? localStorage.getItem(k.replace('coreframe:', 'rigsmith:')); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const CART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h11L21 7H6.3"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>';
const STAGE_OF = { cpu: 'cpu', mobo: 'cpu', cooler: 'cpu', psu: 'cpu', case: 'cpu', ram: 'dram', gpu: 'vga', storage: 'boot' };
const STAGES = [
  { key: 'cpu', name: 'processor and board' },
  { key: 'dram', name: 'memory' },
  { key: 'vga', name: 'graphics' },
  { key: 'boot', name: 'storage' },
];

// ---------- State ----------
function fromHash() {
  const h = location.hash.slice(1);
  if (!h) return null;
  return { build: decodeBuild(h.replace(/&?name=[^&]*/, '')), name: new URLSearchParams(h).get('name') };
}
const hashed = fromHash();
const saved = store.get('coreframe:current', null);
const state = {
  build: decodeBuild(encodeBuild(hashed?.build || saved?.build || emptyBuild())),
  name: hashed?.name || saved?.name || 'My first PC',
  cur: store.get('coreframe:cur', 'inr'),
  step: 0,
  sort: 'rec',
  hideBad: true,
  res: '1080p',
  powered: false,
  posting: false,
  theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  caseView: {}, // colour shown on each case card before it's added
};
const cat = () => CATEGORIES[state.step];
const catInfo = k => CATEGORIES.find(c => c.key === k);
const r = () => resolve(state.build);
const isFilled = (k, rr = r()) => (Array.isArray(rr[k]) ? rr[k].length > 0 : !!rr[k]);
const withoutCat = (rr, k) => ({ ...rr, [k]: catInfo(k).multi ? rr[k] : null });
const filledCount = rr => CATEGORIES.filter(c => isFilled(c.key, rr)).length;
const firstEmptyStep = rr => { const i = CATEGORIES.findIndex(c => !isFilled(c.key, rr)); return i < 0 ? 0 : i; };
state.step = firstEmptyStep(r());

// ---------- 3D (loaded lazily; the planner still works without it) ----------
let bench = null;
const queued = [];
const B = new Proxy({}, { get: (_, k) => (...a) => { if (bench) return bench[k]?.(...a); queued.push([k, a]); } });
(async () => {
  try {
    await Promise.race([document.fonts?.ready, sleep(1500)]);
    const { createBench } = await import('./scene.js');
    bench = createBench($('#bench'), { theme: state.theme, onHover: showTip, onPick: k => goStep(CATEGORIES.findIndex(c => c.key === k), { tab: true }) });
    for (const [k, a] of queued) if (k !== 'update') bench[k]?.(...a);
    bench.update(r());
    bench.setFocus(cat().key);
    $('#loading').classList.add('done');
  } catch (e) {
    console.error(e);
    $('#loading').remove();
    $('#nogl').hidden = false;
  }
})();

function showTip(k, x, y) {
  const tip = $('#tip');
  if (!k || document.body.classList.contains('dragging')) { tip.hidden = true; return; }
  $('#hintChip').classList.add('gone');
  const v = r()[k];
  const name = Array.isArray(v) ? v.map(d => d.name).join(', ') : v?.name;
  tip.innerHTML = `<b>${esc(catInfo(k).label)}</b>${name ? esc(name) : 'Empty. Click to choose one.'}`;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  tip.hidden = false;
}

let toastT;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (undo ? '<button type="button">Undo</button>' : '');
  if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 2800);
}

function persist() {
  store.set('coreframe:current', { build: state.build, name: state.name });
  const enc = encodeBuild(state.build);
  history.replaceState(null, '', location.pathname + location.search + (enc ? `#${enc}&name=${encodeURIComponent(state.name)}` : ''));
}

// ---------- Mutations ----------
function install(k, id, { advance = true } = {}) {
  const part = byId(k, id);
  if (!part) return;
  const errs = conflictsFor(k, part, withoutCat(r(), k)).filter(i => i.level === 'error');
  if (catInfo(k).multi) {
    if (state.build[k].includes(id)) return;
    if (state.build[k].length >= catInfo(k).multi) { toast('Three drives is the limit here. Remove one first.'); return; }
    state.build[k] = [...state.build[k], id];
  } else state.build[k] = id;
  if (k === 'case') state.build.color = state.caseView[id] || part.colors[0].key;
  commit();
  $(`.card[data-id="${id}"]`)?.classList.add('pop');
  sound.insert();
  if (errs.length) { B.setFault(k); sound.error(); toast(`Added, but there's a problem: ${errs[0].msg}`); return; }
  const rr = r();
  const next = CATEGORIES.findIndex((c, i) => i > state.step && !isFilled(c.key, rr));
  const nextAny = next >= 0 ? next : CATEGORIES.findIndex(c => !isFilled(c.key, rr));
  if (advance && !catInfo(k).multi && nextAny >= 0) {
    toast(`${shortName(part)} added. Next: ${CATEGORIES[nextAny].label.toLowerCase()}.`);
    setTimeout(() => goStep(nextAny), reduced() ? 0 : 650);
  } else if (nextAny < 0) {
    toast('Every part is in. Press “Test build” to try it.');
  } else toast(`${shortName(part)} added`);
}
function remove(k, id) {
  const prev = structuredClone(state.build);
  if (catInfo(k).multi) state.build[k] = state.build[k].filter(x => x !== id);
  else state.build[k] = null;
  if (k === 'case') state.build.color = null;
  commit();
  sound.remove();
  toast(`${shortName(byId(k, id))} removed`, () => { state.build = prev; commit(); sound.insert(); });
}
function setBuild(b, name) {
  state.build = decodeBuild(encodeBuild(b));
  if (name) { state.name = name; $('#buildName').value = name; }
  commit();
}
let animToken = 0;
function commit() {
  animToken++; // any change stops a running build animation
  powerOff();
  persist();
  render();
  B.update(r());
}
const shortName = p => p.name.replace(/^(AMD|Intel|NVIDIA GeForce|NVIDIA|Corsair|ASUS|MSI) /, '').replace(/ \(.*?\)/, '');

// ---------- Rendering ----------
function render() {
  const rr = r();
  const issues = checkBuild(rr);
  renderSteps(rr, issues);
  renderStep(rr);
  renderStage(rr);
  renderSummary(rr, issues);
}

function renderSteps(rr, issues) {
  const bad = new Set(issues.filter(i => i.level === 'error').map(i => i.cat));
  $('#steps').innerHTML = CATEGORIES.map((c, i) => `<li><button data-step="${i}" class="${bad.has(c.key) ? 'bad' : isFilled(c.key, rr) ? 'done' : ''}"
    ${i === state.step ? 'aria-current="step"' : ''} aria-label="Step ${i + 1}: ${c.label}${isFilled(c.key, rr) ? ', done' : ''}">
    <span class="n"><span>${i + 1}</span></span><span class="lbl">${c.short}</span></button></li>`).join('');
  const nb = issues.filter(i => i.level === 'error').length;
  $('#issueBadge').hidden = !nb;
  $('#issueBadge').textContent = nb;
}

function photo(p, k) {
  const bg = p.bg || '#ffffff';
  return `<div class="photo" style="background:${bg}"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy" decoding="async" width="320" height="320"></div>`;
}

function renderStep(rr) {
  const c = cat();
  const cur = state.cur;
  $('#stepNo').textContent = `Step ${state.step + 1} of ${CATEGORIES.length}${c.required ? '' : ' (optional)'}`;
  $('#stepTitle').textContent = c.label;
  $('#stepWhat').textContent = c.what;
  let tip = c.tip;
  if (c.key === 'psu' && (rr.cpu || rr.gpu)) tip = `Your parts can draw about ${powerDraw(rr)}W. We recommend at least ${recommendedPsu(powerDraw(rr))}W.`;
  if (c.key === 'cooler' && rr.cpu) tip = rr.cpu.boxCooler ? `Your ${shortName(rr.cpu)} comes with a cooler, so you can skip this step.` : `Your ${shortName(rr.cpu)} doesn't come with a cooler, so you need one.`;
  if (c.key === 'gpu' && rr.cpu) tip = rr.cpu.igpu ? `Optional: your processor has basic built-in graphics. For gaming, add a card.` : `Needed: your ${shortName(rr.cpu)} has no built-in graphics.`;
  $('#stepTip').innerHTML = `<b>Tip:</b> ${esc(tip)}`;

  const base = withoutCat(rr, c.key);
  let items = PARTS[c.key].map(p => {
    const issues = conflictsFor(c.key, p, base);
    return { p, issues, bad: issues.some(i => i.level === 'error') };
  });
  const fit = items.filter(i => !i.bad);
  const pick = fit.length ? fit.reduce((a, b) => (perfOf(c.key, b.p) / b.p.price[cur] > perfOf(c.key, a.p) / a.p.price[cur] ? b : a)).p.id : null;
  if (state.hideBad) items = fit;
  const sorters = {
    rec: () => 0,
    'price-asc': (a, b) => a.p.price[cur] - b.p.price[cur],
    'price-desc': (a, b) => b.p.price[cur] - a.p.price[cur],
    perf: (a, b) => perfOf(c.key, b.p) - perfOf(c.key, a.p),
  };
  items.sort((a, b) => (a.bad - b.bad) || sorters[state.sort](a, b));
  const ids = new Set([].concat(state.build[c.key] || []));
  const grid = $('#grid');
  if (!items.length) {
    grid.innerHTML = `<li class="empty">None of these fit the parts you've chosen. Turn off “Only parts that fit” to see why.</li>`;
  } else {
    grid.innerHTML = items.map(({ p: base, issues, bad }) => {
      const on = ids.has(base.id);
      const p = c.key === 'case' ? caseVariant(base, on) : base;
      const first = issues.find(i => i.level === 'error') || issues[0];
      const badge = on ? '<span class="badge in">In your build</span>' : bad ? '<span class="badge no">Won’t fit</span>' : p.id === pick && !ids.size ? '<span class="badge pick">Best value</span>' : '';
      return `<li class="card ${on ? 'on' : ''} ${bad ? 'bad' : ''}" data-id="${p.id}" data-cat="${c.key}">
        ${photo(p, c.key)}${badge}
        <div class="card-body">
          <span class="c-name">${esc(p.name)}</span>
          ${first ? `<span class="c-why ${first.level === 'warn' ? 'warn' : ''}">${esc(first.msg)}</span>` : `<span class="c-blurb">${esc(p.blurb || '')}</span>`}
          <span class="c-spec">${esc(specLine(c.key, p))}</span>
          ${p.colors?.length > 1 ? `<div class="swatches" role="radiogroup" aria-label="Colour">${p.colors.map(v => `<button type="button" role="radio" data-act="color" data-color="${v.key}" aria-checked="${v.key === p.colorKey}" aria-label="${esc(v.name)}" title="${esc(v.name)}" style="--sw:${v.hex}"></button>`).join('')}<span class="sw-name">${esc(p.colors.find(v => v.key === p.colorKey).name)}</span></div>` : ''}
          <div class="c-foot">
            <span class="c-price">${money(p.price[cur], cur)}</span>
            ${on ? `<button class="c-add remove" data-act="remove">Remove</button>` : `<button class="c-add" data-act="add">Add</button>`}
            <a class="c-buy" href="${buyUrl(p, cur)}" target="_blank" rel="noopener sponsored" title="See price on Amazon" aria-label="See ${esc(p.name)} on Amazon">${CART}</a>
          </div>
        </div></li>`;
    }).join('');
  }
  $('#prevStep').disabled = state.step === 0;
  const nxt = CATEGORIES[state.step + 1];
  $('#nextStep').textContent = nxt ? (c.required || isFilled(c.key, rr) ? `Next: ${nxt.label}` : `Skip to ${nxt.label}`) : 'See your build';
}

// The colour a case card shows: what's in the build, else what the user last picked on the card.
function caseVariant(p, inBuild) {
  const key = (inBuild && state.build.color) || state.caseView[p.id] || p.colors[0].key;
  const v = p.colors.find(x => x.key === key) || p.colors[0];
  return { ...p, img: v.img, bg: v.bg, color: v.hex, colorKey: v.key };
}

function renderStage(rr) {
  const n = filledCount(rr);
  $('#total').textContent = money(total(rr, state.cur), state.cur);
  $('#partCount').textContent = `${n} of ${CATEGORIES.length} parts`;
  const ready = CATEGORIES.filter(c => c.required).every(c => isFilled(c.key, rr));
  $('#powerBtn').disabled = !ready && !state.powered;
  if (!state.posting && !state.powered) {
    const missing = CATEGORIES.filter(c => c.required && !isFilled(c.key, rr));
    $('#postMsg').textContent = missing.length ? `Still needed: ${missing.map(c => c.label.toLowerCase()).join(', ')}.` : 'All set. Test it to see if it boots.';
  }
}

let lastTotal = null;
function renderSummary(rr, issues) {
  const cur = state.cur;
  const t = total(rr, cur);
  if (lastTotal !== null && lastTotal !== t) { const el = $('.stage-total'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  lastTotal = t;

  // checks, in plain language
  const out = [];
  issues.filter(i => i.level === 'error').forEach(i => out.push(['error', esc(i.msg)]));
  issues.filter(i => i.level === 'warn').forEach(i => out.push(['warn', esc(i.msg)]));
  const errs = new Set(issues.filter(i => i.level === 'error').map(i => i.cat));
  if (rr.cpu && rr.mobo && !errs.has('cpu') && !errs.has('mobo')) out.push(['ok', 'Processor fits the motherboard']);
  if (rr.ram && rr.mobo && rr.ram.type === rr.mobo.mem) out.push(['ok', 'Memory works with the motherboard']);
  if (rr.gpu && rr.case && rr.gpu.length <= rr.case.gpuMax) out.push(['ok', `Graphics card fits in the case (${Math.round((rr.case.gpuMax - rr.gpu.length) / 10)}cm to spare)`]);
  if (rr.psu && (rr.cpu || rr.gpu) && rr.psu.watts >= powerDraw(rr) * 1.25) out.push(['ok', 'Power supply is strong enough']);
  if (rr.cpu && !rr.cooler && rr.cpu.boxCooler) out.push(['ok', 'Using the cooler that comes with the processor']);
  CATEGORIES.filter(c => c.required && !isFilled(c.key, rr)).forEach(c => out.push(['todo', `<button data-goto="${c.key}">Choose a ${c.label.toLowerCase()}</button>`]));
  $('#checks').innerHTML = out.length ? out.map(([c, h]) => `<li class="${c}"><span>${h}</span></li>`).join('') : '<li class="todo"><span>Add parts to start checking.</span></li>';

  // games
  const g = $('#games');
  if (!rr.cpu || (!rr.gpu && !rr.cpu.igpu)) {
    g.innerHTML = '<li class="games-empty">Add a processor and a graphics card to see how popular games will run.</li>';
    $('#bottleneck').textContent = '';
  } else {
    g.innerHTML = GAMES.map(gm => {
      const f = fps(gm, rr, state.res), v = verdict(f, gm.cap);
      return `<li class="game" data-v="${v.key}"><span class="g-name">${esc(gm.name)}</span><span class="g-fps">${f}<small>fps</small></span>
        <span class="g-bar"><i style="width:${Math.min(100, (f / 240) * 100)}%"></i></span><span class="g-v">${v.label}${gm.cap ? ' (the game caps at 60)' : ''}</span></li>`;
    }).join('');
    const bn = bottleneck(rr, state.res);
    $('#bottleneck').textContent = !rr.gpu ? 'Using built-in graphics: fine for light games, not for new releases.'
      : bn?.part === 'cpu' ? `At ${state.res}, the processor is holding the graphics card back.`
      : bn?.part === 'gpu' ? `At ${state.res}, the graphics card sets your fps. That's normal.`
      : `Processor and graphics card are well matched at ${state.res}.`;
  }

  // power
  const draw = powerDraw(rr), psu = rr.psu, rec = recommendedPsu(draw);
  const load = rr.cpu || rr.gpu;
  const scale = Math.max(psu?.watts || 0, rec) * 1.08;
  const m = $('#powerMeter');
  m.querySelector('i').style.width = load ? `${(draw / scale) * 100}%` : '0';
  m.querySelector('b').style.left = psu ? `${(psu.watts / scale) * 100}%` : '0';
  m.classList.toggle('has-psu', !!psu);
  m.classList.toggle('over', !!psu && draw > psu.watts);
  m.classList.toggle('tight', !!psu && draw <= psu.watts && draw > psu.watts * 0.8);
  $('#powerNums').textContent = load ? `about ${draw}W${psu ? ` of ${psu.watts}W` : ''}` : '';
  $('#powerNote').textContent = !load ? 'Add a processor and graphics card to estimate power use.'
    : !psu ? `Your parts can draw about ${draw}W at full load. Get a ${rec}W power supply or bigger.`
    : draw > psu.watts ? `Too weak: the PC could shut off in games. Get at least ${rec}W.`
    : psu.watts < rec ? `It works, but runs close to its limit. ${rec}W would be quieter.`
    : `Plenty of headroom (${psu.watts - draw}W spare), even for a future upgrade.`;

  // parts list with photos
  const rows = [];
  for (const c of CATEGORIES) {
    const list = [].concat(rr[c.key] || []);
    if (!list.length) {
      if (c.required) rows.push(`<li class="missing"><span class="thumb"></span><span><span class="pl-cat">${c.label}</span><span class="pl-name">Not chosen yet</span></span><button data-goto="${c.key}">Choose</button></li>`);
      continue;
    }
    for (const p of list) rows.push(`<li><span class="thumb" style="background:${p.bg || '#fff'}"><img src="${p.img}" alt="" loading="lazy"></span>
      <span><span class="pl-cat">${c.label}</span><span class="pl-name">${esc(p.name)}</span></span>
      <span class="pl-right"><span class="pl-price">${money(p.price[cur], cur)}</span><a href="${buyUrl(p, cur)}" target="_blank" rel="noopener sponsored">Buy</a></span></li>`);
  }
  $('#plist').innerHTML = rows.join('');
  $('#sumTotal').textContent = `Total ${money(t, cur)}`;
  $('#savedCount').textContent = store.get('coreframe:saved', []).length || '';
}

// ---------- Navigation ----------
function goStep(i, { tab = false } = {}) {
  if (i < 0 || i >= CATEGORIES.length) return;
  state.step = i;
  B.setFocus(cat().key);
  render();
  if (tab) showTab('pick');
  $('#pickView').scrollTop = 0;
  if (tab && innerWidth <= 820) $('.panel').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
}
function showTab(which) {
  const pick = which === 'pick';
  $('#tabPick').setAttribute('aria-selected', pick);
  $('#tabSummary').setAttribute('aria-selected', !pick);
  $('#pickView').hidden = !pick;
  $('#summaryView').hidden = pick;
}
$('#steps').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) goStep(+b.dataset.step, { tab: true }); });
$('#tabPick').addEventListener('click', () => showTab('pick'));
$('#tabSummary').addEventListener('click', () => showTab('summary'));
$('#prevStep').addEventListener('click', () => goStep(state.step - 1));
$('#nextStep').addEventListener('click', () => { if (state.step === CATEGORIES.length - 1) showTab('summary'); else goStep(state.step + 1); });
document.addEventListener('click', e => { const b = e.target.closest('[data-goto]'); if (b) goStep(CATEGORIES.findIndex(c => c.key === b.dataset.goto), { tab: true }); });

$('#grid').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const li = b.closest('.card');
  if (b.dataset.act === 'color') {
    sound.tick();
    const id = li.dataset.id;
    state.caseView[id] = b.dataset.color;
    if (state.build.case === id) { state.build.color = b.dataset.color; commit(); }
    else renderStep(r());
    $(`.card[data-id="${id}"] [data-color="${b.dataset.color}"]`)?.focus();
    return;
  }
  if (b.dataset.act === 'add') install(li.dataset.cat, li.dataset.id);
  else remove(li.dataset.cat, li.dataset.id);
});
$('#sort').addEventListener('change', e => { state.sort = e.target.value; renderStep(r()); });
$('#hideBad').addEventListener('change', e => { state.hideBad = e.target.checked; renderStep(r()); });

// ---------- Drag a card into the case ----------
let drag = null;
$('#grid').addEventListener('pointerdown', e => {
  const card = e.target.closest('.card');
  if (!card || e.button > 0 || e.target.closest('button, a')) return;
  drag = { k: card.dataset.cat, id: card.dataset.id, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', started: false, card };
  if (drag.touch) {
    const d = drag;
    d.timer = setTimeout(() => { if (drag === d) { beginDrag(); navigator.vibrate?.(10); moveGhost(d.x, d.y); } }, 330);
  }
});
addEventListener('touchmove', e => { if (drag?.started) e.preventDefault(); }, { passive: false });
addEventListener('pointermove', e => {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.started) {
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (drag.touch) { if (moved > 10) { clearTimeout(drag.timer); drag = null; } return; }
    if (moved < 6) return;
    beginDrag();
  }
  e.preventDefault();
  moveGhost(e.clientX, e.clientY);
}, { passive: false });
function beginDrag() {
  const p = drag.k === 'case' ? caseVariant(byId('case', drag.id), state.build.case === drag.id) : byId(drag.k, drag.id);
  const errs = conflictsFor(drag.k, p, withoutCat(r(), drag.k)).filter(i => i.level === 'error');
  drag.blocked = errs.length > 0;
  drag.started = true;
  document.body.classList.add('dragging');
  document.body.classList.toggle('drag-bad', drag.blocked);
  const g = document.createElement('div');
  g.className = 'ghost';
  g.style.background = p.bg || '#fff';
  g.innerHTML = `<img src="${p.img}" alt=""><span style="background:#fff">${esc(shortName(p))}</span>`;
  document.body.appendChild(g);
  drag.ghost = g;
  $('#tip').hidden = true;
  B.setDrag(drag.k, !drag.blocked);
}
function moveGhost(x, y) {
  drag.ghost.style.left = x + 'px';
  drag.ghost.style.top = y + 'px';
  const s = $('#stage').getBoundingClientRect();
  drag.over = x >= s.left && x <= s.right && y >= s.top && y <= s.bottom;
  drag.ghost.className = 'ghost' + (drag.over ? (drag.blocked ? ' bad' : ' ok') : '');
}
function endDrag(cancel) {
  if (!drag) return;
  const d = drag;
  drag = null;
  clearTimeout(d.timer);
  if (!d.started) return;
  document.body.classList.remove('dragging', 'drag-bad');
  d.ghost.remove();
  B.setDrag(null);
  if (d.over && !cancel) install(d.k, d.id);
}
addEventListener('pointerup', () => endDrag(false));
addEventListener('pointercancel', () => endDrag(true));
addEventListener('keydown', e => { if (e.key === 'Escape') endDrag(true); });

// ---------- View tools ----------
$('#explodeBtn').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); B.setExploded(on); sound.tick(); });
$('#xrayBtn').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); B.setXray(on); sound.tick(); });
$('#spinBtn').addEventListener('click', e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); B.setAutoRotate(on); });
$('#bench').addEventListener('pointerdown', () => { $('#spinBtn').setAttribute('aria-pressed', 'false'); $('#hintChip').classList.add('gone'); });
$('#resetView').addEventListener('click', () => B.resetView());

// ---------- Test build (boot check) ----------
function resetLeds() { $$('.leds li').forEach(li => li.classList.remove('on', 'pass', 'run')); }
function powerOff() {
  if (state.posting) return;
  if (state.powered) { B.setPowered(false); sound.fansStop(); }
  state.powered = false;
  const b = $('#powerBtn');
  b.classList.remove('on');
  b.querySelector('span').textContent = 'Test build';
  resetLeds();
}
// How loud the running PC sounds: more fans and a hotter graphics card mean more air noise.
function fanLevel(rr) {
  let fans = rr.case?.fanCount ?? 2;
  if (rr.gpu) fans += rr.gpu.length > 280 ? 3 : 2;
  if (rr.cooler) fans += rr.cooler.kind === 'aio' ? rr.cooler.rad / 120 : rr.cooler.height > 160 ? 2 : 1;
  else fans += 1; // the boxed cooler
  const heat = (rr.gpu?.tdp || 0) / 600;
  return Math.min(1.35, 0.45 + fans * 0.06 + heat * 0.3);
}
async function powerOn() {
  if (state.posting) return;
  if (state.powered) { powerOff(); render(); return; }
  const rr = r();
  const errs = checkBuild(rr).filter(i => i.level === 'error');
  state.posting = true;
  resetLeds();
  const msg = $('#postMsg');
  msg.textContent = 'Checking each part…';
  for (const st of STAGES) {
    const li = $(`.leds li[data-led="${st.key}"]`);
    li.classList.add('run');
    sound.check();
    await sleep(reduced() ? 0 : 420);
    li.classList.remove('run');
    const fail = errs.filter(i => STAGE_OF[i.cat] === st.key);
    if (fail.length) {
      li.classList.add('on');
      msg.textContent = `It won't boot: ${fail[0].msg}.`;
      B.setFault(fail[0].cat);
      sound.error();
      state.posting = false;
      goStep(CATEGORIES.findIndex(c => c.key === fail[0].cat), { tab: true });
      return;
    }
    li.classList.add('pass');
  }
  state.powered = true;
  state.posting = false;
  B.setPowered(true);
  sound.boot();
  sound.fansStart(fanLevel(rr));
  const b = $('#powerBtn');
  b.classList.add('on');
  b.querySelector('span').textContent = 'Power off';
  const smooth = GAMES.filter(g => fps(g, rr, state.res) >= 60).length;
  msg.textContent = `It boots! ${smooth} of ${GAMES.length} popular games run at 60fps or more at ${state.res}.`;
  showTab('summary');
}
$('#powerBtn').addEventListener('click', powerOn);

// ---------- Sound ----------
function renderMute() {
  const b = $('#muteBtn');
  b.setAttribute('aria-pressed', String(sound.muted));
  b.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
  b.title = sound.muted ? 'Sound off' : 'Sound on';
}
$('#muteBtn').addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  renderMute();
  if (!sound.muted) sound.tick();
  if (state.powered && !sound.muted) sound.fansStart(fanLevel(r()));
});
renderMute();

// ---------- Theme ----------
function applyTheme(t) {
  state.theme = t;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]').content = t === 'dark' ? '#0f1216' : '#f4f5f7';
  $('#themeBtn').setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  B.setTheme(t);
}
$('#themeBtn').addEventListener('click', () => {
  const t = state.theme === 'dark' ? 'light' : 'dark';
  store.set('coreframe:theme', t);
  document.documentElement.classList.add('theming');
  applyTheme(t);
  setTimeout(() => document.documentElement.classList.remove('theming'), 350);
});

// ---------- Header + summary controls ----------
function setSeg(group, attr, val) { $$(`[data-${attr}]`, group).forEach(b => b.setAttribute('aria-checked', String(b.dataset[attr] === val))); }
$('.top .seg').addEventListener('click', e => {
  const b = e.target.closest('[data-cur]');
  if (!b) return;
  state.cur = b.dataset.cur;
  store.set('coreframe:cur', state.cur);
  setSeg(e.currentTarget, 'cur', state.cur);
  lastTotal = null;
  render();
});
$('#resSeg').addEventListener('click', e => { const b = e.target.closest('[data-res]'); if (!b) return; state.res = b.dataset.res; setSeg(e.currentTarget, 'res', state.res); render(); });
$('#buildName').addEventListener('input', e => { state.name = e.target.value || 'My first PC'; persist(); });
$('#resetBtn').addEventListener('click', () => {
  if (!filledCount(r())) return;
  const prev = structuredClone(state.build);
  setBuild(emptyBuild());
  goStep(0);
  toast('Started over', () => setBuild(prev));
});
$('#shareBtn').addEventListener('click', async () => {
  persist();
  try { await navigator.clipboard.writeText(location.href); toast('Link copied. It opens this exact build.'); } catch { prompt('Copy this link', location.href); }
});
$('#copyText').addEventListener('click', async () => {
  const cur = state.cur, rr = r();
  const lines = CATEGORIES.flatMap(c => [].concat(rr[c.key] || []).map(p => `${c.label}: ${p.name} (${money(p.price[cur], cur)})`));
  const text = `${state.name}\n${lines.join('\n')}\nTotal: ${money(total(rr, cur), cur)}\n${location.href}`;
  try { await navigator.clipboard.writeText(text); toast('Parts list copied'); } catch { prompt('Copy this', text); }
});

// ---------- Dialogs ----------
$$('.dlg').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }));

// The whole build is applied at once (so the panel is right and nothing can be lost);
// only the 3D view adds the parts one by one. Any change by the user stops the animation.
async function animateBuild(b, name) {
  if (name) { state.name = name; $('#buildName').value = name; }
  state.build = decodeBuild(encodeBuild(b));
  const token = ++animToken;
  powerOff();
  persist();
  render();
  showTab('summary');
  if (reduced()) { B.update(r()); return; }
  const partial = emptyBuild();
  B.update(resolve(partial));
  for (const k of ['case', 'mobo', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']) {
    for (const id of [].concat(state.build[k] || [])) {
      await sleep(240);
      if (token !== animToken) return;
      if (Array.isArray(partial[k])) partial[k] = [...partial[k], id]; else partial[k] = id;
      if (k === 'case') partial.color = state.build.color;
      B.update(resolve(partial));
      sound.insert({ soft: true });
    }
  }
}

const BUDGET = { inr: { min: 60000, max: 400000, step: 5000, def: 100000 }, usd: { min: 650, max: 4500, step: 50, def: 1100 } };
let use = 'gaming';
function openAuto() {
  const b = BUDGET[state.cur], range = $('#budget');
  Object.assign(range, { min: b.min, max: b.max, step: b.step });
  if (range.dataset.cur !== state.cur) range.value = b.def;
  range.dataset.cur = state.cur;
  $('#budgetOut').textContent = money(+range.value, state.cur);
  $('#autoErr').textContent = '';
  $('#autoDlg').showModal();
}
$('#openAuto').addEventListener('click', openAuto);
$('#budget').addEventListener('input', e => { $('#budgetOut').textContent = money(+e.target.value, state.cur); });
$('#useSeg').addEventListener('click', e => { const b = e.target.closest('[data-use]'); if (b) { use = b.dataset.use; setSeg(e.currentTarget, 'use', use); } });
$('#runAuto').addEventListener('click', async () => {
  const budget = +$('#budget').value;
  const res = autoBuild({ budget, cur: state.cur, use, brand: 'any' });
  if (!res) {
    const min = minimumBudget({ cur: state.cur, use, brand: 'any' });
    $('#autoErr').textContent = `We couldn't fit a working build into ${money(budget, state.cur)}.${min ? ` The lowest that works is about ${money(min, state.cur)}.` : ''}`;
    return;
  }
  $('#autoDlg').close();
  animateBuild(res, { gaming: 'Gaming PC', creator: 'Creator PC', office: 'Everyday PC' }[use]);
  toast(`Done. ${money(total(r(), state.cur), state.cur)} of your ${money(budget, state.cur)} budget used.`);
});

$('#openPresets').addEventListener('click', () => {
  $('#presetList').innerHTML = PRESETS.map((pr, i) => {
    const b = { ...emptyBuild(), ...pr.parts };
    const pics = ['case', 'gpu', 'cpu'].map(k => byId(k, b[k])).filter(Boolean).map(p => `<img src="${p.img}" alt="" style="background:${p.bg || '#fff'}">`).join('');
    return `<li><button data-preset="${i}"><span class="pr-pics">${pics}</span><span class="pr-body"><span class="pr-name">${esc(pr.name)}</span>
      <span class="pr-note">${esc(pr.note)}</span><span class="pr-price">${money(total(resolve(b), state.cur), state.cur)}</span></span></button></li>`;
  }).join('');
  $('#presetDlg').showModal();
});
$('#presetList').addEventListener('click', async e => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const pr = PRESETS[+b.dataset.preset];
  $('#presetDlg').close();
  await animateBuild({ ...emptyBuild(), ...pr.parts }, pr.name);
});

function renderSaved() {
  const list = store.get('coreframe:saved', []);
  $('#savedList').innerHTML = list.length ? list.map((s, i) => `<li><span class="sv-main"><span class="sv-name">${esc(s.name)}</span>
      <span class="sv-note">${money(total(resolve(decodeBuild(encodeBuild(s.build))), state.cur), state.cur)}, saved ${new Date(s.at).toLocaleDateString()}</span></span>
      <button class="btn btn-quiet" data-del="${i}" aria-label="Delete ${esc(s.name)}">Delete</button><button class="btn btn-dark" data-load="${i}">Open</button></li>`).join('')
    : '<li class="empty">Nothing saved yet.</li>';
  $('#savedCount').textContent = list.length || '';
}
$('#openSaved').addEventListener('click', () => { renderSaved(); $('#savedDlg').showModal(); });
$('#saveBtn').addEventListener('click', () => {
  if (!filledCount(r())) { toast('Add at least one part first'); return; }
  const list = store.get('coreframe:saved', []);
  const i = list.findIndex(s => s.name === state.name);
  const entry = { name: state.name, build: structuredClone(state.build), at: Date.now() };
  if (i >= 0) list[i] = entry; else list.unshift(entry);
  store.set('coreframe:saved', list.slice(0, 30));
  renderSaved();
  toast(`Saved “${state.name}”`);
});
$('#savedList').addEventListener('click', e => {
  const list = store.get('coreframe:saved', []);
  const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
  if (l) { const s = list[+l.dataset.load]; $('#savedDlg').close(); setBuild(s.build, s.name); toast(`Opened “${s.name}”`); }
  if (d) { const [gone] = list.splice(+d.dataset.del, 1); store.set('coreframe:saved', list); renderSaved(); toast(`Deleted “${gone.name}”`); }
});

$('#welcomeAuto').addEventListener('click', () => { $('#welcomeDlg').close(); openAuto(); });

// A share link opened in a tab that already has the app only changes the hash, so load it here.
addEventListener('hashchange', () => {
  const h = fromHash();
  if (!h) return;
  setBuild(h.build, h.name || undefined);
  goStep(firstEmptyStep(r()));
  toast('Opened the shared build');
});

// ---------- Init ----------
$('#updated').textContent = CATALOG_UPDATED;
$('#themeBtn').setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
$('#buildName').value = state.name;
$('#hideBad').checked = state.hideBad;
setSeg($('.top .seg'), 'cur', state.cur);
render();
if (hashed) persist(); // tidy the address bar (drops anything in a shared link that didn't match a part)
if (!store.get('coreframe:welcomed', false) && !hashed) {
  store.set('coreframe:welcomed', true);
  $('#welcomeDlg').showModal();
}
