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

const ELEMENT_SIGNALS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Logo',        keywords: ['logo accurately rendered', 'no logo'] },
  { label: 'Palette',     keywords: ['brand colors dominant', 'neutral muted color'] },
  { label: 'Text / Copy', keywords: ['brand name as text', 'no text', 'intentional creative or campaign text'] },
  { label: 'Face',        keywords: ['face clearly visible', 'no face visible'] },
  { label: 'Person',      keywords: ['person in scene', 'no people in frame'] },
  { label: 'Copy Space',  keywords: ['generous negative space'] },
  { label: 'Atmosphere',  keywords: ['lifestyle atmosphere', 'clean studio'] },
];

function detectElements(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return ELEMENT_SIGNALS
    .filter(e => e.keywords.some(k => lower.includes(k.toLowerCase())))
    .map(e => e.label);
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

  const runsText = runs.map(r => {
    const feedbackStr = r.feedback.map((f, i) =>
      `Image ${i + 1}: ${f === 'up' ? '👍 useful' : f === 'down' ? '👎 not useful' : 'no rating'}`
    ).join(', ');
    const elements = detectElements(r.prompt);
    return [
      `Run ${r.runNumber}`,
      `Prompt: "${r.prompt.replace(/\s+/g, ' ').trim()}"`,
      `Brand elements active: ${elements.length ? elements.join(', ') : 'none explicitly set'}`,
      `Feedback: ${feedbackStr}`,
    ].join('\n');
  }).join('\n\n');

  const systemPrompt = [
    'You are a brand AI analyst. Analyze this image-generation session and write a concise report.',
    'Be direct and opinionated. Base every rating on actual feedback evidence — do not guess.',
    '',
    'Output EXACTLY this markdown structure, no extra sections:',
    '',
    '## Summary',
    '(keep the stats exactly as provided — do not change numbers)',
    '',
    '## Brand Element Performance',
    'Rate each element that was tested in any run. Use ✓ Good, ✗ Weak, or — Not tested.',
    'One line per element: rating + one short sentence of evidence.',
    'Only include elements that appear in the data below.',
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
