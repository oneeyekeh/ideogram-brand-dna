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
  { label: 'Logo',        keywords: ['logo accurately rendered'] },
  { label: 'Text / Copy', keywords: ['brand name as text', 'intentional creative or campaign text'] },
  { label: 'Face',        keywords: ['face clearly visible'] },
  { label: 'Person',      keywords: ['person in scene'] },
  { label: 'Copy Space',  keywords: ['generous negative space'] },
  { label: 'Atmosphere',  keywords: ['lifestyle atmosphere', 'clean studio'] },
  { label: 'Brand Colors',keywords: ['brand colors dominant'] },
];

function classifyRun(prompt: string): 'base' | 'followup' | 'refinement' {
  if (/REFINEMENT REQUEST/i.test(prompt)) return 'refinement';
  if (/FOLLOW-UP REQUEST/i.test(prompt)) return 'followup';
  return 'base';
}

function describeRunElements(prompt: string, alwaysActive: string[]): string {
  const lower = prompt.toLowerCase();

  const overriddenOff = DNA_OVERRIDE_OFF
    .filter(d => d.offKeywords.some(k => lower.includes(k.toLowerCase())))
    .map(d => `${d.element} disabled`);

  const overriddenOn = OVERRIDE_ON_SIGNALS
    .filter(d => d.keywords.some(k => lower.includes(k.toLowerCase())))
    .map(d => `${d.label} (override on)`);

  const activeFromDNA = alwaysActive.filter(
    el => !DNA_OVERRIDE_OFF.some(d =>
      d.element.toLowerCase() === el.toLowerCase() &&
      d.offKeywords.some(k => lower.includes(k.toLowerCase()))
    )
  );

  const all = [
    ...activeFromDNA.map(e => `${e} (Brand DNA)`),
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
  const unrated = runs.flatMap(r => r.feedback).filter(f => f === null).length;

  const alwaysActiveElements: string[] = [];
  if (brand?.palette?.length) alwaysActiveElements.push('Palette');
  if (brand?.tone) alwaysActiveElements.push('Voice / Tone');
  if (brand?.hasLogo) alwaysActiveElements.push('Logo');

  const runsText = runs.map(r => {
    const type = classifyRun(r.prompt);
    const feedbackStr = r.feedback.map((f, i) =>
      `Image ${i + 1}: ${f === 'up' ? '👍 useful' : f === 'down' ? '👎 not useful' : 'unrated'}`
    ).join(', ');

    // Extract just the most recent instruction layer for readability
    const promptLines = r.prompt.trim().split('\n');
    const lastSection = promptLines.slice(
      Math.max(0, promptLines.lastIndexOf('') + 1)
    ).join(' ').trim().slice(0, 300);

    return [
      `--- Run ${r.runNumber} [${type}] ---`,
      `Core intent: ${lastSection}`,
      `Active elements: ${describeRunElements(r.prompt, alwaysActiveElements)}`,
      `Feedback: ${feedbackStr}`,
    ].join('\n');
  }).join('\n\n');

  const systemPrompt = [
    'You are a brand AI analyst. Write a concise but complete session report.',
    'Be direct and specific. No padding, but do not leave gaps.',
    '',
    'RULES:',
    '- Brand DNA elements (Palette, Logo, Voice/Tone) are active by default in every run.',
    '  Rate them using the overall session feedback — if most images were useful, the element likely worked.',
    '- Override elements were explicitly turned on or off per run — note whether that override helped or hurt.',
    '- Always rate every element that was active in any run. Never skip an element.',
    '- If feedback is 100% positive and nothing failed, say so clearly.',
    '- 👍 = model respected the request. 👎 = model failed or produced off-brand result.',
    '',
    'FORMAT — use exactly this structure:',
    '',
    '## Summary',
    'Runs: N | Images: N | Useful: N | Not useful: N | Brand: X | Model: Y',
    '',
    '## Model Performance',
    'Rate every element that was active. One line each:',
    '  ✓ Name — short reason it worked',
    '  ✗ Name — short reason it failed, which run',
    '  ~ Name — mixed: what worked, what didn\'t',
    '',
    '## What to try next',
    '2–4 bullets. Specific. If the session was successful, suggest what to push further or test next.',
  ].join('\n');

  const userText = [
    `BRAND: ${brand?.name ?? 'none'}`,
    `Palette: ${brand?.palette?.join(', ') || 'not set'}`,
    `Voice / Tone: ${brand?.tone || 'not specified'}`,
    `Logo asset: ${brand?.hasLogo ? 'attached' : 'not attached'}`,
    `Always-active Brand DNA elements: ${alwaysActiveElements.join(', ') || 'none'}`,
    `Model(s): ${models.join(', ') || 'unknown'}`,
    '',
    `STATS: ${runs.length} runs | ${totalImages} images | ${useful} 👍 | ${notUseful} 👎 | ${unrated} unrated`,
    '',
    'RUNS:',
    runsText,
    '',
    `Summary line: Runs: ${runs.length} | Images: ${totalImages} | Useful: ${useful} | Not useful: ${notUseful} | Brand: ${brand?.name ?? 'none'} | Model: ${models.join(', ') || 'unknown'}`,
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
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
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
