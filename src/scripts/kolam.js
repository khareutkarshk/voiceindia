// A sikku kolam: a diamond of pulli (dots, a square grid turned a quarter) and one unbroken line that weaves around every one of them.
// The line is a mirror curve. It runs diagonally between the midpoints of neighbouring dots, crosses
// straight over at each midpoint unless a wall stands between the two dots, and turns back at the edge.
// Walls are placed with four-fold rotational symmetry (full mirror symmetry never closes as one loop), and a seed is kept only if the line closes
// on itself as a single loop.

const key = (x, y) => x + ',' + y;

export function kolam({ rows = 7, seed = 7, wall = 0.32, bulge = 0.9, samples = 2400 } = {}) {
  const r = (rows - 1) / 2;
  const dots = [];
  const has = new Set();
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.max(Math.abs(x), Math.abs(y)) <= r) { dots.push([x, y]); has.add(key(x, y)); }

  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const tries = 400;
  for (let t = 0; t < tries; t++) {
    // walls: one decision per symmetry orbit of interior edges (edge midpoints, doubled to stay integer)
    const walls = new Map();
    const orbit = (mx, my) => [[mx, my], [-my, mx], [-mx, -my], [my, -mx]];
    for (const [x, y] of dots) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const mx = 2 * x + dx, my = 2 * y + dy, k = key(mx, my);
      if (walls.has(k) || !has.has(key(x + dx, y + dy))) continue;
      const w = rnd() < wall;
      for (const [ox, oy] of orbit(mx, my)) walls.set(key(ox, oy), w);
    }
    // midpoints in doubled coordinates: exactly one coordinate is odd. A midpoint with only one dot is a wall.
    const isWall = (mx, my) => {
      const ax = Math.floor(mx / 2), ay = Math.floor(my / 2);
      const [x0, y0, x1, y1] = mx & 1 ? [ax, my / 2, ax + 1, my / 2] : [mx / 2, ay, mx / 2, ay + 1];
      if (!has.has(key(x0, y0)) || !has.has(key(x1, y1))) return true;
      return walls.get(key(mx, my)) === true;
    };
    // a closed single line passes each shared midpoint twice and each midpoint on the edge once
    const mids = new Map();
    for (const [x, y] of dots) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(2 * x + dx, 2 * y + dy); mids.set(k, (mids.get(k) || 0) + 1); }
    let strands = 0;
    for (const v of mids.values()) strands += v;
    const start = [2 * -r - 1, 0, -1, -1]; // arriving at the left tip; the edge turns it up and right
    let [mx, my, dx, dy] = start;
    const pts = [];
    for (let n = 0; n < strands * 2; n++) {
      const turn = isWall(mx, my);
      pts.push([mx / 2, my / 2, turn]);
      if (turn) { if (mx & 1) dx = -dx; else dy = -dy; }
      mx += dx; my += dy;
      if (mx === start[0] && my === start[1] && dx === start[2] && dy === start[3]) break;
    }
    if (pts.length !== strands) continue;
    // the square grid is shown turned a quarter, so the pulli read as the familiar diamond
    const path = smooth(pts, bulge, samples), c = Math.SQRT1_2;
    for (let i = 0; i < path.length; i += 3) { const x = path[i], y = path[i + 1]; path[i] = (x - y) * c; path[i + 1] = (x + y) * c; }
    return { dots: dots.map(([x, y]) => [(x - y) * c, (x + y) * c]), path, rows, seed: s };
  }
  return null;
}

// Where the line crosses it runs straight, so every crossing reads as a clean X; where it turns it is pushed
// out round the dot it passes, then pass a closed Catmull-Rom spline through the
// points and resample it evenly. x, y and curvature per sample; curvature sets how fast the hand moves.
function smooth(pts, bulge, samples) {
  const n = pts.length, ctrl = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    ctrl.push(a);
    // the dot this segment goes around: the corner shared by both midpoints' edges
    const cx = Number.isInteger(a[0]) ? a[0] : b[0], cy = Number.isInteger(a[1]) ? a[1] : b[1];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ox = m[0] - cx, oy = m[1] - cy, d = Math.hypot(ox, oy) || 1;
    const R = d + (0.5 - d) * bulge * (0.25 + (a[2] ? 0.375 : 0) + (b[2] ? 0.375 : 0));
    ctrl.push([cx + (ox / d) * R, cy + (oy / d) * R]);
  }
  const N = ctrl.length, dense = [];
  for (let i = 0; i < N; i++) {
    const p0 = ctrl[(i - 1 + N) % N], p1 = ctrl[i], p2 = ctrl[(i + 1) % N], p3 = ctrl[(i + 2) % N];
    for (let k = 0; k < 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  const L = [0];
  for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1], b = dense[i % dense.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = L[L.length - 1], out = new Float32Array(samples * 3);
  for (let i = 0, j = 0; i < samples; i++) {
    const d = (i / samples) * total;
    while (L[j + 1] < d) j++;
    const f = (d - L[j]) / (L[j + 1] - L[j] || 1), a = dense[j], b = dense[(j + 1) % dense.length];
    out[i * 3] = a[0] + (b[0] - a[0]) * f; out[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
  }
  for (let i = 0; i < samples; i++) {
    const p = (i - 1 + samples) % samples, q = (i + 1) % samples;
    const ax = out[i * 3] - out[p * 3], ay = out[i * 3 + 1] - out[p * 3 + 1], bx = out[q * 3] - out[i * 3], by = out[q * 3 + 1] - out[i * 3 + 1];
    out[i * 3 + 2] = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  }
  return out;
}
