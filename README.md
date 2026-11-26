# Wyatt's Barbershop — Website Concept

A one-page, static website concept for Wyatt's Barbershop (East Austin, TX).

- Single file: `index.html` (inline CSS + JS, no build step, no backend)
- Open `index.html` in a browser, or host it on GitHub Pages / Netlify / any static host
- Set the real Booksy profile link in the `BOOKSY_URL` constant near the bottom of `index.html`
- Replace the `.ph` placeholder blocks with real photos when available

## AI Style Lab
Customers add a photo (live camera, upload or phone camera), type the cut they want
("skin fade, short textured top"), and an AI image model returns the same photo with
only the hair changed. Drag across the photo to compare before/after; every result is
saved below to compare, download or book.

How it works
- `index.html` sends a 1024px square JPEG + the request to `/api/style`.
- `netlify/functions/style.mjs` adds strict "change only the hair" instructions and
  calls Google's Gemini image model (`gemini-2.5-flash-image`). The API key stays on the server.
- Nothing is stored; the photo goes only to Gemini to make the preview.
- Cost: about $0.04 per generated look (Gemini API pricing, Nov 2026). Set a budget alert in Google Cloud.

Setup (Netlify)
1. Create a Gemini API key at https://aistudio.google.com/apikey (billing enabled).
2. Deploy this repo on Netlify (publish directory `.`; `netlify.toml` is included).
3. In Netlify → Site configuration → Environment variables, add `GEMINI_API_KEY`.
   Optional: `ALLOWED_ORIGIN` (e.g. `https://yourdomain.com`) to block other sites,
   `GEMINI_IMAGE_MODEL` to switch models.
4. Redeploy. Opening `index.html` straight from a computer or phone can't reach the AI;
   the page says so in the chat.

## 3D walk-in intro
The page opens on a 3D storefront; scrolling opens the door, walks into the shop and
stops at a barber chair with an "Add your picture" prompt that leads to the AI Style Lab.

- Source: `src/intro3d.js` (Three.js r160).
- It is bundled and inlined into `index.html`, so it works with no internet connection
  (the downloaded file still plays the walk-through).
- After editing `src/intro3d.js`: `npm install` then `npm run build`.
