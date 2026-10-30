// The brand wave, drawn as particles. One WebGL draw call; every dot is placed in the vertex shader.
// The page opens on the core: one sphere of grains that speaks, with the records it reads spiralling into it.
// Threads carry the brand's meanings: navy = foundation, blue = intelligence, orange = action, green = trust.
// Each chapter declares a shape (her line, a wave, a word, a walled field, the logo). Scrolling mixes the dots
// from one shape to the next; the page's own scroll (smoothed by Lenis) is the only clock for that.
// The one other clock is her line changing script in her chapter, which runs on its own.

import { LANGS, langOf } from './langs.js';

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
attribute vec2 aAlt;    // her line in the script it is leaving (her chapter only)
attribute float aShard; // which of the five pieces of her line this grain breaks away with; 5 is her voice
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
uniform vec2 uTilt;      // the pointer's lean, px: her line is near, so it moves most
uniform vec4 uIntro;     // her line: risen out of her voice, how loud she is, how far into the next script, voice shown
uniform vec4 uPc[5];     // each broken piece: where it landed (x, y) and its centre in her line (z, w), px
uniform float uPr[5];    // and the turn it landed with
uniform float uJoin;     // 0 broken, 1 held back together by the visitor
uniform vec3 uHome;      // where the joined line forms, in the pieces' stage (x, y), and its scale against the pieces (z)
uniform vec2 uLc[5];     // each piece's centre in her line, in her line's stage, px: what it turns about as it falls
varying vec4 vCol;
// what the core sets besides place and alpha: a grain's size (nearer is larger) and its colour
float gSz = 1.;
vec3 gCol = vec3(1.);

// her voice: one thin band of grains drawn like a recording of speech. A smooth carrier swells and falls in
// syllables that drift along it, louder where she is speaking (sx, px, as strong as pk), and it is still at both ends
float voiceY(float x, float x0, float x1, float amp, float sx, float pk, float pw) {
  float u = clamp((x - x0) / max(1., x1 - x0), 0., 1.);
  float carrier = sin(u * 70. + uTime * 5.) * .6 + sin(u * 43. - uTime * 3.4) * .4;
  float syllables = pow(.5 + .5 * sin(u * 11. - uTime * 1.6), 2.) * (.55 + .45 * sin(u * 3.7 + uTime * .6));
  float near = exp(-pow((x - sx) / (pw * 2.5), 2.)) * pk;
  return carrier * (syllables * amp + near) * 62. * sin(3.14159 * u);
}

vec3 threadCol(float k, float dark) {
  vec3 l = k < .5 ? vec3(.027,.106,.286) : k < 1.5 ? vec3(.153,.298,.608) : k < 2.5 ? vec3(1.,.42,.102) : vec3(.086,.639,.29);
  vec3 d = k < .5 ? vec3(.79,.84,.95) : k < 1.5 ? vec3(.43,.57,.86) : k < 2.5 ? vec3(1.,.5,.23) : vec3(.2,.78,.43);
  return mix(l, d, dark);
}

// x, y, alpha in viewport px for one shape
vec3 shape(float mode, vec4 R, vec4 p1, vec4 p2, vec2 pts, vec2 alt) {
  float k = aSeed.x, u = aSeed.y, r1 = aSeed.z, r2 = aSeed.w;
  float g = aSeed2.x, st = aSeed2.y, r3 = aSeed2.z;
  float t = uTime, w = R.z, h = R.w;
  if (mode > 5.5) {
    // the core. p1 = its centre (x, y) and radius, in the stage; p2.x = how far it has gathered on arrival.
    // Three in five grains lie on a sphere engraved in rings of latitude, like the rules on a note; each ring is a
    // line of her voice, swelling as a voice climbs the sphere, and one orange band, the action, sweeps round it.
    // The rest are the records it reads: five arms, one for each system her account sits in, spiralling in from far
    // out on a tilted disc, faster as they near it, and blue (data) turning to ice (understood) as they come in. Where
    // an arm meets the sphere, the ring it touches takes the record in: it lights white there, and the light runs round
    // it, cooling to the logo's green as it goes: taken in, then settled as verified.
    float Rr = p1.z;
    vec3 q; float a;
    vec3 ice = vec3(.86, .9, 1.), blue = vec3(.43, .57, .86), orange = vec3(1., .5, .23), green = vec3(.2, .78, .43);
    if (r3 < .6) {
      float rings = 44., ri = floor(r1 * rings), lat = (ri + .5) / rings;
      float z = -cos(lat * 3.14159) + (fract(r1 * rings) - .5) * .006, ph = r2 * 6.2832, rxy = sqrt(max(0., 1. - z * z));
      vec3 n = vec3(rxy * cos(ph), z, rxy * sin(ph));
      float talk = sin(ph * 3. + t * 1.6 + lat * 9.) * .6 + sin(ph * 7. - t * 2.3 + lat * 4.) * .3;
      float swell = pow(.5 + .5 * sin(lat * 9.42 - t * 1.3), 2.);
      vec3 ax = normalize(vec3(sin(t * .21), .5, cos(t * .21)));
      float band = exp(-pow(dot(n, ax) / .05, 2.));
      float disp = talk * swell * .05 + band * (.04 + .04 * sin(ph * 16. - t * 4.5));
      q = n * Rr * (1. + disp);
      float lit = clamp(dot(n, normalize(vec3(-.5, .6, .65))) * .5 + .5, 0., 1.);
      // the sphere turns inside the still disc; where each arm comes in, the ring there takes the record in
      float rs = t * .12, nx = n.x * cos(rs) + n.z * sin(rs), nz = -n.x * sin(rs) + n.z * cos(rs);
      float az = atan(nz, nx), took = 0., kept = 0.;
      for (int k = 0; k < 5; k++) {
        float A = float(k) * 1.2566 + t * .18 + 3.6;
        vec3 d = vec3(cos(A), -sin(A) * sin(.62), sin(A) * cos(.62));
        float da = abs(atan(sin(az - atan(d.z, d.x)), cos(az - atan(d.z, d.x))));
        float onRing = exp(-pow((n.y - d.y) / .045, 2.));
        float run = onRing * exp(-da * .8) * pow(.5 + .5 * cos(da * 7. - t * 4.), 3.);
        took += run + exp(-pow(length(vec3(nx, n.y, nz) - d) / .16, 2.));
        kept += run * smoothstep(.12, .8, da);
      }
      took = min(1., took * 1.3); kept = min(1., kept * 2.4);
      vec3 lift = mix(vec3(1.), vec3(.13, .78, .36), smoothstep(0., .6, kept / max(took, .001)));
      gCol = mix(mix(mix(blue, ice, lit), lift, took), orange, smoothstep(.25, .7, band));
      a = .5 + .45 * lit + band * .3 + took * .45;
    } else {
      float f = fract(u + t * (.03 + .012 * r1));
      float rr = Rr * mix(1.8, 1.04, pow(f, .85));
      float arm = floor(r2 * 5.);
      float ang = arm * 1.2566 + t * .18 + f * 3.6 + (fract(r2 * 5.) - .5) * mix(.5, .12, f) + g * .02;
      q = vec3(cos(ang) * rr, g * Rr * .01 * rr / Rr, sin(ang) * rr);
      float ti = .62;
      q = vec3(q.x, q.y * cos(ti) - q.z * sin(ti), q.y * sin(ti) + q.z * cos(ti));
      // a record is blue while it is only data, and turns to ice as it comes in to be understood
      gCol = mix(blue, ice, smoothstep(.35, .95, f) * (.6 + .4 * r1));
      a = (.3 + .6 * r1) * smoothstep(0., .18, f) * (1. - smoothstep(.86, 1., f));
    }
    // the sphere turns slowly; the disc it sits in holds still, so the gate and the arms read as one calm plane.
    // All of it leans a little towards the pointer
    float ry = (r3 < .6 ? t * .12 : 0.) + uTilt.x * .012, rx = -.18 + uTilt.y * .01, rz = -.2;
    q = vec3(q.x * cos(ry) + q.z * sin(ry), q.y, -q.x * sin(ry) + q.z * cos(ry));
    q = vec3(q.x, q.y * cos(rx) - q.z * sin(rx), q.y * sin(rx) + q.z * cos(rx));
    q = vec3(q.x * cos(rz) - q.y * sin(rz), q.x * sin(rz) + q.y * cos(rz), q.z);
    float s = 3.4 * Rr / (3.4 * Rr - q.z);
    vec2 p = p1.xy + q.xy * s * vec2(1., -1.);
    a *= mix(.32, 1., smoothstep(-Rr, Rr, q.z));
    // a record passing behind the sphere is hidden by it
    if (r3 >= .6 && q.z < 0. && length(q.xy) < Rr * .98) a *= .12;
    gSz = s * (r3 < .6 ? 1. : .92);
    // arriving: every grain starts as dust across the screen and is drawn in, turning, the nearest first
    float ar = clamp(p2.x * 1.5 - r3 * .25 - fract(r1 * 7.7) * .25, 0., 1.);
    ar = 1. - pow(1. - ar, 3.);
    vec2 dust = vec2(fract(r1 * 13.1 + r2 * 3.7), fract(r2 * 17.3 + r3 * 5.1)) * vec2(w, h) * 1.2 - vec2(w, h) * .1;
    vec2 dd = dust - p1.xy; float sa = (1. - ar) * 2.2;
    dust = p1.xy + vec2(dd.x * cos(sa) - dd.y * sin(sa), dd.x * sin(sa) + dd.y * cos(sa));
    p = mix(dust, p, ar);
    a *= .25 + .75 * ar;
    return vec3(R.xy + p, a);
  }
  if (mode > 4.5) {
    // her line in five pieces, each kept by one system; pts = this grain's place in its piece.
    // Her voice is not carried down: it fades where it was (see main)
    if (aShard > 4.5) return vec3(R.xy + vec2(r1, r2) * vec2(w, h), 0.);
    vec2 p = pts;
    if (uJoin > 0.) {
      // held together: undo the piece's landing, so it goes home to its place in her line, whole again
      vec4 pc = uPc[0]; float ro = uPr[0];
      for (int k = 1; k < 5; k++) if (abs(aShard - float(k)) < .5) { pc = uPc[k]; ro = uPr[k]; }
      vec2 d = pts - pc.xy;
      float cs = cos(ro), sn = sin(ro);
      float jj = clamp(uJoin * 1.24 - aShard * .06, 0., 1.);
      jj = jj * jj * (3. - 2. * jj);
      vec2 home = uHome.xy + (vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) + pc.zw) * mix(1., uHome.z, jj);
      p = mix(p, home, jj);
    }
    p += vec2(sin(t * .6 + r1 * 6.2832), cos(t * .5 + r2 * 6.2832)) * .9;
    return vec3(R.xy + p, .72 + .28 * r2);
  }
  if (mode > 3.5) {
    // p1 = her line's centre (x, y), its half width, the voice's baseline; p2 = where the voice starts and ends
    // she speaks while the line changes script, so the voice swells with every change
    // a quiet murmur at rest; louder with each word as she first speaks, and a little as each new script arrives
    float amp = .32 + uIntro.y * .8 + .2 * sin(3.14159 * uIntro.z);
    float vy = p1.w + (st - 3.) * .75 + g * .55;
    // where she is speaking runs under the words as they are said: as they rise, and as each new script arrives
    float said = uIntro.x < .999 ? uIntro.x : uIntro.z;
    float sx = p1.x - p1.z * 1.15 + p1.z * 2.3 * said, pw = max(60., p1.z * .2);
    // full once as she first speaks; after that only a murmur as each new script arrives
    float pk = sin(3.14159 * said) * (uIntro.x < .999 ? .8 : .24);
    if (aShard > 4.5) {
      float x = mix(p2.x, p2.y, u);
      return vec3(R.xy + uTilt * .45 + vec2(x, vy + voiceY(x, p2.x, p2.y, amp, sx, pk, pw)), (.22 + .36 * r1) * uIntro.w * smoothstep(0., .06, u));
    }
    float xn = clamp((pts.x - p1.x + p1.z) / (2. * p1.z), 0., 1.);
    // the next script arrives from left to right, the way the words are said, each grain lifting as it goes
    float m = clamp(uIntro.z * 1.6 - xn * .6, 0., 1.);
    m = m * m * (3. - 2. * m);
    vec2 p = mix(alt, pts, m);
    p += vec2((r2 - .5) * 10., -6. - 16. * r1) * sin(m * 3.14159);
    // before she has spoken every grain of the line lies in her voice; the words rise out of it in the order said
    float ga = clamp(uIntro.x * 1.5 - xn * .5, 0., 1.);
    ga = 1. - pow(1. - ga, 3.);
    p = mix(vec2(p.x, vy + voiceY(p.x, p2.x, p2.y, amp, sx, pk, pw)), p, ga);
    // once it is said, the line breathes, and every few seconds her voice passes through it again, left to right,
    // lifting the grains it crosses
    p += vec2(sin(t * .6 + r1 * 6.2832), cos(t * .5 + r2 * 6.2832)) * .9;
    float sw = exp(-pow((xn - (fract(t * .16) * 1.6 - .3)) / .07, 2.));
    p += vec2((r2 - .5) * 3., -4. - 6. * r1) * sw;
    return vec3(R.xy + uTilt + p, min(1., mix((.3 + .4 * r1) * uIntro.w, .74 + .26 * r2, ga) + sw * .25));
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
  // her line breaking: the pieces come away one after another, each as a body of grains
  bool lineA = uModeA > 3.5 && uModeA < 5.5, lineB = uModeB > 3.5 && uModeB < 5.5;
  bool shatter = uModeA > 3.5 && uModeA < 4.5 && uModeB > 4.5 && uModeB < 5.5;
  // the core giving way to her line: it draws in, then bursts, and the grains are caught by her words
  bool burst = uModeA > 5.5 && uModeB > 3.5 && uModeB < 4.5;
  float e = words ? clamp(uMix * 1.35 - aSeed2.z * .35, 0., 1.)
    : shatter ? clamp(uMix * 1.4 - aShard * .1, 0., 1.)
    : burst ? clamp((uMix - .12) * 1.5 - aSeed.w * .3, 0., 1.)
    : clamp(uMix * 1.7 - (aSeed.y * .55 + aSeed2.z * .15), 0., 1.);
  e = e < .5 ? 4. * e * e * e : 1. - pow(-2. * e + 2., 3.) / 2.;
  vec3 A = shape(uModeA, uRectA, uP1A, uP2A, aFrom, aAlt);
  float szA = gSz; vec3 gA = gCol;
  vec3 B = uMix > 0. ? shape(uModeB, uRectB, uP1B, uP2B, aTo, aAlt) : A;
  float szB = uMix > 0. ? gSz : szA; vec3 gB = gCol;
  vec2 cc = uRectA.xy + uP1A.xy;
  if (burst) {
    // first the core holds its breath: it pulls in on itself, tighter and brighter
    float hold = sin(clamp(uMix / .14, 0., 1.) * 3.14159) * (1. - step(.14, uMix));
    A.xy = cc + (A.xy - cc) * (1. - .42 * hold);
    A.z = min(1., A.z * (1. + hold));
  }
  vec2 dir = B.xy - A.xy;
  // far apart: dissolve out and back in rather than fly across the words between
  float far = smoothstep(uFar, uFar + .5, length(dir) / uRes.y);
  // her line never flies across the words below it to an unrelated shape: it dissolves where it lies
  // (except when it breaks: then each piece is carried, whole, to the system that keeps it. Where the
  // layout is stacked the words lie between, so there the pieces fade out and re-form in place: p1.x of the state)
  if (burst) far = 0.;
  else if (lineA || lineB) far = shatter ? uP1B.x : 1.;
  vec2 p = mix(mix(A.xy, B.xy, e), e < .5 ? A.xy : B.xy, far);
  float fade = mix(1., abs(1. - 2. * e), far);
  // in the air a piece thins, and gathers again as it lands; her voice stays where it was and fades
  if (shatter) fade *= 1. - .18 * sin(e * 3.14159);
  if (shatter && aShard > 4.5) { p = A.xy; fade = 1. - smoothstep(0., .22, uMix); }

  vec2 mid = (A.xy + B.xy) * .5;
  vec2 cur = vec2(sin(mid.y * .0045 + uTime * .3), cos(mid.x * .004 - uTime * .25));
  // a piece is carried whole, so its current is read at the piece, not at each grain
  if (shatter) cur = vec2(sin(aShard * 1.7 + uTime * .3), cos(aShard * 2.3 - uTime * .25));
  p += cur * sin(e * 3.14159) * min(42., length(dir) * .1) * (1. - far);
  float sw = sin(e * 3.14159);
  if (burst) {
    // the shockwave: every grain thrown out from the core, stirred as it flies, then caught by her line
    vec2 o = A.xy - cc; float ol = length(o);
    p += o / max(ol, 1.) * sw * uP1A.z * (.9 + 1.6 * aSeed.z) * (1. - far);
    p += vec2(sin(p.y * .011 + uTime * .9 + aSeed.w * 6.2832), cos(p.x * .009 - uTime * .8 + aSeed.z * 6.2832)) * sw * 90.;
    fade = 1.;
  } else if (shatter && aShard < 4.5) {
    // each piece is wrenched away whole: it rises, swells towards the viewer and turns about its own centre as it
    // falls, shedding a little dust, and the dust is gathered back as it lands
    vec2 pa = uLc[0], pb = uPc[0].xy;
    for (int k = 1; k < 5; k++) if (abs(aShard - float(k)) < .5) { pa = uLc[k]; pb = uPc[k].xy; }
    vec2 pv = mix(uRectA.xy + uTilt + pa, uRectB.xy + pb, e);
    float spin = sw * (aShard - 2. + .5) * .32, cs = cos(spin), sn = sin(spin);
    vec2 d = (p - pv) * (1. + .28 * sw);
    p = pv + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    p.y -= sw * (46. + aShard * 12.);
    p += vec2(aSeed.z - .5, aSeed.w - .5) * pow(sw, 1.5) * (20. + 70. * aSeed2.z * aSeed2.z);
  } else if (lineA || lineB) p.y += (e < .5 ? -1. : 1.) * sw * 16.;
  if (words) {
    p += vec2(sin(aSeed.z * 31. + uTime * .7), cos(aSeed.w * 27. + uTime * .6)) * sw * 26.;
    fade *= 1. - .7 * sw;
  }
  float txt = aShard < 4.5 ? 1. : 0.;
  float lineW = mix(lineA ? 1. : 0., lineB ? 1. : 0., e);
  float stiff = txt > .5 ? .3 : 1.;
  float push = mix(uModeA > 3.5 ? 1. : uModeA > 1.5 ? 0. : uModeA > .5 ? .3 : 1., uModeB > 3.5 ? 1. : uModeB > 1.5 ? 0. : uModeB > .5 ? .3 : 1., e) * uMouse.z;
  float wiped = 0.;
#ifdef TRAIL
  // a fingertip through her line: it parts the grains, and they settle back as the trail fades
  if (lineW > 0.) {
    vec2 uv = vec2(p.x / uRes.x, 1. - p.y / uRes.y), d = vec2(1. / 160., 1. / 100.);
    float c0 = texture2D(uTrail, uv).r;
    vec2 gr = vec2(texture2D(uTrail, uv + vec2(d.x, 0.)).r - texture2D(uTrail, uv - vec2(d.x, 0.)).r,
                   texture2D(uTrail, uv - vec2(0., d.y)).r - texture2D(uTrail, uv + vec2(0., d.y)).r);
    p -= gr * 80. * stiff * lineW;
    wiped = c0 * lineW * .3;
    push *= 1. - lineW;
  }
#endif
  push *= mix(1., stiff, lineW);
  vec2 m = p - uMouse.xy; float md = length(m);
  if (md < 130. && push > 0.) p += m / max(md, .001) * pow(1. - md / 130., 2.) * 46. * push;
  float tone = toneAt(p.y);
  vec3 cA = colour(uCA, uColA, tone), cB = colour(uCB, uColB, tone);
  float lit = abs(floor(aSeed.w * 6.) - uSel) < .5 ? 1. : 0.;
  if (uModeA > 2.5 && uModeA < 3.5) { cA = lit > .5 ? threadCol(2., tone) : cA; A.z *= lit > .5 ? 1. : .38; }
  if (uModeB > 2.5 && uModeB < 3.5) { cB = lit > .5 ? threadCol(2., tone) : cB; B.z *= lit > .5 ? 1. : .38; }
  // her line is ink: white on navy, navy on the pale chapter. The word for salary is orange (piece 4), so the
  // eye can follow it down to the system that knows when her salary lands. Her voice is a cooler ice.
  vec3 ink = mix(vec3(.027, .106, .286), vec3(.93, .95, 1.), tone);
  vec3 ice = mix(vec3(.153, .298, .608), vec3(.6, .72, .95), tone);
  vec3 orange = mix(vec3(.76, .255, .06), threadCol(2., 1.), tone);
  vec3 grain = txt < .5 ? ice : abs(aShard - 4.) < .5 ? orange : ink;
  if (lineA) cA = grain;
  if (lineB) cB = grain;
  if (uModeA > 5.5) cA = gA;
  if (uModeB > 5.5) cB = gB;
  bool hyb = floor(aSeed.w * 3.) > 1.5 && aSeed2.z >= .16;
  if (uModeA > 1.5 && uModeA < 2.5 && hyb) cA = threadCol(3., tone);
  if (uModeB > 1.5 && uModeB < 2.5 && hyb) cB = threadCol(3., tone);
  vec3 inkC = mix(vec3(.027, .106, .286), vec3(.93, .95, 1.), tone);
  // a piece of her line keeps its colours in flight; other shapes pass through the ink of the ground
  vec3 cm = shatter || burst ? mix(cA, cB, e) : e < .5 ? mix(cA, inkC, smoothstep(0., .5, e)) : mix(inkC, cB, smoothstep(.5, 1., e));
  vCol = vec4(uMix > 0. ? cm : cA, mix(A.z, B.z, e) * fade * (1. - wiped));
  vec2 q = p / uRes * 2. - 1.;
  gl_Position = vec4(q.x, -q.y, 0., 1.);
  // her line is engraved, so its grains are finer than the rest
  // a grain of the core is larger the nearer it is, and every grain swells a little in the burst
  float near = mix(uModeA > 5.5 ? szA : 1., uModeB > 5.5 ? szB : 1., e) * (1. + (burst ? .7 : shatter ? .25 : 0.) * sw);
  gl_PointSize = mix(uCA.w > 0. ? uCA.w : aSeed2.w, uCB.w > 0. ? uCB.w : aSeed2.w, e) * mix(1., .78, lineW * txt) * near * uDpr;
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
  // enough grains that her line reads as finely engraved type and the core as a solid body
  const N = narrow ? 26000 : innerWidth < 1200 ? 56000 : 84000;

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
  const locFrom = gl.getAttribLocation(prog, 'aFrom'), locTo = gl.getAttribLocation(prog, 'aTo'), locAlt = gl.getAttribLocation(prog, 'aAlt');
  gl.enableVertexAttribArray(locFrom); gl.enableVertexAttribArray(locTo); gl.enableVertexAttribArray(locAlt);
  const zero = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, zero); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N * 2), gl.STATIC_DRAW);
  const U_ = {};
  for (const n of ['uRes', 'uDpr', 'uTime', 'uMix', 'uApprove', 'uModeA', 'uModeB', 'uRectA', 'uRectB', 'uP1A', 'uP1B', 'uP2A', 'uP2B', 'uColA', 'uColB', 'uMouse', 'uBand', 'uBandTone', 'uCA', 'uCB', 'uFar', 'uSel', 'uIntro', 'uTilt', 'uTrail', 'uPc', 'uPr', 'uJoin', 'uHome', 'uLc']) U_[n] = gl.getUniformLocation(prog, n);

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
  // a word in an Indian script is set in Anek; '{self}' and '{hello}' are her language's own name and greeting
  const INDIC = /[\u0900-\u0DFF]/;
  const say = (word) => (word === '{self}' ? langOf(lang).self : word === '{hello}' ? langOf(lang).hello : word);
  function wordShape(word, w, h) {
    word = say(word);
    const indic = INDIC.test(word);
    const family = indic ? 'Anek' : 'Jakarta';
    const weight = indic ? 700 : 800;
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

  // ---------- her line, in every script ----------
  // Most grains carry her line, the rest her voice (aShard 5). A grain of the line keeps one piece of it in
  // every script, so when the line breaks the same grains always go to the same system: piece 4 is the word
  // for salary, pieces 0 to 3 are the rest of the line cut into equal shares from left to right.
  let lang = LANGS[0].code, prev = lang, morph0 = -1e9;
  const MORPH = 1100;
  const SH = new Float32Array(N);
  for (let i = 0; i < N; i++) SH[i] = S2[i * 4 + 2] > 0.72 ? 5 : J[i * 3] < 0.3 ? 4 : Math.floor(J[i * 3 + 1] * 4);
  attr('aShard', SH, 1);
  const CUT = 5;
  const pieceGrains = Array.from({ length: CUT }, () => []);
  for (const i of order) if (SH[i] < CUT) pieceGrains[SH[i]].push(i);
  // engraved: the ink is laid in fine horizontal rules with a clean contour, like the print on a note
  const ROW = 2.5, STEP = 1.5, EDGE = 1.3;
  // her line set in the box (w by h px), and every grain's place in it; `pieces` are the five pieces' centres and reach
  function sampleLine(L, w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    scratch.width = w; scratch.height = h;
    sx.clearRect(0, 0, w, h);
    const font = (px) => `600 ${px}px Anek, Jakarta, sans-serif`;
    sx.font = font(100);
    const m = sx.measureText(L.line), mh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const size = Math.min((100 * w * 0.74) / m.width, (100 * h * 0.8) / mh);
    sx.font = font(size);
    const n = sx.measureText(L.line);
    const at = L.line.indexOf(L.salary), parts = [L.line.slice(0, at), L.salary, L.line.slice(at + L.salary.length)];
    let x = (w - n.width) / 2;
    const base = (h - (n.actualBoundingBoxAscent + n.actualBoundingBoxDescent)) / 2 + n.actualBoundingBoxAscent;
    parts.forEach((t, k) => { sx.fillStyle = k === 1 ? '#f00' : '#000'; sx.fillText(t, x, base); x += sx.measureText(t).width; });
    const d = sx.getImageData(0, 0, w, h).data;
    // 0 no ink, 1 the rest of the line, 2 the word for salary
    const cls = new Uint8Array(w * h), cols = new Float64Array(w);
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let p = 0, o = 0; p < w * h; p++, o += 4) {
      if (d[o + 3] < 120) continue;
      const c = d[o] > 110 && d[o] > d[o + 1] + 60 ? 2 : 1, px = p % w, py = (p / w) | 0;
      cls[p] = c; if (c === 1) cols[px]++;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    // the rest of the line in four shares of ink, left to right. A cut moves to the gap between two words when
    // one is near, so a piece is a whole word where it can be; a cut through a word is torn, never straight
    let total = 0; for (let i = 0; i < w; i++) total += cols[i];
    const ink = new Uint8Array(w);
    for (let p = 0; p < w * h; p++) if (cls[p]) ink[p % w] = 1;
    const gaps = [];
    for (let i = x0, g0 = -1; i <= x1; i++) { if (!ink[i] && g0 < 0) g0 = i; if (ink[i] && g0 >= 0) { if (i - g0 > size * 0.12) gaps.push((g0 + i) / 2); g0 = -1; } }
    const cuts = [];
    for (let i = 0, acc = 0, k = 1; i < w && k < 4; i++) {
      acc += cols[i];
      if (acc < (total * k) / 4) continue;
      const near = gaps.filter((g) => Math.abs(g - i) < (x1 - x0) * 0.12 && !cuts.some((c) => c.x === g)).sort((a, b) => Math.abs(a - i) - Math.abs(b - i))[0];
      cuts.push(near !== undefined ? { x: near, torn: 0 } : { x: i, torn: 1 });
      k++;
    }
    cuts.sort((a, b) => a.x - b.x);
    const tear = (c, py) => c.x + c.torn * (Math.sin(py * 0.13 + c.x) * 4 + Math.sin(py * 0.37 + c.x * 1.7) * 2);
    const pieceAt = (px, py) => {
      const c = cls[py * w + px];
      if (c !== 1) return c === 2 ? 4 : -1;
      let k = 0; for (const cut of cuts) if (px > tear(cut, py)) k++;
      return k;
    };
    // how close a point lies to a torn cut, so the pieces crumble a little there when they part
    const torn = (px, py) => { let d = 99; for (const c of cuts) if (c.torn) d = Math.min(d, Math.abs(px - tear(c, py))); return d; };
    const sites = Array.from({ length: CUT }, () => []), seen = new Set();
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
      const p = y * w + xx;
      if (!cls[p] || (cls[p - 1] && cls[p + 1] && cls[p - w] && cls[p + w])) continue;
      const key = Math.floor(xx / EDGE) * 100003 + Math.floor(y / EDGE);
      if (seen.has(key)) continue;
      seen.add(key); sites[pieceAt(xx, y)].push(xx, y);
    }
    for (let y = ROW / 2; y < h; y += ROW) for (let xx = STEP / 2 + ((y / ROW) & 1) * STEP * 0.5; xx < w; xx += STEP) {
      const k = pieceAt(Math.round(xx), Math.round(y));
      if (k >= 0) sites[k].push(xx, y);
    }
    const pos = new Float32Array(N * 2), edge = new Float32Array(N).fill(99), pieces = [];
    for (let k = 0; k < CUT; k++) {
      const st = sites[k], S = st.length / 2, M = pieceGrains[k].length;
      const idx = Array.from({ length: S }, (_, j) => j).sort((a, b) => st[a * 2] - st[b * 2] || st[a * 2 + 1] - st[b * 2 + 1]);
      let a0 = w, a1 = 0, b0 = h, b1 = 0;
      for (let j = 0; j < S; j++) { const sx_ = st[j * 2], sy = st[j * 2 + 1]; if (sx_ < a0) a0 = sx_; if (sx_ > a1) a1 = sx_; if (sy < b0) b0 = sy; if (sy > b1) b1 = sy; }
      if (!S) { a0 = a1 = w / 2; b0 = b1 = h / 2; }
      pieces.push({ x: (a0 + a1) / 2, y: (b0 + b1) / 2, hw: (a1 - a0) / 2 + 3, hh: (b1 - b0) / 2 + 3 });
      for (let j = 0; j < M; j++) {
        const i = pieceGrains[k][j];
        if (!S) { pos[i * 2] = w / 2; pos[i * 2 + 1] = h / 2; continue; }
        // several grains share a site, each a hair apart, so the rules read as ink rather than as dots
        const q = idx[Math.min(S - 1, Math.floor((j * S) / M))], a = J[i * 3 + 2] * TAU;
        pos[i * 2] = st[q * 2] + Math.cos(a) * 0.45; pos[i * 2 + 1] = st[q * 2 + 1] + Math.sin(a) * 0.45;
        if (k < 4) edge[i] = torn(st[q * 2], st[q * 2 + 1]);
      }
    }
    return { pos, edge, pieces, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.max(1, (x1 - x0) / 2) };
  }
  // her chapter: her line across the top of its box, her voice under it from one edge of the screen to the other.
  // Every script is set once per layout, so changing script later only moves a buffer.
  function lineShape(s) {
    const r = s.el.getBoundingClientRect(), b = s.box.getBoundingClientRect();
    const ox = b.left - r.left, oy = b.top - r.top, th = b.height * 0.8;
    s.lines = {};
    for (const L of LANGS) {
      const d = sampleLine(L, b.width, th);
      for (let i = 0; i < N * 2; i += 2) { d.pos[i] += ox; d.pos[i + 1] += oy; }
      d.pieces.forEach((c) => { c.x += ox; c.y += oy; });
      d.cx += ox; d.cy += oy;
      s.lines[L.code] = d;
    }
    s.voice = [0, r.width, oy + b.height * 0.94];
    return placeHero(s);
  }
  function placeHero(s) {
    const d = s.lines[lang];
    s.p1 = [d.cx, d.cy, d.hw, s.voice[2]];
    s.p2 = [s.voice[0], s.voice[1], 0, 0];
    if (!s.alt) s.alt = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, s.alt); gl.bufferData(gl.ARRAY_BUFFER, s.lines[prev].pos, gl.STATIC_DRAW);
    return d.pos;
  }

  // ---------- her line, broken ----------
  // each piece lands on the slip its system's record marks out, turned with the slip (data-rot, radians)
  function shardShape(s) {
    const r = s.el.getBoundingClientRect();
    // data-shard names the piece a slip receives, so the page can list the systems in reading order
    const boxes = [];
    s.el.querySelectorAll('[data-shard]').forEach((el) => {
      const b = el.getBoundingClientRect();
      boxes[+el.dataset.shard] = { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, w: el.offsetWidth, h: el.offsetHeight, rot: +el.dataset.rot || 0 };
    });
    const out = new Float32Array(N * 2);
    if (!voice || !voice.lines || boxes.filter(Boolean).length < CUT) return out;
    const d = voice.lines[lang], P = d.pieces;
    // one scale for every piece, the largest at which each still sits inside its slip
    const sc = Math.min(narrow ? 1.9 : 1.4, ...boxes.map((b, j) => Math.min((b.w * 0.88) / (2 * P[j].hw), (b.h * 0.86) / (2 * P[j].hh))));
    // where each piece landed and where it sat in her line, so the shader can send it home when the visitor asks
    s.pc = new Float32Array(CUT * 4);
    s.rot = new Float32Array(boxes.map((b) => b.rot));
    boxes.forEach((b, j) => s.pc.set([b.x, b.y, (P[j].x - d.cx) * sc, (P[j].y - d.cy) * sc], j * 4));
    // stacked layouts put words between her line and its pieces: there they re-form instead of flying
    s.p1[0] = innerWidth < 900 ? 1 : 0;
    s.lineR = d.hw * sc;
    for (let i = 0; i < N; i++) {
      const j = SH[i];
      if (j >= CUT) continue;
      const c = P[j], b = boxes[j];
      let x = (d.pos[i * 2] - c.x) * sc, y = (d.pos[i * 2 + 1] - c.y) * sc;
      // close to a tear the ink comes loose, and a few grains spill off the piece
      if (d.edge[i] < 5) {
        const f = (1 - d.edge[i] / 5) ** 2, a = J[i * 3 + 2] * TAU, rr = f * 9 * sc * J[i * 3 + 1];
        x += Math.cos(a) * rr; y += Math.sin(a) * rr;
      }
      const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
      out[i * 2] = b.x + x * cs - y * sn;
      out[i * 2 + 1] = b.y + x * sn + y * cs;
    }
    return out;
  }

  // ---------- the core ----------
  // it has no points to sample: the shader places every grain. Here it is only measured, from the box the page
  // keeps clear for it
  function coreShape(s) {
    const r = s.el.getBoundingClientRect(), b = (s.box || s.el).getBoundingClientRect();
    s.p1 = [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2, Math.min(b.width, b.height) * (narrow ? 0.3 : 0.29), 0];
    return new Float32Array(N * 2);
  }

  // ---------- states, in page order ----------
  // wave: p1 = tilt, amplitude, fray, voice; p2 = navy mass, y shift, -, overscan. Colours follow the ground.
  const INK = [-1, 0, 0];
  const W = (tilt, amp, fray, voice, mass, yshift, os, c = [0, 0, 0, 0]) => ({ mode: 0, p1: [tilt, amp, fray, voice], p2: [mass, yshift, 0, os], col: INK, c });
  const states = [];
  const push = (el, cfg, extra = {}) => { if (el) states.push({ el, ...cfg, ...extra, h0: 0, h1: 0, buf: null }); };
  const sec = (id) => document.getElementById(id);
  const stageOf = (s) => s && s.querySelector('[data-stage]');
  push(stageOf(sec('top')), { mode: 6, p1: [0, 0, 1, 0], p2: [1, 0, 0, 0], col: INK, c: [0, 0, 0, 0] }, { name: 'hero', sec: sec('top'), box: sec('top')?.querySelector('[data-core]') });
  const core = states[0] && states[0].mode === 6 ? states[0] : null;
  // her line, which the core bursts into: it arrives late, so the burst has most of a screen to fly
  push(stageOf(sec('her')), { mode: 4, p1: [0, 0, 1, 1], p2: [0, 0, 0, 0], col: INK, c: [0, 0, 0, 0] }, { name: 'voice', sec: sec('her'), box: sec('her')?.querySelector('[data-line]'), enter: core ? 0.12 : 0.6 });
  const voice = states.find((s) => s.mode === 4) || null;
  // her story in five systems: the same line, broken into the pieces each one keeps
  push(stageOf(sec('problem')), { mode: 5, p1: [0, 0, 0, 0], p2: [0, 0, 0, 0], col: INK, c: [0, 0, 0, 0] }, { name: 'scatter', sec: sec('problem'), enter: voice ? 0.3 : 0.6 });
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
    // her language's own name and greeting are drawn in orange, in whatever script she chose
    push(caseStage, { mode: 1, p1: [0, 0, 0, reduced ? 0 : 0.5], p2: [0, 0, 0, 0], col: word[0] === '{' ? ORANGE : INK, c: [1, 0, word === 'APPROVE' ? 1 : 0, DOT] },
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
        // on a phone the broken line is a long list: its pieces hold until the next chapter is well up the screen
        s.h1 = Math.max(s.h0, nt - vh * (narrow && s.mode === 5 ? 0.72 : 0.92));
      }
    }
    // the core gives way as soon as the page moves, so the burst runs across the whole first screen
    states[0].h0 = -1e9; states[0].h1 = Math.min(states[0].h1, vh * 0.02);
    states[states.length - 1].h1 = 1e9;
  }
  function build(s) {
    const r = s.el.getBoundingClientRect();
    const data = s.mode === 6 ? coreShape(s) : s.mode === 5 ? shardShape(s) : s.mode === 4 ? lineShape(s) : s.draw ? sample(r.width, r.height, s.draw) : s.logo ? logoShape(r.width, r.height) : wordShape(s.word, r.width, r.height);
    if (!s.buf) s.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, s.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    s.lang = lang;
  }
  function buildShapes() {
    for (const s of states) if (s.mode === 1 || s.mode >= 4) build(s);
    built.w = innerWidth;
  }
  // her line moves to another script: her chapter morphs from the old one, and the pieces below follow
  function setLang(code, instant) {
    if (code === lang || !LANGS.some((L) => L.code === code)) return;
    prev = instant ? code : lang; lang = code;
    morph0 = instant || reduced ? -1e9 : performance.now();
    if (!voice || !voice.lines) return;
    const data = placeHero(voice); // binds and fills the buffer of the script it leaves, so it runs first
    gl.bindBuffer(gl.ARRAY_BUFFER, voice.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const scatter = states.find((s) => s.mode === 5);
    if (scatter) build(scatter);
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
  // her line's opening is set from outside (main.js runs it with her words); finished by default
  const intro = { rise: 1, amp: 0, voice: 1, core: 1 }, tilt = [0, 0];
  let approve = 0, sel = 0, join = 0, t0 = performance.now(), last = t0, tNow = 0;
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
    const line = !idle && (A.mode >= 4 || B.mode >= 4);
    if (trail && line) {
      const moved = Math.hypot(mouse.x - trail.px, mouse.y - trail.py);
      stepTrail(trail.px < -1e3 ? 0 : Math.max(0.2 * mouse.s, Math.min(1, moved / 8)) * (mouse.x < -1e3 ? 0 : 1));
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (idle) return { a: A, b: B, f };
    const mp = clamp((now - morph0) / MORPH, 0, 1);
    gl.uniform4f(U_.uIntro, intro.rise, intro.amp, mp, intro.voice);
    gl.uniform2f(U_.uTilt, tilt[0], tilt[1]);
    if (core) core.p2[0] = intro.core;
    gl.bindBuffer(gl.ARRAY_BUFFER, (voice && voice.alt) || zero);
    gl.vertexAttribPointer(locAlt, 2, gl.FLOAT, false, 0, 0);
    // a word in her language, drawn further down, is set again once she has a new one
    for (const s of [A, B]) if (s.word && s.word[0] === '{' && s.lang !== lang) build(s);
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
    tNow = reduced ? 2 : (now - t0) / 1000;
    gl.uniform1f(U_.uTime, tNow);
    gl.uniform1f(U_.uMix, ib !== ia ? f : 0);
    gl.uniform1f(U_.uApprove, approve);
    gl.uniform1f(U_.uFar, narrow ? -0.5 : 1.0);
    gl.uniform1f(U_.uSel, sel);
    const pieces = [A, B].find((s) => s.mode === 5 && s.pc);
    gl.uniform1f(U_.uJoin, pieces ? join : 0);
    if (pieces) {
      gl.uniform4fv(U_.uPc, pieces.pc); gl.uniform1fv(U_.uPr, pieces.rot);
      if (voice && voice.lines) gl.uniform2fv(U_.uLc, voice.lines[lang].pieces.flatMap((c) => [c.x, c.y]));
      // side by side, her line forms again across the middle of its stage; stacked, in the part of the list on screen.
      // It is set as wide as the stage comfortably holds
      const r = pieces === A ? ra : rb, stacked = pieces.p1[0];
      const k = clamp((r.width * (stacked ? 0.84 : 0.74)) / (2 * pieces.lineR), 0.5, 2.4);
      gl.uniform3f(U_.uHome, r.width / 2, stacked ? clamp(vh * 0.42 - r.top, 80, r.height - 80) : r.height / 2, k);
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
    ...(document.fonts ? LANGS.map((L) => document.fonts.load('600 100px Anek', L.line + L.self + L.hello)) : []),
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
    setLang,
    setTilt(x, y) { tilt[0] = x; tilt[1] = y; },
    get lang() { return lang; },
    get morphing() { return performance.now() - morph0 < MORPH; },
    relayout: () => layout(true),
  };
}
