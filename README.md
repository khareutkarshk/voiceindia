# Voice India Super Intelligence — one-page site

Static Astro site. Every section is rendered to HTML at build time, with the CSS inlined, so the full text arrives in the first response for crawlers and visitors. The particle layer (`src/scripts/wave.js`, plain WebGL) loads after the first paint. The page works without it: no WebGL, Save-Data, or no JavaScript.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview
```

Requires Node 22.23.4 or newer (Node 24 recommended). Deploy `dist/` to any static host or CDN (Cloudflare Pages, Netlify, Vercel, S3 + CloudFront). Set long cache headers on `/_astro/*` and `/fonts/*`.

| File | What it holds |
| --- | --- |
| `src/pages/index.astro` | All content, meta tags, JSON-LD |
| `src/styles/global.css` | Tailwind v4: brand tokens (`@theme`), base, and the few script-driven states, the gate's 3D stack and runtime SVG that utilities cannot express. Everything else is utility classes in the markup |
| `src/scripts/main.js` | Hero intro, loop, case steps, gate, engines preview, connectors, form |
| `src/scripts/wave.js` | The particle engine: one state per section, blended on scroll |
| `src/scripts/kolam.js` | The hero's kolam: one closed line woven round a diamond of dots |
| `src/scripts/listen.js` | Opt-in sound for her line, shown only when `public/audio/her-line.mp3` exists |

Before launch: have native speakers verify the Tamil lines, and connect the form to a real endpoint. It currently opens a pre-written email to tabassum.farheen@voiceindia.ai.
