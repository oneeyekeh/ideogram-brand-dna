# Ideogram Brand DNA

Brand-consistent image generation prototype built for the Ideogram PM take-home.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your GEMINI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## User flow

1. **Brand DNA** (sidebar → Brand DNA) — create a brand: upload logo, pick colors, describe voice.
2. **Explore** — type a prompt, pick your brand from the pill in the composer, optionally attach up to five campaign reference images, hit ↑.
3. **Batch** — chat panel left, generated images right. Two images generate in parallel via Gemini Flash Image.
4. Click any image to open the detail view with download + variation thumbnails.

## Environment

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key |

The API route tries these Gemini models in order (picks first that works):
- `gemini-2.0-flash-preview-image-generation`
- `gemini-2.0-flash-exp-image-generation`
- `gemini-2.0-flash-exp`

## Tech

- Next.js 14 (App Router)
- React 18, TypeScript
- Gemini API via direct HTTP (no SDK dependency)
- Brand DNA stored in `localStorage`
- Campaign reference images are attached per generation from the composer
