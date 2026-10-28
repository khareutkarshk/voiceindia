// Page behaviour. One clock: Lenis smooths the scroll, and the same frame drives the particles and the
// pinned case, so words, cards and dots never drift apart. Everything works without the particle layer.
import Lenis from 'lenis';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nav = $('#nav');
let field = null;

// ---------- smooth scroll ----------
const lenis = reduced ? null : new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
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

// ---------- entrances: one reveal per heading, a soft rise for what follows ----------
(() => {
  const items = $$('.reveal, .fade');
  items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); });
  if (reduced || !('IntersectionObserver' in window)) return items.forEach((el) => el.classList.add('in'));
  document.documentElement.classList.add('rv');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  items.forEach((el) => el.classList.contains('in') || io.observe(el));
})();

// ---------- the pinned case ----------
const caseSec = $('#account');
const steps = $$('.step', caseSec);
const log = $$('.cc-log li', caseSec);
const nowEl = $('#step-now');
const [prevBtn, nextBtn] = $$('.arrow', caseSec);
let current = -1;
// approval state is read by setStep, so it is declared before the first step is set
let approved = 0, holding = false, lastT = 0, by = 'you';
function caseGeometry() {
  const top = caseSec.getBoundingClientRect().top + scrollY, p0 = top - nav.offsetHeight;
  const p1 = top + caseSec.offsetHeight - innerHeight;
  return { p0, seg: (p1 - p0) / steps.length };
}
function setStep(i) {
  if (i === current) return;
  caseSec.dataset.dir = i < current ? 'up' : 'down';
  current = i;
  steps.forEach((s, k) => { s.dataset.active = String(k === i); s.setAttribute('aria-hidden', String(k !== i)); s.inert = k !== i; });
  // the case record fills in as the case moves: done, now, still to come
  log.forEach((l, k) => { l.dataset.s = k < i ? 'done' : k === i ? 'now' : 'next'; l.inert = k > i; });
  nowEl.textContent = String(i + 1);
  // the outcome cannot exist without an approval: if the visitor skipped it, a reviewer gave it
  if (i >= 3 && approved < 1) { by = 'a credit operations reviewer'; approved = 1; holding = false; paintHold(); }
  // back before the approval step: the case is undecided again
  if (i < 2 && approved > 0 && !holding) { approved = 0; by = 'you'; paintHold(); }
  prevBtn.disabled = i === 0; nextBtn.disabled = i === steps.length - 1;
}
function goStep(i) {
  const { p0, seg } = caseGeometry();
  scrollToY(p0 + seg * (Math.max(0, Math.min(steps.length - 1, i)) + 0.62));
}
prevBtn.addEventListener('click', () => goStep(current - 1));
nextBtn.addEventListener('click', () => goStep(current + 1));
setStep(0);

// ---------- hold to approve (Emil's hold-to-confirm: linear while held, quick ease back on release) ----------
const hold = $('#hold'), status = $('#gate-status');
const approveTime = $('#approve-time');
function paintHold() {
  hold.style.setProperty('--p', approved.toFixed(4));
  const done = approved >= 1;
  hold.querySelectorAll('.hold-label').forEach((l) => (l.textContent = done ? 'Approved' : 'Hold to approve'));
  status.dataset.ok = String(done);
  status.textContent = done ? `Approved by ${by}. Status is verified before the outcome is marked complete.` : holding ? 'Approving…' : 'Contact hours, consent and authority checked';
  approveTime.textContent = done ? '10:42' : 'waiting';
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
paintHold();

// ---------- engines: index with preview ----------
const rows = $$('[data-engine]'), preview = $('#engine-preview');
const narrow = matchMedia('(max-width: 899px)');
let sel = '';
function selectEngine(id, row) {
  if (id === sel) return;
  sel = id;
  rows.forEach((r) => r.setAttribute('aria-pressed', String(r.dataset.engine === id)));
  const n = rows.findIndex((r) => r.dataset.engine === id);
  if (field) field.setEngine(n);
  const next = $(`.ep[data-for="${id}"]`, preview);
  $$('.ep', preview).forEach((p) => (p.hidden = p !== next));
  if (!reduced) { next.classList.add('swap'); requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('swap'))); }
}
rows.forEach((r) => {
  r.addEventListener('click', () => selectEngine(r.dataset.engine, r));
  r.addEventListener('focus', () => selectEngine(r.dataset.engine, narrow.matches ? r : null));
  if (fine) r.addEventListener('pointerenter', () => selectEngine(r.dataset.engine, null));
});
selectEngine('collections');

// ---------- the request ----------
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
  const body = `Request: Voice India Super Intelligence demonstration\n\nName: ${d.name}\nWork email: ${d.email}\nOrganisation: ${d.org}\nRole: ${d.role}\nDeployment preference: ${d.deploy}\n\nWhat we would like to prove:\n${d.brief}\n`;
  location.href = `mailto:tabassum.farheen@voiceindia.ai?subject=${encodeURIComponent('Voice India Super Intelligence demonstration request')}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the request written out. If it did not, write to tabassum.farheen@voiceindia.ai.';
});

// ---------- one frame: scroll, then everything that depends on it ----------
const tones = $$('.ch[data-tone], .foot');
const crests = $$('.crest:not(.crest-light)');
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
  const { p0, seg } = caseGeometry();
  const x = (scrollY - p0) / seg;
  setStep(Math.max(0, Math.min(steps.length - 1, Math.floor(x - 0.3))));
}
function frame(t) {
  if (lenis) lenis.raf(t);
  if (field) field.render(t);
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
    field.setApprove(approved);
    field.setEngine(rows.findIndex((r) => r.dataset.engine === sel));
  });
}
if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 500 }); else setTimeout(boot, 150);
