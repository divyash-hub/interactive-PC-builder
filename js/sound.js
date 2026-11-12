// Sound effects, synthesised with the Web Audio API (no audio files to download).
// Everything starts from a click, so browsers' autoplay rules are never a problem.

const KEY = 'coreframe:muted';
let muted = false;
try { muted = localStorage.getItem(KEY) === 'true'; } catch {}

let ctx = null, master = null, noiseBuf = null;
let fans = null; // the running fan/PSU hum, while the PC is on

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    // a gentle limiter so stacked sounds never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// One-shot helpers
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, { type = 'sine', at = 0, a = 0.004, d = 0.12, peak = 0.3, to = null } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  env(g, t, a, peak, d);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + a + d + 0.05);
}
function burst({ at = 0, freq = 2500, q = 1.2, a = 0.002, d = 0.05, peak = 0.4, type = 'bandpass' } = {}) {
  const c = ac(); if (!c || muted) return;
  const t = c.currentTime + at;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, a, peak, d);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random()); s.stop(t + a + d + 0.05);
}

export const sound = {
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, String(m)); } catch {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05);
    if (!m) ac();
  },

  // A part seating into place: a soft thump with a latch click on top.
  insert({ soft = false } = {}) {
    const k = soft ? 0.55 : 1;
    tone(140, { to: 55, d: 0.11, peak: 0.45 * k });
    burst({ freq: 3200, q: 2, d: 0.035, peak: 0.35 * k });
    burst({ at: 0.045, freq: 5200, q: 3, d: 0.02, peak: 0.18 * k });
  },
  // Lifting a part out: a lighter, rising click.
  remove() {
    burst({ freq: 2200, q: 2, d: 0.04, peak: 0.25 });
    tone(180, { to: 320, d: 0.08, peak: 0.16, type: 'triangle' });
  },
  // Small UI tick (colour swatches, view toggles).
  tick() { burst({ freq: 4200, q: 4, d: 0.018, peak: 0.16 }); },
  // Each boot check: a quiet blip.
  check() { tone(1320, { type: 'square', d: 0.04, peak: 0.05 }); },
  // The classic single POST beep: all good.
  boot() { tone(1000, { type: 'square', a: 0.005, d: 0.16, peak: 0.12 }); },
  // Something's wrong: three short low beeps, like a motherboard error code.
  error() { for (let i = 0; i < 3; i++) tone(330, { type: 'square', at: i * 0.2, d: 0.12, peak: 0.1 }); },

  // Fans and power supply. level ~0.5 (quiet build) to ~1.3 (lots of fans, hot GPU).
  fansStart(level = 1) {
    const c = ac(); if (!c) return;
    this.fansStop(0.05);
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.11 * level, t + 1.6); // spin up
    out.connect(master);
    // air rushing through the fans
    const s = c.createBufferSource(); s.buffer = noise(); s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(700 + 500 * level, t + 1.8);
    // a gentle wobble so it doesn't sound like static
    const lfo = c.createOscillator(), lfoGain = c.createGain();
    lfo.frequency.value = 0.35; lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(lp.frequency);
    s.connect(lp).connect(out);
    // motor tone of the fans, rising as they spin up
    const hum = c.createOscillator(), humGain = c.createGain();
    hum.type = 'triangle';
    hum.frequency.setValueAtTime(40, t);
    hum.frequency.exponentialRampToValueAtTime(95 + 25 * level, t + 1.8);
    humGain.gain.value = 0.18;
    hum.connect(humGain).connect(out);
    // power supply's faint mains hum
    const mains = c.createOscillator(), mainsGain = c.createGain();
    mains.frequency.value = 100; mainsGain.gain.value = 0.05;
    mains.connect(mainsGain).connect(out);
    for (const n of [s, lfo, hum, mains]) n.start(t);
    fans = { out, nodes: [s, lfo, hum, mains], lp, hum };
  },
  fansStop(fade = 1.4) {
    if (!fans || !ctx) return;
    const f = fans; fans = null;
    const t = ctx.currentTime;
    f.out.gain.cancelScheduledValues(t);
    f.out.gain.setValueAtTime(Math.max(f.out.gain.value, 0.0001), t);
    f.out.gain.exponentialRampToValueAtTime(0.0001, t + fade); // spin down
    f.lp.frequency.cancelScheduledValues(t);
    f.lp.frequency.setValueAtTime(f.lp.frequency.value, t);
    f.lp.frequency.exponentialRampToValueAtTime(120, t + fade);
    f.hum.frequency.cancelScheduledValues(t);
    f.hum.frequency.setValueAtTime(f.hum.frequency.value, t);
    f.hum.frequency.exponentialRampToValueAtTime(30, t + fade);
    for (const n of f.nodes) n.stop(t + fade + 0.1);
  },
};

// Go quiet when the tab is hidden, pick up again when it's back.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else if (fans) ctx.resume();
});
