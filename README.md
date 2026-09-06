# ideogram-brand-dna

A weekend prototype around one question: what if an image generator actually knew your brand?

You give it a logo, a few colors, and a sentence about your voice. It turns that into a "Brand DNA", and every image you generate afterwards stays on-brand. Attach a few campaign reference images if you want to steer it further. Built in May 2026 for an Ideogram PM take-home, on top of Gemini's image model.

**Live:** https://ideogram-brand-dna.vercel.app

## Try it

```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY
npm run dev
```

## How it flows

1. **Brand DNA** — upload a logo, pick colors, describe the voice.
2. **Explore** — type a prompt, pick your brand from the pill, optionally attach up to five reference images.
3. **Batch** — two images generate in parallel. Click one for the detail view, downloads, and variations.

## Under the hood

Next.js App Router, TypeScript, Gemini called over plain HTTP with no SDK, brand data kept in `localStorage`. Mostly built pair-programming with Claude Code.

## Who made this

Onee Yekeh. Technical PM at HeyGen, ex-founder, design background. More at [oneeyekeh/personal-site](https://github.com/oneeyekeh/personal-site).
