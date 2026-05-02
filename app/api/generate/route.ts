import { NextRequest, NextResponse } from 'next/server';

interface BrandDNA {
  name: string;
  voice: string;
  keywords: string[];
  palette: string[];
}

interface RefImage {
  data: string;   // base64, no prefix
  mimeType: string;
}

interface GenerateRequest {
  prompt: string;
  brand?: BrandDNA | null;
  referenceImages?: RefImage[];
  logoImage?: RefImage;
  preset?: string | null;
}

function buildPrompt(userPrompt: string, brand: BrandDNA | null | undefined, preset: string | null | undefined): string {
  const lines: string[] = [];

  if (brand) {
    lines.push(`Generate a brand-consistent image for ${brand.name}.`);
    lines.push('');
    lines.push('Brand identity:');
    if (brand.voice) lines.push(`- Voice & feel: ${brand.voice}`);
    if (brand.keywords.length > 0) lines.push(`- Visual style: ${brand.keywords.join(', ')}`);
    if (brand.palette.length > 0) lines.push(`- Color palette: ${brand.palette.join(', ')}`);
    lines.push('');
    lines.push('Keep the image visually consistent with this brand: match the mood, color palette, and visual style described above.');
    lines.push('');
  }

  if (preset && preset !== 'general') {
    const presetMap: Record<string, string> = {
      editorial: 'Style: editorial photography — dramatic lighting, high contrast, magazine-quality.',
      product: 'Style: clean product photography — neutral background, sharp focus, professional.',
      lifestyle: 'Style: lifestyle photography — candid, warm, authentic human moments.',
      social: 'Style: social media post — vibrant, eye-catching, optimized for Instagram/feed.',
      banner: 'Style: web banner — wide format, bold typography space, clean composition.',
      package: 'Style: packaging mockup — 3D render, studio lighting, product-forward.',
    };
    if (presetMap[preset]) lines.push(presetMap[preset] + '\n');
  }

  lines.push(`Image to generate: ${userPrompt}`);

  return lines.join('\n');
}

async function generateOne(
  apiKey: string,
  fullPrompt: string,
  referenceImages: RefImage[],
  logoImage?: RefImage,
): Promise<{ data: string; mimeType: string }> {
  const parts: object[] = [{ text: fullPrompt }];

  // Add logo first if available
  if (logoImage) {
    parts.push({ inlineData: { mimeType: logoImage.mimeType, data: logoImage.data } });
  }

  // Add up to 3 reference images
  for (const img of referenceImages.slice(0, 3)) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  };

  // Try primary model first, fall back to standard gemini flash
  const models = [
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-exp',
  ];

  let lastError: Error | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      // 404 = model doesn't exist, try next; other errors = bail
      if (res.status === 404) { lastError = new Error(`Model ${model} not found`); continue; }
      throw new Error(`Gemini API error (${res.status}): ${text}`);
    }

    const result = await res.json();
    const parts2: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> =
      result?.candidates?.[0]?.content?.parts ?? [];

    const imgPart = parts2.find(p => p.inlineData?.data);
    if (imgPart?.inlineData) {
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
    }

    // Model responded but no image — might be a text-only response from flash-exp
    throw new Error('Model returned no image. Try adding more specific brand references.');
  }

  throw lastError ?? new Error('All models failed');
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured. Add it to .env.local.' },
      { status: 500 },
    );
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { prompt, brand, referenceImages = [], logoImage, preset } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const fullPrompt = buildPrompt(prompt.trim(), brand, preset);

  try {
    // Generate 2 images in parallel
    const [img1, img2] = await Promise.allSettled([
      generateOne(apiKey, fullPrompt, referenceImages, logoImage),
      generateOne(apiKey, fullPrompt, referenceImages, logoImage),
    ]);

    const images: Array<{ data: string; mimeType: string }> = [];
    const errors: string[] = [];

    for (const result of [img1, img2]) {
      if (result.status === 'fulfilled') {
        images.push(result.value);
      } else {
        errors.push(result.reason?.message ?? 'Unknown error');
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: errors[0] ?? 'Generation failed' }, { status: 500 });
    }

    return NextResponse.json({ images });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
