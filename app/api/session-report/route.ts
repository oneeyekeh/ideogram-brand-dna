import { NextRequest, NextResponse } from 'next/server';

const TEXT_MODEL = 'gemini-2.5-flash';

interface RunData {
  runNumber: number;
  prompt: string;
  imageCount: number;
  feedback: Array<'up' | 'down' | null>;
}

interface SessionReportRequest {
  brand: { name: string; palette: string[]; tone?: string; hasLogo: boolean } | null;
  runs: RunData[];
  totalImages: number;
  models: string[];
}

// Tags that explicitly disable a Brand DNA element via override
const DNA_OVERRIDE_OFF: Array<{ element: string; offKeywords: string[] }> = [
  { element: 'Logo',    offKeywords: ['no logo'] },
  { element: 'Palette', offKeywords: ['neutral muted color palette'] },
  { element: 'Text',    offKeywords: ['no text'] },
  { element: 'Person',  offKeywords: ['no people in frame'] },
  { element: 'Face',    offKeywords: ['no face visible'] },
];

// Tags that explicitly enable an optional element via override
const OVERRIDE_ON_SIGNALS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Logo (override on)',        keywords: ['logo accurately rendered'] },
  { label: 'Text / Copy (override on)', keywords: ['brand name as text', 'intentional creative or campaign text'] },
  { label: 'Face (override on)',        keywords: ['face clearly visible'] },
  { label: 'Person (override on)',      keywords: ['person in scene'] },
  { label: 'Copy Space (override on)',  keywords: ['generous negative space'] },
  { label: 'Atmosphere (override on)',  keywords: ['lifestyle atmosphere', 'clean studio'] },
];

function describeRunElements(prompt: string, alwaysActive: string[]): string {
  const lower = prompt.toLowerCase();

  const overriddenOff = DNA_OVERRIDE_OFF
    .filter(d => d.offKeywords.some(k => lower.includes(k.toLowerCase())))
    .map(d => `${d.element} (disabled via override)`);

  const overriddenOn = OVERRIDE_ON_SIGNALS
    .filter(d => d.keywords.some(k => lower.includes(k.toLowerCase())))
    .map(d => d.label);

  const activeFromDNA = alwaysActive.filter(
    el => !DNA_OVERRIDE_OFF.some(d =>
      d.element.toLowerCase() === el.toLowerCase() &&
      d.offKeywords.some(k => lower.includes(k.toLowerCase()))
    )
  );

  const all = [
    ...activeFromDNA.map(e => `${e} (from Brand DNA)`),
    ...overriddenOn,
    ...overriddenOff,
  ];
  return all.length ? all.join(', ') : 'none';
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });

  let body: SessionReportRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { brand, runs, totalImages, models } = body;
  const useful = runs.flatMap(r => r.feedback).filter(f => f === 'up').length;
  const notUseful = runs.flatMap(r => r.feedback).filter(f => f === 'down').length;

  // Brand DNA elements that are ALWAYS active (applied to every run via the base system prompt)
  const alwaysActiveElements: string[] = [];
  if (brand?.palette?.length) alwaysActiveElements.push('Palette');
  if (brand?.tone) alwaysActiveElements.push('Voice / Tone');
  if (brand?.hasLogo) alwaysActiveElements.push('Logo');

  const runsText = runs.map(r => {
    const feedbackStr = r.feedback.map((f, i) =>
      `Image ${i + 1}: ${f === 'up' ? '👍 useful' : f === 'down' ? '👎 not useful' : 'no rating'}`
    ).join(', ');
    return [
      `Run ${r.runNumber}`,
      `Prompt: "${r.prompt.replace(/\s+/g, ' ').trim()}"`,
      `Active elements: ${describeRunElements(r.prompt, alwaysActiveElements)}`,
      `Feedback: ${feedbackStr}`,
    ].join('\n');
  }).join('\n\n');

  const systemPrompt = [
    'You are a brand AI analyst. Analyze this image-generation session and write a concise report.',
    'Be direct and opinionated. Base every rating on actual feedback evidence — do not guess.',
    '',
    'IMPORTANT: Brand DNA elements (Palette, Voice/Tone, Logo when provided) are active by default in every run.',
    'They can be disabled per-run via override tags (e.g. "no logo", "neutral muted color palette").',
    'Each run below lists which elements were active, disabled, or overridden — use that as ground truth.',
    'Rate elements based on whether feedback suggests the model respected them when they were active.',
    'If an element was disabled via override in all runs, mark it — Disabled.',
    'Do NOT mark Brand DNA elements as "Not tested" just because no explicit mod tag was added.',
    '',
    'Output EXACTLY this markdown structure, no extra sections:',
    '',
    '## Summary',
    '(keep the stats exactly as provided — do not change numbers)',
    '',
    '## Brand Element Performance',
    'Rate each element. Use ✓ Good, ✗ Weak, or ~ Unclear (not enough feedback).',
    'One line per element: rating + one short sentence of evidence.',
    'Always include the always-active Brand DNA elements listed below.',
    'Also include any override elements that appeared in individual run prompts.',
    '',
    '## What Worked',
    '1–3 short bullets. Only write this if feedback clearly shows something succeeded.',
    '',
    '## What Didn\'t Work',
    '1–3 short bullets. Only write this if feedback clearly shows something failed.',
    '',
    '## Takeaway',
    '2–3 sentences max. Specific and actionable for the next session.',
    'Focus on what to change or try differently, not what already succeeded.',
  ].join('\n');

  const userText = [
    `BRAND: ${brand?.name ?? 'none'}`,
    `Palette: ${brand?.palette?.join(', ') || 'not set'}`,
    `Voice: ${brand?.tone || 'not specified'}`,
    `Logo asset available: ${brand?.hasLogo ? 'yes' : 'no'}`,
    `Models used: ${models.join(', ') || 'unknown'}`,
    '',
    `ALWAYS-ACTIVE BRAND DNA ELEMENTS (present in every run): ${alwaysActiveElements.join(', ') || 'none'}`,
    '',
    `STATS: ${runs.length} runs | ${totalImages} images | ${useful} useful | ${notUseful} not useful`,
    '',
    'RUNS:',
    runsText,
    '',
    '---',
    'Now write the report following the exact structure above.',
    `Fill in the Summary section with these exact values: Runs: ${runs.length} | Images generated: ${totalImages} | Useful: ${useful} | Not useful: ${notUseful} | Brand: ${brand?.name ?? 'none'} | Model: ${models.join(', ') || 'unknown'}`,
  ].join('\n');

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const markdown: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!markdown) {
      return NextResponse.json({ error: 'Empty response from model' }, { status: 502 });
    }

    return NextResponse.json({ markdown });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
