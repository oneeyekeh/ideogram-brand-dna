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
const TEXT_ANALYSIS_MODEL = 'gemini-2.5-flash';

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
  cleanPrompt: string;
  overrideSettings: string[];
  modelCandidates: string[];
  selectedModels: string[];
  analysisModel?: string;
  campaignType?: string;
  decisionLog?: string[];
  assetManifest: Array<{ role: string; mimeType: string; bytesApprox: number }>;
  partLabels: string[];
}

interface CampaignAnalysis {
  campaignType: string;
  decisionLog: string[];
}

const FALLBACK_ANALYSIS: CampaignAnalysis = {
  campaignType: 'General campaign image',
  decisionLog: [
    'Read the user prompt as the primary creative task.',
    'Apply Brand DNA first, then use references only to fill missing visual cues.',
    'Keep output campaign-ready without adding hidden preset constraints.',
  ],
};

interface ParsedPrompt {
  cleanPrompt: string;
  overrideSettings: string[];
}

function parsePromptOverrides(prompt: string): ParsedPrompt {
  const trimmed = prompt.trim();
  const match = trimmed.match(/(?:\.\s*)?Override settings:\s*([\s\S]*?)\.?\s*$/i);
  if (!match) return { cleanPrompt: trimmed, overrideSettings: [] };

  const cleanPrompt = trimmed.slice(0, match.index).trim().replace(/[.\s]+$/, '');
  const overrideSettings = match[1]
    .split(';')
    .map(item => item.trim().replace(/[.\s]+$/, ''))
    .filter(Boolean);

  return { cleanPrompt: cleanPrompt || trimmed, overrideSettings };
}

function buildBrandSection(brand: BrandDNA | null | undefined): string {
  if (!brand) {
    return [
      'BRAND DNA',
      '- Brand: none selected',
      '- Use the user task as the main creative direction.',
    ].join('\n');
  }

  const lines: string[] = [
    'BRAND DNA',
    `- Brand: ${brand.name}`,
  ];

  if (brand.voice) lines.push(`- Voice / tone: ${brand.voice}`);
  if (brand.palette.length) {
    lines.push(`- Palette: ${brand.palette.join(', ')}`);
    lines.push('- Use this palette as the primary color system for backgrounds, props, wardrobe, surfaces, and lighting accents.');
  }

  return lines.join('\n');
}

function buildAssetsSection(hasLogo: boolean, refCount: number, brand?: BrandDNA | null): string {
  const lines = ['ASSETS'];
  lines.push(hasLogo
    ? `- Logo attached: yes, official logo for ${brand?.name ?? 'the brand'}. Include the logo visibly in the scene — render it accurately with correct shape, colors, proportions, and weight. Do not invent a substitute or place it out of frame.`
    : '- Logo attached: no. Do not invent a logo unless the user explicitly asks for one.');
  lines.push(refCount > 0
    ? `- References attached: ${refCount}. Use them for relevant subject, composition, typography feel, tone, material, layout, and mood.`
    : '- References attached: none. Infer style from the prompt and Brand DNA only.');
  return lines.join('\n');
}

function buildOverrideSection(overrides: string[]): string {
  const lines = ['OVERRIDE SETTINGS'];
  if (!overrides.length) {
    lines.push('- None. Do not apply optional override controls.');
    return lines.join('\n');
  }
  overrides.forEach(item => lines.push(`- ${item}`));
  lines.push('- These overrides are explicit controls. Respect them unless they directly conflict with the user task.');
  return lines.join('\n');
}

function buildOutputStandard(): string {
  return [
    'OUTPUT STANDARD',
    '- Commercial campaign quality with clean hierarchy, coherent lighting, and sharp focal detail.',
    '- Avoid visual glitches, warped anatomy, random text, watermarks, and accidental extra logos.',
    '- If text is requested, keep it intentional, minimal, and readable.',
    '- If the task mentions a product but no product/reference is supplied, represent the brand offering or campaign idea instead of inventing an unrelated physical product.',
  ].join('\n');
}

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
  cleanPrompt: string,
  brand: BrandDNA | null | undefined,
  _preset: string | null | undefined,
  hasLogo: boolean,
  refCount: number,
  analysis: CampaignAnalysis,
  overrideSettings: string[],
): string {
  return [
    'USER TASK',
    cleanPrompt.trim(),
    '',
    'CAMPAIGN TYPE',
    analysis.campaignType,
    '',
    buildBrandSection(brand),
    '',
    buildAssetsSection(hasLogo, refCount, brand),
    '',
    buildOverrideSection(overrideSettings),
    '',
    'GENERATION DIRECTION',
    '- User task defines the scene and goal.',
    '- Brand DNA defines the visual identity, tone, and color system.',
    '- Attached logo and references are grounding assets, not optional decoration.',
    '- Campaign type is planning context only; do not let it override the user task.',
    '',
    buildOutputStandard(),
  ].join('\n');
}

async function analyzeCampaign(
  apiKey: string,
  prompt: string,
  brand: BrandDNA | null | undefined,
  refCount: number,
  hasLogo: boolean,
): Promise<CampaignAnalysis> {
  const text = [
    'Classify this image-generation request for internal logging.',
    'Return JSON only with keys: campaignType (short label) and decisionLog (3 to 5 short strings).',
    'Do not write a generation prompt. Do not add constraints. This is only for debugging and user-visible logs.',
    '',
    `Prompt: ${prompt}`,
    `Brand: ${brand?.name ?? 'none'}`,
    `Brand voice: ${brand?.voice || 'not specified'}`,
    `Palette: ${brand?.palette?.join(', ') || 'not specified'}`,
    `Logo attached: ${hasLogo ? 'yes' : 'no'}`,
    `Reference image count: ${refCount}`,
  ].join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_ANALYSIS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!res.ok) return FALLBACK_ANALYSIS;
    const json = await res.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = raw ? JSON.parse(raw) : null;
    const campaignType = typeof parsed?.campaignType === 'string' && parsed.campaignType.trim()
      ? parsed.campaignType.trim()
      : FALLBACK_ANALYSIS.campaignType;
    const decisionLog = Array.isArray(parsed?.decisionLog)
      ? parsed.decisionLog.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 5)
      : FALLBACK_ANALYSIS.decisionLog;
    return { campaignType, decisionLog: decisionLog.length ? decisionLog : FALLBACK_ANALYSIS.decisionLog };
  } catch {
    return FALLBACK_ANALYSIS;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — API parts array
//
// Interleave labeled text before each image so the model understands the ROLE
// of each image before processing it. Order:
//   1. Full text prompt (task + campaign type + brand + assets + overrides)
//   2. [label] "BRAND LOGO" + logo inlineData
//   3. [label] "REFERENCE IMAGE N of M" + ref inlineData (up to 5)
//   4. [task reinforcement] — re-states task after all images
//
// The label-before-image pattern is the key to reliable multi-image grounding.
// ─────────────────────────────────────────────────────────────────────────────
function buildApiParts(
  promptText: string,
  cleanPrompt: string,
  referenceImages: RefImage[],
  brand: BrandDNA | null | undefined,
  overrideSettings: string[],
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
    `"${cleanPrompt.trim()}"`,
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
  if (overrideSettings.length > 0) {
    reinforcement.push(`OVERRIDES: ${overrideSettings.join('; ')}.`);
  }
  reinforcement.push(
    `STANDARD: clean campaign-quality composition, coherent lighting, sharp focal detail, ` +
    `no visual glitches, no accidental extra text, no watermarks.`
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
  const { cleanPrompt, overrideSettings } = parsePromptOverrides(prompt);
  const analysis = await analyzeCampaign(apiKey, cleanPrompt, brand, refCount, hasLogo);

  // Build parts once — reused for both parallel generation calls
  const fullPrompt = buildFullPrompt(cleanPrompt, brand, preset, hasLogo, refCount, analysis, overrideSettings);
  const parts = buildApiParts(fullPrompt, cleanPrompt, referenceImages, brand, overrideSettings, logoImage);
  const debug: DebugInfo = {
    fullPrompt,
    cleanPrompt,
    overrideSettings,
    modelCandidates: IMAGE_GENERATION_MODELS,
    selectedModels: [],
    analysisModel: TEXT_ANALYSIS_MODEL,
    campaignType: analysis.campaignType,
    decisionLog: analysis.decisionLog,
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
