// One material for the whole page: a single WebGL layer of flat, ink-like dots.
// Each section declares a state; scrolling blends the dots from one state's shape to the next,
// and every dot keeps its identity, so the customer's voice can be followed all the way to the reply.
// Forces mean something: springs are context, damping is governance, walls are data boundaries.

const C = {
  mist: [169, 179, 172], paper: [238, 241, 236], saff: [240, 122, 42], green: [44, 188, 103],
  signal: [86, 97, 90], ink: [23, 23, 23], deep: [184, 64, 15],
};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// The logo's pulse, as a polyline in a 1000 x 300 box (flat, dip, rise, deep V, peak, flat).
const PULSE = [[0, 150], [120, 150], [150, 190], [185, 120], [265, 285], [380, 15], [420, 15], [440, 140], [1000, 140]];
const pulseLen = (() => {
  const acc = [0];
  for (let k = 1; k < PULSE.length; k++) acc.push(acc[k - 1] + Math.hypot(PULSE[k][0] - PULSE[k - 1][0], PULSE[k][1] - PULSE[k - 1][1]));
  return acc;
})();
function pulseAt(u, out) {
  const L = pulseLen[pulseLen.length - 1] * clamp(u, 0, 1);
  let k = 1;
  while (k < pulseLen.length - 1 && pulseLen[k] < L) k++;
  const a = PULSE[k - 1], b = PULSE[k], seg = pulseLen[k] - pulseLen[k - 1] || 1;
  const t = (L - pulseLen[k - 1]) / seg;
  out[0] = (a[0] + (b[0] - a[0]) * t) / 1000;
  out[1] = (a[1] + (b[1] - a[1]) * t) / 300;
  out[2] = -(b[1] - a[1]) / seg; // normal, for stroke thickness
  out[3] = (b[0] - a[0]) / seg;
  return out;
}

// A speech-like amplitude envelope for the customer's line, loudest on "salary" and "call me".
function speechProfile(cols) {
  const words = [['I', .5], ['cannot', .7], ['pay', .8], ['before', .6], ['the', .4], ['salary', 1], ['comes', .7], ['in', .5],
    ['Can', .6], ['someone', .7], ['call', 1], ['me', .9], ['after', .6], ['that', .7]];
  const total = words.reduce((s, [w]) => s + w.length + 1.6, 0);
  const prof = new Float32Array(cols);
  let pos = 0.04 * total;
  const span = total * 1.08;
  for (const [w, loud] of words) {
    const a = pos / span, b = (pos + w.length) / span;
    const syl = Math.max(1, Math.round(w.length / 2.6));
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      if (u < a || u > b) continue;
      const k = (u - a) / (b - a);
      const env = Math.sin(Math.PI * k);
      const m = 0.55 + 0.45 * Math.abs(Math.sin(k * Math.PI * syl));
      prof[c] = Math.max(prof[c], loud * env * m);
    }
    pos += w.length + (w === 'in' ? 4 : 1.6);
  }
  return prof;
}

export function createField(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
    || canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return null;
  const reduced = !!opts.reduced;
  const small = Math.min(innerWidth, innerHeight) < 600 || innerWidth < 760;
  const N = opts.count || (small ? 7000 : innerWidth < 1200 ? 11000 : 15000);
  let n = N; // active count; stepped down on slow devices

  // ---------- GL ----------
  const vs = `attribute vec2 p;attribute vec4 c;attribute float s;uniform vec2 r;uniform float d;varying vec4 v;
    void main(){vec2 q=p/r*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);gl_PointSize=s*d;v=c;}`;
  const fs = `precision mediump float;varying vec4 v;
    void main(){float r=length(gl_PointCoord-0.5);float a=1.0-smoothstep(0.36,0.5,r);gl_FragColor=vec4(v.rgb*v.a*a,v.a*a);}`;
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const loc = { p: gl.getAttribLocation(prog, 'p'), c: gl.getAttribLocation(prog, 'c'), s: gl.getAttribLocation(prog, 's'), r: gl.getUniformLocation(prog, 'r'), d: gl.getUniformLocation(prog, 'd') };
  const bufP = gl.createBuffer(), bufC = gl.createBuffer(), bufS = gl.createBuffer();
  // flat grounds (the case plate) are painted here, under the dots, so dots and ground stay one layer
  const gprog = gl.createProgram();
  gl.attachShader(gprog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;uniform vec2 r;void main(){vec2 q=p/r*2.0-1.0;gl_Position=vec4(q.x,-q.y,0.0,1.0);}'));
  gl.attachShader(gprog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;uniform vec4 c;void main(){gl_FragColor=c;}'));
  gl.linkProgram(gprog);
  const gloc = { p: gl.getAttribLocation(gprog, 'p'), r: gl.getUniformLocation(gprog, 'r'), c: gl.getUniformLocation(gprog, 'c') };
  const bufG = gl.createBuffer(), quad = new Float32Array(12);
  const grounds = [...document.querySelectorAll('[data-ground]')].map((el) => {
    const h = el.dataset.ground.replace('#', '');
    return { el, col: [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) };
  });
  document.documentElement.classList.add('field-on');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // ---------- particles ----------
  const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
  const R1 = new Float32Array(N), R2 = new Float32Array(N), R3 = new Float32Array(N), R4 = new Float32Array(N), G1 = new Float32Array(N), G2 = new Float32Array(N);
  const BASE = new Float32Array(N); // size class
  const CR = new Float32Array(N), CG = new Float32Array(N), CB = new Float32Array(N), CA = new Float32Array(N);
  const SZ = new Float32Array(N);
  const outP = new Float32Array(N * 2), outC = new Uint8Array(N * 4), outS = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < N; i++) {
    R1[i] = rnd(); R2[i] = rnd(); R3[i] = rnd(); R4[i] = rnd();
    const u = Math.max(1e-6, rnd()), v = rnd();
    const m = Math.sqrt(-2 * Math.log(u));
    G1[i] = m * Math.cos(TAU * v); G2[i] = m * Math.sin(TAU * v);
    BASE[i] = rnd() < 0.72 ? 1.7 : 2.6;
    X[i] = innerWidth * (0.5 + G1[i] * 0.2); Y[i] = innerHeight * 0.75 + G2[i] * 40;
    CR[i] = C.mist[0]; CG[i] = C.mist[1]; CB[i] = C.mist[2]; CA[i] = 0;
  }

  // ---------- pointer ----------
  const ptr = { x: -9999, y: -9999, vx: 0, vy: 0, down: false, t: 0 };
  addEventListener('pointermove', (e) => {
    if (ptr.x > -9000) { ptr.vx = e.clientX - ptr.x; ptr.vy = e.clientY - ptr.y; }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); dirty = true;
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.isPrimary) { ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); } }, { passive: true });
  const up = () => { ptr.down = false; };
  addEventListener('pointerup', up, { passive: true });
  addEventListener('pointercancel', up, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.x = ptr.y = -9999; ptr.down = false; });

  // ---------- helpers shared by states ----------
  const P4 = [0, 0, 0, 0];
  function put(st, i, x, y, col, a = 1, s = 1) {
    st.tx[i] = x; st.ty[i] = y; st.cr[i] = col[0]; st.cg[i] = col[1]; st.cb[i] = col[2]; st.ca[i] = a; st.sz[i] = s;
  }
  function makeState(name, def) {
    const sec = document.querySelector(`[data-state="${name}"]`);
    if (!sec) return null;
    const stage = sec.hasAttribute('data-stage') ? sec : sec.querySelector('[data-stage]');
    const st = Object.assign({
      name, sec, stage, w: 1, h: 1, anchors: {}, prog: 0, weight: 0, active: 0, tIn: 0,
      tx: new Float32Array(N), ty: new Float32Array(N), cr: new Float32Array(N), cg: new Float32Array(N), cb: new Float32Array(N), ca: new Float32Array(N), sz: new Float32Array(N),
      pin: sec.hasAttribute('data-pin'), top: 0, height: 0, h0: 0, h1: 0,
    }, def);
    return st;
  }
  function measureAnchors(st) {
    const r = st.stage.getBoundingClientRect();
    st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    st.anchors = {};
    st.stage.querySelectorAll('[data-anchor]').forEach((el) => {
      const a = el.getBoundingClientRect();
      const first = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().top - r.top : a.top - r.top + a.height;
      st.anchors[el.dataset.anchor] = { x: a.left - r.left, y: a.top - r.top, w: a.width, h: a.height, cx: a.left - r.left + a.width / 2, cy: a.top - r.top + a.height / 2, text: first };
    });
  }

  // A pluckable string under a waveform: a 1D wave equation, one cell per column.
  function makeString(cols, damp) {
    return { D: new Float32Array(cols), V: new Float32Array(cols), damp, cols };
  }
  function stepString(sg, st, rect, ampH) {
    const { D, V, cols } = sg;
    if (rect && ptr.x > -9000) {
      const lx = ptr.x - rect.left, ly = ptr.y - rect.top - st.h / 2;
      const recent = performance.now() - ptr.t < 120;
      if (lx > 0 && lx < st.w && Math.abs(ly) < st.h * 0.6) {
        const cp = (lx / st.w) * (cols - 1);
        const lo = Math.max(1, Math.floor(cp - 10)), hi = Math.min(cols - 2, Math.ceil(cp + 10));
        for (let c = lo; c <= hi; c++) {
          const g = Math.exp(-((c - cp) * (c - cp)) / 18);
          if (ptr.down) { D[c] += (clamp(ly, -ampH, ampH) - D[c]) * 0.25 * g; V[c] *= 1 - 0.5 * g; }
          else if (recent) V[c] += clamp(ptr.vy, -40, 40) * 0.09 * g;
        }
      }
    }
    for (let k = 0; k < 2; k++) {
      for (let c = 1; c < cols - 1; c++) V[c] += 0.24 * (D[c - 1] + D[c + 1] - 2 * D[c]) - 0.0015 * D[c];
      for (let c = 1; c < cols - 1; c++) { V[c] *= sg.damp; D[c] += V[c]; }
    }
  }

  // Dots sampled from real text, for the policy cloud.
  let policyPts = null;
  function samplePolicy() {
    const cv = document.createElement('canvas');
    cv.width = 300; cv.height = 120;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000';
    x.font = '600 46px "Anek Latin", sans-serif';
    x.textBaseline = 'top';
    x.fillText('Contact only in', 4, 6);
    x.fillText('permitted hours.', 4, 62);
    const d = x.getImageData(0, 0, 300, 120).data;
    const pts = [];
    for (let yy = 0; yy < 120; yy += 3) for (let xx = 0; xx < 300; xx += 3) if (d[(yy * 300 + xx) * 4 + 3] > 120) pts.push([xx / 150 - 1, yy / 150 - 0.4]);
    policyPts = pts.length > 40 ? pts : null;
  }

  // ---------- states ----------
  const states = [];
  const add = (s) => { if (s) states.push(s); };

  // 1 · The call: her voice as columns of dots, pluckable.
  add(makeState('hero', {
    layout() {
      this.cols = clamp(Math.round(this.w / 7), 50, 240);
      this.prof = speechProfile(this.cols);
      this.sg = makeString(this.cols, 0.996);
      this.per = Math.ceil(N / this.cols);
    },
    frame(t, rect) {
      const { cols, prof, sg, per, w, h } = this;
      const ampH = h * 0.46;
      stepString(sg, this, rect, ampH);
      const ph = reduced ? 2 : ((t / 7.5) % 1.3);
      const breath = 1 + 0.035 * Math.sin(t * 1.3);
      for (let i = 0; i < N; i++) {
        const c = i % cols, j = Math.floor(i / cols);
        const u = c / (cols - 1);
        let a = 0.03 + prof[c] * 0.97;
        const near = Math.abs(u - ph);
        if (!reduced && near < 0.05) a *= 1 + 0.28 * Math.sin(t * 22 + c * 1.7) * (1 - near / 0.05);
        a *= breath;
        const k = per > 1 ? (j / (per - 1)) * 2 - 1 : 0;
        const spoken = u < ph;
        put(this, i, (c + 0.5) * (w / cols), h / 2 + sg.D[c] + k * a * ampH, spoken ? C.paper : C.mist, spoken ? 1 : 0.8);
      }
    },
  }));

  // 2 · Five places: five clouds, five tempos, never in step.
  add(makeState('scatter', {
    layout() {
      const keys = ['customer', 'loan', 'calls', 'txn', 'policy'];
      this.R = clamp(Math.min(this.w, this.h) * 0.09, 44, 118);
      const R = this.R;
      this.centres = keys.map((k) => {
        const a = this.anchors[k];
        if (!a) return [this.w / 2, this.h / 2];
        return [a.cx, a.y < this.h / 2 ? a.y + a.h + R + 8 : a.y - R - 6];
      });
    },
    frame(t) {
      const R = this.R, cs = this.centres;
      const tick = Math.floor(t);
      for (let i = 0; i < N; i++) {
        const g = i % 5, k = Math.floor(i / 5);
        const [cx, cy] = cs[g];
        let x = 0, y = 0, col = C.mist, a = 0.92;
        if (g === 0) { // customer: a soft cluster that breathes slowly
          const b = 1 + 0.07 * Math.sin(t * 0.8);
          x = clamp(G1[i], -2.4, 2.4) * 0.4 * R * b; y = clamp(G2[i], -2.4, 2.4) * 0.4 * R * b;
        } else if (g === 1) { // loan ledger: a rigid grid that ticks once a second
          const cols = 22, rows = 14, cell = k % (cols * rows);
          const cx2 = cell % cols, ry = Math.floor(cell / cols);
          x = (cx2 / (cols - 1) * 2 - 1) * R * 1.05; y = (ry / (rows - 1) * 2 - 1) * R * 0.7;
          if (ry === (tick % rows)) col = C.paper, a = 1;
        } else if (g === 2) { // conversations: waveform fragments that breathe
          const cols = 34, c = k % cols, j = Math.floor(k / cols) % 18;
          const amp = (0.12 + 0.7 * Math.abs(Math.sin(c * 0.55 + t * 1.6)) * Math.abs(Math.sin(c * 0.21 + 1))) * R * 0.75;
          x = (c / (cols - 1) * 2 - 1) * R * 1.1; y = (j / 17 * 2 - 1) * amp;
        } else if (g === 3) { // transactions: bursts along three lanes
          const lane = k % 3, burst = Math.floor(t / 1.4) + (t % 1.4 < 0.3 ? (t % 1.4) / 0.3 : 1);
          const u = (R1[i] + burst * 0.18 * (1 + lane * 0.4)) % 1;
          x = (u * 2 - 1) * R * 1.15; y = (lane - 1) * R * 0.32 + G2[i] * 2;
          a = 0.5 + 0.5 * Math.sin(u * Math.PI);
        } else { // policy: dots that are letters
          if (policyPts) { const p = policyPts[k % policyPts.length]; x = p[0] * R * 1.15; y = p[1] * R * 1.15; }
          else { x = (R1[i] * 2 - 1) * R; y = (R2[i] * 2 - 1) * R * 0.5; }
          const drift = Math.sin(t * 0.37 + 2) * 2;
          x += drift;
        }
        put(this, i, cx + x, cy + y, col, a);
      }
    },
  }));

  // 3 · The loop: five tiles that grow, each showing its stage.
  add(makeState('loop', {
    layout() {
      const w = [1, 1.4, 1.9, 2.6, 3.3], tot = w.reduce((s, v) => s + v, 0);
      this.cut = []; let acc = 0;
      for (const v of w) { acc += v / tot; this.cut.push(acc); }
    },
    frame(t) {
      for (let i = 0; i < N; i++) {
        const q = R1[i];
        let g = 0; while (g < 4 && q > this.cut[g]) g++;
        const a = this.anchors['t' + g];
        if (!a) { put(this, i, this.w / 2, this.h / 2, C.mist, 0); continue; }
        const pad = 14, x0 = a.x + pad, y0 = a.y + pad, w = a.w - pad * 2 - 22, h = a.h - pad * 2;
        let x, y, col = C.paper, al = 1, s = 1;
        if (g === 0) { // understand: noise on the left settles into rows on the right
          const u = R2[i], rows = Math.max(3, Math.floor(h / 9));
          const order = smooth(clamp(u * 1.4 - 0.2, 0, 1));
          const ry = Math.floor(R3[i] * rows) / (rows - 1);
          x = x0 + u * w; y = y0 + (ry * (order) + R4[i] * (1 - order)) * h;
          col = order > 0.6 ? C.paper : C.mist;
        } else if (g === 1) { // predict: one line fans into three
          const u = (R2[i] + t * 0.06) % 1, br = Math.floor(R3[i] * 3) - 1;
          x = x0 + u * w; y = y0 + h / 2 + br * smooth(clamp(u * 1.6 - 0.4, 0, 1)) * h * 0.36 + G1[i] * 1.2;
          col = u < 0.35 ? C.mist : C.paper;
        } else if (g === 2) { // decide: everything is drawn into one dense decision
          const cx = x0 + w / 2, cy = y0 + h / 2, Rm = Math.min(w, h) * 0.45;
          if (R3[i] < 0.55) { const r = Math.sqrt(R2[i]) * Rm * 0.32; const an = R4[i] * TAU; x = cx + Math.cos(an) * r; y = cy + Math.sin(an) * r; }
          else { const k = (R2[i] + t * 0.12) % 1; const r = Rm * (1 - k) + Rm * 0.32 * k; const an = R4[i] * TAU + k * 0.6; x = cx + Math.cos(an) * r; y = cy + Math.sin(an) * r; al = 0.35 + 0.65 * k; }
          col = C.ink;
        } else if (g === 3) { // execute: one point fans out to four channels
          const u = (R2[i] + t * 0.08) % 1, lane = Math.floor(R3[i] * 4);
          const ly = y0 + h * (0.2 + lane * 0.2);
          const k = smooth(clamp(u * 2.2, 0, 1));
          x = x0 + u * w; y = y0 + h / 2 + (ly - (y0 + h / 2)) * k + G1[i] * 1.1;
        } else { // learn: the loop, orbiting
          const cx = x0 + w / 2, cy = y0 + h * 0.45, rr = Math.min(w, h) * 0.34;
          const an = R2[i] * TAU + t * 0.35;
          const ring = R3[i] < 0.8;
          const r = ring ? rr + G1[i] * 2.4 : Math.sqrt(R4[i]) * rr * 0.28;
          x = cx + Math.cos(an) * r; y = cy + Math.sin(an) * r;
          col = C.ink; s = ring ? 1 : 1.2;
        }
        put(this, i, x, y, col, al, s);
      }
    },
  }));

  // 4 · Account 1048: context, diagnosis, action, conversation, resolution, feedback.
  const tmp = { tx: new Float32Array(N), ty: new Float32Array(N), cr: new Float32Array(N), cg: new Float32Array(N), cb: new Float32Array(N), ca: new Float32Array(N), sz: new Float32Array(N) };
  add(makeState('case', {
    step: 0,
    shape(k, t, out) {
      const S = Math.min(this.w, this.h), ox = (this.w - S) / 2, oy = (this.h - S) / 2;
      const P = (u, v) => [ox + u * S, oy + v * S];
      const branchY = [0.22, 0.5, 0.78];
      for (let i = 0; i < N; i++) {
        const role = R3[i] < 0.42 ? 0 : R3[i] < 0.72 ? 1 : 2; // A, B, C
        const flow = (R1[i] + t * 0.07) % 1;
        let u, v, col = C.paper, a = 1, s = 1;
        if (k === 0) {
          const th = Math.floor(R2[i] * 4), v0 = 0.2 + th * 0.2;
          u = 0.04 + flow * 0.66;
          v = u < 0.48 ? v0 + (0.5 - v0) * smooth(clamp((u - 0.04) / 0.44, 0, 1)) : 0.5;
          v += G1[i] * 0.004;
          col = u < 0.22 ? C.mist : C.paper;
        } else if (k === 1) {
          u = 0.04 + flow * 0.8;
          const sp = smooth(clamp((u - 0.36) / 0.4, 0, 1));
          v = 0.5 + (branchY[role] - 0.5) * sp + G1[i] * 0.004;
          col = u < 0.2 ? C.mist : C.paper;
        } else {
          if (role > 0) { // B and C settle out like sediment: kept, dimmed
            u = 0.05 + R1[i] * 0.73;
            const sp = smooth(clamp((u - 0.36) / 0.4, 0, 1));
            v = 0.5 + (branchY[role] - 0.5) * sp + 0.03 + Math.abs(G2[i]) * 0.012;
            col = C.signal; a = 0.55;
          } else if (k === 2) { // A becomes the decision packet
            const r = Math.sqrt(R2[i]) * 0.085, an = R4[i] * TAU;
            u = 0.6 + Math.cos(an) * r; v = 0.3 + Math.sin(an) * r;
            col = C.saff;
          } else if (k === 3) { // the packet speaks
            const cols = 40, c = Math.floor(R2[i] * cols), j = R4[i] * 2 - 1;
            const amp = 0.012 + 0.07 * Math.abs(Math.sin(c * 0.7 + t * 5.3) * Math.sin(c * 0.19 + t * 1.3));
            u = 0.46 + (c / (cols - 1)) * 0.3; v = 0.3 + j * amp;
            col = C.saff;
          } else if (k === 4) { // recorded: a stamp
            const ring = R2[i] < 0.6;
            if (ring) { const an = R4[i] * TAU; const r = 0.11 + G1[i] * 0.003; u = 0.6 + Math.cos(an) * r; v = 0.3 + Math.sin(an) * r; }
            else { const q = R4[i]; const pts = q < 0.35 ? [0.545 + q / 0.35 * 0.04, 0.305 + q / 0.35 * 0.04] : [0.585 + (q - 0.35) / 0.65 * 0.08, 0.345 - (q - 0.35) / 0.65 * 0.09]; u = pts[0] + G1[i] * 0.002; v = pts[1] + G2[i] * 0.002; }
            col = C.green;
          } else { // the outcome goes back to the core
            if (R2[i] < 0.45) { const an = R4[i] * TAU; u = 0.6 + Math.cos(an) * 0.11; v = 0.3 + Math.sin(an) * 0.11; col = C.green; a = 0.85; }
            else {
              const q = (R4[i] + t * 0.05) % 1;
              const an = Math.PI * 0.5 + q * Math.PI * 1.05;
              // from the stamp, round the top of the plate, back to where the context came in
              u = 0.6 - 0.52 * q; v = 0.19 - Math.sin(q * Math.PI) * 0.12 + q * 0.3;
              col = C.paper; a = 0.4 + 0.6 * q;
            }
          }
        }
        const [x, y] = P(u, v);
        out.tx[i] = x; out.ty[i] = y; out.cr[i] = col[0]; out.cg[i] = col[1]; out.cb[i] = col[2]; out.ca[i] = a; out.sz[i] = s;
      }
    },
    frame(t) {
      const s = clamp(this.prog, 0, 0.9999) * 6;
      const k = Math.floor(s), q = s - k;
      this.step = k;
      this.shape(k, t, this);
      const blend = k < 5 ? easeInOut(clamp((q - 0.72) / 0.28, 0, 1)) : 0;
      if (blend > 0) {
        this.shape(k + 1, t, tmp);
        for (let i = 0; i < N; i++) {
          const e = clamp(blend * 1.4 - R1[i] * 0.4, 0, 1);
          this.tx[i] += (tmp.tx[i] - this.tx[i]) * e; this.ty[i] += (tmp.ty[i] - this.ty[i]) * e;
          this.cr[i] += (tmp.cr[i] - this.cr[i]) * e; this.cg[i] += (tmp.cg[i] - this.cg[i]) * e; this.cb[i] += (tmp.cb[i] - this.cb[i]) * e; this.ca[i] += (tmp.ca[i] - this.ca[i]) * e;
        }
      }
    },
  }));

  // 5 · The gate: six strata, a decision that falls, and a human who approves it.
  const gate = { approved: 0, layer: 0, hover: -1, waiting: false };
  add(makeState('gate', {
    layout() {
      const w = this.w, h = this.h;
      this.bandX = w * 0.0; this.bandW = w < 520 ? w * 0.52 : w * 0.6;
      this.bandY = []; for (let b = 0; b < 6; b++) this.bandY.push(h * (0.1 + b * 0.155));
      this.gateY = this.bandY[3];
      this.packR = clamp(Math.min(w, h) * 0.075, 26, 60);
      this.packN = Math.floor(N * 0.34);
      const strata = N - this.packN, per = Math.floor(strata / 6);
      this.per = per;
      const bh = 22, bw = this.bandW;
      const cols = Math.max(8, Math.round(Math.sqrt(per * bw / bh)));
      this.bcols = cols; this.brows = Math.max(2, Math.ceil(per / cols));
    },
    frame(t) {
      const { bandY, gateY, packR, packN, per, bandW, bcols, brows } = this;
      const cx = bandW * 0.5;
      const p = this.prog;
      const a = gate.approved;
      // where is the packet?
      const fall = easeInOut(clamp(p / 0.42, 0, 1));
      const topY = Math.max(packR * 0.5, bandY[0] - packR * 1.2), restY = gateY - packR * 0.55 - 8;
      const preY = topY + (restY - topY) * fall;
      const after = a >= 1 ? easeInOut(clamp((p - 0.5) / 0.36, 0, 1)) : 0;
      const belowY0 = gateY + packR + 18, belowY1 = bandY[5] - 2;
      const postY = belowY0 + (belowY1 - belowY0) * after;
      gate.waiting = p > 0.42 && a < 1;
      let lay = 0; for (let b = 0; b < 6; b++) if (preY + packR * 0.5 > bandY[b] - 12) lay = b;
      if (a > 0) lay = Math.max(3, a >= 1 ? (after > 0.55 ? 5 : after > 0.05 ? 4 : 3) : 3);
      gate.layer = lay;
      const hl = gate.hover >= 0 ? gate.hover : lay;
      // strata
      for (let i = packN; i < N; i++) {
        const k = i - packN, b = Math.min(5, Math.floor(k / per)), kk = k - b * per;
        const c = kk % bcols, r = Math.floor(kk / bcols) % brows;
        const isGate = b === 3;
        let x = (c + 0.5) / bcols * bandW, y = bandY[b] + (brows > 1 ? (r / (brows - 1) - 0.5) * (isGate ? 8 : 22) : 0);
        if (isGate && Math.abs(x - cx) < 5 && a > 0 && a < 1) x += x < cx ? -6 : 6; // the opening, while approving
        const lit = b === hl;
        const col = isGate ? (gate.waiting ? C.saff : lit ? C.paper : C.mist) : lit ? C.paper : C.mist;
        put(this, i, x, y, col, lit || isGate ? 1 : 0.42, isGate ? 0.9 : 1);
      }
      // the packet
      for (let i = 0; i < packN; i++) {
        const rank = R4[i];
        const an = R2[i] * TAU, rr = Math.sqrt(R1[i]) * packR;
        let x = cx + Math.cos(an) * rr, y, col = C.saff, al = 1, s = 1;
        if (p < 0.42 || rank >= a) {
          if (p >= 0.42 && rank >= a) {
            // waiting: the decision piles against the gate
            const xn = R1[i] * 2 - 1;
            x = cx + xn * packR * 1.9;
            y = gateY - 7 - (1 - Math.pow(Math.abs(xn), 1.5)) * packR * 1.05 * R2[i] - 2;
            if (rank < a + 0.035 && a > 0) { const f = (rank - a) / 0.035; x = cx + (R1[i] - 0.5) * 3; y = gateY - 6 - f * packR * 0.6; }
          } else y = preY + Math.sin(an) * rr * 0.8;
        } else if (rank > a - 0.04 && a < 1) {
          // passing through, in single file
          const f = (a - rank) / 0.04;
          x = cx + (R1[i] - 0.5) * 2; y = gateY - 4 + f * (packR + 18); col = C.green;
        } else {
          col = C.green;
          y = postY + Math.sin(an) * rr * 0.8;
          if (a >= 1 && after > 0.62 && R3[i] < 0.14) { // status verified: a tick
            const q = R3[i] / 0.14;
            const tx0 = bandW * 0.86, ty0 = bandY[4];
            if (q < 0.35) { x = tx0 + q / 0.35 * 10; y = ty0 + q / 0.35 * 10; } else { x = tx0 + 10 + (q - 0.35) / 0.65 * 22; y = ty0 + 10 - (q - 0.35) / 0.65 * 24; }
          } else if (a >= 1 && after > 0.9 && R3[i] > 0.88) { // the audit copy left behind
            const q = (R3[i] - 0.88) / 0.12;
            x = bandW * 0.12 + Math.cos(q * TAU) * packR * 0.45; y = bandY[5] + Math.sin(q * TAU) * packR * 0.45 - 30;
            col = C.paper; al = 0.5;
          }
        }
        put(this, i, x, y, col, al, s);
      }
    },
  }));

  // 6 · Within your control: the logo's pulse, built large on the saffron tile.
  add(makeState('board', {
    frame(t) {
      const a = this.anchors.mark;
      if (!a) return;
      const x0 = a.x + 26, w = a.w - 26 - 56, y0 = a.y + a.h * 0.46, h = a.h * 0.44;
      const lift = 1 + 0.02 * Math.sin(t * 1.1);
      for (let i = 0; i < N; i++) {
        pulseAt(R1[i], P4);
        const th = G1[i] * 2.4;
        put(this, i, x0 + P4[0] * w + P4[2] * th, y0 + P4[1] * h * lift + P4[3] * th, C.ink, 1, 0.9);
      }
    },
  }));

  // 7 · Your walls: data that presses against the boundary and never crosses it.
  const walls = { mode: 'premise' };
  add(makeState('walls', {
    layout() {
      const w = this.w, h = this.h, narrow = w < 560;
      this.A = narrow ? [0.02 * w, 0.08 * h, 0.96 * w, 0.5 * h] : [0.01 * w, 0.1 * h, 0.6 * w, 0.82 * h];
      this.B = narrow ? [0.02 * w, 0.66 * h, 0.96 * w, 0.28 * h] : [0.69 * w, 0.1 * h, 0.3 * w, 0.82 * h];
      this.narrow = narrow;
      this.wallN = Math.floor(N * 0.12); this.courN = Math.floor(N * 0.03);
    },
    region(i) {
      const m = walls.mode, f = R2[i];
      if (m === 'premise') return 0;
      if (m === 'private') return f < 0.3 ? 0 : 1;
      return f < 0.5 ? 0 : 1;
    },
    frame(t) {
      const { A, B, wallN, courN, narrow } = this;
      const m = walls.mode;
      const open = m !== 'premise';
      // opening, between A and B
      const oy = narrow ? 0 : A[1] + A[3] * 0.5, ox = narrow ? A[0] + A[2] * 0.5 : 0;
      const per = (r) => 2 * (r[2] + r[3]);
      const pA = per(A), pB = per(B);
      for (let i = 0; i < wallN; i++) {
        const onB = i % 2 === 1, r = onB ? B : A, P = onB ? pB : pA;
        let d = ((i >> 1) / (wallN >> 1)) * P, x, y;
        if (d < r[2]) { x = r[0] + d; y = r[1]; }
        else if (d < r[2] + r[3]) { x = r[0] + r[2]; y = r[1] + d - r[2]; }
        else if (d < 2 * r[2] + r[3]) { x = r[0] + r[2] - (d - r[2] - r[3]); y = r[1] + r[3]; }
        else { x = r[0]; y = r[1] + r[3] - (d - 2 * r[2] - r[3]); }
        let al = onB && !open ? 0.45 : 1, col = onB && !open ? C.signal : C.paper;
        if (open) {
          const gap = narrow ? Math.abs(x - ox) < 14 && ((!onB && Math.abs(y - (A[1] + A[3])) < 2) || (onB && Math.abs(y - B[1]) < 2))
            : Math.abs(y - oy) < 14 && ((!onB && Math.abs(x - (A[0] + A[2])) < 2) || (onB && Math.abs(x - B[0]) < 2));
          if (gap) { x = narrow ? ox + (x < ox ? -16 : 16) : x; y = narrow ? y : oy + (y < oy ? -16 : 16); }
        }
        put(this, i, x, y, col, al, 1.05);
      }
      for (let i = wallN; i < wallN + courN; i++) {
        if (!open) { put(this, i, A[0] + 12 + R1[i] * (A[2] - 24), A[1] + 12 + R2[i] * (A[3] - 24), C.mist, 0.9); continue; }
        const dir = m === 'hybrid' && i % 2 ? -1 : 1;
        let u = ((i - wallN) / courN + t * 0.04 * dir) % 1; if (u < 0) u += 1;
        let x, y;
        if (narrow) {
          const ya = A[1] + A[3] * 0.62, yb = B[1] + B[3] * 0.4;
          x = ox + (m === 'hybrid' ? (i % 2 ? -5 : 5) : 0); y = ya + (yb - ya) * u;
        } else {
          const xa = A[0] + A[2] * 0.7, xb = B[0] + B[2] * 0.4;
          x = xa + (xb - xa) * u; y = oy + (m === 'hybrid' ? (i % 2 ? -5 : 5) : 0);
        }
        put(this, i, x, y, C.paper, 1);
      }
      for (let i = wallN + courN; i < N; i++) {
        const reg = this.region(i), r = reg ? B : A;
        const wx = Math.sin(t * 0.5 + R3[i] * TAU) * 10, wy = Math.cos(t * 0.43 + R4[i] * TAU) * 10;
        const x = r[0] + 10 + R1[i] * (r[2] - 20) + wx, y = r[1] + 10 + R4[i] * (r[3] - 20) + wy;
        put(this, i, x, y, reg ? C.paper : C.mist, 0.95);
      }
    },
    // the boundary is a hard constraint: dots compress against it, they never leave
    constrain(ox, oy) {
      const { A, B, wallN, courN } = this;
      const open = walls.mode !== 'premise';
      for (let i = wallN + courN; i < n; i++) {
        const r = this.region(i) ? B : A;
        const x0 = ox + r[0] + 4, x1 = ox + r[0] + r[2] - 4, y0 = oy + r[1] + 4, y1 = oy + r[1] + r[3] - 4;
        if (X[i] < x0) { X[i] = x0; VX[i] = Math.abs(VX[i]) * 0.3; } else if (X[i] > x1) { X[i] = x1; VX[i] = -Math.abs(VX[i]) * 0.3; }
        if (Y[i] < y0) { Y[i] = y0; VY[i] = Math.abs(VY[i]) * 0.3; } else if (Y[i] > y1) { Y[i] = y1; VY[i] = -Math.abs(VY[i]) * 0.3; }
      }
      return open;
    },
    push: 2.4,
  }));

  // 8 · Engines: each tile holds its engine's texture; the portfolio pours, then sorts itself.
  const engines = { sel: 'collections' };
  add(makeState('engines', {
    layout() {
      const ids = ['collections', 'customer', 'conversation', 'portfolio', 'risk', 'operations'];
      const wts = [24, 6, 6, 12, 6, 6], tot = 60;
      this.ids = ids; this.cut = []; let acc = 0;
      for (const v of wts) { acc += v / tot; this.cut.push(acc); }
      this.acct = -1;
    },
    frame(t) {
      const tin = this.tIn;
      for (let i = 0; i < N; i++) {
        let g = 0; while (g < 5 && R1[i] > this.cut[g]) g++;
        const id = this.ids[g], a = this.anchors[id];
        if (!a) { put(this, i, 0, 0, C.mist, 0); continue; }
        const x0 = a.x + 18, w = a.w - 36, y0 = a.y + 18, h = Math.max(24, a.text - y0 - 16);
        const lit = engines.sel === id;
        let x, y, col = lit ? C.paper : C.mist, al = lit ? 1 : 0.7, s = 1;
        const lo = g === 0 ? 0 : this.cut[g - 1], q = (R1[i] - lo) / (this.cut[g] - lo); // 0..1 within group
        if (g === 0) { // collections: pour into four DPD buckets, then rank
          const shares = [0.42, 0.27, 0.18, 0.13];
          let b = 0, acc = shares[0]; while (b < 3 && q > acc) { b++; acc += shares[b]; }
          const bq = (q - (acc - shares[b])) / shares[b];
          const bw = w / 4, sp = 4.6, cols = Math.max(3, Math.floor((bw - 14) / sp));
          const cnt = this.cut[0] * n * shares[b], rows = Math.max(1, Math.ceil(cnt / cols));
          const vsp = Math.min(sp, (h * 0.96 * (shares[b] / 0.42)) / rows);
          const k = Math.floor(bq * cnt);
          const cx = x0 + b * bw + (k % cols) * sp + 4, cy = y0 + h - Math.floor(k / cols) * vsp;
          const pour = reduced ? 1 : clamp((tin * 0.8 - bq * 0.9) * 2.4, 0, 1);
          const sortK = reduced ? 1 : easeInOut(clamp((tin - 3.2) / 1.6, 0, 1));
          // ranked: one wall, highest priority top-left
          const rank = R4[i], rcols = Math.max(4, Math.floor(w / sp));
          const rk = Math.floor(rank * rcols * Math.floor(h / sp));
          const rx = x0 + (rk % rcols) * sp, ry = y0 + Math.floor(rk / rcols) * sp;
          const fx = cx, fy = y0 - 30 + (cy - y0 + 30) * easeOut(pour);
          x = fx + (rx - fx) * sortK; y = fy + (ry - fy) * sortK;
          if (sortK > 0.5) { col = rank < 0.12 ? C.paper : C.mist; al = rank < 0.12 ? 1 : 0.62; }
          if (this.acct < 0) this.acct = i;
          if (i === this.acct) { col = C.saff; al = 1; s = 2.4; }
        } else if (g === 1) { // customer: one soft, dense context
          const b = 1 + 0.05 * Math.sin(t);
          x = x0 + w / 2 + clamp(G1[i], -2.5, 2.5) * Math.min(w, h) * 0.17 * b; y = y0 + h / 2 + clamp(G2[i], -2.5, 2.5) * Math.min(w, h) * 0.17 * b;
        } else if (g === 2) { // conversation: a small waveform
          const cols = 30, c = Math.floor(q * cols * 13) % cols, j = R3[i] * 2 - 1;
          const amp = (0.1 + 0.8 * Math.abs(Math.sin(c * 0.5 + t * 2.1) * Math.sin(c * 0.17 + 0.6))) * h * 0.42;
          x = x0 + (c / (cols - 1)) * w; y = y0 + h / 2 + j * amp;
        } else if (g === 3) { // portfolio: a heat grid
          const gc = 6, gr = 8, cell = Math.floor(q * gc * gr) % (gc * gr), cxi = cell % gc, cyi = Math.floor(cell / gc);
          const heat = 0.5 + 0.5 * Math.sin(cxi * 1.3 + cyi * 0.7 + 1.2) * Math.cos(cyi * 0.9 - cxi * 0.4);
          const cw = w / gc, ch = h / gr;
          x = x0 + cxi * cw + (R2[i] * 0.7 + 0.15) * cw; y = y0 + cyi * ch + (R3[i] * 0.7 + 0.15) * ch;
          col = heat > 0.72 ? C.paper : C.mist; al = (0.35 + heat * 0.65) * (lit ? 1 : 0.8);
        } else if (g === 4) { // risk: held behind a line; exceptions flagged
          const lineX = x0 + w * 0.62;
          if (R2[i] < 0.22) { x = lineX + (R3[i] - 0.5) * 2; y = y0 + R4[i] * h; col = C.paper; al = 1; }
          else if (R2[i] > 0.985) { x = lineX + 18 + R3[i] * (w * 0.3); y = y0 + R4[i] * h; col = C.saff; al = 1; s = 1.5; }
          else { const d = Math.pow(R3[i], 2.2); x = lineX - 6 - d * w * 0.58 + Math.sin(t * 2 + R4[i] * 9) * 1.5; y = y0 + R4[i] * h; }
        } else { // operations: a queue with a bottleneck
          const u = (R2[i] + t * 0.05) % 1;
          const xu = u - 0.1 * Math.sin(TAU * (u - 0.08)) / TAU * 2.2;
          const half = h * (0.36 - 0.26 * Math.exp(-Math.pow((xu - 0.55) / 0.09, 2)));
          x = x0 + xu * w; y = y0 + h / 2 + (R3[i] * 2 - 1) * half;
        }
        put(this, i, x, y, col, al, s);
      }
    },
  }));

  // 9 · Outcomes: the visitor's own hours, one dot per five.
  const stats = { dots: 1200 };
  add(makeState('stats', {
    frame(t) {
      const w = this.w, h = this.h - 24;
      const need = Math.min(stats.dots, n - 200);
      const sp = clamp(Math.sqrt((w * h) / Math.max(need, 1)) * 0.92, 3.4, 14);
      const cols = Math.max(1, Math.floor(w / sp));
      for (let i = 0; i < N; i++) {
        if (i < need) {
          const c = i % cols, r = Math.floor(i / cols);
          put(this, i, w - (c + 0.5) * sp, h - (r + 0.5) * sp, C.ink, 1, clamp(sp / 5.5, 0.8, 1.9));
        } else {
          const j = need > 0 ? i % need : 0, c = j % cols, r = Math.floor(j / cols);
          put(this, i, w - (c + 0.5) * sp, h - (r + 0.5) * sp, C.ink, need > 0 ? 0.0 : 0.3, 1);
        }
      }
    },
  }));

  // 10 · The reply: the same pluck, now governed. A ghost of the first call lies beneath it.
  add(makeState('reply', {
    layout() {
      this.cols = clamp(Math.round(this.w / 7), 50, 240);
      this.ghost = speechProfile(this.cols);
      this.sg = makeString(this.cols, 0.955);
      this.per = Math.ceil((N * 0.78) / this.cols);
      this.gn = Math.floor(N * 0.22);
    },
    frame(t, rect) {
      const { cols, ghost, sg, per, gn, w, h } = this;
      const ampH = h * 0.42;
      stepString(sg, this, rect, ampH);
      for (let i = 0; i < N; i++) {
        if (i < gn) {
          const c = i % cols, j = Math.floor(i / cols), pg = Math.ceil(gn / cols);
          const k = pg > 1 ? (j / (pg - 1)) * 2 - 1 : 0;
          put(this, i, (c + 0.5) * (w / cols), h / 2 + k * (0.03 + ghost[c]) * ampH, C.signal, 0.28, 0.85);
          continue;
        }
        const ii = i - gn, c = ii % cols, j = Math.floor(ii / cols);
        const u = c / (cols - 1);
        const env = Math.pow(Math.sin(Math.PI * u), 1.4);
        const a = (0.05 + 0.4 * env * (0.82 + 0.18 * Math.sin(u * 38))) * (1 + 0.02 * Math.sin(t * 1.2));
        const k = per > 1 ? (j / (per - 1)) * 2 - 1 : 0;
        put(this, i, (c + 0.5) * (w / cols), h / 2 + sg.D[c] + k * a * ampH, C.ink, 1);
      }
    },
  }));

  // 11 · Start with one: the line under the decision grows a pulse as the form fills.
  const form = { level: 0, shown: 0 };
  add(makeState('cta', {
    frame(t) {
      form.shown = reduced ? form.level : form.shown + (form.level - form.shown) * 0.08;
      const w = this.w, h = this.h, a = form.shown;
      for (let i = 0; i < N; i++) {
        pulseAt(R1[i], P4);
        const th = G1[i] * 1.6;
        const y = h * 0.5 + (P4[1] - 0.5) * h * 0.86 * a;
        put(this, i, P4[0] * w + P4[2] * th * a, y + P4[3] * th, C.ink, 1, 0.9);
      }
    },
  }));

  // 12 · The mark, built large.
  add(makeState('foot', {
    frame(t) {
      const w = this.w, h = this.h, m = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--m')) || 20;
      const x0 = m, pw = (w - 2 * m) * 0.7, bar0 = x0 + (w - 2 * m) * 0.76, bar1 = w - m;
      for (let i = 0; i < N; i++) {
        if (R3[i] < 0.84) {
          pulseAt(R1[i], P4);
          const th = G1[i] * 5.5;
          put(this, i, x0 + P4[0] * pw + P4[2] * th, h * 0.08 + P4[1] * h * 0.8 + P4[3] * th, C.saff, 1, 1);
        } else {
          put(this, i, bar0 + R1[i] * (bar1 - bar0), h * 0.82 + G1[i] * 4, C.green, 1, 1);
        }
      }
    },
  }));

  // ---------- layout & scroll mapping ----------
  let vw = innerWidth, vh = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  function layoutAll() {
    vw = canvas.clientWidth || innerWidth; vh = canvas.clientHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, vw < 760 ? 2 : 1.75);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const sy = scrollY;
    for (const st of states) {
      const r = st.sec.getBoundingClientRect();
      st.top = r.top + sy; st.height = r.height;
      if (st.pin) { st.h0 = st.top - vh * 0.1; st.h1 = Math.max(st.h0 + 1, st.top + st.height - vh); }
      else {
        st.h0 = st.top - vh * 0.32; st.h1 = st.top + st.height - vh * 0.68;
        if (st.h1 < st.h0) st.h0 = st.h1 = (st.h0 + st.h1) / 2;
      }
      measureAnchors(st);
      st.layout && st.layout();
    }
    if (states.length) states[0].h0 = -1e9;
    dirty = true;
  }

  function locate(y) {
    for (let k = 0; k < states.length; k++) {
      const st = states[k];
      if (y <= st.h1 || k === states.length - 1) {
        if (y >= st.h0 || k === 0) return [k, k, 0];
        const prev = states[k - 1];
        const f = (y - prev.h1) / Math.max(1, st.h0 - prev.h1);
        return [k - 1, k, clamp(f, 0, 1)];
      }
    }
    return [0, 0, 0];
  }

  // ---------- loop ----------
  let dirty = true, last = performance.now(), t0 = last, frames = 0, slow = 0, prevKey = '', prevTop = 0, lastScroll = -1;
  let running = true;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const y = scrollY;
    if (reduced && !dirty && y === lastScroll) return;
    lastScroll = y;
    const dt = Math.min(50, now - last); last = now;
    const t = reduced ? 3 : (now - t0) / 1000;
    frames++;
    if (frames > 30 && frames < 150) { if (dt > 26) slow++; if (frames === 149 && slow > 70) n = Math.floor(N * 0.6); }

    const [ia, ib, f] = locate(y);
    const A = states[ia], B = states[ib];
    if (!A) return;
    for (const st of states) {
      st.prog = clamp((y - st.h0) / Math.max(1, st.h1 - st.h0), 0, 1);
      const wgt = st === A ? 1 - f : st === B ? f : 0;
      if (wgt > 0.5 && st.weight <= 0.5) st.tIn0 = t;
      st.weight = wgt;
      st.tIn = t - (st.tIn0 || t);
    }
    const ra = A.stage.getBoundingClientRect();
    A.frame(t, ra);
    let rb = ra;
    if (B !== A && f > 0) { rb = B.stage.getBoundingClientRect(); B.frame(t, rb); }

    // keep the dots attached to the page when the dominant stage scrolls
    const dom = f < 0.5 ? A : B, domTop = f < 0.5 ? ra.top : rb.top;
    if (prevKey === dom.name) { const dy = domTop - prevTop; if (dy !== 0 && Math.abs(dy) < vh) for (let i = 0; i < n; i++) Y[i] += dy; }
    prevKey = dom.name; prevTop = domTop;

    const blend = B !== A && f > 0;
    const steps = reduced ? 1 : clamp(Math.round(dt / 16.7), 1, 3);
    const R = 120, push = (f < 0.5 ? A.push : B.push) || 1;
    const pRecent = now - ptr.t < 1500 && ptr.x > -9000;
    const k = 0.055, damp = 0.8;
    const cl = reduced ? 1 : 0.09;
    for (let i = 0; i < n; i++) {
      let tx = A.tx[i] + ra.left, ty = A.ty[i] + ra.top;
      let r = A.cr[i], g = A.cg[i], b = A.cb[i], a = A.ca[i], s = A.sz[i] || 1;
      if (blend) {
        const st = 0.55 * R2[i] + 0.45 * clamp((A.tx[i] + ra.left) / vw, 0, 1);
        const e = easeInOut(clamp((f * 1.5 - st * 0.5), 0, 1));
        tx += (B.tx[i] + rb.left - tx) * e; ty += (B.ty[i] + rb.top - ty) * e;
        r += (B.cr[i] - r) * e; g += (B.cg[i] - g) * e; b += (B.cb[i] - b) * e; a += (B.ca[i] - a) * e; s += ((B.sz[i] || 1) - s) * e;
      }
      if (reduced) { X[i] = tx; Y[i] = ty; VX[i] = VY[i] = 0; }
      else {
        for (let q = 0; q < steps; q++) {
          let ax = (tx - X[i]) * k, ay = (ty - Y[i]) * k;
          if (pRecent) {
            const dx = X[i] - ptr.x, dy = Y[i] - ptr.y, d2 = dx * dx + dy * dy;
            if (d2 < R * R && d2 > 0.01) {
              const d = Math.sqrt(d2), fall = 1 - d / R, fo = fall * fall * 7 * push;
              ax += (dx / d) * fo + ptr.vx * 0.02 * fall; ay += (dy / d) * fo + ptr.vy * 0.02 * fall;
            }
          }
          VX[i] = (VX[i] + ax) * damp; VY[i] = (VY[i] + ay) * damp;
          X[i] += VX[i]; Y[i] += VY[i];
        }
      }
      CR[i] += (r - CR[i]) * cl; CG[i] += (g - CG[i]) * cl; CB[i] += (b - CB[i]) * cl; CA[i] += (a - CA[i]) * cl;
      SZ[i] = s;
    }
    if (!reduced && A.constrain && !blend) A.constrain(ra.left, ra.top);
    ptr.vx *= 0.85; ptr.vy *= 0.85;

    for (let i = 0; i < n; i++) {
      outP[i * 2] = X[i]; outP[i * 2 + 1] = Y[i];
      outC[i * 4] = CR[i]; outC[i * 4 + 1] = CG[i]; outC[i * 4 + 2] = CB[i]; outC[i * 4 + 3] = clamp(CA[i], 0, 1) * 255;
      outS[i] = BASE[i] * SZ[i];
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (grounds.length) {
      gl.useProgram(gprog); gl.uniform2f(gloc.r, vw, vh);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufG);
      gl.disableVertexAttribArray(loc.c); gl.disableVertexAttribArray(loc.s);
      for (const g of grounds) {
        const r = g.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.width < 1) continue;
        quad.set([r.left, r.top, r.right, r.top, r.left, r.bottom, r.left, r.bottom, r.right, r.top, r.right, r.bottom]);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(gloc.p); gl.vertexAttribPointer(gloc.p, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(gloc.c, g.col[0], g.col[1], g.col[2], 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      gl.useProgram(prog);
    }
    gl.uniform2f(loc.r, vw, vh); gl.uniform1f(loc.d, dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.bufferData(gl.ARRAY_BUFFER, outP.subarray(0, n * 2), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufC); gl.bufferData(gl.ARRAY_BUFFER, outC.subarray(0, n * 4), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.c); gl.vertexAttribPointer(loc.c, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufS); gl.bufferData(gl.ARRAY_BUFFER, outS.subarray(0, n), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.s); gl.vertexAttribPointer(loc.s, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, n);
    dirty = false;
    api.onframe && api.onframe(api);
  }

  let rt = 0;
  const relayout = () => { clearTimeout(rt); rt = setTimeout(layoutAll, 120); };
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW || !small) { lastW = innerWidth; relayout(); } else { relayout(); } });
  new ResizeObserver(relayout).observe(document.querySelector('main') || document.body);
  document.fonts && document.fonts.ready.then(() => { samplePolicy(); layoutAll(); });
  addEventListener('scroll', () => { dirty = true; }, { passive: true });

  layoutAll();
  requestAnimationFrame(frame);

  const api = {
    gate, walls, engines, stats, form,
    get count() { return n; },
    get caseStep() { const s = states.find((x) => x.name === 'case'); return s ? s.step : 0; },
    states,
    poke() { dirty = true; },
    relayout: layoutAll,
    onframe: null,
  };
  return api;
}
