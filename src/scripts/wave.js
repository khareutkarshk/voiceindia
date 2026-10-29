// The brand wave, drawn as particles. One WebGL draw call; every dot is placed in the vertex shader.
// Threads carry the brand's meanings: navy = foundation, blue = intelligence, orange = action, green = trust.
// Each chapter declares a shape (a kolam, a wave, a word, a walled field, the logo). Scrolling mixes the dots
// from one shape to the next; the page's own scroll (smoothed by Lenis) is the only clock for that.

import { kolam } from './kolam.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const VS = `
precision highp float;
#ifdef TRAIL
uniform sampler2D uTrail;  // where a finger has been through the flour, fading
#endif
attribute vec4 aSeed;   // thread, u, r1, r2
attribute vec4 aSeed2;  // gaussian, strand, r3, size
attribute vec2 aFrom;
attribute vec2 aTo;
attribute float aShard; // which of the five pieces of the kolam this grain breaks away with
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
uniform vec4 uKol;       // the kolam's opening: voice gathers the flour, its loudness, the pulli settle, the line is drawn
uniform vec2 uHead;      // the drawing hand, in the kolam's stage
uniform vec4 uPc[5];     // each broken piece: where it landed (x, y) and its centre in the kolam (z, w), px
uniform float uPr[5];    // and the turn it landed with
uniform float uJoin;     // 0 broken, 1 held back together by the visitor
uniform vec3 uHome;      // where the joined kolam forms, in the pieces' stage (x, y), and how much larger than its pieces (z)
varying vec4 vCol;

// in the kolam, blue and orange threads make the one line, part of the navy thread makes the pulli, the rest is loose flour
float kolRole() { return aSeed.x > .5 && aSeed.x < 2.5 ? 2. : aSeed.x < .5 && aSeed2.z < .55 ? 1. : 0.; }

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
  if (mode > 4.5) {
    // the kolam in five pieces, each kept by one system; pts = this grain's place in its piece.
    // The loose flour hangs in the air of the screen, not the page, so the pieces scroll past it.
    float role = kolRole();
    if (role < .5) {
      vec2 b0 = vec2(r1, r2) * uRes;
      vec2 dust = b0 + vec2(sin(b0.y * .0052 + t * .11 + r3 * 6.), cos(b0.x * .0047 - t * .09 + r1 * 6.)) * 22.;
      return vec3(dust, (.16 + .3 * r1) * .5 * step(.5, fract(r2 * 7.)));
    }
    vec2 p = pts;
    if (uJoin > 0.) {
      // held together: undo the piece's landing, so it goes home to its place in one kolam at the stage's centre
      vec4 pc = uPc[0]; float ro = uPr[0];
      for (int k = 1; k < 5; k++) if (abs(aShard - float(k)) < .5) { pc = uPc[k]; ro = uPr[k]; }
      vec2 d = pts - pc.xy;
      float cs = cos(ro), sn = sin(ro);
      float jj = clamp(uJoin * 1.24 - aShard * .06, 0., 1.);
      jj = jj * jj * (3. - 2. * jj);
      // it grows as it closes, so the whole ends larger than the pieces it was made from
      vec2 home = uHome.xy + (vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) + pc.zw) * mix(1., uHome.z, jj);
      p = mix(p, home, jj);
    }
    p += vec2(sin(t * .6 + r1 * 6.2832), cos(t * .5 + r2 * 6.2832)) * .5;
    return vec3(R.xy + p, role > 1.5 ? .72 + .28 * r2 : .62 + .38 * r1);
  }
  if (mode > 3.5) {
    // p1 = kolam centre x, y, radius, pulli spacing (px in the stage); pts = this dot's place in the kolam
    float role = kolRole();
    // loose flour hanging in still air, drifting on a slow current
    vec2 b0 = vec2(r1, r2) * vec2(w, h);
    vec2 dust = b0 + vec2(sin(b0.y * .0052 + t * .11 + r3 * 6.) + .5 * sin(t * .07 + r2 * 30.), cos(b0.x * .0047 - t * .09 + r1 * 6.) + .5 * cos(t * .05 + r1 * 30.)) * 22.;
    // her voice: the flour gathers into one band through the kolam's centre and moves with what she says.
    // It starts just short of the kolam and runs off the far edge, so it never crosses the words beside it.
    float env = sin(3.14159 * u);
    float amp = .12 + uKol.y;
    float x0 = max(0., p1.x - 1.3 * p1.z);
    vec2 band = vec2(mix(x0, w, u), p1.y + (st - 3.) * 1.7 + g * 1.4
      + (sin(u * 13. + t * 2.1 + r3 * .3) * .06 + sin(u * 29. - t * 3.3) * .025) * h * amp * env);
    float ge = clamp(uKol.x * 1.7 - r3 * .7, 0., 1.);
    ge = ge * ge * (3. - 2. * ge);
    vec2 p = mix(dust, band, ge);
    float a = mix(.16 + .3 * r1, .8 * (x0 > 0. ? smoothstep(0., .14, u) : 1.), ge);
    float back = smoothstep(0., 1., uKol.z);
    if (role > .5 && role < 1.5) {
      // the pulli settle from the centre outwards, slowing as they land
      float dc = length(pts - p1.xy) / max(p1.z, 1.);
      float se = clamp(uKol.z * 1.8 - dc * .8, 0., 1.);
      se = 1. - pow(1. - se, 3.);
      p = mix(p, pts, se);
      a = mix(a, .62 + .38 * r1, se);
    } else {
      // loose flour settles back into the air, and thins once the line is done so the kolam carries the screen
      p = mix(p, dust, back);
      // half the loose flour settles out of sight once the kolam is made, so the air stays clear around it
      a = mix(a, (.16 + .3 * r1) * (1. - .45 * uKol.w) * mix(1., step(.5, fract(r2 * 7.)), uKol.w), back);
    }
    if (role > 1.5) {
      // the line: flour swirls in to the hand just before it is laid down behind it
      vec2 hand = uHead + vec2(cos(r1 * 6.2832), sin(r1 * 6.2832)) * (3. + 9. * r2);
      float k = clamp((uKol.w - u) * 45. + 1., 0., 2.);
      if (k < 1.) { p = mix(p, hand, k * k); a = mix(a, .9, k); }
      else { float f = 1. - pow(2. - k, 3.); p = mix(hand, pts, f); a = .72 + .28 * r2; }
    }
    // once it is made, the kolam only breathes
    p += vec2(sin(t * .6 + r1 * 6.2832), cos(t * .5 + r2 * 6.2832)) * .5 * uKol.z;
    return vec3(R.xy + p, a);
  }
  if (mode > 0.5 && mode < 1.5) {
    vec2 j = vec2(sin(t * 1.1 + r1 * 40.), cos(t * .9 + r2 * 40.)) * p1.w;
    return vec3(R.xy + pts + j, .68 + .32 * r1);
  }
  if (mode > 2.5 && mode < 3.5) {
    // one core fanning out into six engine threads; the chosen one flows, the others wait
    float lane = floor(r2 * 6.);
    float ly = h * (.1 + .16 * lane);
    float cy = h * .5;
    if (r3 < .12) {
      float a = r1 * 6.2832, rr = sqrt(fract(r2 * 7.13)) * h * .06;
      return vec3(R.x + w * .03 + cos(a) * rr * .8, R.y + cy + sin(a) * rr, .9);
    }
    bool on = abs(lane - uSel) < .5;
    float uu = on ? fract(u + t * .06) : u;
    float x = mix(w * .03, w * p1.x, uu);
    float bend = smoothstep(0., .62, uu);
    float y = mix(cy, ly, bend) + (st - 3.) * h * .0026 * (.35 + .65 * bend) + g * .3 + (on ? sin(uu * 18. - t * 3.) * h * .006 * bend : 0.);
    return vec3(R.x + x, R.y + y, on ? .95 : .5);
  }
  if (mode > 1.5) {
    // three deployments, one lane each, level with its table row. On premise and private cloud stop at the
    // boundary; hybrid crosses it through one opening, as a thin strand. p1.xyz = lane heights, p1.w = lit lane
    float mx = w * .82;
    float lane = floor(r2 * 3.);
    float ly = h * (lane < .5 ? p1.x : lane < 1.5 ? p1.y : p1.z);
    float gy = h * p1.z;
    vec2 p; float a = .9;
    if (r3 < .16) {
      float yy = mix(h * p1.x - 64., gy + 64., r1), d = yy - gy;
      if (abs(d) < 16.) yy = gy + sign(d + .001) * (16. + abs(d) * 1.5);
      float bend = sin(yy / h * 3.14159) * w * .05 + sin(yy * .02 + t * .6) * 2.;
      p = vec2(mx + bend + g * .8, yy);
      a = .35 + .55 * sin(r1 * 3.14159);
    } else {
      bool through = lane > 1.5;
      float x0 = w * .17, x = mix(x0, through ? w : mx, u);
      float calm = through ? smoothstep(.55, .76, u) : 0.;
      float y = ly + (sin(u * 5.5 + t * .4 + lane * 1.7) * h * .03 + (st - 3.) * h * .005) * (1. - .85 * calm);
      p = vec2(x, y);
      float lim = mx + sin(p.y / h * 3.14159) * w * .05 - 6.;
      if (!through) p.x = min(p.x, lim - abs(g) * 1.5);
      a = .25 + .7 * smoothstep(0., .25, u);
      if (p1.w > -.5 && abs(lane - p1.w) > .5) a *= .3;
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
    a = mix(a, .92, fr) * (1. - smoothstep(.9, 1., u) * fr);
  }
  a *= os > 0. ? 1. : smoothstep(0., .14, u);
  x *= 1. - (.2 + p2.z) * p1.z;
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
  // the kolam breaking: the pieces come away one after another, each as a body of grains
  bool shatter = uModeA > 3.5 && uModeA < 4.5 && uModeB > 4.5;
  float e = words ? clamp(uMix * 1.35 - aSeed2.z * .35, 0., 1.)
    : shatter ? clamp(uMix * 1.48 - aShard * .12, 0., 1.)
    : clamp(uMix * 1.7 - (aSeed.y * .55 + aSeed2.z * .15), 0., 1.);
  e = e < .5 ? 4. * e * e * e : 1. - pow(-2. * e + 2., 3.) / 2.;
  vec3 A = shape(uModeA, uRectA, uP1A, uP2A, aFrom);
  vec3 B = uMix > 0. ? shape(uModeB, uRectB, uP1B, uP2B, aTo) : A;
  vec2 dir = B.xy - A.xy;
  // far apart: dissolve out and back in rather than fly across the words between
  float far = smoothstep(uFar, uFar + .5, length(dir) / uRes.y);
  // the kolam never flies across the words below it: it unwinds where it lies, line first, and the wave of
  // five systems grows in its place in the same order
  // (except when it breaks: then each piece is carried, whole, to the system that keeps it. Where the
  // layout is stacked the words lie between, so there the pieces fade out and re-form in place: p1.x of the state)
  if (uModeA > 3.5 || uModeB > 3.5) far = shatter ? uP1B.x : 1.;
  vec2 p = mix(mix(A.xy, B.xy, e), e < .5 ? A.xy : B.xy, far);
  float fade = mix(1., abs(1. - 2. * e), far);
  // in the air the flour thins, and gathers again as it lands
  if (shatter) fade *= 1. - .25 * sin(e * 3.14159);

  vec2 mid = (A.xy + B.xy) * .5;
  vec2 cur = vec2(sin(mid.y * .0045 + uTime * .3), cos(mid.x * .004 - uTime * .25));
  // a piece is carried whole, so its current is read at the piece, not at each grain
  if (shatter) cur = vec2(sin(aShard * 1.7 + uTime * .3), cos(aShard * 2.3 - uTime * .25));
  p += cur * sin(e * 3.14159) * min(42., length(dir) * .1) * (1. - far);
  // flour lifts a little as it lets go, and settles a little as it lands
  if (uModeA > 3.5 || uModeB > 3.5) p.y += (e < .5 ? -1. : 1.) * sin(e * 3.14159) * 16.;
  if (words) {
    float sw = sin(e * 3.14159);
    p += vec2(sin(aSeed.z * 31. + uTime * .7), cos(aSeed.w * 27. + uTime * .6)) * sw * 26.;
    fade *= 1. - .7 * sw;
  }
  float role = kolRole();
  float kolW = mix(uModeA > 3.5 ? 1. : 0., uModeB > 3.5 ? 1. : 0., e);
  float stiff = role > 1.5 ? .12 : role > .5 ? .3 : 1.;
  float push = mix(uModeA > 3.5 ? 1. : uModeA > 1.5 ? 0. : uModeA > .5 ? .3 : 1., uModeB > 3.5 ? 1. : uModeB > 1.5 ? 0. : uModeB > .5 ? .3 : 1., e) * uMouse.z;
  float wiped = 0.;
#ifdef TRAIL
  // a fingertip through flour: it parts the grains, and they settle back as the trail fades
  if (kolW > 0.) {
    vec2 uv = vec2(p.x / uRes.x, 1. - p.y / uRes.y), d = vec2(1. / 160., 1. / 100.);
    float c0 = texture2D(uTrail, uv).r;
    vec2 gr = vec2(texture2D(uTrail, uv + vec2(d.x, 0.)).r - texture2D(uTrail, uv - vec2(d.x, 0.)).r,
                   texture2D(uTrail, uv - vec2(0., d.y)).r - texture2D(uTrail, uv + vec2(0., d.y)).r);
    p -= gr * 80. * stiff * kolW;
    wiped = c0 * kolW * (role > 1.5 ? .15 : .55);
    push *= 1. - kolW;
  }
#endif
  push *= mix(1., stiff, kolW);
  vec2 m = p - uMouse.xy; float md = length(m);
  if (md < 130. && push > 0.) p += m / max(md, .001) * pow(1. - md / 130., 2.) * 46. * push;
  float tone = toneAt(p.y);
  vec3 cA = colour(uCA, uColA, tone), cB = colour(uCB, uColB, tone);
  float lit = abs(floor(aSeed.w * 6.) - uSel) < .5 ? 1. : 0.;
  if (uModeA > 2.5 && uModeA < 3.5) { cA = lit > .5 ? threadCol(2., tone) : cA; A.z *= lit > .5 ? 1. : .38; }
  if (uModeB > 2.5 && uModeB < 3.5) { cB = lit > .5 ? threadCol(2., tone) : cB; B.z *= lit > .5 ? 1. : .38; }
  // the kolam is rice flour: the pulli white, the line a cooler ice. One strand is orange, the stretch of
  // line that breaks away with her words (piece 4, the call recordings), so the eye can follow it down
  vec3 flour = vec3(.93, .95, 1.), ice = vec3(.78, .85, .98);
  vec3 lineCol = abs(aShard - 4.) < .5 ? threadCol(2., 1.) : ice;
  if (uModeA > 3.5) cA = role > 1.5 ? lineCol : flour;
  if (uModeB > 3.5) cB = role > 1.5 ? lineCol : flour;
  bool hyb = floor(aSeed.w * 3.) > 1.5 && aSeed2.z >= .16;
  if (uModeA > 1.5 && uModeA < 2.5 && hyb) cA = threadCol(3., tone);
  if (uModeB > 1.5 && uModeB < 2.5 && hyb) cB = threadCol(3., tone);
  vec3 inkC = mix(vec3(.027, .106, .286), vec3(.93, .95, 1.), tone);
  // a piece of the kolam keeps its colours in flight; other shapes pass through the ink of the ground
  vec3 cm = shatter ? mix(cA, cB, e) : e < .5 ? mix(cA, inkC, smoothstep(0., .5, e)) : mix(inkC, cB, smoothstep(.5, 1., e));
  vCol = vec4(uMix > 0. ? cm : cA, mix(A.z, B.z, e) * fade * (1. - wiped));
  vec2 q = p / uRes * 2. - 1.;
  gl_Position = vec4(q.x, -q.y, 0., 1.);
  // in the kolam a few grains of flour float close to the eye, larger and fainter
  float near = role < .5 && aSeed2.x > 1.9 ? 2.4 : 1.;
  if (near > 1.) vCol.a *= mix(1., .45, kolW);
  gl_PointSize = mix(uCA.w > 0. ? uCA.w : aSeed2.w, uCB.w > 0. ? uCB.w : aSeed2.w, e) * mix(1., near, kolW) * uDpr;
}`;

const FS = `
precision mediump float;
varying vec4 vCol;
void main() {
  float r = length(gl_PointCoord - .5);
  float a = (1. - smoothstep(.34, .5, r)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}`;

// The finger's trail: a small texture that remembers where the pointer went and fades it out over about two seconds
const TVS = `attribute vec2 aQ; void main() { gl_Position = vec4(aQ, 0., 1.); }`;
const TFS = `
precision mediump float;
uniform sampler2D uPrev;
uniform vec2 uSize, uRes;
uniform vec4 uSeg;
uniform float uAmt;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float prev = max(0., texture2D(uPrev, uv).r * .975 - .004);
  vec2 p = vec2(uv.x, 1. - uv.y) * uRes, a = uSeg.xy, ab = uSeg.zw - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0., 1.);
  float s = (1. - smoothstep(0., 56., length(p - a - ab * h))) * uAmt;
  gl_FragColor = vec4(min(1., prev + s * .3), 0., 0., 1.);
}`;

const ORANGE = [1, 0.42, 0.102];
const DOT = 3.6; // dot size for type: big enough to read as dots, with clear gaps between

export function createWave(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const link = (vs, fs, bind) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    if (bind) gl.bindAttribLocation(p, 7, bind);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    return p;
  };
  const trailOk = !reduced && gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;
  const prog = link((trailOk ? '#define TRAIL 1\n' : '') + VS, FS);
  if (!prog) return null;
  gl.useProgram(prog);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const narrow = innerWidth < 760;
  // enough grains that the kolam's line reads as one line of flour, not a dotted one
  const N = narrow ? 18000 : innerWidth < 1200 ? 30000 : 42000;

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
  for (const n of ['uRes', 'uDpr', 'uTime', 'uMix', 'uApprove', 'uModeA', 'uModeB', 'uRectA', 'uRectB', 'uP1A', 'uP1B', 'uP2A', 'uP2B', 'uColA', 'uColB', 'uMouse', 'uBand', 'uBandTone', 'uCA', 'uCB', 'uFar', 'uSel', 'uKol', 'uHead', 'uTrail', 'uPc', 'uPr', 'uJoin', 'uHome']) U_[n] = gl.getUniformLocation(prog, n);

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

  // ---------- the kolam ----------
  // the line goes to the blue and orange threads, in order along it, so it unthreads into the wave the same way;
  // the pulli are small hand-dropped heaps of the navy thread, none quite round
  const KOL = kolam({ rows: narrow ? 5 : 7, seed: 3, wall: 0.2 });
  const KN = KOL.path.length / 3;
  const kext = ((KOL.rows - 1) / 2) * Math.SQRT2 + 0.56;
  // the hand slows on the curves: time along the line, from how sharply each step turns
  const pace = new Float32Array(KN + 1);
  for (let i = 0; i < KN; i++) pace[i + 1] = pace[i] + 1 + Math.min(4, KOL.path[i * 3 + 2] * 60);
  for (let i = 0; i <= KN; i++) pace[i] /= pace[KN];
  const drawAt = (tau) => {
    if (tau <= 0) return 0; if (tau >= 1) return 1;
    let lo = 0, hi = KN;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pace[m] < tau) lo = m; else hi = m; }
    return (lo + (tau - pace[lo]) / Math.max(1e-6, pace[hi] - pace[lo])) / KN;
  };
  const pathAt = (u) => {
    const f = ((u % 1) + 1) % 1 * KN, i = Math.floor(f) % KN, j = (i + 1) % KN, t = f - Math.floor(f);
    return [KOL.path[i * 3] + (KOL.path[j * 3] - KOL.path[i * 3]) * t, KOL.path[i * 3 + 1] + (KOL.path[j * 3 + 1] - KOL.path[i * 3 + 1]) * t];
  };
  let hs = 5;
  const hr = () => ((hs = (hs * 16807) % 2147483647) - 1) / 2147483646;
  const HEAPS = KOL.dots.map(([x, y]) => ({ x: x + (hr() - 0.5) * 0.05, y: y + (hr() - 0.5) * 0.05, ph: hr() * TAU, ph2: hr() * TAU, sq: 0.92 + hr() * 0.16 }));
  const isLine = (i) => K[i] === 1 || K[i] === 2, isPulli = (i) => K[i] === 0 && S2[i * 4 + 2] < 0.55;
  const heapOf = (i) => Math.floor(S1[i * 4 + 2] * HEAPS.length) % HEAPS.length;
  // every grain's place round the kolam's centre at scale sc, in px; loose flour is left at 0
  function kolamLocal(sc) {
    const out = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      if (isLine(i)) {
        const u = U[i], [x, y] = pathAt(u), [x2, y2] = pathAt(u + 1 / KN);
        let nx = -(y2 - y), ny = x2 - x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        // a hand-drawn line wanders a little and is never one even width
        const wob = Math.sin(u * TAU * 9 + 1.3) * 0.7 + Math.sin(u * TAU * 23 + 0.4) * 0.35;
        const off = wob + S2[i * 4] * (0.75 + 0.35 * Math.sin(u * TAU * 5));
        out[i * 2] = x * sc + nx * off; out[i * 2 + 1] = y * sc + ny * off;
      } else if (isPulli(i)) {
        const hp = HEAPS[heapOf(i)], a = J[i * 3] * TAU;
        const rad = sc * 0.05 * Math.sqrt(-2 * Math.log(Math.max(0.06, J[i * 3 + 1]))) * (1 + 0.08 * Math.sin(3 * a + hp.ph) + 0.05 * Math.sin(5 * a + hp.ph2));
        out[i * 2] = hp.x * sc + Math.cos(a) * rad * hp.sq; out[i * 2 + 1] = hp.y * sc + Math.sin(a) * rad / hp.sq;
      }
    }
    return out;
  }
  function kolamShape(s) {
    const r = s.el.getBoundingClientRect(), b = (s.box || s.el).getBoundingClientRect();
    const sc = Math.min(b.width, b.height) / (2 * kext);
    const cx = b.left - r.left + b.width / 2, cy = b.top - r.top + b.height / 2;
    s.p1 = [cx, cy, kext * sc, sc];
    s.kol = { cx, cy, sc };
    const out = kolamLocal(sc);
    for (let i = 0; i < N; i++) if (isLine(i) || isPulli(i)) { out[i * 2] += cx; out[i * 2 + 1] += cy; }
    return out;
  }

  // ---------- the kolam, broken ----------
  // Five wedges round the centre, cut along wavering lines so no break runs straight or along an axis.
  // A heap of flour goes whole with its piece; the line is cut, and its ends crumble.
  const CUT = 5, CUT0 = 0.31, ARC = TAU / CUT;
  const ROT = [-0.05, 0.04, -0.03, 0.05, -0.04];
  const cutAt = (x, y) => (((Math.atan2(y, x) + 0.26 * Math.sin(Math.hypot(x, y) * 2.3 + 1.1) - CUT0) % TAU) + TAU) % TAU;
  const SH = new Float32Array(N).fill(2), EDGE = new Float32Array(N).fill(9);
  // each piece is placed by the middle of its own outline, and fitted by its larger side
  const PIECE = Array.from({ length: CUT }, () => ({ x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }));
  for (let i = 0; i < N; i++) {
    const line = isLine(i);
    if (!line && !isPulli(i)) continue;
    const [x, y] = line ? pathAt(U[i]) : KOL.dots[heapOf(i)];
    const a = cutAt(x, y), j = Math.min(CUT - 1, Math.floor(a / ARC)), f = a / ARC - j, c = PIECE[j];
    SH[i] = j;
    if (line) EDGE[i] = Math.min(f, 1 - f) * ARC * Math.hypot(x, y);
    c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
  }
  PIECE.forEach((c) => { c.x = (c.x0 + c.x1) / 2; c.y = (c.y0 + c.y1) / 2; c.rad = Math.max(c.x1 - c.x0, c.y1 - c.y0) / 2 + 0.2; });
  attr('aShard', SH, 1);
  // each piece lands, turned a little, in the box its system's label marks out
  function shardShape(s) {
    const r = s.el.getBoundingClientRect();
    // data-shard names the piece a box receives, so the page can list the systems in reading order
    const boxes = [];
    s.el.querySelectorAll('[data-shard]').forEach((b) => { boxes[+b.dataset.shard] = b.getBoundingClientRect(); });
    const out = new Float32Array(N * 2);
    if (boxes.filter(Boolean).length < CUT) return out;
    const sc = Math.min(...boxes.map((b, j) => Math.min(b.width, b.height) / 2 / PIECE[j].rad));
    const loc = kolamLocal(sc);
    // where each piece landed and where it came from, so the shader can send it home when the visitor holds
    s.pc = new Float32Array(CUT * 4);
    boxes.forEach((b, j) => s.pc.set([b.left - r.left + b.width / 2, b.top - r.top + b.height / 2, PIECE[j].x * sc, PIECE[j].y * sc], j * 4));
    // stacked layouts put words between the kolam and its pieces: there they re-form instead of flying
    s.p1[0] = innerWidth < 900 ? 1 : 0;
    s.kolR = kext * sc;
    for (let i = 0; i < N; i++) {
      if (!isLine(i) && !isPulli(i)) continue;
      const j = SH[i], c = PIECE[j], b = boxes[j];
      let x = loc[i * 2] - c.x * sc, y = loc[i * 2 + 1] - c.y * sc;
      // close to a break the line comes loose, and a few grains spill off the piece
      if (EDGE[i] < 0.22) {
        const f = (1 - EDGE[i] / 0.22) ** 2, a = J[i * 3 + 2] * TAU, d = f * sc * 0.3 * J[i * 3 + 1];
        x += Math.cos(a) * d; y += Math.sin(a) * d;
      }
      const cs = Math.cos(ROT[j]), sn = Math.sin(ROT[j]);
      out[i * 2] = b.left - r.left + b.width / 2 + x * cs - y * sn;
      out[i * 2 + 1] = b.top - r.top + b.height / 2 + x * sn + y * cs;
    }
    return out;
  }

  // ---------- states, in page order ----------
  // wave: p1 = tilt, amplitude, fray, voice; p2 = navy mass, y shift, -, overscan. Colours follow the ground.
  const INK = [-1, 0, 0];
  const W = (tilt, amp, fray, voice, mass, yshift, os, c = [0, 0, 0, 0]) => ({ mode: 0, p1: [tilt, amp, fray, voice], p2: [mass, yshift, 0, os], col: INK, c });
  const states = [];
  const push = (el, cfg, extra = {}) => { if (el) states.push({ el, ...cfg, ...extra, h0: 0, h1: 0, buf: null }); };
  const sec = (id) => document.getElementById(id);
  const stageOf = (s) => s && s.querySelector('[data-stage]');
  push(stageOf(sec('top')), { mode: 4, p1: [0, 0, 1, 1], p2: [0, 0, 0, 0], col: INK, c: [0, 0, 0, 0] }, { name: 'hero', sec: sec('top'), box: sec('top')?.querySelector('[data-kolam]') });
  const hero = states[0] && states[0].mode === 4 ? states[0] : null;
  // her story in five systems: the same kolam, broken into the pieces each one keeps
  push(stageOf(sec('problem')), { mode: 5, p1: [0, 0, 0, 0], p2: [0, 0, 0, 0], col: INK, c: [0, 0, 0, 0] }, { name: 'scatter', sec: sec('problem'), enter: hero ? 0.3 : 0.6 });
  // the decision loop: one ring with five stations on it
  const ring = (c, W, H) => {
    const m = Math.min(W, H), R = m * 0.4;
    c.strokeStyle = c.fillStyle = '#000';
    c.lineWidth = m * 0.024;
    c.beginPath(); c.arc(W / 2, H / 2, R, 0, TAU); c.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i * 72 - 90) * Math.PI / 180;
      c.beginPath(); c.arc(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R, m * 0.034, 0, TAU); c.fill();
    }
  };
  push(stageOf(sec('loop')), { mode: 1, p1: [0, 0, 0, reduced ? 0 : 0.7], p2: [0, 0, 0, 0], col: INK, c: [1, 0, 0, DOT] }, { name: 'loop', draw: ring, pinned: true, sec: sec('loop') });
  const caseStage = stageOf(sec('account'));
  const words = caseStage ? JSON.parse(caseStage.dataset.words || '[]') : [];
  words.forEach((word, i) => {
    const tamil = /[\u0B80-\u0BFF]/.test(word);
    push(caseStage, { mode: 1, p1: [0, 0, 0, reduced ? 0 : 0.5], p2: [0, 0, 0, 0], col: tamil ? ORANGE : INK, c: [1, 0, word === 'APPROVE' ? 1 : 0, DOT] },
      { name: 'case' + i, word, sec: sec('account'), step: i, steps: words.length });
  });
  push(stageOf(sec('engines')), { mode: 3, p1: [narrow ? 0.48 : 0.72, 0, 0, 0], p2: [0, 0, 0, 0], col: INK, c: [1, 0, 0, 0] }, { name: 'engines', sec: sec('engines') });
  push(stageOf(sec('security')), { mode: 2, p1: [0.25, 0.5, 0.75, -1], p2: [0, 0, 0, 0], col: INK, c: [1, 0, 0, 0] }, { name: 'trust', sec: sec('security') });
  const trust = states[states.length - 1];
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
        // a stage inside a sticky pin is measured from its section, so a resize mid-scroll cannot shift it
        const topOf = (n) => (n.pinned ? n.sec : n.el).getBoundingClientRect().top + y;
        const st = topOf(s);
        s.h0 = st - vh * (s.enter ?? 0.6);
        const next = states.slice(states.indexOf(s) + 1).find((n) => n.sec !== s.sec);
        const nt = !next ? top + hgt : next.step !== undefined ? next.sec.getBoundingClientRect().top + y + vh * 0.2 : topOf(next);
        s.h1 = Math.max(s.h0, nt - vh * 0.92);
      }
    }
    // the kolam starts to unthread almost at once, and is the wave of five systems by the time they are read
    states[0].h0 = -1e9; states[0].h1 = Math.min(states[0].h1, vh * (hero ? 0.04 : 0.28));
    states[states.length - 1].h1 = 1e9;
  }
  function buildShapes() {
    for (const s of states) {
      if (s.mode !== 1 && s.mode < 4) continue;
      const r = s.el.getBoundingClientRect();
      const data = s.mode === 5 ? shardShape(s) : s.mode === 4 ? kolamShape(s) : s.draw ? sample(r.width, r.height, s.draw) : s.logo ? logoShape(r.width, r.height) : wordShape(s.word, r.width, r.height);
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
    if (trust && trust.el) {
      const r = trust.el.getBoundingClientRect(), rows = [...document.querySelectorAll('.deploy tbody tr')];
      rows.forEach((row, i) => {
        const b = row.getBoundingClientRect();
        const f = narrow || !r.height ? 0.22 + 0.28 * i : clamp((b.top + b.height / 2 - r.top) / r.height, 0.05, 0.95);
        trust.p1[i] = f;
        trust.el.style.setProperty('--y' + i, (f * 100).toFixed(2) + '%');
      });
    }
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

  // ---------- the finger's trail ----------
  const TW = 160, TH = 100;
  let trail = null;
  if (trailOk) {
    const tp = link(TVS, TFS, 'aQ');
    const mk = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TW, TH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { tex, fb } : null;
    };
    const a = tp && mk(), b = tp && mk();
    if (a && b) {
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const u = {};
      for (const n of ['uPrev', 'uSize', 'uRes', 'uSeg', 'uAmt']) u[n] = gl.getUniformLocation(tp, n);
      trail = { prog: tp, quad, u, src: a, dst: b, px: -1e4, py: -1e4 };
    }
  }
  function stepTrail(amt) {
    const T = trail;
    gl.useProgram(T.prog);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.dst.fb);
    gl.viewport(0, 0, TW, TH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.src.tex);
    gl.uniform1i(T.u.uPrev, 0);
    gl.uniform2f(T.u.uSize, TW, TH);
    gl.uniform2f(T.u.uRes, vw, vh);
    gl.uniform4f(T.u.uSeg, T.px, T.py, mouse.x, mouse.y);
    gl.uniform1f(T.u.uAmt, amt);
    gl.bindBuffer(gl.ARRAY_BUFFER, T.quad);
    gl.enableVertexAttribArray(7);
    gl.vertexAttribPointer(7, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(7);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [T.src, T.dst] = [T.dst, T.src];
    T.px = mouse.x; T.py = mouse.y;
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, T.src.tex);
    gl.uniform1i(U_.uTrail, 0);
  }

  // ---------- frame ----------
  // the kolam's opening is set from outside (main.js runs it with her words); finished by default
  const intro = { gather: 0, amp: 0, settle: 1, tau: 1 };
  let approve = 0, sel = 0, join = 0, t0 = performance.now(), last = t0;
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
    // nothing on screen to draw: both shapes are well outside the viewport
    const off = (r) => r.bottom < -vh * 0.4 || r.top > vh * 1.4;
    const idle = off(ra) && (ib === ia || off(rb));
    const kol = !idle && (A.mode >= 4 || B.mode >= 4);
    if (trail && kol) {
      const moved = Math.hypot(mouse.x - trail.px, mouse.y - trail.py);
      stepTrail(trail.px < -1e3 ? 0 : Math.max(0.2 * mouse.s, Math.min(1, moved / 8)) * (mouse.x < -1e3 ? 0 : 1));
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (idle) return { a: A, b: B, f };
    if (hero && hero.kol) {
      const [hx, hy] = pathAt(drawAt(intro.tau));
      gl.uniform2f(U_.uHead, hero.kol.cx + hx * hero.kol.sc, hero.kol.cy + hy * hero.kol.sc);
      // a touch past the end, so the last grains are laid down rather than left in the hand
      gl.uniform4f(U_.uKol, intro.gather, intro.amp, intro.settle, drawAt(intro.tau) * (1 + 1 / 40));
    }
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
    const pieces = [A, B].find((s) => s.mode === 5 && s.pc);
    gl.uniform1f(U_.uJoin, pieces ? join : 0);
    if (pieces) {
      gl.uniform4fv(U_.uPc, pieces.pc); gl.uniform1fv(U_.uPr, ROT);
      // side by side, the kolam forms in the middle of its stage; stacked, in the part of the list on screen
      // and it ends larger than the pieces it was made from, as large as the stage comfortably holds
      const r = pieces === A ? ra : rb, stacked = pieces.p1[0];
      const k = clamp((stacked ? r.width * 0.86 : Math.min(r.width, r.height) * 0.8) / (2 * pieces.kolR), 1, 1.8), m = pieces.kolR * k;
      gl.uniform3f(U_.uHome, r.width / 2, stacked ? clamp(vh * 0.42 - r.top, m, r.height - m) : r.height / 2, k);
    }
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
    setJoin(v) { join = v; },
    setDeploy(i) { if (trust) trust.p1[3] = i; },
    setIntro(v) { Object.assign(intro, v); },
    relayout: () => layout(true),
  };
}
