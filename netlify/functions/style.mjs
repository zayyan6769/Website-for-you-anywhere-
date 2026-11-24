// AI hairstyle preview for the Wyatt's Barbershop Style Lab.
// Receives { image: "data:image/jpeg;base64,...", prompt: "skin fade..." } from the page,
// asks Google's Gemini image model to change ONLY the hair, and returns { image: "data:..." }.
//
// Environment variables (set in Netlify → Site configuration → Environment variables):
//   GEMINI_API_KEY      required. Create one at https://aistudio.google.com/apikey
//   GEMINI_IMAGE_MODEL  optional. Defaults to "gemini-2.5-flash-image".
//   ALLOWED_ORIGIN      optional. e.g. "https://wyattsbarbershop.com". Blocks calls from other sites.

const MAX_PROMPT = 300;
const MAX_IMAGE_B64 = 4_000_000; // ~3 MB; the page sends ~150 KB 1024px JPEGs

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const instructions = request => `You are a professional barber's photo editor.
Edit this photo of a customer so it shows the hairstyle they asked for: "${request}".

Rules:
- Change ONLY the hair on the head${/beard|mustache|moustache|goatee|stubble|shave|facial hair/i.test(request) ? ' and the facial hair, as requested' : ''}. Do not change facial hair unless asked.
- Keep the person's face, identity, skin tone, eyes, nose, mouth, expression, ears, head shape, age, pose, clothing, background, lighting and camera angle exactly the same.
- Make the new hair look like a real photograph of a fresh, professional cut, matching the photo's lighting, focus and grain.
- Keep the same framing and image size. No text, logos, borders or watermarks.
- If the request is not about hair or grooming, just give the person a neat, classic barbershop haircut.`;

export default async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const allowed = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.get('origin');
  if (allowed && origin && origin !== allowed) return json({ error: 'Not allowed' }, 403);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'The AI isn\'t set up yet: the site owner needs to add GEMINI_API_KEY.' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  const prompt = String(body?.prompt ?? '').replace(/[\u0000-\u001f"]+/g, ' ').trim().slice(0, MAX_PROMPT);
  if (!prompt) return json({ error: 'Tell the AI what haircut you want.' }, 400);

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body?.image ?? ''));
  if (!m) return json({ error: 'Please add a JPG or PNG photo.' }, 400);
  if (m[2].length > MAX_IMAGE_B64) return json({ error: 'That photo is too large.' }, 413);

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instructions(prompt) }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });
  } catch (e) {
    console.error('Gemini request failed', e);
    return json({ error: 'Couldn\'t reach the AI. Please try again.' }, 502);
  }

  if (!res.ok) {
    console.error('Gemini error', res.status, (await res.text()).slice(0, 500));
    return json({ error: res.status === 429 ? 'The AI is busy right now. Please try again in a minute.' : 'The AI couldn\'t edit this photo. Please try again.' }, 502);
  }

  const data = await res.json();
  const cand = data?.candidates?.[0];
  const part = (cand?.content?.parts || []).find(p => p.inlineData || p.inline_data);
  if (!part) {
    const blocked = data?.promptFeedback?.blockReason || /SAFETY|PROHIBITED|IMAGE_SAFETY/.test(cand?.finishReason || '');
    return json({ error: blocked ? 'The AI couldn\'t edit this photo (safety filter). Try a different photo or describe just the haircut.' : 'The AI didn\'t return a photo. Try rewording your request.' }, 422);
  }
  const img = part.inlineData || part.inline_data;
  return json({ image: `data:${img.mimeType || img.mime_type || 'image/png'};base64,${img.data}` });
};

export const config = { path: '/api/style' };
