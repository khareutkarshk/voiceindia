// Her line, out loud. Off until asked for. The page renders the button only when the recording exists.
// Under it a tanpura-like drone, made here rather than loaded: four plucked strings, Pa Sa Sa Sa, very quiet.
// level() is how loud she is right now, for her voice in the particles to move with.

const SRC = '/audio/her-line.mp3';
const KEY = 'si-listen';

export function createListen(button, { onStart } = {}) {
  if (!button) return null;
  let ctx = null, voice = null, analyser = null, buf = null, drone = null, on = false;
  const data = new Uint8Array(256);

  // a browser will not start sound without a gesture, so a remembered "on" only marks the button
  try { if (localStorage.getItem(KEY) === '1') button.setAttribute('aria-pressed', 'true'); } catch {}

  function tanpura() {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    lp.connect(out); out.connect(ctx.destination);
    const sa = 138.6; // C#3
    const strings = [sa * 1.5, sa * 2, sa * 2, sa];
    let i = 0, timer = 0;
    const pluck = () => {
      const f = strings[i++ % 4], t = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 5.5);
      g.connect(lp);
      // the jawari buzz: a stack of upper partials that fade more slowly than a plain string
      [1, 2, 3, 4, 5, 6].forEach((h) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = f * h * (1 + (h - 1) * 0.0007);
        og.gain.value = 0.5 / (h * 0.9);
        o.connect(og); og.connect(g);
        o.start(t); o.stop(t + 5.6);
      });
      timer = setTimeout(pluck, i % 4 === 0 ? 1400 : 700);
    };
    pluck();
    return { stop() { clearTimeout(timer); out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8); } };
  }

  async function start() {
    ctx = ctx || new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if (!buf) buf = await fetch(SRC).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
    analyser = analyser || Object.assign(ctx.createAnalyser(), { fftSize: 512, smoothingTimeConstant: 0.6 });
    analyser.connect(ctx.destination);
    drone = tanpura();
    onStart?.();
    // she speaks as her words rise out of her voice
    voice = ctx.createBufferSource();
    voice.buffer = buf;
    voice.connect(analyser);
    voice.start(ctx.currentTime + 1.1);
  }
  function stop() {
    try { voice?.stop(); } catch {}
    drone?.stop();
    voice = drone = null;
  }

  button.addEventListener('click', () => {
    // a remembered "on" that has not played yet still starts on the first click
    on = !on;
    button.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
    if (on) start().catch(() => { on = false; button.setAttribute('aria-pressed', 'false'); }); else stop();
  });

  return {
    level() {
      if (!voice || !analyser) return 0;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      return Math.min(1, Math.sqrt(sum / data.length) * 4);
    },
  };
}
