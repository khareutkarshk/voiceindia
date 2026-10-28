// Page behaviour. Everything here works without the particle field; the field only adds to it.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = new Intl.NumberFormat('en-IN');
let field = null;

// ---------- entrances: heading, then text, then the rest; once ----------
(() => {
  const items = $$('.rise');
  const groups = new Map();
  for (const el of items) {
    const sec = el.closest('section, footer') || document.body;
    const k = groups.get(sec) || 0;
    el.style.setProperty('--d', `${Math.min(k, 6) * 70}ms`);
    groups.set(sec, k + 1);
  }
  // what is already on screen is never hidden; the rest rises as it arrives
  items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); });
  if (reduced || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('in')); return; }
  document.documentElement.classList.add('rv');
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  items.forEach((el) => io.observe(el));
  // never leave content hidden if the observer stalls
  setTimeout(() => items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); }), 1200);
})();

// ---------- scroll progress of a pinned section ----------
function progress(sec) {
  const r = sec.getBoundingClientRect(), vh = innerHeight;
  const h0 = -vh * 0.1 + 0, h1 = r.height - vh;
  return Math.min(1, Math.max(0, (-r.top - h0) / Math.max(1, h1 - h0)));
}
function scrollToProgress(sec, p) {
  const r = sec.getBoundingClientRect(), vh = innerHeight;
  const top = r.top + scrollY, h0 = top - vh * 0.1, h1 = top + r.height - vh;
  scrollTo({ top: h0 + (h1 - h0) * p, behavior: reduced ? 'auto' : 'smooth' });
}

// ---------- Account 1048 ----------
const caseSec = $('#journey');
const tabs = $$('.tab', caseSec), panels = $$('.step', caseSec), plate = $('.plate', caseSec);
const [backBtn, nextBtn] = $$('.cell', caseSec);
let caseStep = -1;
function setStep(k) {
  if (k === caseStep) return;
  caseStep = k;
  tabs.forEach((t, i) => { t.setAttribute('aria-selected', String(i === k)); t.tabIndex = i === k ? 0 : -1; });
  panels.forEach((p, i) => p.dataset.active = String(i === k));
  plate.dataset.step = String(k);
  backBtn.disabled = k === 0; nextBtn.disabled = k === 5;
  nextBtn.textContent = k === 5 ? 'Last step' : 'Next step';
}
const goStep = (k) => scrollToProgress(caseSec, (Math.max(0, Math.min(5, k)) + 0.4) / 6);
tabs.forEach((t, i) => {
  t.addEventListener('click', () => goStep(i));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = Math.max(0, Math.min(5, i + d));
    tabs[k].focus(); goStep(k);
  });
});
backBtn.addEventListener('click', () => goStep(caseStep - 1));
nextBtn.addEventListener('click', () => goStep(caseStep + 1));

// ---------- the gate ----------
const gateSec = $('#trust');
const hold = $('#hold'), fill = $('.hold-fill', hold), status = $('#gate-status');
const layerBtns = $$('.layer', gateSec), layerText = $('#layer-text');
const layerData = JSON.parse($('#layer-data').textContent);
const gateState = { approved: 0, holding: false, hover: -1, layer: 0 };
let lastT = 0;
function paintHold() {
  fill.style.setProperty('--p', gateState.approved.toFixed(4));
  const done = gateState.approved >= 1;
  hold.querySelectorAll('.hold-label').forEach((l) => (l.textContent = done ? 'Approved' : 'Hold to approve'));
  status.dataset.ok = String(done);
  status.textContent = done ? 'Approved. Status verified before completion.' : gateState.holding ? 'Approving…' : gateState.approved > 0 ? 'Partly approved. The rest waits.' : 'Waiting for review';
  if (field) { field.gate.approved = gateState.approved; field.poke(); }
}
function tickHold(now) {
  if (!gateState.holding) return;
  const dt = lastT ? now - lastT : 16; lastT = now;
  gateState.approved = Math.min(1, gateState.approved + dt / 1600);
  paintHold();
  if (gateState.approved < 1) requestAnimationFrame(tickHold); else gateState.holding = false, paintHold();
}
function startHold() { if (gateState.approved >= 1 || gateState.holding) return; gateState.holding = true; lastT = 0; requestAnimationFrame(tickHold); paintHold(); }
function stopHold() { if (!gateState.holding) return; gateState.holding = false; paintHold(); }
hold.addEventListener('pointerdown', (e) => { hold.setPointerCapture(e.pointerId); startHold(); });
hold.addEventListener('pointerup', stopHold);
hold.addEventListener('pointercancel', stopHold);
hold.addEventListener('lostpointercapture', stopHold);
hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stopHold(); });
hold.addEventListener('contextmenu', (e) => e.preventDefault());
function showLayer(i) {
  layerBtns.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  layerText.textContent = layerData[i];
}
layerBtns.forEach((b, i) => {
  const on = () => { gateState.hover = i; showLayer(i); if (field) field.gate.hover = i; };
  const off = () => { gateState.hover = -1; if (field) field.gate.hover = -1; };
  if (fine) { b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off); }
  b.addEventListener('focus', on); b.addEventListener('blur', off);
  b.addEventListener('click', on);
});

// ---------- walls ----------
const wallsStage = $('.walls-stage');
const modeText = $('#mode-text'), modeData = JSON.parse($('#mode-data').textContent);
const segs = $$('.seg-btn');
function setMode(m, focus) {
  segs.forEach((b) => { const on = b.dataset.mode === m; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  modeText.textContent = modeData[m];
  wallsStage.dataset.mode = m;
  if (field) { field.walls.mode = m; field.poke(); }
}
segs.forEach((b, i) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
  b.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setMode(segs[(i + d + segs.length) % segs.length].dataset.mode, true);
  });
});
setMode('premise');

// ---------- engines: index with preview ----------
const tilesE = $$('[data-engine]'), preview = $('#engine-preview');
const narrow = matchMedia('(max-width: 899px)');
let selE = '';
function selectEngine(id, from) {
  if (id === selE) return;
  selE = id;
  tilesE.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.engine === id)));
  const next = $(`.ep[data-for="${id}"]`, preview), cur = $('.ep:not([hidden])', preview);
  if (cur && cur !== next) cur.hidden = true;
  next.hidden = false;
  if (!reduced) { next.classList.add('swap'); requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('swap'))); }
  if (narrow.matches && from) from.after(preview);
  if (field) { field.engines.sel = id; field.poke(); }
}
tilesE.forEach((t) => {
  t.addEventListener('click', () => selectEngine(t.dataset.engine, t));
  t.addEventListener('focus', () => selectEngine(t.dataset.engine, null));
  if (fine) t.addEventListener('pointerenter', () => selectEngine(t.dataset.engine, null));
});
selectEngine('collections');

// ---------- outcomes calculator ----------
const dotsKey = $('.dots-key');
const accounts = $('#accounts'), accOut = $('#accounts-out'), minsOut = $('#mins-out'), hoursEl = $('#hours');
let mins = 6;
function calc() {
  const a = +accounts.value, h = Math.round((a * mins) / 60);
  accOut.textContent = fmt.format(a);
  minsOut.textContent = String(mins);
  hoursEl.textContent = fmt.format(h);
  accounts.setAttribute('aria-valuetext', `${fmt.format(a)} accounts`);
  // one dot per unit; the unit grows only when the dots would not fit, and the key says so
  const cap = field ? Math.max(400, field.count - 400) : 6000;
  const unit = [1, 2, 5, 10, 20, 50].find((u) => h / u <= cap) || 50;
  dotsKey.textContent = unit === 1 ? 'One dot is one hour.' : `One dot is ${unit} hours.`;
  if (field) { field.stats.dots = Math.round(h / unit); field.poke(); }
}
accounts.addEventListener('input', calc);
$$('.step-btn').forEach((b) => b.addEventListener('click', () => { mins = Math.max(1, Math.min(30, mins + +b.dataset.delta)); calc(); }));
calc();

// ---------- the request ----------
const formEl = $('#demo'), note = $('#form-note');
const fieldsF = $$('input, select, textarea', formEl);
function level() {
  const filled = fieldsF.filter((f) => f.tagName === 'SELECT' ? f.selectedIndex > 0 || f.dataset.touched : f.value.trim()).length;
  if (field) { field.form.level = filled / fieldsF.length; field.poke(); }
}
fieldsF.forEach((f) => { f.addEventListener('input', level); f.addEventListener('change', () => { f.dataset.touched = '1'; level(); }); });
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  let first = null;
  for (const f of fieldsF) {
    const bad = f.required && (!f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value)));
    f.setAttribute('aria-invalid', String(bad));
    if (bad && !first) first = f;
  }
  if (first) { note.textContent = 'Please add your name, a work email and your organisation.'; first.focus(); return; }
  const d = Object.fromEntries(new FormData(formEl));
  const body = `Request: Voice India Super Intelligence demonstration\n\nName: ${d.name}\nWork email: ${d.email}\nOrganisation: ${d.org}\nRole: ${d.role}\nUse case: ${d.usecase}\nDeployment preference: ${d.deploy}\n\nWhat we would like to prove:\n${d.brief}\n`;
  location.href = `mailto:tabassum.farheen@voiceindia.ai?subject=${encodeURIComponent('Voice India Super Intelligence demonstration request')}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Your email app should open with the request written out. If it did not, write to tabassum.farheen@voiceindia.ai.';
  if (field) { field.form.level = 1; field.poke(); }
});

// ---------- back to the call ----------
$('#rewind').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });

// ---------- per-frame sync between page and field ----------
function sync() {
  setStep(Math.min(5, Math.floor(progress(caseSec) * 6)));
  const gp = progress(gateSec);
  if (gp < 0.03 && gateState.approved >= 1 && !gateState.holding) { gateState.approved = 0; paintHold(); }
  if (gateState.hover < 0) {
    const L = field ? field.gate.layer : Math.min(5, Math.floor(gp * 6));
    if (L !== gateState.layer) { gateState.layer = L; showLayer(L); }
  }
}
setStep(0); showLayer(0); paintHold();
addEventListener('scroll', () => { if (!field) sync(); }, { passive: true });

// ---------- the field: load after first paint, only where it can run ----------
function boot() {
  const canvas = $('#field');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (!canvas || saveData) return;
  import('./field.js').then(({ createField }) => {
    field = createField(canvas, { reduced });
    if (!field) { canvas.remove(); return; }
    field.walls.mode = wallsStage.dataset.mode;
    field.engines.sel = selE;
    calc(); level(); paintHold();
    field.onframe = sync;
  });
}
if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 600 }); else setTimeout(boot, 200);
