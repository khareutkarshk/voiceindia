# Voice India Super Intelligence — one-page site

Static Astro site. Every section is rendered to HTML at build time, with the CSS inlined, so the full text arrives in the first response for crawlers and visitors. The particle layer (`src/scripts/field.js`, about 10 KB gzipped, plain WebGL) loads after the first paint. The page works without it: no WebGL, Save-Data, or no JavaScript.

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
| `src/styles/site.css` | Pulse tokens, layout, motion rules |
| `src/scripts/main.js` | Steps, gate, deployment toggle, engines preview, calculator, form |
| `src/scripts/field.js` | The particle engine: one state per section, blended on scroll |

Before launch: have native speakers verify the Tamil lines, and connect the form to a real endpoint. It currently opens a pre-written email to tabassum.farheen@voiceindia.ai.
