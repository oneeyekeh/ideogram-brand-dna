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

interface DebugInfo {
  fullPrompt: string;
  modelCandidates: string[];
  selectedModels: string[];
  assetManifest: Array<{ role: string; mimeType: string; bytesApprox: number }>;
  partLabels: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Global quality standards
//
// Appended to every generation regardless of brand or preset.
// These directives push the model toward commercial-grade output.
// Tune the wording here to raise or lower the technical bar.
// ─────────────────────────────────────────────────────────────────────────────
const QUALITY_STANDARDS = `\
━━━ TECHNICAL QUALITY REQUIREMENTS (mandatory for every output) ━━━

RESOLUTION & SHARPNESS:
  • Maximum detail fidelity — render at the highest possible quality
  • Tack-sharp focus on the hero subject with optically natural depth of field
  • No soft edges from AI blur, no unintended motion blur, no halation

PHOTOREALISM:
  • Physically accurate materials: glass refracts light correctly, metal reflects
    environment, fabric has micro-texture and weave detail, liquid has meniscus
  • No AI tells: no melting geometry, no hallucinated reflections, no extra limbs
  • Accurate product geometry: labels lie flat on curves, logos have correct perspective
  • Text and logos must be crisp, readable, and intentionally placed when requested
  • Physically plausible lighting — shadows and highlights obey a single light source

EXPOSURE & COLOR SCIENCE:
  • Full dynamic range: rich shadow detail without crush, highlights without blow-out
  • Accurate white balance and color grading consistent throughout the frame
  • No over-saturation, no unnatural glow, no HDR halo artifacts

OUTPUT STANDARD:
  • Commercial photography quality — suitable for print, large-format digital, campaigns
  • Clean, noise-free result (add intentional film grain only if brand aesthetic demands it)
  • No visual glitches, warping, stitching artifacts, or repeated patterns
  • Composition follows rule of thirds or golden ratio; intentional, not accidental`;

const CAMPAIGN_EXECUTION_GUIDE = `\
━━━ CAMPAIGN EXECUTION GUIDE ━━━

Classify the user's request into the closest campaign type and apply the matching constraints:

PRODUCT SHOTS — highest reliability:
  • Keep the product geometry clean, readable, and centered unless the user asks otherwise.
  • For hero shots: simple background, realistic soft shadow, controlled studio lighting.
  • For flat lays: top-down camera, tidy prop spacing, surface texture from prompt/reference.
  • For variants: consistent scale, alignment, lighting, and palette across all products.
  • Avoid random text. Render logo only when it belongs on the product/package/surface.

CHARACTER + PRODUCT — medium difficulty:
  • Prioritize natural hands, believable interaction, and product visibility.
  • For full people: use candid lifestyle realism, not fashion-catalog stiffness.
  • For hands close-ups: avoid face generation, keep hands anatomically plausible.
  • Keep the product and logo legible; do not let the person overwhelm the product.

APPAREL / WEARABLES — hardest:
  • Preserve garment silhouette, fabric behavior, seams, scale, and fit.
  • For on-model apparel: clean pose, full garment visible, no warped limbs or extra fingers.
  • Prefer simpler compositions for reliability; flat lay is more reliable than on-model.
  • For shoes/accessories: emphasize side angle, material texture, and product shape accuracy.

SEASONAL / PROMO CAMPAIGNS:
  • Use seasonal props and lighting as context, but preserve explicit Brand DNA first.
  • Do not add sale text, slogans, prices, or dates unless the user explicitly requests text.
  • Leave intentional negative space when prompt asks for banners, overlays, or text-safe areas.

BRAND ATMOSPHERE / NO PRODUCT:
  • If no product is needed, express the brand through palette, tone, lighting, texture, location,
    typography feel, and art direction inferred from Brand DNA and references.
  • Avoid inventing products or logos when the prompt asks only for mood, texture, or location.

SOCIAL FORMAT SPECIFIC:
  • Square post: strong central read, simple shapes, works at thumbnail size.
  • Vertical 9:16: clear subject, top/bottom text-safe space, simple background hierarchy.
  • Wide banner: horizontal composition, product or focal subject on one side, negative space
    for headline, professional crop-safe framing.`;

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Brand context block
//
// Injected before preset + quality when a brand is active.
// hasLogo / refCount are passed so rules can reference what's actually attached.
//
// Priority hierarchy (enforced in text):
//   1. Explicit Brand DNA fields entered by the user
//      (logo, palette, voice/tone, brand name) are the source of truth.
//   2. Reference images fill in missing brand signals:
//      typography style, formality, layout rhythm, visual tone, materials.
//   3. User prompt decides the campaign task and which reference details matter.
//   4. Quality standards raise the technical bar without overriding brand fidelity.
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
    lines.push('  Color palette (authoritative hex values):');
    brand.palette.forEach((c, i) => lines.push(`    ${i + 1}. ${c}`));
  }
  lines.push('');

  // ── Asset inventory ──────────────────────────────────────────
  lines.push('━━━ ATTACHED BRAND ASSETS ━━━');
  if (hasLogo) {
    lines.push('  [LOGO IMAGE ATTACHED] — see the image immediately following this text.');
    lines.push('  This is the official brand logo. Memorize its exact shape, colors,');
    lines.push('  proportions, and design details — you will reproduce it accurately.');
  } else {
    lines.push('  [No logo attached] — do not invent a logo.');
  }
  if (refCount > 0) {
    lines.push(`  [${refCount} CAMPAIGN REFERENCE IMAGE(S) ATTACHED] — see images following the logo.`);
    lines.push('  These are per-generation campaign references supplied by the user.');
    lines.push('  Use them together with the brand identity to create the requested campaign image.');
  } else {
    lines.push('  [No reference images] — derive visual style from palette and voice only.');
  }
  lines.push('');

  // ── Mandatory brand rules ─────────────────────────────────────
  lines.push('━━━ BRAND RULES — follow ALL without exception ━━━');
  lines.push('');

  lines.push('PRIORITY ORDER:');
  lines.push('  1. Explicit Brand DNA provided by the user comes first: logo, palette,');
  lines.push('     brand name, and written voice/tone are authoritative.');
  lines.push('  2. If Brand DNA is vague or incomplete, infer missing brand elements from');
  lines.push('     the reference images: typography style, degree of formality, layout');
  lines.push('     rhythm, camera language, graphic density, materials, tone, and mood.');
  lines.push('  3. Use the user prompt to decide the scene and which reference details are relevant.');
  lines.push('  4. Never let references contradict explicit Brand DNA unless the user asks.');
  lines.push('');

  if (hasLogo) {
    lines.push('LOGO RENDERING:');
    lines.push('  • The attached logo image is the ground truth — reproduce it faithfully.');
    lines.push('  • When the scene includes a branded product, package, or surface,');
    lines.push('    render the logo on it with accurate colors, proportions, and details.');
    lines.push('  • If the user asks for packaging, ads, banners, social posts, products,');
    lines.push('    uniforms, storefronts, or branded surfaces, include the logo unless');
    lines.push('    the user explicitly asks for an unbranded image.');
    lines.push('  • Do NOT simplify, distort, or reimagine the logo — match it exactly.');
    lines.push('  • The logo\'s own colors take precedence over the palette in the logo area.');
    lines.push('  • Logo placement should feel professionally applied — correct perspective,');
    lines.push('    proper material interaction (e.g. slight surface curvature on bottles).');
    lines.push('');
  }

  if (refCount > 0) {
    lines.push('CAMPAIGN REFERENCE IMAGES:');
    lines.push('  • These images are user-provided campaign references for THIS generation.');
    lines.push('  • Use them according to the user prompt: preserve the relevant subject,');
    lines.push('    pose, product context, composition, lighting, or material cues as requested.');
    lines.push('  • Study their brand DNA beyond objects: typography style, font weight,');
    lines.push('    spacing, hierarchy, minimal vs. expressive layout, formal vs. playful');
    lines.push('    tone, premium vs. casual mood, texture system, and graphic language.');
    lines.push('  • If the written Brand DNA does not specify typography or tone clearly,');
    lines.push('    infer those from the references and apply them consistently.');
    lines.push('  • Do not copy irrelevant objects or accidental details from references.');
    lines.push('  • Blend the references with the active Brand DNA rather than replacing it.');
    lines.push('  • The final image must feel like a campaign asset for this brand, informed by');
    lines.push('    the supplied references and constrained by the brand palette, voice, and logo.');
    lines.push('');
  }

  if (brand.palette.length) {
    lines.push('COLOR PALETTE (second priority after reference images):');
    lines.push(`  • Dominant palette: ${brand.palette.join(', ')}`);
    lines.push('  • Treat these as brand color constraints, not loose inspiration.');
    lines.push('  • Apply these hex values to backgrounds, surfaces, props, wardrobe, lighting gels, packaging, and environment.');
    lines.push('  • Outside colors may appear only for natural skin, realistic materials, or physically unavoidable context.');
    lines.push('  • Color temperature and saturation must align with these swatches.');
    lines.push('');
  }

  if (brand.voice) {
    lines.push('BRAND VOICE & ATMOSPHERE:');
    lines.push(`  • The brand feels: "${brand.voice}"`);
    lines.push('  • This written voice overrides any conflicting tone inferred from references.');
    lines.push('  • Let this permeate lighting mood, subject expression, texture, composition.');
    lines.push('  • A viewer should feel this brand\'s personality without reading any text.');
    lines.push('');
  }

  lines.push('GENERAL:');
  lines.push('  • Do NOT add random text, watermarks, or unsolicited brand names.');
  lines.push('  • DO render the brand logo when it is part of the requested scene.');
  lines.push('  • Brand consistency overrides literal prompt interpretation.');
  lines.push('  • If brand rules and references conflict, follow explicit user Brand DNA first,');
  lines.push('    then use references to fill missing typography, tone, and style details.');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Style preset modifier
//
// Preset names are shown in the UI for user context only.
// They are intentionally NOT injected into the prompt — brand DNA + quality
// standards are the sole generation drivers. Edit this map if you want to
// re-enable preset prompt injection in buildFullPrompt.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PRESET_MODIFIERS: Record<string, string> = {
  editorial: 'Editorial',
  product:   'Product',
  lifestyle: 'Lifestyle',
  social:    'Social post',
  banner:    'Web banner',
  package:   'Packaging',
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Full prompt assembly
//
// Final text block sent to the model. Structure:
//   [Brand DNA]        — who the brand is + mandatory rules
//   [Quality standards]— technical quality requirements
//   [Generation task]  — the user's actual request
//
// Preset is received but not injected — it's a UI label only.
// ─────────────────────────────────────────────────────────────────────────────
function buildFullPrompt(
  userPrompt: string,
  brand: BrandDNA | null | undefined,
  _preset: string | null | undefined,
  hasLogo: boolean,
  refCount: number,
): string {
  const sections: string[] = [];

  if (brand) {
    sections.push(buildBrandContext(brand, hasLogo, refCount));
  }

  sections.push(QUALITY_STANDARDS);
  sections.push(CAMPAIGN_EXECUTION_GUIDE);

  sections.push(
    '━━━ GENERATION TASK ━━━\n' +
    'Apply ALL brand rules, style direction, and quality requirements above.\n\n' +
    'Generate: ' + userPrompt.trim() + '\n\n' +
    'This output must be publication-ready. No compromises on quality or brand fidelity.'
  );

  return sections.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — API parts array
//
// Interleave labeled text before each image so the model understands the ROLE
// of each image before processing it. Order:
//   1. Full text prompt (brand context + preset + quality + task)
//   2. [label] "BRAND LOGO" + logo inlineData
//   3. [label] "REFERENCE IMAGE N of M" + ref inlineData (up to 5)
//   4. [task reinforcement] — re-states scene + quality bar after all images
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

  // Logo: labeled immediately before the image for clear role anchoring
  if (logoImage) {
    parts.push({
      text:
        `[BRAND LOGO — study and memorize precisely]\n` +
        `This is the official logo for "${brand?.name ?? 'this brand'}". ` +
        `It is the #1 brand asset. Reproduce it exactly: same icon shape, same colors, ` +
        `same proportions, same weight. When the scene calls for the logo on a product ` +
        `or surface, render it faithfully with correct material interaction.`,
    });
    parts.push({ inlineData: { mimeType: logoImage.mimeType, data: logoImage.data } });
  }

  // Campaign references: numbered labels so the model processes each distinctly
  const refs = referenceImages.slice(0, 5);
  refs.forEach((img, i) => {
    parts.push({
      text:
        `[CAMPAIGN REFERENCE IMAGE ${i + 1} of ${refs.length}]\n` +
        `Use this image as a generation-specific reference. Interpret it through the ` +
        `user prompt and the "${brand?.name ?? 'selected brand'}" Brand DNA: carry over ` +
        `the relevant subject, pose, product context, composition, lighting, textures, ` +
        `or mood only where they help create the requested campaign image. Also infer ` +
        `missing brand signals from it: typography style, layout hierarchy, formality, ` +
        `visual tone, graphic density, material language, and art direction. Do not let ` +
        `reference colors or tone override explicit Brand DNA unless the user asks.`,
    });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  });

  // Final reinforcement: re-state task + quality expectation after all images
  const reinforcement: string[] = [
    '[FINAL TASK — generate now]',
    `You have studied all brand assets. Now produce a publication-quality image of:\n`,
    `"${userPrompt.trim()}"`,
    '',
  ];
  if (logoImage) {
    reinforcement.push(
      `LOGO: Render the brand logo from the attached image faithfully on the product/surface. ` +
      `Correct perspective, material curvature, and lighting interaction.`
    );
  }
  if (refs.length > 0) {
    reinforcement.push(
      `REFERENCES: Use the ${refs.length} campaign reference image(s) according to the user prompt. ` +
      `Preserve explicit Brand DNA first. Then use references to fill missing typography, tone, ` +
      `layout, material, and art-direction details.`
    );
  }
  reinforcement.push(
    `QUALITY: Photorealistic, tack-sharp, full dynamic range, no AI artifacts. ` +
    `Commercial photography standard. This must be campaign-ready.`
  );

  parts.push({ text: reinforcement.join('\n') });

  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Single generation call
// Tries each model in IMAGE_GENERATION_MODELS until one returns an image.
// ─────────────────────────────────────────────────────────────────────────────
async function generateOne(
  apiKey: string,
  parts: object[],
): Promise<{ data: string; mimeType: string; model: string }> {
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
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType, model };
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
  const refCount = Math.min(referenceImages.length, 5);

  // Build parts once — reused for both parallel generation calls
  const fullPrompt = buildFullPrompt(prompt.trim(), brand, preset, hasLogo, refCount);
  const parts = buildApiParts(fullPrompt, prompt.trim(), referenceImages, brand, logoImage);
  const debug: DebugInfo = {
    fullPrompt,
    modelCandidates: IMAGE_GENERATION_MODELS,
    selectedModels: [],
    assetManifest: [
      ...(logoImage ? [{ role: 'Brand logo', mimeType: logoImage.mimeType, bytesApprox: Math.round(logoImage.data.length * 0.75) }] : []),
      ...referenceImages.slice(0, 5).map((img, i) => ({
        role: `Campaign reference ${i + 1}`,
        mimeType: img.mimeType,
        bytesApprox: Math.round(img.data.length * 0.75),
      })),
    ],
    partLabels: parts
      .filter((part): part is { text: string } => typeof (part as { text?: unknown }).text === 'string')
      .map(part => part.text.split('\n')[0].slice(0, 120)),
  };

  // Generate 2 images in parallel
  const [r1, r2] = await Promise.allSettled([
    generateOne(apiKey, parts),
    generateOne(apiKey, parts),
  ]);

  const images: Array<{ data: string; mimeType: string }> = [];
  const errors: string[] = [];

  for (const result of [r1, r2]) {
    if (result.status === 'fulfilled') {
      images.push({ data: result.value.data, mimeType: result.value.mimeType });
      debug.selectedModels.push(result.value.model);
    }
    else errors.push(result.reason?.message ?? 'Unknown error');
  }

  if (images.length === 0) {
    return NextResponse.json({ error: errors[0] ?? 'Generation failed', debug }, { status: 500 });
  }

  return NextResponse.json({ images, debug });
}
