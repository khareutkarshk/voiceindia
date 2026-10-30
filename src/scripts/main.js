// Page behaviour. One clock: Lenis smooths the scroll, and the same frame drives the particles, the pinned
// case and the loop, so words, cards and dots never drift apart. GSAP owns the two scrubbed scenes (the gate)
// and the headline entrances. Everything works without the particle layer and without motion.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { createListen } from './listen.js';
import { LANGS, langOf } from './langs.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nav = $('#nav');
let field = null;

// ---------- smooth scroll ----------
const lenis = reduced ? null : new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
window.__lenis = lenis; // lets the review capture jump to exact scroll positions
if (lenis) lenis.on('scroll', ScrollTrigger.update);
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y }));
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : document.body;
  if (!el) return;
  e.preventDefault();
  scrollToY(id === 'top' || !id ? 0 : el.getBoundingClientRect().top + scrollY - nav.offsetHeight);
  history.replaceState(null, '', '#' + id);
});
// a pinned chapter measured from its own box: where its sticky run starts, and how far it goes
function run(sec) {
  const top = sec.getBoundingClientRect().top + scrollY, p0 = top - nav.offsetHeight;
  return { p0, len: Math.max(1, top + sec.offsetHeight - innerHeight - p0) };
}

// ---------- entrances: headline lines rise out of a mask; supporting copy settles in after ----------
(() => {
  // [data-land] labels wait for their piece of her line instead (see sync)
  const heads = $$('.reveal'), items = $$('.fade:not([data-land])');
  const live = !reduced && 'IntersectionObserver' in window;
  // hidden first, then shown, so what is on the first screen arrives in its order (each one's --d) rather than at once
  if (live) { document.documentElement.classList.add('rv'); void document.body.offsetHeight; }
  heads.forEach((h) => h.classList.add('in'));
  items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); });
  if (!live) return items.forEach((el) => el.classList.add('in'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  items.forEach((el) => el.classList.contains('in') || io.observe(el));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    heads.forEach((h) => {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 108, duration: 1.05, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: { trigger: h, start: 'top 88%', once: true },
        }) });
      return split;
    });
  });
})();

// ---------- the hero: the core gathers out of dust, then the claim rises beside it ----------
// The particle layer reads `intro` every frame, so it can arrive late and still be in step.
// Scrolling before it finishes hurries it to the end. Her line, in the chapter below, is already said.
const intro = { rise: 1, amp: 0, voice: 1, core: reduced ? 1 : 0 };
let introTl = null, listen = null;
(() => {
  if (!$('[data-core]') || reduced) return;
  // it waits for the particles, so on a slow device the words never arrive before the core (boot() plays it;
  // without particles it plays after a moment anyway)
  const tl = gsap.timeline({ paused: true, delay: 0.15 });
  setTimeout(() => tl.paused() && tl.play(), 1600);
  tl.to(intro, { core: 1, duration: 2.6, ease: 'power2.out' }, 0);
  const h1 = $('#h-hero');
  tl.fromTo(h1, { y: '0.3em', clipPath: 'inset(0% 0% 100% 0%)' },
    { y: 0, clipPath: 'inset(-20% -2% -20% -2%)', duration: 1.2, ease: 'expo.out' }, 0.5);
  [[1, 1.05], [2, 1.3], [3, 1.8]].forEach(([k, at]) => tl.to(`[data-hero-in="${k}"]`, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, at));
  // once it has arrived, the action says its line once: the pulse draws and lets go
  const cta = $('.btn-voice');
  if (cta) tl.call(() => cta.classList.add('speak'), null, 2.4).call(() => cta.classList.remove('speak'), null, 3.6);
  introTl = tl;
})();
// her recorded line, when there is one: her voice swells with it
listen = createListen($('#listen'), { onStart: () => gsap.fromTo(intro, { amp: 0.8 }, { amp: 0, duration: 2.4, ease: 'sine.inOut' }) });

// ---------- depth: a banknote's rosette, engraved behind her line, and again behind her records ----------
// Bands of sine rings round one centre, each drawn many times a little out of phase, so the lines cross into the
// lattice printed round a note's watermark. Hairlines faint enough to sit far back: ice and brand blue on the navy
// hero, navy and blue on the pale chapter.
const rosette = $('[data-guilloche]'), depth = $('[data-depth]');
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const rosettes = [
  { canvas: rosette, host: $('#her'), anchor: $('[data-line]'), size: (h) => Math.max(h.width * 0.4, h.height * 0.66), y: 0.42,
    inks: () => [css('--color-on-navy'), css('--color-blue')], strength: 1 },
  { canvas: $('[data-guilloche-records]'), host: $('#problem [data-stage]'), size: (h) => Math.max(h.width, h.height) * 0.56, y: 0.5,
    inks: () => [css('--color-navy'), css('--color-blue')], strength: innerWidth < 900 ? 0.5 : 0.75 },
].filter((r) => r.canvas && r.host);
function engrave({ canvas, host, anchor, size, y, inks, strength }) {
  const h = host.getBoundingClientRect(), l = (anchor || host).getBoundingClientRect();
  if (!h.width) return;
  const R = Math.round(size(h));
  const cx = l.left - h.left + l.width / 2, cy = l.top - h.top + l.height * y;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  Object.assign(canvas.style, { left: `${cx - R}px`, top: `${cy - R}px`, width: `${2 * R}px`, height: `${2 * R}px` });
  canvas.width = canvas.height = Math.round(2 * R * dpr);
  const c = canvas.getContext("2d"), [hair, blue] = inks();
  c.setTransform(dpr, 0, 0, dpr, R * dpr, R * dpr);
  c.lineWidth = 0.6;
  // radius, swing, lobes, copies, ink, strength, and a slower second swing that braids the band
  const bands = [
    [0.97, 0.022, 72, 6, hair, 0.035],
    [0.82, 0.05, 40, 10, blue, 0.24, 0.018, 8],
    [0.6, 0.065, 28, 12, hair, 0.03, 0.022, 7],
    [0.4, 0.06, 20, 10, blue, 0.2, 0.015, 5],
    [0.2, 0.05, 12, 8, hair, 0.035],
  ];
  const TAU = Math.PI * 2;
  for (const [r, a, n, copies, ink, alpha, a2 = 0, n2 = 0] of bands) {
    c.strokeStyle = ink; c.globalAlpha = alpha * strength;
    const steps = n * 40;
    for (let j = 0; j < copies; j++) {
      const ph = (j / copies) * TAU;
      c.beginPath();
      for (let k = 0; k <= steps; k++) {
        const t = (k / steps) * TAU, rho = R * (r + a * Math.sin(n * t + ph) + a2 * Math.sin(n2 * t - ph));
        k ? c.lineTo(Math.cos(t) * rho, Math.sin(t) * rho) : c.moveTo(Math.cos(t) * rho, Math.sin(t) * rho);
      }
      c.stroke();
    }
  }
}
rosettes.forEach((r) => {
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => engrave(r));
  let et = 0;
  new ResizeObserver(() => { clearTimeout(et); et = setTimeout(() => engrave(r), 150); }).observe(r.host);
});
// the pointer tilts the scene: her line leans towards it, the rosette away, so the two read as near and far
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
if (fine && !reduced) addEventListener('pointermove', (e) => { tilt.tx = e.clientX / innerWidth - 0.5; tilt.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
const herSec = $('#her');
function parallax() {
  if (reduced) return;
  tilt.x += (tilt.tx - tilt.x) * 0.05; tilt.y += (tilt.ty - tilt.y) * 0.05;
  if (field) field.setTilt(tilt.x * 12, tilt.y * 8);
  // and the scroll: the rosette is far, so it falls behind more slowly than the page
  const top = herSec ? herSec.getBoundingClientRect().top : 0;
  if (!depth || top > innerHeight || top < -innerHeight * 1.3) return;
  depth.style.translate = `${(-tilt.x * 22).toFixed(2)}px ${(-top * 0.35 - tilt.y * 14).toFixed(2)}px`;
  // the microprint is nearer than the rosette: it leans the other way and falls behind less
  if (micro) micro.style.translate = `${(tilt.x * 16).toFixed(2)}px ${(-top * 0.16 + tilt.y * 10).toFixed(2)}px`;
}
const micro = $('[data-micro-in]');

// ---------- her five records, at their heights above the desk ----------
// A nearer record moves more with the pointer and the scroll than a lower one, and much more than the rosette under
// them all; each piece of her line rides its record. Side by side only: stacked, the records are a plain list.
const docs = $$('[data-doc]'), deskStage = $('#problem [data-stage]');
const po = new Float32Array(10);
function desk() {
  if (!deskStage || reduced || innerWidth < 900) return;
  const r = deskStage.getBoundingClientRect();
  if (r.bottom < -100 || r.top > innerHeight + 100) return;
  const rel = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
  for (const d of docs) {
    const z = +d.dataset.z, j = +d.dataset.doc;
    const x = tilt.x * -34 * z, y = tilt.y * -20 * z + rel * (z - 0.4) * 90;
    d.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    po[j * 2] = x; po[j * 2 + 1] = y;
  }
  if (field) field.setPieceOffsets(po);
}

// ---------- depth behind the core ----------
// Three planes. Far: stars, barely moving. Middle: the rings of its voice, spreading out on the tilt of its disc,
// and in the burst one bright ring thrown out across the screen. Near: a few motes so close they are out of focus,
// drifting, and moved most by the pointer. Drawn only while the hero is on screen.
let heroBurst = 0;
const space = (() => {
  const cv = $('[data-space]'), host = $('#top'), box = $('[data-core]');
  if (!cv || !host || !box) return null;
  const c = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0, stars = [], motes = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  function size() {
    const r = host.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx = b.left - r.left + b.width / 2; cy = b.top - r.top + b.height / 2; R = Math.min(b.width, b.height) * 0.29;
    seed = 7;
    stars = Array.from({ length: Math.round((W * H) / 2200) }, () => ({ x: rnd() * W, y: rnd() * H, z: rnd(), r: 0.35 + rnd() * 0.9, ph: rnd() * 6.28 }));
    const tints = ['201,214,242', '110,146,219'];
    motes = Array.from({ length: innerWidth < 900 ? 4 : 6 }, (_, i) => ({ x: rnd() * W, y: rnd() * H, z: 0.4 + rnd() * 0.6, r: 14 + rnd() * 54, a: 0.05 + rnd() * 0.08, tint: tints[i % tints.length], v: 4 + rnd() * 8, ph: rnd() * 6.28 }));
  }
  function draw(t) {
    if (!W) return;
    const s = t / 1000;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // far: stars
    c.fillStyle = '#C9D6F2';
    for (const p of stars) {
      // they thin out towards the foot of the hero, so the next chapter's ground takes over without an edge
      c.globalAlpha = (0.14 + 0.5 * p.z) * (0.65 + 0.35 * Math.sin(s * (0.8 + p.z) + p.ph)) * Math.min(1, (H - p.y) / 160);
      const x = p.x - tilt.x * 10 * p.z, y = p.y - tilt.y * 6 * p.z;
      c.fillRect(x, y, p.r, p.r);
    }
    // middle: the rings of its voice, on the disc's tilt
    c.save();
    c.translate(cx - tilt.x * 4, cy - tilt.y * 3);
    c.rotate(0.2);
    c.scale(1, 0.46);
    // a murmur, not a pulse: three faint rings, slow, gone before they reach the words
    c.lineWidth = 1.1;
    c.setLineDash([1, 8]);
    c.strokeStyle = '#8EA2CF';
    for (let i = 0; i < 3; i++) {
      const k = (s / 7 + i / 3) % 1;
      c.globalAlpha = 0.2 * Math.pow(1 - k, 2) * Math.min(1, k * 4);
      c.beginPath(); c.arc(0, 0, R * (1.2 + k * 2.2), 0, Math.PI * 2); c.stroke();
    }
    // the burst: one bright ring thrown out across the screen
    if (heroBurst > 0.005 && heroBurst < 0.995) {
      c.setLineDash([]);
      const a = Math.sin(heroBurst * Math.PI), rr = R * (1 + heroBurst * 7);
      c.strokeStyle = '#FFB27A';
      c.lineWidth = 10; c.globalAlpha = 0.1 * a;
      c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2.2; c.globalAlpha = 0.6 * a;
      c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
    // near: motes out of focus
    for (const m of motes) {
      const x = ((m.x + Math.sin(s * 0.07 * m.v + m.ph) * 30 - tilt.x * 70 * m.z) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = m.y + Math.cos(s * 0.05 * m.v + m.ph) * 22 - tilt.y * 40 * m.z - heroBurst * 160 * m.z;
      const g = c.createRadialGradient(x, y, 0, x, y, m.r);
      g.addColorStop(0, `rgba(${m.tint},${m.a})`); g.addColorStop(0.55, `rgba(${m.tint},${m.a * 0.55})`); g.addColorStop(1, `rgba(${m.tint},0)`);
      c.globalAlpha = 1; c.fillStyle = g;
      c.beginPath(); c.arc(x, y, m.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  size();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(size);
  let st = 0;
  new ResizeObserver(() => { clearTimeout(st); st = setTimeout(size, 150); }).observe(host);
  if (reduced) { requestAnimationFrame((t) => draw(t)); return null; }
  return { draw };
})();

// ---------- her language: the panel sets it and the story below follows ----------
// Until someone chooses, her line passes through every script on the panel, one every few seconds, so each
// visitor sees their own go by. It runs only while her line is settled on screen, and rests while the panel is
// pointed at or focused and while the tab is hidden; a choice ends it for good.
let her = LANGS[0];
const panel = $('[data-panel]'), langBtns = $$('[data-lang]', panel || document);
function speak(code) {
  if (code === her.code) return;
  her = langOf(code);
  langBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === code)));
  $$('[data-lang-name]').forEach((el) => (el.textContent = her.name));
  $$('[data-lang-line]').forEach((el) => { el.textContent = her.line; el.lang = code; });
  $$('[data-lang-hello]').forEach((el) => { el.textContent = her.hello; el.lang = code; });
  if (found) payoff.textContent = conclusion();
  if (field) field.setLang(code);
}
if (panel) {
  let chosen = false, resting = false;
  langBtns.forEach((b) => b.addEventListener('click', () => { chosen = true; speak(b.dataset.lang); }));
  ['pointerenter', 'focusin'].forEach((n) => panel.addEventListener(n, () => (resting = true)));
  panel.addEventListener('pointerleave', () => (resting = panel.contains(document.activeElement)));
  panel.addEventListener('focusout', (e) => (resting = panel.contains(e.relatedTarget) || panel.matches(':hover')));
  if (!reduced) setTimeout(() => setInterval(() => {
    const r = herSec.getBoundingClientRect(), settled = r.top < innerHeight * 0.2 && r.bottom > innerHeight * 0.75;
    if (chosen || resting || document.hidden || !settled || (field && field.morphing)) return;
    speak(LANGS[(LANGS.indexOf(her) + 1) % LANGS.length].code);
  }, 3200), 2400);
}

// ---------- the loop: the orange arc follows the scroll round the ring ----------
const loopSec = $('#loop');
const loopSteps = $$('.loop-step', loopSec), ringNames = $$('.ring-names li', loopSec);
const ringWord = $('#ring-word'), ringStep = $('#ring-step'), ringArc = $('.ring-arc', loopSec);
const ringFacts = JSON.parse($('.ring-word', loopSec).dataset.facts);
let loopNow = -1;
function syncLoop() {
  const { p0, len } = run(loopSec);
  const x = clamp((scrollY - p0) / len, 0, 1);
  ringArc.style.setProperty('--p', (reduced ? 1 : Math.min(1, x * 1.08)).toFixed(4));
  const i = Math.min(loopSteps.length - 1, Math.floor(x * loopSteps.length * 1.04));
  if (i === loopNow) return;
  loopNow = i;
  loopSteps.forEach((s, k) => { s.dataset.active = String(k === i); s.inert = k !== i; });
  ringNames.forEach((n, k) => { n.dataset.s = k < i ? 'done' : k === i ? 'now' : 'next'; });
  ringWord.textContent = ringFacts[i];
  ringStep.textContent = `Account 1048, ${ringNames[i].textContent.toLowerCase()}`;
  if (!reduced) gsap.fromTo(ringWord, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out', overwrite: true });
}

// ---------- the pinned case ----------
const caseSec = $('#account');
const steps = $$('.step', caseSec);
const log = $$('.cc-log li', caseSec);
const nowEl = $('#step-now');
const [prevBtn, nextBtn] = $$('.arrow', caseSec);
let current = -1;
// approval state is read by setStep, so it is declared before the first step is set
let approved = 0, holding = false, lastT = 0, by = 'you';
function setStep(i) {
  if (i === current) return;
  caseSec.dataset.dir = i < current ? 'up' : 'down';
  current = i;
  steps.forEach((s, k) => { s.dataset.active = String(k === i); s.setAttribute('aria-hidden', String(k !== i)); s.inert = k !== i; });
  // the case record fills in as the case moves: done (one line), now (in full), still to come
  log.forEach((l, k) => { l.dataset.s = k < i ? 'done' : k === i ? 'now' : 'next'; l.inert = k > i; });
  nowEl.textContent = String(i + 1);
  // the call cannot happen without an approval: if the visitor skipped it, a reviewer gave it
  if (i >= 3 && approved < 1) { by = 'a credit operations reviewer'; approved = 1; holding = false; paintHold(); }
  // back before the approval step: the case is undecided again
  if (i < 2 && approved > 0 && !holding) { approved = 0; by = 'you'; paintHold(); }
  prevBtn.disabled = i === 0; nextBtn.disabled = i === steps.length - 1;
}
function goStep(i) {
  const { p0, len } = run(caseSec), seg = len / steps.length;
  scrollToY(p0 + seg * (clamp(i, 0, steps.length - 1) + 0.62));
}
prevBtn.addEventListener('click', () => goStep(current - 1));
nextBtn.addEventListener('click', () => goStep(current + 1));

// ---------- bring her five records together on click/tap; clicking again lets them drift apart ----------
// The change is persistent so it works equally well with a mouse, trackpad, touch, or keyboard.
const join = $('#join'), payoff = $('[data-payoff]'), joinStage = $('#problem [data-stage]');
let joined = 0, joinTarget = 0, joinT = 0, found = false;
const conclusion = () => `The 8th, after 6\u00a0pm, in\u00a0${her.name}.`;
const keys = $$('#problem [data-key]'), seal = $('[data-seal]');
function reveal() {
  found = true;
  // the facts the next call is drawn from are marked on their records, one after another, and the seal answers
  ['salary', 'hours', 'lang'].forEach((k, i) => keys.filter((el) => el.dataset.key === k).forEach((el) => { el.style.setProperty('--hl', `${200 + i * 260}ms`); el.classList.add('lit'); }));
  if (seal && !reduced) { seal.classList.remove('pulse'); void seal.offsetWidth; seal.classList.add('pulse'); }
  const swap = () => { payoff.textContent = conclusion(); payoff.style.opacity = ''; payoff.style.filter = ''; };
  if (reduced) return swap();
  // a short blur bridges the two sentences, so it reads as one line changing rather than two swapping
  payoff.style.opacity = '0'; payoff.style.filter = 'blur(4px)';
  setTimeout(swap, 300);
}
function tickJoin(t) {
  const dt = joinT ? Math.min(0.05, (t - joinT) / 1000) : 0; joinT = t;
  if (reduced) joined = joinTarget;
  else joined += (joinTarget - joined) * (1 - Math.exp(-dt * 5));
  if (Math.abs(joinTarget - joined) < 0.002) joined = joinTarget;
  if (field) field.setJoin(joined);
  join.style.setProperty('--p', joined.toFixed(4));
  joinStage.dataset.joined = String(joined > 0.05);
  join.setAttribute('aria-pressed', String(joinTarget === 1));
  if (joined >= 1 && !found) reveal();
  if (joined !== joinTarget) requestAnimationFrame(tickJoin); else joinT = 0;
}
if (join) {
  join.setAttribute('aria-pressed', 'false');
  join.addEventListener('click', () => {
    joinTarget = joinTarget ? 0 : 1;
    join.querySelectorAll('.hold-label').forEach((label) => {
      label.textContent = joinTarget ? 'Let the pieces drift apart' : 'Bring her five records together';
    });
    joinT = 0;
    requestAnimationFrame(tickJoin);
  });
  join.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- hold to approve (linear while held, quick ease back on release) ----------
const hold = $('#hold'), status = $('#gate-status');
const approveTime = $('#approve-time'), approveSum = $('#approve-sum');
function paintHold() {
  hold.style.setProperty('--p', approved.toFixed(4));
  const done = approved >= 1;
  hold.querySelectorAll('.hold-label').forEach((l) => (l.textContent = done ? 'Approved' : 'Hold to approve'));
  status.dataset.ok = String(done);
  status.textContent = done ? `Approved by ${by}. Status is verified before the outcome is marked complete.` : holding ? 'Approving…' : 'Contact hours, consent and authority checked';
  approveTime.textContent = done ? '10:42' : 'waiting';
  approveSum.textContent = done ? `Approved by ${by}` : 'Waiting';
  log[2].dataset.ok = String(done);
  if (field) field.setApprove(approved);
}
function tickHold(t) {
  const dt = lastT ? t - lastT : 16; lastT = t;
  if (holding) approved = Math.min(1, approved + dt / (reduced ? 1 : 1400));
  else if (approved < 1) approved = Math.max(0, approved - dt / 220);
  paintHold();
  if (approved >= 1) { holding = false; paintHold(); return; }
  if (holding || approved > 0) requestAnimationFrame(tickHold);
}
const startHold = () => { if (approved >= 1 || holding) return; holding = true; lastT = 0; requestAnimationFrame(tickHold); };
const stopHold = () => { if (!holding) return; holding = false; lastT = 0; requestAnimationFrame(tickHold); };
hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); startHold(); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => hold.addEventListener(n, stopHold));
hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stopHold(); });
hold.addEventListener('contextmenu', (e) => e.preventDefault());
setStep(0);
paintHold();

// ---------- the gate: one action falls through six layers, scrubbed by the scroll ----------
(() => {
  const sec = $('#gate');
  const plates = $$('.plate', sec), texts = $$('.layer-text article', sec), checks = $$('.checks li', sec);
  const packet = $('.packet', sec), split = $('.split', sec), ghost = $('.ghost', sec), scan = $('.scan', sec);
  const reviewer = $('.reviewer', sec), tag = $('#gate-tag');
  const Z = (i) => (2.5 - i) * 74 + 4;
  const words = [
    [4, 'Proposed action: a follow-up call, in {lang}'],
    [5, 'Checked against permissions and policy'],
    [7.2, 'Higher impact: sent to an authorised reviewer'],
    [8.2, 'Approved and released to the voice channel'],
    [9.2, 'Call placed. Payment status verified, never assumed'],
    [99, 'A copy stays in the audit trail'],
  ];
  const marks = [2, 5, 6.1, 9.2, 9.6]; // when each control is passed
  let last = '';
  function paint(t) {
    const L = t < 1.2 ? 0 : t < 2.2 ? 1 : t < 3.2 ? 2 : t < 7.2 ? 3 : t < 8.2 ? 4 : 5;
    const key = L + ':' + marks.filter((m) => t >= m).length + ':' + (t >= 6.1);
    tag.textContent = words.find(([at]) => t < at)[1].replace('{lang}', her.name);
    if (key === last) return;
    last = key;
    plates.forEach((p, i) => (p.dataset.s = i < L ? 'done' : i === L ? 'now' : 'next'));
    texts.forEach((a, i) => { a.dataset.active = String(i === L); });
    checks.forEach((c, i) => (c.dataset.on = String(t >= marks[i])));
    reviewer.dataset.ok = String(t >= 6.1);
  }
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' }, onUpdate: () => paint(tl.time()) });
  tl.set(packet, { z: Z(0) + 170, opacity: 0 }, 0)
    .to(packet, { opacity: 1, z: Z(0), duration: 1 }, 0)
    .to(packet, { z: Z(1), duration: 0.9 }, 1.1)
    .to(packet, { z: Z(2), duration: 0.9 }, 2.1)
    .to(packet, { z: Z(3), duration: 0.9 }, 3.1)
    .fromTo(scan, { y: 0, opacity: 1 }, { y: 270, duration: 1, ease: 'none' }, 4)
    .to(scan, { opacity: 0, duration: 0.1 }, 5)
    .to(reviewer, { opacity: 1, duration: 0.4 }, 5)
    .to(split, { opacity: 1, duration: 0.2 }, 5.1)
    .to(split, { x: 341, y: -40, duration: 0.8 }, 5.3)
    .to(split, { x: 0, y: 0, duration: 0.8 }, 6.4)
    .to(split, { opacity: 0, duration: 0.2 }, 7.1)
    .to(packet, { z: Z(4), duration: 0.9 }, 7.2)
    .to(packet, { z: Z(5), duration: 0.9 }, 8.2)
    .to(ghost, { opacity: 0.38, duration: 0.3 }, 9.1)
    .to(packet, { z: Z(5) - 140, opacity: 0, duration: 0.8 }, 9.3)
    .to({}, { duration: 0.4 }, 10.1);
  if (reduced) { tl.progress(1); paint(tl.duration()); return; }
  paint(0);
  ScrollTrigger.create({
    trigger: sec, start: () => `top ${nav.offsetHeight}px`, end: 'bottom bottom', scrub: 0.6,
    animation: tl, invalidateOnRefresh: true,
  });
})();

// ---------- engines: index with preview ----------
const rows = $$('[data-engine]'), preview = $('#engine-preview');
const narrow = matchMedia('(max-width: 899px)');
let sel = '';
function selectEngine(id) {
  if (id === sel) return;
  sel = id;
  rows.forEach((r) => r.setAttribute('aria-pressed', String(r.dataset.engine === id)));
  if (field) field.setEngine(rows.findIndex((r) => r.dataset.engine === id));
  const next = $(`.ep[data-for="${id}"]`, preview);
  $$('.ep', preview).forEach((p) => (p.hidden = p !== next));
  if (!reduced) { next.classList.add('swap'); requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('swap'))); }
}
rows.forEach((r) => {
  r.addEventListener('click', () => selectEngine(r.dataset.engine));
  r.addEventListener('focus', () => selectEngine(r.dataset.engine));
  if (fine) r.addEventListener('pointerenter', () => selectEngine(r.dataset.engine));
});
selectEngine('collections');
(() => {
  if (reduced) return;
  let touched = false, timer = 0;
  const stop = () => { touched = true; clearInterval(timer); };
  rows.forEach((r) => ['pointerenter', 'click', 'focus'].forEach((n) => r.addEventListener(n, stop)));
  ScrollTrigger.create({
    trigger: '#engines', start: 'top 40%', end: 'bottom 60%',
    onToggle: (st) => {
      clearInterval(timer);
      if (!st.isActive || touched) return;
      timer = setInterval(() => { const n = rows.findIndex((r) => r.dataset.engine === sel); const nx = rows[(n + 1) % rows.length]; selectEngine(nx.dataset.engine); }, 3200);
    },
  });
})();

// ---------- security: a table row lights its lane ----------
$$('.deploy tbody tr').forEach((tr) => {
  const on = () => field && field.setDeploy(Number(tr.dataset.row));
  const off = () => field && field.setDeploy(-1);
  tr.addEventListener('pointerenter', on); tr.addEventListener('pointerleave', off);
  tr.addEventListener('focus', on); tr.addEventListener('blur', off);
});

// ---------- connect: wires into the core; in phase two the approved ones also carry actions out ----------
(() => {
  const sec = $('#connect'), g = $('.wires', sec), NS = 'http://www.w3.org/2000/svg';
  const ports = $$('.ports li', sec);
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  ports.forEach((p, i) => {
    const left = i < 3, y = [100, 300, 500][i % 3], x = left ? 0 : 600, cx = left ? 226 : 374;
    const d = left ? `M${x} ${y}C150 ${y} 170 300 ${cx} 300` : `M${x} ${y}C450 ${y} 430 300 ${cx} 300`;
    const id = 'wire' + i, acts = p.dataset.acts;
    g.append(el('path', { id, d, class: 'wire', 'data-acts': acts }));
    g.append(el('circle', { cx: x, cy: y, r: 6, class: 'port-dot' }));
    if (reduced) return;
    const dots = (cls, reverse, n) => {
      for (let k = 0; k < n; k++) {
        const c = el('circle', { r: cls === 'dot-in' ? 3.5 : 4.5, class: cls });
        const m = el('animateMotion', { dur: '2.6s', repeatCount: 'indefinite', begin: `${(-2.6 * k) / n - i * 0.37}s`, calcMode: 'linear', ...(reverse ? { keyPoints: '1;0', keyTimes: '0;1' } : {}) });
        m.append(el('mpath', { href: '#' + id }));
        c.append(m); g.append(c);
      }
    };
    dots('dot-in', false, 3);
    if (acts === 'yes') dots('dot-out', true, 2);
  });
  const btns = $$('.phase button', sec);
  let touched = false;
  const set = (ph) => { sec.dataset.phase = ph; btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.phase === ph))); };
  btns.forEach((b) => b.addEventListener('click', () => { touched = true; set(b.dataset.phase); }));
  // show the second phase once by itself, after the reader has had a moment with the first
  ScrollTrigger.create({ trigger: $('.hub', sec), start: 'center 62%', once: true, onEnter: () => setTimeout(() => { if (!touched) set('act'); }, 2200) });
})();

// ---------- outcomes: the measure crossing the middle of the screen is the one being read ----------
(() => {
  const items = $$('.measures > li');
  items.forEach((li) => ScrollTrigger.create({
    trigger: li, start: 'top 58%', end: 'bottom 58%',
    onToggle: (st) => { if (st.isActive) items.forEach((o) => (o.dataset.active = String(o === li))); },
  }));
})();

// ---------- the request ----------
const mail = 'tabassum.farheen@voiceindia.ai';
const form = $('#demo'), note = $('#form-note');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let first = null;
  for (const f of $$('input, select, textarea', form)) {
    const bad = f.required && (!f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value)));
    f.setAttribute('aria-invalid', String(bad));
    if (bad && !first) first = f;
  }
  if (first) { note.textContent = 'Please add your name, a work email and your organisation.'; first.focus(); return; }
  const d = Object.fromEntries(new FormData(form));
  const body = `Request: Voice India Super Intelligence demonstration\n\nName: ${d.name}\nWork email: ${d.email}\nOrganisation: ${d.org}\nRole: ${d.role}\nUse case: ${d.usecase}\nDeployment preference: ${d.deploy}\n\nWhat we would like to prove:\n${d.brief}\n`;
  location.href = `mailto:${mail}?subject=${encodeURIComponent('Voice India Super Intelligence demonstration request')}&body=${encodeURIComponent(body)}`;
  note.textContent = `Your email app should open with the request written out. If it did not, write to ${mail}.`;
});
$$('[data-copy]').forEach((b) => b.addEventListener('click', () => {
  navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy the address'), 1800); });
}));

// ---------- her line breaking into the records ----------
// The tide of the pale chapter swells while the pieces fall; each record takes its piece's weight as it lands (the
// moment matches wave.js: piece k is down when the mix reaches .1 + (1 + .1k) / 1.55), and the seal answers the last.
const tide = $('[data-tide]');
let lastBreak = -1;
function breakTo(f) {
  if (f === lastBreak) return;
  if (tide) tide.style.setProperty('--tide', reduced ? '0' : Math.sin(clamp((f - 0.18) / 0.72, 0, 1) * Math.PI).toFixed(3));
  if (!reduced && f > lastBreak) {
    docs.forEach((d) => {
      const k = +d.dataset.doc, at = Math.min(0.99, 0.1 + (1 + 0.1 * k) / 1.55);
      if (lastBreak < at && f >= at) { d.classList.remove('catch'); void d.offsetWidth; d.classList.add('catch'); }
    });
    if (lastBreak < 0.97 && f >= 0.97 && seal) { seal.classList.remove('pulse'); void seal.offsetWidth; seal.classList.add('pulse'); }
  }
  lastBreak = f;
}

// ---------- one frame: scroll, then everything that depends on it ----------
const tones = $$('.ch[data-tone], .foot');
const crests = $$('.crest:not(.crest-light)');
const voiceText = $$('[data-voice-text]');
const heroTop = $('#top'), heroCopy = $('[data-hero-copy]');
let lastBurst = -1;
// the five systems' labels appear as their pieces of her line land; without particles, as the stage comes up
const landStage = $('#problem [data-stage]');
let landing = $$('[data-land]');
const land = () => { landing.forEach((el) => el.classList.add('in')); landing = null; };
let tone = '';
function sync() {
  const line = nav.offsetHeight;
  let onCrest = false;
  for (const c of crests) { const r = c.getBoundingClientRect(); if (r.top + r.height * 0.75 <= line && r.bottom > line) { onCrest = true; break; } }
  if (onCrest) { if (tone !== 'dark') { tone = 'dark'; nav.dataset.tone = 'dark'; } }
  else for (const s of tones) {
    const r = s.getBoundingClientRect();
    if (r.top <= line && r.bottom > line) {
      const t = s.classList.contains('foot') ? 'dark' : s.dataset.tone;
      if (t !== tone) { tone = t; nav.dataset.tone = t; }
      break;
    }
  }
  // her chapter's words step aside as her line starts to break, so its pieces fall through clear air
  // (only when there are particles to break; side by side only: stacked, the pieces re-form in place)
  const ls = landStage ? landStage.getBoundingClientRect().top / innerHeight : 1;
  const said = field && innerWidth >= 900 ? clamp((ls - 0.8) / 0.12, 0, 1).toFixed(3) : '';
  voiceText.forEach((el) => (el.style.opacity = said));
  // the core bursts across the first screen: its light flares, and the claim is thrown up and away with it
  const burst = reduced ? 0 : clamp((scrollY - innerHeight * 0.02) / (innerHeight * 0.7), 0, 1);
  heroBurst = burst;
  if (burst !== lastBurst && scrollY < innerHeight * 1.5) {
    lastBurst = burst;
    const b = Math.sin(Math.min(1, burst * 1.6) * Math.PI / 2);
    heroTop.style.setProperty('--burst', (Math.sin(burst * Math.PI)).toFixed(3));
    heroCopy.style.opacity = (1 - b).toFixed(3);
    heroCopy.style.translate = `0 ${(-b * 90).toFixed(1)}px`;
    heroCopy.style.filter = b > 0.01 ? `blur(${(b * 8).toFixed(1)}px)` : '';
  }
  // and in any case once the desk is well into view (a jump past the hero skips the pieces' flight)
  if (landing && landStage && landStage.getBoundingClientRect().top < innerHeight * (field ? 0.75 : 0.5)) land();
  const { p0, len } = run(caseSec);
  setStep(clamp(Math.floor(((scrollY - p0) / len) * steps.length - 0.3), 0, steps.length - 1));
  syncLoop();
}
function frame(t) {
  if (lenis) lenis.raf(t);
  if (introTl && introTl.progress() < 1 && scrollY > 40) introTl.timeScale(5);
  if (field) {
    field.setIntro(listen ? { ...intro, amp: Math.max(intro.amp, listen.level()) } : intro);
    const r = field.render(t);
    if (landing && r && (!['hero', 'voice'].includes(r.a.name) || (r.b.name === 'scatter' && r.f > 0.85))) land();
    if (r) breakTo(r.a.name === 'voice' && r.b.name === 'scatter' ? r.f : r.a.name === 'voice' || r.a.name === 'hero' ? 0 : 1);
  }
  parallax();
  desk();
  sync();
  if (space && scrollY < innerHeight * 1.2) space.draw(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- the particle layer: loaded after first paint, only where it can run ----------
function boot() {
  const canvas = $('#field');
  if (!canvas || (navigator.connection && navigator.connection.saveData)) return document.documentElement.classList.add('no-field');
  import('./wave.js').then(({ createWave }) => {
    const f = createWave(canvas, { reduced });
    if (!f) { canvas.remove(); document.documentElement.classList.add('no-field'); return; }
    field = f;
    window.__field = f; // lets the review capture set her language and read the particle state
    document.documentElement.classList.add('has-field');
    f.setLang(her.code, true);
    // the pieces can only be held together where there are pieces to hold
    const wrap = $('[data-join-wrap]'); if (wrap) wrap.hidden = false;
    field.setApprove(approved);
    field.setEngine(rows.findIndex((r) => r.dataset.engine === sel));
    f.ready.then(() => { ScrollTrigger.refresh(); if (introTl && introTl.paused()) introTl.play(); });
  });
}
if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 500 }); else setTimeout(boot, 150);
// her line as type stands in only if the particles have not come after a few seconds (they replace it when they do)
setTimeout(() => field || document.documentElement.classList.add('no-field'), 4000);
