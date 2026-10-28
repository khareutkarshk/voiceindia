// The brand wave, drawn as particles. One WebGL draw call; every dot is placed in the vertex shader.
// Threads carry the brand's meanings: navy = foundation, blue = intelligence, orange = action, green = trust.
// Each chapter declares a shape (a wave, a word, a walled field, the logo). Scrolling mixes the dots
// from one shape to the next; the page's own scroll (smoothed by Lenis) is the only clock for that.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const VS = `
precision highp float;
attribute vec4 aSeed;   // thread, u, r1, r2
attribute vec4 aSeed2;  // gaussian, strand, r3, size
attribute vec2 aFrom;
attribute vec2 aTo;
uniform vec2 uRes;
uniform float uDpr, uTime, uMix, uApprove;
uniform float uModeA, uModeB;
uniform vec4 uRectA, uRectB, uP1A, uP1B, uP2A, uP2B;
uniform vec3 uColA, uColB;
uniform vec4 uCA, uCB;   // colour: one-colour amount, accents kept (1 orange+green, 2 green), approve flag, dot size
uniform vec3 uMouse;
uniform float uFar;
uniform float uSel;     // the engine whose thread is lit     // travel distance (in screens) beyond which shapes dissolve instead of fly
uniform vec3 uBand;      // viewport y of up to three ground edges
uniform vec4 uBandTone;  // tone (0 light, 1 navy) of the ground above, between and below them
varying vec4 vCol;

vec3 threadCol(float k, float dark) {
  vec3 l = k < .5 ? vec3(.027,.106,.286) : k < 1.5 ? vec3(.153,.298,.608) : k < 2.5 ? vec3(1.,.42,.102) : vec3(.086,.639,.29);
  vec3 d = k < .5 ? vec3(.79,.84,.95) : k < 1.5 ? vec3(.43,.57,.86) : k < 2.5 ? vec3(1.,.5,.23) : vec3(.2,.78,.43);
  return mix(l, d, dark);
}

// x, y, alpha in viewport px for one shape
vec3 shape(float mode, vec4 R, vec4 p1, vec4 p2, vec2 pts) {
  float k = aSeed.x, u = aSeed.y, r1 = aSeed.z, r2 = aSeed.w;
  float g = aSeed2.x, st = aSeed2.y, r3 = aSeed2.z;
  float t = uTime, w = R.z, h = R.w;
  if (mode > 0.5 && mode < 1.5) {
    vec2 j = vec2(sin(t * 1.1 + r1 * 40.), cos(t * .9 + r2 * 40.)) * p1.w;
    return vec3(R.xy + pts + j, .68 + .32 * r1);
  }
  if (mode > 2.5) {
    // one core fanning out into six engine threads
    float lane = floor(r2 * 6.);
    float ly = h * (.1 + .16 * lane);
    if (r3 < .1) return vec3(R.x + g * .6, R.y + h * (.1 + .8 * r1), .9);
    bool on = abs(lane - uSel) < .5;
    float uu = on ? fract(u + t * .06) : u;
    float reach = on ? 1. : .42 + .3 * fract(sin(lane * 12.9898) * 43758.55);
    float x = 10. + uu * (w * p1.x - 10.) * reach;
    float y = ly + (st - 3.) * h * .0026 + g * .3 + (on ? sin(uu * 18. - t * 3.) * h * .006 : 0.);
    return vec3(R.x + x, R.y + y, on ? .95 : .55);
  }
  if (mode > 1.5) {
    // data flows in from the left and stops at a soft membrane: it never leaves the boundary
    float mx = w * .82;
    vec2 p; float a = .9;
    if (r3 < .16) {
      float yy = r1 * h;
      float bend = sin(yy / h * 3.14159) * w * .05 + sin(yy * .02 + t * .6) * 2.;
      p = vec2(mx + bend + g * .8, yy);
      a = .35 + .55 * sin(r1 * 3.14159);
    } else {
      float x = u * mx;
      float lane = k * .2 + .2;
      float y = h * lane + sin(u * 5.5 + t * .4 + k * 1.7) * h * .055 + sin(u * 12. - t * .3 + k) * h * .015 + (st - 3.) * h * .0065;
      p = vec2(x, y);
      vec2 m = R.xy + p - uMouse.xy; float md = length(m);
      if (md < 150.) p += m / max(md, .001) * pow(1. - md / 150., 2.) * 70. * uMouse.z;
      float lim = mx + sin(p.y / h * 3.14159) * w * .05 - 6.;
      p.x = min(p.x, lim - abs(g) * 1.5);
      a = .25 + .7 * smoothstep(0., .25, u);
    }
    return vec3(R.xy + p, a);
  }
  // the wave
  float os = p2.w;
  float x = (u * (1. + 2. * os) - os) * w;
  float s = smoothstep(.3, 1.05, u);
  float ph = k * 1.9;
  float base = h * (.86 - p1.x * .66 * s + p2.y);
  float off = k < .5 ? 0. : k < 1.5 ? -.075 : k < 2.5 ? -.04 : .015;
  float y = base + off * h * (.4 + s) + p1.y * (.3 + .7 * s) * h * (.075 * sin(u * 4.6 + t * .32 + ph) + .035 * sin(u * 10.3 - t * .47 + ph * 1.7));
  float env = .35 + 1.65 * sin(3.14159 * u);
  float a = .9;
  float yy = y + (st - 3. + (aSeed.z - .5) * .45) * h * .0055 * env + g * .5;
  if (k < .5 && r3 < .58 && p2.x > 0.) {
    yy = y + 3. + pow(r1, 1.25) * h * .42 * p2.x * (.75 + .25 * sin(u * 3. + t * .2));
    a = .25 + .65 * pow(1. - r1, 1.5);
  }
  if (k > 1.5 && k < 2.5) {
    float c = fract(t * .07);
    yy += p1.w * sin(u * 120. - t * 7.) * h * .02 * exp(-pow((u - c) * 7., 2.));
  }
  float fr = p1.z * smoothstep(.08, .75, u);
  if (fr > 0.) {
    float lane = floor(r2 * 5.);
    float ly = h * (.14 + .18 * lane) + (st - 3.) * h * .0045 + sin(u * 7. + t * .5 + lane * 2.) * h * .025 + g * 1.4;
    yy = mix(yy, ly, fr);
    a = mix(a, .92, fr);
  }
  a *= os > 0. ? 1. : smoothstep(0., .14, u);
  x *= 1. - .2 * p1.z;
  return vec3(R.x + x, R.y + yy, a);
}

float toneAt(float y) {
  return y < uBand.x ? uBandTone.x : y < uBand.y ? uBandTone.y : y < uBand.z ? uBandTone.z : uBandTone.w;
}
// p1.y = how much the shape is one colour; p1.z = which accents keep their own colour (1 orange+green, 2 green)
// col.r < 0 means "the ink of the ground": navy on light, near-white on navy
vec3 colour(vec4 C, vec3 col, float tone) {
  float k = aSeed.x;
  vec3 c = threadCol(k, tone);
  float amt = C.x;
  if ((C.y > .5 && C.y < 1.5 && k > 1.5) || (C.y > 1.5 && k > 2.5)) amt = 0.;
  vec3 ink = col.r < 0. ? mix(vec3(.027, .106, .286), vec3(.93, .95, 1.), tone) : col;
  c = mix(c, ink, amt);
  if (C.z > .5 && aSeed.y < uApprove * 1.02) c = threadCol(3., tone);
  return c;
}

void main() {
  // dots leave in order along the wave (left first), so a shape peels away as a stream, not a cloud
  bool words = uModeA > .5 && uModeA < 1.5 && uModeB > .5 && uModeB < 1.5;
  float e = words ? clamp(uMix * 1.35 - aSeed2.z * .35, 0., 1.) : clamp(uMix * 1.7 - (aSeed.y * .55 + aSeed2.z * .15), 0., 1.);
  e = e < .5 ? 4. * e * e * e : 1. - pow(-2. * e + 2., 3.) / 2.;
  vec3 A = shape(uModeA, uRectA, uP1A, uP2A, aFrom);
  vec3 B = uMix > 0. ? shape(uModeB, uRectB, uP1B, uP2B, aTo) : A;
  vec2 dir = B.xy - A.xy;
  // far apart: dissolve out and back in rather than fly across the words between
  float far = smoothstep(uFar, uFar + .5, length(dir) / uRes.y);
  vec2 p = mix(mix(A.xy, B.xy, e), e < .5 ? A.xy : B.xy, far);
  float fade = mix(1., abs(1. - 2. * e), far);
  vec2 mid = (A.xy + B.xy) * .5;
  vec2 cur = vec2(sin(mid.y * .0045 + uTime * .3), cos(mid.x * .004 - uTime * .25));
  p += cur * sin(e * 3.14159) * min(42., length(dir) * .1) * (1. - far);
  if (words) {
    float sw = sin(e * 3.14159);
    p += vec2(sin(aSeed.z * 31. + uTime * .7), cos(aSeed.w * 27. + uTime * .6)) * sw * 26.;
    fade *= 1. - .7 * sw;
  }
  float push = mix(uModeA > 1.5 ? 0. : uModeA > .5 ? .3 : 1., uModeB > 1.5 ? 0. : uModeB > .5 ? .3 : 1., e) * uMouse.z;
  vec2 m = p - uMouse.xy; float md = length(m);
  if (md < 130. && push > 0.) p += m / max(md, .001) * pow(1. - md / 130., 2.) * 46. * push;
  float tone = toneAt(p.y);
  vec3 cA = colour(uCA, uColA, tone), cB = colour(uCB, uColB, tone);
  float lit = abs(floor(aSeed.w * 6.) - uSel) < .5 ? 1. : 0.;
  if (uModeA > 2.5) { cA = lit > .5 ? threadCol(2., tone) : cA; A.z *= lit > .5 ? 1. : .38; }
  if (uModeB > 2.5) { cB = lit > .5 ? threadCol(2., tone) : cB; B.z *= lit > .5 ? 1. : .38; }
  vec3 inkC = mix(vec3(.027, .106, .286), vec3(.93, .95, 1.), tone);
  vec3 cm = e < .5 ? mix(cA, inkC, smoothstep(0., .5, e)) : mix(inkC, cB, smoothstep(.5, 1., e));
  vCol = vec4(uMix > 0. ? cm : cA, mix(A.z, B.z, e) * fade);
  vec2 q = p / uRes * 2. - 1.;
  gl_Position = vec4(q.x, -q.y, 0., 1.);
  gl_PointSize = mix(uCA.w > 0. ? uCA.w : aSeed2.w, uCB.w > 0. ? uCB.w : aSeed2.w, e) * uDpr;
}`;

const FS = `
precision mediump float;
varying vec4 vCol;
void main() {
  float r = length(gl_PointCoord - .5);
  float a = (1. - smoothstep(.34, .5, r)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;

const ORANGE = [1, 0.42, 0.102];
const DOT = 3.6; // dot size for type: big enough to read as dots, with clear gaps between

export function createWave(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const narrow = innerWidth < 760;
  const N = narrow ? 13000 : innerWidth < 1200 ? 21000 : 30000;

  // seeds
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const S1 = new Float32Array(N * 4), S2 = new Float32Array(N * 4);
  const U = new Float32Array(N), K = new Uint8Array(N), J = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const q = rnd();
    const k = q < 0.46 ? 0 : q < 0.76 ? 1 : q < 0.91 ? 2 : 3;
    const u = rnd();
    const g = clamp(Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) * Math.cos(TAU * rnd()), -2.5, 2.5);
    S1.set([k, u, rnd(), rnd()], i * 4);
    S2.set([g, Math.floor(rnd() * 7), rnd(), (rnd() < 0.78 ? 1.7 : 2.5) * (narrow ? 0.9 : 1)], i * 4);
    U[i] = u; K[i] = k; J[i * 3] = rnd(); J[i * 3 + 1] = rnd(); J[i * 3 + 2] = rnd();
  }
  const attr = (name, data, size) => {
    const loc = gl.getAttribLocation(prog, name), buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return { loc, buf };
  };
  attr('aSeed', S1, 4);
  attr('aSeed2', S2, 4);
  const locFrom = gl.getAttribLocation(prog, 'aFrom'), locTo = gl.getAttribLocation(prog, 'aTo');
  gl.enableVertexAttribArray(locFrom); gl.enableVertexAttribArray(locTo);
  const zero = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, zero); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N * 2), gl.STATIC_DRAW);
  const U_ = {};
  for (const n of ['uRes', 'uDpr', 'uTime', 'uMix', 'uApprove', 'uModeA', 'uModeB', 'uRectA', 'uRectB', 'uP1A', 'uP1B', 'uP2A', 'uP2B', 'uColA', 'uColB', 'uMouse', 'uBand', 'uBandTone', 'uCA', 'uCB', 'uFar', 'uSel']) U_[n] = gl.getUniformLocation(prog, n);

  // ---------- point shapes: a word or the logo, sampled to exactly N targets ----------
  const scratch = document.createElement('canvas');
  const sx = scratch.getContext('2d', { willReadFrequently: true });
  // Targets sit on a jittered grid inside the glyphs, so the type reads as evenly spaced dots, not static.
  // Sites are taken in column order and handed out by each dot's position along the wave, so shapes
  // assemble from left to right instead of shuffling.
  const STACK = 20; // dots share a site four deep: fewer, larger, evenly spaced points
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => U[a] - U[b]);
  const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return v - Math.floor(v); };
  function sample(w, h, draw, classify) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    scratch.width = w; scratch.height = h;
    sx.clearRect(0, 0, w, h);
    draw(sx, w, h);
    const d = sx.getImageData(0, 0, w, h).data;
    const cls = new Int8Array(w * h).fill(-1), counts = [0, 0, 0];
    for (let p = 0, o = 0; p < w * h; p++, o += 4) {
      if (d[o + 3] < 140) continue;
      const c = classify ? classify(d[o], d[o + 1], d[o + 2]) : 0;
      cls[p] = c; counts[c]++;
    }
    const members = [[], [], []];
    for (const i of order) { let c = classify ? (K[i] === 2 ? 1 : K[i] === 3 ? 2 : 0) : 0; if (!counts[c]) c = 0; members[c].push(i); }
    const out = new Float32Array(N * 2);
    const filled = (x, y) => { const ix = Math.round(x), iy = Math.round(y); return ix >= 0 && iy >= 0 && ix < w && iy < h ? cls[iy * w + ix] : -1; };
    for (let c = 0; c < 3; c++) {
      const M = members[c].length;
      if (!M) continue;
      const sp = Math.max(2, Math.sqrt(counts[c] / (M / STACK)));
      const sites = [];
      // the outline: one site per cell along the glyph edge, so every letter has a clean contour
      const cell = sp * 0.85, seen = new Set();
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (cls[p] !== c) continue;
        if (cls[p - 1] === c && cls[p + 1] === c && cls[p - w] === c && cls[p + w] === c) continue;
        const key = Math.floor(x / cell) * 100003 + Math.floor(y / cell);
        if (seen.has(key)) continue;
        seen.add(key); sites.push(x, y);
      }
      // the interior: an exact grid, kept clear of the outline
      const r = sp * 0.55;
      for (let x = sp / 2; x < w; x += sp) for (let y = sp / 2; y < h; y += sp) {
        if (filled(x, y) === c && filled(x - r, y) === c && filled(x + r, y) === c && filled(x, y - r) === c && filled(x, y + r) === c) sites.push(x, y);
      }
      const S = sites.length / 2;
      const idxs = Array.from({ length: S }, (_, k) => k).sort((a, b) => sites[a * 2] - sites[b * 2] || sites[a * 2 + 1] - sites[b * 2 + 1]);
      for (let j = 0; j < M; j++) {
        const i = members[c][j];
        if (!S) { out[i * 2] = w / 2; out[i * 2 + 1] = h / 2; continue; }
        const k = idxs[Math.min(S - 1, Math.floor((j * S) / M))];
        out[i * 2] = sites[k * 2];
        out[i * 2 + 1] = sites[k * 2 + 1];
      }
    }
    return out;
  }
  function wordShape(word, w, h) {
    const tamil = /[஀-௿]/.test(word);
    const family = tamil ? '"Anek Tamil"' : 'Jakarta';
    const weight = tamil ? 700 : 800;
    return sample(w, h, (c, W, H) => {
      c.font = `${weight} 200px ${family}`;
      const m = c.measureText(word);
      const mw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, mh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const size = 200 * Math.min((W * 0.94) / mw, (H * 0.86) / mh);
      c.font = `${weight} ${size}px ${family}`;
      const n = c.measureText(word);
      const tw = n.actualBoundingBoxLeft + n.actualBoundingBoxRight, th = n.actualBoundingBoxAscent + n.actualBoundingBoxDescent;
      c.fillStyle = '#000';
      c.fillText(word, (W - tw) / 2 + n.actualBoundingBoxLeft, (H - th) / 2 + n.actualBoundingBoxAscent);
    });
  }
  let logoImg = null;
  function logoShape(w, h) {
    if (!logoImg) return wordShape('Voice India', w, h);
    return sample(w, h, (c, W, H) => {
      const r = Math.min((W * 0.92) / logoImg.width, (H * 0.9) / logoImg.height);
      const lw = logoImg.width * r, lh = logoImg.height * r;
      c.drawImage(logoImg, (W - lw) / 2, (H - lh) / 2, lw, lh);
    }, (r, g, b) => (r > 180 && g < 190 && b < 120 ? 1 : g > r + 40 && g > b ? 2 : 0));
  }

  // ---------- states, in page order ----------
  // wave: p1 = tilt, amplitude, fray, voice; p2 = navy mass, y shift, -, overscan. Colours follow the ground.
  const INK = [-1, 0, 0];
  const W = (tilt, amp, fray, voice, mass, yshift, os, c = [0, 0, 0, 0]) => ({ mode: 0, p1: [tilt, amp, fray, voice], p2: [mass, yshift, 0, os], col: INK, c });
  const states = [];
  const push = (el, cfg, extra = {}) => { if (el) states.push({ el, ...cfg, ...extra, h0: 0, h1: 0, buf: null }); };
  const sec = (id) => document.getElementById(id);
  const stageOf = (s) => s && s.querySelector('[data-stage]');
  push(stageOf(sec('top')), narrow ? W(0.5, 0.9, 0, 1, 0, -0.3, 0.08) : W(1, 1, 0, 1, 0, -0.04, 0.12), { name: 'hero', sec: sec('top') });
  push(stageOf(sec('problem')), W(0.15, 0.6, 1, 0, 0, -0.3, 0, [0.85, 2, 0, 0]), { name: 'scatter', sec: sec('problem') });
  const caseStage = stageOf(sec('account'));
  const words = caseStage ? JSON.parse(caseStage.dataset.words || '[]') : [];
  words.forEach((word, i) => {
    const tamil = /[\u0B80-\u0BFF]/.test(word);
    push(caseStage, { mode: 1, p1: [0, 0, 0, reduced ? 0 : 0.5], p2: [0, 0, 0, 0], col: tamil ? ORANGE : INK, c: [1, 0, word === 'APPROVE' ? 1 : 0, DOT] },
      { name: 'case' + i, word, sec: sec('account'), step: i, steps: words.length });
  });
  push(stageOf(sec('engines')), { mode: 3, p1: [narrow ? 0.48 : 0.72, 0, 0, 0], p2: [0, 0, 0, 0], col: INK, c: [1, 0, 0, 0] }, { name: 'engines', sec: sec('engines') });
  push(stageOf(sec('security')), { mode: 2, p1: [0, 0, 0, 0], p2: [0, 0, 0, 0], col: INK, c: [1, 2, 0, 0] }, { name: 'trust', sec: sec('security') });
  push(stageOf(sec('pilot')), W(0.6, 0.8, 0, 0, 0, 0.02, 0.12), { name: 'cta', sec: sec('pilot') });
  const foot = document.querySelector('.foot');
  push(stageOf(foot), { mode: 1, p1: [0, 0, 0, reduced ? 0 : 0.25], p2: [0, 0, 0, 0], col: INK, c: [1, 1, 0, DOT] }, { name: 'foot', logo: true, sec: foot });
  const grounds = [...document.querySelectorAll('.ch[data-tone], .foot')].map((el) => ({ el, tone: el.dataset.tone === 'dark' || el.classList.contains('foot') ? 1 : 0 }));

  // ---------- layout ----------
  let vw = 0, vh = 0, dpr = 1, built = { w: 0 };
  function ranges() {
    const y = scrollY, nav = document.getElementById('nav')?.offsetHeight || 0;
    for (const s of states) {
      const r = s.sec.getBoundingClientRect(), top = r.top + y, hgt = r.height;
      if (s.step !== undefined) {
        const p0 = top - nav, p1 = top + hgt - vh, seg = (p1 - p0) / s.steps;
        s.h0 = s.step === 0 ? p0 - vh * 0.1 : p0 + seg * s.step + seg * 0.62;
        s.h1 = p0 + seg * (s.step + 1) - (s.step === s.steps - 1 ? 0 : seg * 0.06);
      } else {
        // a shape changes while the next chapter's edge crosses the middle of the screen, and is done by then
        // a shape holds while its stage is on screen and hands over as the next stage rises into view
        const st = s.el.getBoundingClientRect().top + y;
        s.h0 = st - vh * 0.6;
        const next = states.slice(states.indexOf(s) + 1).find((n) => n.sec !== s.sec);
        const nt = !next ? top + hgt : next.step !== undefined ? next.sec.getBoundingClientRect().top + y + vh * 0.2 : next.el.getBoundingClientRect().top + y;
        s.h1 = Math.max(s.h0, nt - vh * 0.92);
      }
    }
    states[0].h0 = -1e9; states[0].h1 = Math.min(states[0].h1, vh * 0.28);
    states[states.length - 1].h1 = 1e9;
  }
  function buildShapes() {
    for (const s of states) {
      if (s.mode !== 1) continue;
      const r = s.el.getBoundingClientRect();
      const data = s.logo ? logoShape(r.width, r.height) : wordShape(s.word, r.width, r.height);
      if (!s.buf) s.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, s.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }
    built.w = innerWidth;
  }
  function layout(rebuild) {
    vw = canvas.clientWidth || innerWidth; vh = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round((canvas.clientHeight || vh) * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    ranges();
    if (rebuild || built.w !== innerWidth) buildShapes();
  }

  function locate(y) {
    for (let k = 0; k < states.length; k++) {
      const s = states[k];
      if (y <= s.h1) {
        if (y >= s.h0 || k === 0) return [k, k, 0];
        const p = states[k - 1];
        return [k - 1, k, clamp((y - p.h1) / Math.max(1, s.h0 - p.h1), 0, 1)];
      }
    }
    return [states.length - 1, states.length - 1, 0];
  }

  // ---------- pointer ----------
  const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, s: 0, last: -1e9 };
  const move = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; if (mouse.x < -1e3) { mouse.x = mouse.tx; mouse.y = mouse.ty; } mouse.last = performance.now(); };
  addEventListener('pointermove', move, { passive: true });
  addEventListener('pointerdown', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mouse.last = -1e9; });

  // ---------- frame ----------
  let approve = 0, sel = 0, t0 = performance.now(), last = t0;
  const set4 = (n, v) => gl.uniform4f(U_[n], v[0], v[1], v[2], v[3]);
  function bindState(s, which, rect) {
    gl.uniform1f(U_['uMode' + which], s.mode);
    gl.uniform4f(U_['uRect' + which], rect.left, rect.top, rect.width, rect.height);
    set4('uP1' + which, s.p1); set4('uP2' + which, s.p2);
    gl.uniform3f(U_['uCol' + which], s.col[0], s.col[1], s.col[2]);
    set4('uC' + which, s.c || [0, 0, 0, 0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.buf || zero);
    gl.vertexAttribPointer(which === 'A' ? locFrom : locTo, 2, gl.FLOAT, false, 0, 0);
  }
  function render(now = performance.now()) {
    if (!states.length) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 14);
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k;
    const active = now - mouse.last < 1800 ? 1 : 0;
    mouse.s += (active - mouse.s) * (1 - Math.exp(-dt * (active ? 6 : 2)));
    const [ia, ib, f] = locate(scrollY);
    const A = states[ia], B = states[ib];
    const ra = A.el.getBoundingClientRect(), rb = ib !== ia ? B.el.getBoundingClientRect() : ra;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    // nothing on screen to draw: both shapes are well outside the viewport
    const off = (r) => r.bottom < -vh * 0.4 || r.top > vh * 1.4;
    if (off(ra) && (ib === ia || off(rb))) return { a: A, b: B, f };
    // the grounds in view, so each dot takes the ink of whatever it is passing over
    const edges = [1e5, 1e5, 1e5], tones = [0, 0, 0, 0];
    let n = -1;
    for (const g of grounds) {
      const r = g.el.getBoundingClientRect();
      if (r.bottom <= 0) continue;
      if (r.top >= vh) break;
      if (n < 0) { tones[0] = g.tone; n = 0; continue; }
      if (g.tone !== tones[n] && n < 3) { edges[n] = r.top; tones[++n] = g.tone; }
    }
    for (let i = n + 1; i < 4; i++) tones[i] = tones[Math.max(0, n)];
    gl.uniform3f(U_.uBand, edges[0], edges[1], edges[2]);
    gl.uniform4f(U_.uBandTone, tones[0], tones[1], tones[2], tones[3]);
    gl.uniform2f(U_.uRes, vw, canvas.height / dpr);
    gl.uniform1f(U_.uDpr, dpr);
    gl.uniform1f(U_.uTime, reduced ? 2 : (now - t0) / 1000);
    gl.uniform1f(U_.uMix, ib !== ia ? f : 0);
    gl.uniform1f(U_.uApprove, approve);
    gl.uniform1f(U_.uFar, narrow ? -0.5 : 1.0);
    gl.uniform1f(U_.uSel, sel);
    gl.uniform3f(U_.uMouse, mouse.x, mouse.y, reduced ? 0 : mouse.s);
    bindState(A, 'A', ra);
    bindState(B, 'B', rb);
    gl.drawArrays(gl.POINTS, 0, N);
    return { a: A, b: B, f };
  }

  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => layout(false), 150); });
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => layout(false), 150); }).observe(document.body);

  const ready = Promise.all([
    document.fonts ? document.fonts.load('800 100px Jakarta', '₹48,500 CALLBACK') : null,
    document.fonts ? document.fonts.load('700 100px "Anek Tamil"', 'தமிழ்') : null,
    new Promise((res) => { const im = new Image(); im.onload = () => { logoImg = im; res(); }; im.onerror = res; im.src = '/brand/logo-mask.png'; }),
  ]).then(() => layout(true));
  layout(true);

  return {
    render, ready, states,
    setApprove(v) { approve = v; },
    setEngine(i) { sel = i; },
    relayout: () => layout(true),
  };
}
