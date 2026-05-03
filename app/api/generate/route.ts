import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// Primary: gemini-2.5-flash-image — Gemini 2.5 Flash Image ("Nano Banana 2").
//   Supports multimodal input (text + logo + reference images) → image output.
//   Docs: https://ai.google.dev/gemini-api/docs/image-generation
// Fallback: gemini-2.0-flash-preview-image-generation — previous generation.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_GENERATION_MODELS = [
  'gemini-2.5-flash-image',                    // Gemini 2.5 Flash Image ("Nano Banana 2") — primary
  'gemini-2.0-flash-preview-image-generation', // Gemini 2.0 Flash Image — fallback
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
//
// Injected as the opening system instruction before any images or prompt.
// hasLogo / refCount are passed so the rules can reference what's attached.
//
// Priority hierarchy (enforced in text):
//   1. Brand logo  → render faithfully when logo appears in scene
//   2. Reference images → primary source for visual style / mood / lighting
//   3. Color palette → fallback for color decisions not covered by refs
//   4. Voice & feel → emotional tone across all visual choices
// ─────────────────────────────────────────────────────────────────────────────
function buildBrandContext(brand: BrandDNA, hasLogo: boolean, refCount: number): string {
  const lines: string[] = [
    '╔══════════════════════════════════════════════════════════════╗',
    `║  BRAND DNA — ${brand.name.toUpperCase().padEnd(48)}║`,
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `You are a world-class art director and brand photographer working exclusively`,
    `for "${brand.name}". Every image you produce must be immediately recognizable`,
    `as belonging to this brand. Brand fidelity is non-negotiable.`,
    '',
  ];

  // ── Brand identity facts ──────────────────────────────────────
  lines.push('━━━ BRAND IDENTITY ━━━');
  lines.push(`  Brand name : ${brand.name}`);
  if (brand.voice) lines.push(`  Voice & feel: ${brand.voice}`);
  if (brand.palette.length) {
    lines.push(`  Color palette (authoritative hex values):`);
    brand.palette.forEach((c, i) => lines.push(`    ${i + 1}. ${c}`));
  }
  lines.push('');

  // ── Asset inventory (tells the model what's attached) ─────────
  lines.push('━━━ ATTACHED BRAND ASSETS ━━━');
  if (hasLogo) {
    lines.push('  [LOGO IMAGE ATTACHED] — see the image immediately following this text block.');
    lines.push('  This is the official brand logo. Memorize its exact shape, colors,');
    lines.push('  proportions, and design details. You will need to reproduce it accurately.');
  } else {
    lines.push('  [No logo attached] — do not invent a logo.');
  }
  if (refCount > 0) {
    lines.push(`  [${refCount} REFERENCE IMAGE(S) ATTACHED] — see images following the logo.`);
    lines.push('  These images define the brand\'s visual language. Study them carefully.');
  } else {
    lines.push('  [No reference images] — derive visual style from palette and voice.');
  }
  lines.push('');

  // ── Mandatory rendering rules ─────────────────────────────────
  lines.push('━━━ MANDATORY RULES — follow ALL of these without exception ━━━');
  lines.push('');

  if (hasLogo) {
    lines.push('LOGO RENDERING:');
    lines.push('  • The attached logo image is the ground truth. Reproduce it faithfully.');
    lines.push('  • When the scene includes a branded product, package, or surface,');
    lines.push('    render the logo on it with accurate colors, proportions, and details.');
    lines.push('  • Do NOT simplify, distort, or reimagine the logo — match it exactly.');
    lines.push('  • The logo\'s own colors take precedence over the palette in the logo area.');
    lines.push('  • Logo placement should feel natural and professionally applied.');
    lines.push('');
  }

  if (refCount > 0) {
    lines.push('REFERENCE IMAGES (HIGHEST PRIORITY for visual style):');
    lines.push('  • These images ARE the brand\'s visual identity. They override everything');
    lines.push('    else when it comes to aesthetic decisions.');
    lines.push('  • Replicate exactly: lighting quality, color grading, texture, grain,');
    lines.push('    depth of field, shadow softness, highlight roll-off, and mood.');
    lines.push('  • Match the compositional approach: negative space, subject framing,');
    lines.push('    camera angle, and focal length feel.');
    lines.push('  • If references use a specific photographic style (e.g. film, studio,');
    lines.push('    editorial, lifestyle), reproduce that style precisely.');
    lines.push('');
  }

  if (brand.palette.length) {
    lines.push('COLOR PALETTE (authoritative — second priority after reference images):');
    lines.push(`  • Dominant palette: ${brand.palette.join(', ')}`);
    lines.push('  • These hex values are the law. Apply them to backgrounds, surfaces,');
    lines.push('    props, clothing, and environmental elements.');
    lines.push('  • Do not introduce colors outside this palette unless physically');
    lines.push('    unavoidable (e.g., human skin tones, natural elements).');
    lines.push('  • Color temperature and saturation must align with these swatches.');
    lines.push('');
  }

  if (brand.voice) {
    lines.push('BRAND VOICE & EMOTIONAL ATMOSPHERE:');
    lines.push(`  • The brand feels: "${brand.voice}"`);
    lines.push('  • Let this permeate every visual choice — lighting mood, subject');
    lines.push('    expression, environmental texture, and pacing of the composition.');
    lines.push('  • A viewer should feel this brand\'s personality without reading any text.');
    lines.push('');
  }

  lines.push('GENERAL CONSTRAINTS:');
  lines.push('  • Do NOT add random text, watermarks, or unsolicited brand names.');
  lines.push('  • DO render the brand logo when it is part of the requested scene.');
  lines.push('  • Brand consistency overrides literal prompt interpretation.');
  lines.push('  • Quality bar: this image should be publishable in a brand campaign.');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Style preset modifier
//
// Each preset adds photographic/design direction ON TOP of brand rules.
// Add or edit entries here to tune generation for specific use cases.
// These co-exist with brand DNA — they shape composition, not override brand.
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_MODIFIERS: Record<string, string> = {
  editorial:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Editorial — ' +
    'dramatic directional lighting with deep intentional shadows; high contrast ratio; ' +
    'magazine-quality composition with strong visual tension; mood and emotion first.',

  product:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Product — ' +
    'clean studio environment with neutral or brand-palette background; ' +
    'sharp edge-to-edge focus; professional three-point lighting; ' +
    'product perfectly centered with no distractions.',

  lifestyle:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Lifestyle — ' +
    'candid authentic moments; warm soft natural light; genuine human presence; ' +
    'shallow depth of field that draws focus to the hero element.',

  social:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Social media — ' +
    'vibrant high-energy composition; optimized for square crop; ' +
    'bold visual hierarchy readable at thumbnail size; eye-catching contrast.',

  banner:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Web banner — ' +
    'wide cinematic 16:9 or 3:1 composition; strong intentional negative space ' +
    'on one side for headline overlay; minimal, impactful, single visual story.',

  package:
    'PHOTOGRAPHY STYLE (apply within brand constraints): Packaging — ' +
    '3D product render or styled flat-lay; soft studio lighting with subtle ' +
    'surface reflection; product center-stage; tactile material quality visible.',
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Full prompt assembly
//
// Final text sent to the model (before images). Structure:
//   [Brand DNA block]   — who the brand is + mandatory rules
//   [Preset modifier]   — photographic style direction
//   [Generation task]   — the user's actual request
// ─────────────────────────────────────────────────────────────────────────────
function buildFullPrompt(
  userPrompt: string,
  brand: BrandDNA | null | undefined,
  preset: string | null | undefined,
  hasLogo: boolean,
  refCount: number,
): string {
  const sections: string[] = [];

  if (brand) {
    sections.push(buildBrandContext(brand, hasLogo, refCount));
  }

  if (preset && preset !== 'general' && PRESET_MODIFIERS[preset]) {
    sections.push(PRESET_MODIFIERS[preset]);
  }

  sections.push(
    '━━━ GENERATION TASK ━━━\n' +
    'Now apply ALL brand rules above and generate the following:\n\n' +
    userPrompt.trim() + '\n\n' +
    'Remember: brand DNA + style rules are non-negotiable. Execute the task within them.'
  );

  return sections.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — API parts array
//
// Critical: interleave labeled text before each image so the model understands
// the ROLE of each image before processing it. Order:
//   1. Full text prompt (brand context + task)
//   2. [text label] "BRAND LOGO:" + logo inlineData
//   3. [text label] "REFERENCE IMAGE N of M:" + ref inlineData (up to 4)
//   4. [final reinforcement text] — re-states the core task at the end
//
// The label-before-image pattern is the key to reliable multi-image grounding.
// ─────────────────────────────────────────────────────────────────────────────
function buildApiParts(
  promptText: string,
  userPrompt: string,
  referenceImages: RefImage[],
  brand: BrandDNA | null | undefined,
  logoImage?: RefImage,
): object[] {
  const parts: object[] = [{ text: promptText }];

  // Logo with a clear role label immediately before the image
  if (logoImage) {
    parts.push({
      text:
        `[BRAND LOGO — study and memorize]\n` +
        `This is the official logo for "${brand?.name ?? 'this brand'}". ` +
        `It is the #1 brand asset. When the scene calls for the logo on a product ` +
        `or surface, render it exactly as shown: same shape, same colors, same proportions.`,
    });
    parts.push({ inlineData: { mimeType: logoImage.mimeType, data: logoImage.data } });
  }

  // Reference images with numbered labels so the model processes each distinctly
  const refs = referenceImages.slice(0, 4);
  refs.forEach((img, i) => {
    parts.push({
      text:
        `[REFERENCE IMAGE ${i + 1} of ${refs.length} — visual style guide]\n` +
        `Study the lighting, color grading, texture, composition, and atmosphere ` +
        `of this image. This is how "${brand?.name ?? 'this brand'}" looks and feels. ` +
        `Replicate this visual language in the output.`,
    });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  });

  // Final reinforcement: re-state the task after all images so it stays fresh
  parts.push({
    text:
      `[TASK REMINDER]\n` +
      `You have now seen all brand assets above. ` +
      `Generate this scene while honoring every brand rule:\n\n` +
      `"${userPrompt.trim()}"\n\n` +
      (logoImage
        ? `If the scene includes a branded product, render the logo from the attached logo image faithfully on it. `
        : '') +
      (refs.length > 0
        ? `Match the visual style of the reference images — lighting, palette, mood, and composition. `
        : '') +
      `Brand consistency is mandatory. Deliver a publication-quality result.`,
  });

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

  const hasLogo = !!logoImage;
  const refCount = Math.min(referenceImages.length, 4);

  // Build parts once — reused for both parallel generation calls
  const fullPrompt = buildFullPrompt(prompt.trim(), brand, preset, hasLogo, refCount);
  const parts = buildApiParts(fullPrompt, prompt.trim(), referenceImages, brand, logoImage);

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
