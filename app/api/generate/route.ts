import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// Primary: Gemini Flash Image ("nano banana 2") — generates images with
//   multimodal input (text + logo + reference images).
// Fallback: experimental variant in case preview slot is unavailable.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_GENERATION_MODELS = [
  'gemini-2.0-flash-preview-image-generation', // Gemini Flash Image — primary
  'gemini-2.0-flash-exp-image-generation',      // experimental fallback
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface BrandDNA {
  name: string;
  voice: string;
  keywords?: string[];
  palette: string[];
}

interface RefImage {
  data: string;    // base64, no data-URL prefix
  mimeType: string;
}

interface GenerateRequest {
  prompt: string;
  brand?: BrandDNA | null;
  referenceImages?: RefImage[];
  logoImage?: RefImage;
  preset?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Brand context block
// Injected before every prompt when a brand is active.
// Edit this to change how strongly brand identity shapes the generation.
// ─────────────────────────────────────────────────────────────────────────────
function buildBrandContext(brand: BrandDNA): string {
  const lines: string[] = [
    `You are generating images for "${brand.name}", a brand with a specific visual identity.`,
    '',
    'BRAND IDENTITY:',
  ];
  if (brand.voice)
    lines.push(`  Voice & feel: ${brand.voice}`);
  if (brand.keywords?.length)
    lines.push(`  Visual style keywords: ${brand.keywords.join(', ')}`);
  if (brand.palette.length)
    lines.push(`  Color palette (hex): ${brand.palette.join(', ')}`);

  lines.push('');
  lines.push('GENERATION RULES:');
  lines.push('  - Strictly match the brand color temperature and palette');
  lines.push('  - If reference images are attached, extract their visual style and replicate it');
  lines.push('  - Reference images take priority over color palette for stylistic decisions');
  lines.push('  - Match the emotional tone and mood described in Voice & feel');
  lines.push('  - Do NOT add text, logos, watermarks, or brand names to the image');
  lines.push('  - Prioritize brand consistency over literal interpretation of the prompt');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Style preset modifier
// Appended after brand context. Controls photographic/design style.
// Add or edit entries here to tune generation for specific use cases.
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_MODIFIERS: Record<string, string> = {
  editorial:
    'STYLE: Editorial photography — dramatic, directional lighting; deep shadows; ' +
    'high contrast; magazine-quality composition; mood-forward.',
  product:
    'STYLE: Product photography — clean neutral or white background; sharp focus; ' +
    'professional studio lighting; object center-stage.',
  lifestyle:
    'STYLE: Lifestyle photography — candid moments; warm natural light; ' +
    'authentic human presence; shallow depth of field.',
  social:
    'STYLE: Social media content — vibrant, high-energy; optimized for square format; ' +
    'bold visual hierarchy; eye-catching at small sizes.',
  banner:
    'STYLE: Web banner — wide cinematic composition; strong negative space on one side ' +
    'for copy overlay; minimal, impactful.',
  package:
    'STYLE: Packaging mockup — 3D render; soft studio lighting; product center-stage; ' +
    'neutral surface reflection.',
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Full prompt assembly
// Combines brand context + preset modifier + user prompt.
// ─────────────────────────────────────────────────────────────────────────────
function buildFullPrompt(
  userPrompt: string,
  brand: BrandDNA | null | undefined,
  preset: string | null | undefined,
): string {
  const sections: string[] = [];

  if (brand) {
    sections.push(buildBrandContext(brand));
  }

  if (preset && preset !== 'general' && PRESET_MODIFIERS[preset]) {
    sections.push(PRESET_MODIFIERS[preset]);
  }

  sections.push(`GENERATE: ${userPrompt}`);

  return sections.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — API parts array
// Order matters for the model's attention:
//   1. Text prompt (primary instruction)
//   2. Logo (brand identity anchor — shown first so model treats it as context)
//   3. Reference images (visual style examples — up to 3 to avoid token bloat)
// Reorder or remove entries here to change how inputs are weighted.
// ─────────────────────────────────────────────────────────────────────────────
function buildApiParts(
  promptText: string,
  referenceImages: RefImage[],
  logoImage?: RefImage,
): object[] {
  const parts: object[] = [{ text: promptText }];

  // Logo: brand identity anchor
  if (logoImage) {
    parts.push({ inlineData: { mimeType: logoImage.mimeType, data: logoImage.data } });
  }

  // Reference images: visual style examples (cap at 3 to stay within limits)
  for (const img of referenceImages.slice(0, 3)) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Single generation call
// Tries each model in IMAGE_GENERATION_MODELS until one returns an image.
// ─────────────────────────────────────────────────────────────────────────────
async function generateOne(
  apiKey: string,
  parts: object[],
): Promise<{ data: string; mimeType: string }> {
  let lastError: Error | null = null;

  for (const model of IMAGE_GENERATION_MODELS) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent?key=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      if (res.status === 404) {
        // Model not available — try next
        lastError = new Error(`Model ${model} not found (404)`);
        continue;
      }
      throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
    }

    const result = await res.json();
    const responseParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
      result?.candidates?.[0]?.content?.parts ?? [];

    const imgPart = responseParts.find(p => p.inlineData?.data);
    if (imgPart?.inlineData) {
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
    }

    throw new Error(
      'Model responded but returned no image. ' +
      'The prompt may have been blocked or the model returned text only.',
    );
  }

  throw lastError ?? new Error('All models failed to return an image');
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE — POST /api/generate
// Fires two parallel generation calls and returns up to 2 images.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not set. Add it to .env.local.' },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, brand, referenceImages = [], logoImage, preset } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Build prompt and parts once — reused for both parallel calls
  const fullPrompt = buildFullPrompt(prompt.trim(), brand, preset);
  const parts = buildApiParts(fullPrompt, referenceImages, logoImage);

  // Generate 2 images in parallel
  const [r1, r2] = await Promise.allSettled([
    generateOne(apiKey, parts),
    generateOne(apiKey, parts),
  ]);

  const images: Array<{ data: string; mimeType: string }> = [];
  const errors: string[] = [];

  for (const result of [r1, r2]) {
    if (result.status === 'fulfilled') images.push(result.value);
    else errors.push(result.reason?.message ?? 'Unknown error');
  }

  if (images.length === 0) {
    return NextResponse.json({ error: errors[0] ?? 'Generation failed' }, { status: 500 });
  }

  return NextResponse.json({ images });
}
