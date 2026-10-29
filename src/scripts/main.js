// Page behaviour. One clock: Lenis smooths the scroll, and the same frame drives the particles, the pinned
// case and the loop, so words, cards and dots never drift apart. GSAP owns the two scrubbed scenes (the gate)
// and the headline entrances. Everything works without the particle layer and without motion.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { createListen } from './listen.js';

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
  // [data-land] labels wait for their piece of the kolam instead (see sync)
  const heads = $$('.reveal'), items = $$('.fade:not([data-land])');
  heads.forEach((h) => h.classList.add('in'));
  items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); });
  if (reduced || !('IntersectionObserver' in window)) return items.forEach((el) => el.classList.add('in'));
  document.documentElement.classList.add('rv');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  items.forEach((el) => el.classList.contains('in') || io.observe(el));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    heads.forEach((h) => {
      const split = SplitText.create(h, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, {
          yPercent: 108, duration: 1.05, ease: 'expo.out', stagger: 0.09,
          scrollTrigger: h.id === 'h-hero' ? undefined : { trigger: h, start: 'top 88%', once: true },
        }) });
      return split;
    });
  });
})();

// ---------- the hero: her voice gathers the flour, the pulli settle, and one line is drawn round them all ----------
// One timeline runs her subtitle and the kolam together; the particle layer reads `intro` every frame,
// so it can arrive late and still be in step. Scrolling before it finishes hurries it to the end.
const intro = reduced ? { gather: 0, amp: 0, settle: 1, tau: 1 } : { gather: 0, amp: 0, settle: 0, tau: 0 };
let introTl = null, listen = null;
(() => {
  const en = $('.voice-en'), ta = $('.voice-ta'), cap = $('.voice figcaption');
  if (!en || reduced) return;
  const words = (el) => {
    const parts = el.textContent.split(/(\s+)/);
    el.textContent = '';
    return parts.map((w) => {
      if (!w.trim()) { el.append(w); return null; }
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.append(s); return s;
    }).filter(Boolean);
  };
  const said = words(ta), meant = words(en);
  const tl = gsap.timeline({ delay: 0.5 });
  tl.to(intro, { gather: 1, duration: 2.2, ease: 'power2.inOut' }, 0.3)
    .from(said, { autoAlpha: 0, y: 6, duration: 0.5, ease: 'power2.out', stagger: 0.32 }, 0.6);
  // each word she says is a breath of sound through the flour
  said.forEach((_, i) => tl.to(intro, { amp: 0.9, duration: 0.14, ease: 'power2.out' }, 0.6 + i * 0.32)
    .to(intro, { amp: 0.08, duration: 0.36, ease: 'power2.in' }, 0.74 + i * 0.32));
  tl.from(meant, { autoAlpha: 0, y: 4, duration: 0.42, ease: 'power2.out', stagger: 0.06 }, 2.7)
    .to(intro, { settle: 1, duration: 1.8, ease: 'power1.inOut' }, 3.0)
    .to(intro, { amp: 0, duration: 0.6 }, 3.0)
    .from(cap, { autoAlpha: 0, duration: 0.6 }, 3.6)
    .to(intro, { tau: 1, duration: 6.4, ease: 'sine.inOut' }, 4.1)
    .set(intro, { gather: 0 });
  introTl = tl;
  listen = createListen($('#listen'), { onStart: () => tl.timeScale(1).restart(true) });
})();

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

// ---------- hold to join her story: the five pieces go home into one kolam while held, and part on release ----------
// Linear while held, so the hold reads as deliberate; a quick ease back on release, as the system lets go.
// The first time it is whole, the closing line becomes what no single system knew (salary on the 7th, her ask,
// the contact hours, her language), and stays: the result is earned.
// A tap too short to be a hold still plays a small preview, so the control explains itself.
const join = $('#join'), payoff = $('[data-payoff]'), joinStage = $('#problem [data-stage]');
let joined = 0, joining = false, joinT = 0, found = false, pressedAt = 0, previewTo = 0;
function reveal() {
  found = true;
  const swap = () => { payoff.textContent = 'Read as one, the next call is clear: the 8th, after 6\u00a0pm, in\u00a0Tamil.'; join.querySelectorAll('.hold-label').forEach((l) => (l.textContent = 'Hold to see it again')); payoff.style.opacity = ''; payoff.style.filter = ''; };
  if (reduced) return swap();
  // a short blur bridges the two sentences, so it reads as one line changing rather than two swapping
  payoff.style.opacity = '0'; payoff.style.filter = 'blur(4px)';
  setTimeout(swap, 300);
}
function tickJoin(t) {
  const dt = joinT ? Math.min(0.05, (t - joinT) / 1000) : 0; joinT = t;
  if (joining || joined < previewTo) joined = reduced ? (joining ? 1 : joined) : Math.min(1, joined + dt / 1.2);
  else { previewTo = 0; joined = reduced || joined < 0.003 ? 0 : joined * Math.exp(-dt * 10); }
  if (field) field.setJoin(joined);
  join.style.setProperty('--p', joined.toFixed(4));
  joinStage.dataset.joined = String(joined > 0.05);
  if (joined >= 1 && !found) reveal();
  if (joining || joined > 0) requestAnimationFrame(tickJoin); else joinT = 0;
}
if (join) {
  const start = () => { if (joining) return; joining = true; pressedAt = performance.now(); joinT = 0; requestAnimationFrame(tickJoin); };
  const stop = () => { if (!joining) return; joining = false; if (performance.now() - pressedAt < 250 && !reduced) previewTo = 0.3; };
  join.addEventListener('pointerdown', (e) => { join.setPointerCapture(e.pointerId); start(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((n) => join.addEventListener(n, stop));
  join.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  join.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
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
    [4, 'Proposed action: a follow-up call, in Tamil'],
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
    tag.textContent = words.find(([at]) => t < at)[1];
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

// ---------- one frame: scroll, then everything that depends on it ----------
const tones = $$('.ch[data-tone], .foot');
const crests = $$('.crest:not(.crest-light)');
const voiceText = $('[data-voice-text]');
// the five systems' labels appear as their pieces of the kolam land; without particles, as the stage comes up
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
  // her words step aside as the kolam starts to break (only when there are particles to break)
  // (side by side only: stacked, the pieces re-form in place and never cross her words)
  if (voiceText) voiceText.style.opacity = field && innerWidth >= 900 ? (1 - clamp((scrollY - 40) / 190, 0, 1)).toFixed(3) : '';
  if (landing && !field && landStage && landStage.getBoundingClientRect().top < innerHeight * 0.5) land();
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
    if (landing && r && (r.a.name !== 'hero' || (r.b.name === 'scatter' && r.f > 0.85))) land();
  }
  sync();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- the particle layer: loaded after first paint, only where it can run ----------
function boot() {
  const canvas = $('#field');
  if (!canvas || (navigator.connection && navigator.connection.saveData)) return;
  import('./wave.js').then(({ createWave }) => {
    const f = createWave(canvas, { reduced });
    if (!f) { canvas.remove(); return; }
    field = f;
    // the pieces can only be held together where there are pieces to hold
    const wrap = $('[data-join-wrap]'); if (wrap) wrap.hidden = false;
    field.setApprove(approved);
    field.setEngine(rows.findIndex((r) => r.dataset.engine === sel));
    f.ready.then(() => ScrollTrigger.refresh());
  });
}
if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 500 }); else setTimeout(boot, 150);
