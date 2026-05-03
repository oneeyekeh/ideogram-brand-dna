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
    'You are a senior brand AI analyst reviewing an image-generation session.',
    'Your job is to produce a smart, honest, specific session report that helps the user understand what worked,',
    'what failed, and what to do next. Write as a colleague, not a form-filler.',
    '',
    'CONTEXT:',
    '- Brand DNA elements (Palette, Voice/Tone, Logo) are applied by default to every run.',
    '- They can be disabled per-run via override tags (e.g. "no logo", "neutral muted color palette").',
    '- Override elements (face, person, logo, brand colors, etc.) are explicitly activated or disabled per run.',
    '- Use the per-run "Active elements" field as ground truth for what was requested.',
    '- Runs are typed: base (first prompt), followup (same session, new direction), refinement (fixing a previous result).',
    '- 👍 useful = model respected the request. 👎 not useful = model failed or result was off-brand.',
    '',
    'OUTPUT FORMAT — use exactly this structure:',
    '',
    '## Summary',
    '(fill in the stats block exactly as given)',
    '',
    '## Session Arc',
    'In 2–4 sentences: describe what the user was trying to do across the session, how the approach evolved',
    '(did they add overrides? refine multiple times?), and whether the session converged or stalled.',
    '',
    '## Brand Element Performance',
    'For every element that was active in any run, give one line:',
    '  ✓ Good — model respected it, feedback confirms',
    '  ✗ Weak — model failed it, feedback confirms',
    '  ~ Inconsistent — mixed results across runs',
    '  — Disabled — turned off via override in all runs',
    'Include evidence (which run, what happened). Be specific.',
    '',
    '## Override Effectiveness',
    'Only include this section if the user used overrides.',
    'For each override that was activated: did it work? Did adding it improve or worsen results?',
    'Note if any override seemed to conflict with another or with Brand DNA.',
    '',
    '## Refinement Analysis',
    'Only include this section if refinement runs exist.',
    'Did the refinements improve the result? What specific issues were targeted vs. what actually changed?',
    '',
    '## What Worked',
    '1–3 short bullets. Only from evidence in the feedback.',
    '',
    '## What Didn\'t Work',
    '1–3 short bullets. Only from evidence in the feedback.',
    '',
    '## Recommendations for Next Session',
    '3–5 specific, actionable bullets. Reference what you observed.',
    'Suggest what to keep, drop, change, or try differently.',
  ].join('\n');

  const userText = [
    `BRAND: ${brand?.name ?? 'none'}`,
    `Palette: ${brand?.palette?.join(', ') || 'not set'}`,
    `Voice / Tone: ${brand?.tone || 'not specified'}`,
    `Logo asset: ${brand?.hasLogo ? 'attached' : 'not attached'}`,
    `Always-active Brand DNA elements: ${alwaysActiveElements.join(', ') || 'none'}`,
    `Model(s): ${models.join(', ') || 'unknown'}`,
    '',
    `STATS: ${runs.length} runs | ${totalImages} images | ${useful} 👍 useful | ${notUseful} 👎 not useful | ${unrated} unrated`,
    '',
    'SESSION RUNS:',
    runsText,
    '',
    '---',
    `Now write the full report. Start the Summary section with exactly:`,
    `Runs: ${runs.length} | Images generated: ${totalImages} | Useful: ${useful} | Not useful: ${notUseful} | Brand: ${brand?.name ?? 'none'} | Model: ${models.join(', ') || 'unknown'}`,
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
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
