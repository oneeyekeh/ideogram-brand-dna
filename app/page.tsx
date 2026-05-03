'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttachedImage {
  dataURL: string;
  mimeType: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
  logoText: string;
  logoImage?: string;
  palette: string[];
  voice: string;
  edited: string;
  keywords: string[];
  samples: string[];
}

interface StreamMessage {
  role: 'user' | 'asst';
  text?: string;
  loading?: boolean;
  images?: string[];
  prompt?: string;
  attachedImages?: string[];
  referenceImages?: AttachedImage[];
  error?: string;
  variant?: 'regen' | 'refine';
  trace?: GenerationTrace;
}

interface GenerationTrace {
  status: 'generating' | 'complete' | 'error';
  mode: 'generate' | 'regenerate' | 'refine';
  prompt: string;
  brandName?: string;
  hasLogo: boolean;
  palette: string[];
  tone?: string;
  referenceCount: number;
  referenceNames: string[];
  modelName: string;
  debugMarkdown?: string;
}

interface DebugDocState {
  title: string;
  markdown: string;
}

interface DetailState {
  images: string[];
  idx: number;
  prompt: string;
  brand?: Brand;
}

interface RefineState {
  q1: string[];   // main issues
  q2: string[];   // what to change
  q3: string[];   // priority element
  q4: string;     // free text
}

interface SavedImage {
  id: string;
  src: string;
  prompt: string;
  brandName?: string;
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────

const paths: Record<string, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14"/>,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>,
  arrowU: <path d="M12 19V5M5 12l7-7 7 7"/>,
  chevR: <path d="m9 6 6 6-6 6"/>,
  chevL: <path d="m15 6-6 6 6 6"/>,
  chevD: <path d="m6 9 6 6 6-6"/>,
  x: <path d="M18 6 6 18M6 6l12 12"/>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
  expand: <><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></>,
  ratio: <rect x="3" y="6" width="18" height="12" rx="1"/>,
  check: <path d="M20 6 9 17l-5-5"/>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  explore: <><circle cx="12" cy="12" r="10"/><path d="m16 8-3 7-7 3 3-7 7-3z"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  image2: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
  heart: <path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.7l-1.06-1.1a5.5 5.5 0 0 0-7.78 7.78L12 21.2l8.84-8.82a5.5 5.5 0 0 0 0-7.78z"/>,
  cube: <><path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  dna: <><path d="M4 4c8 4 8 12 16 16M20 4C12 8 12 16 4 20"/><path d="M7 5h2M15 5h2M5 9h2M17 9h2M5 15h2M17 15h2M7 19h2M15 19h2"/></>,
  type: <path d="M4 7V5h16v2M9 5v14M15 19h-2"/>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></>,
  thumbUp: <><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></>,
  thumbDown: <><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></>,
  paperclip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
};

function Icon({ name, size = 16, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

const DEFAULT_BRANDS: Brand[] = [
  { id: 'foundry', name: 'Foundry Coffee', logoText: 'Foundry', palette: ['#3D1F12','#C97A3A','#E9D5B5','#F5EBDB'], voice: 'Earthy, crafted, slow.', edited: '2d ago', keywords: ['warm grain','matte ceramic','shadow play'], samples: ['grad-1','grad-3','grad-9'] },
  { id: 'aria', name: 'Aria Skincare', logoText: 'aria', palette: ['#F5E6D3','#E8C5A0','#A87856','#3F2A1E'], voice: 'Soft, considered, luminous.', edited: '5h ago', keywords: ['diffused light','milky beige','glassy'], samples: ['grad-6','grad-2','grad-11'] },
  { id: 'monsoon', name: 'Monsoon Tech', logoText: 'Monsoon', palette: ['#0F1F3A','#4A90E2','#8FB8E8','#FFFFFF'], voice: 'Confident, calm, technical.', edited: 'last week', keywords: ['cool gradients','blue glass','clean type'], samples: ['grad-7','grad-12','grad-4'] },
  { id: 'plume', name: 'Plume Studio', logoText: 'Plume', palette: ['#FFE5EC','#FF7AA2','#5B1339','#FFFFFF'], voice: 'Playful, bold, expressive.', edited: '3d ago', keywords: ['soft pinks','high contrast','paper textures'], samples: ['grad-2','grad-5','grad-8'] },
];

interface PromptPreset {
  id: string;
  category: string;
  label: string;
  prompt: string;
}

const PRESET_CATEGORIES = ['Social Media', 'Product', 'Campaign', 'Brand Storytelling'];

const PROMPT_SUGGESTIONS: PromptPreset[] = [
  { id: 'instagram_feed', category: 'Social Media', label: 'Instagram Feed Post', prompt: 'Square lifestyle product shot, styled and polished, scroll-stopping composition, no text' },
  { id: 'instagram_story', category: 'Social Media', label: 'Instagram Story / Reel Cover', prompt: 'Vertical 9:16, subject in lower third, top half open for text overlay, no text' },
  { id: 'facebook_cover', category: 'Social Media', label: 'Facebook Event Cover', prompt: 'Wide horizontal 16:9, energetic and inviting, event or promotion feel, no text' },
  { id: 'product_hero', category: 'Product', label: 'Clean Product Hero', prompt: 'Isolated product on clean background, professional studio lighting, sharp detail, no text' },
  { id: 'product_in_use', category: 'Product', label: 'Product In Use', prompt: 'Person naturally using or holding the product, candid and authentic, shallow depth of field, no text' },
  { id: 'product_flatlay', category: 'Product', label: 'Product Flat Lay', prompt: 'Overhead top-down arrangement, product with complementary props on a clean surface, editorial composition, no text' },
  { id: 'product_apparel', category: 'Product', label: 'Apparel / Wearable on Model', prompt: 'Clothing or accessory worn by a model, full or half body, clean background, no text' },
  { id: 'product_shoe_bag', category: 'Product', label: 'Shoe / Bag Hero', prompt: 'Single accessory product shot, side or three-quarter angle, surface with texture, dramatic lighting, no text' },
  { id: 'sale_promo', category: 'Campaign', label: 'Sale / Promo', prompt: 'Bold high-energy composition, product as hero, generous negative space for text overlay, no text' },
  { id: 'seasonal', category: 'Campaign', label: 'Seasonal / Holiday', prompt: 'Product in a seasonal setting with contextual atmosphere and props, warm and editorial, no text' },
  { id: 'new_arrival', category: 'Campaign', label: 'New Arrival / Launch', prompt: 'Product as absolute hero, clean elevated composition, sense of newness and premium quality, no text' },
  { id: 'behind_scenes', category: 'Brand Storytelling', label: 'Behind the Scenes', prompt: 'Hands at work, craft or process visible, documentary feel, authentic and human, no text' },
  { id: 'lifestyle_aspirational', category: 'Brand Storytelling', label: 'Lifestyle / Aspirational', prompt: 'Atmosphere and feeling over literal product, editorial and evocative, no hard product focus, no text' },
  { id: 'customer_moment', category: 'Brand Storytelling', label: 'Customer Moment', prompt: 'Candid scene of a happy customer enjoying the product, warm and relatable, genuine and human, no text' },
];

interface BrandingMod {
  id: string;
  label: string;
  onLabel: string;
  offLabel: string | null;
  onTag: string;
  offTag: string | null;
  defaultOn: boolean;
}

type BrandingModState = Record<string, { enabled: boolean; value: boolean }>;

const BRANDING_MODS: BrandingMod[] = [
  { id: 'logo',        label: 'Logo',          onLabel: 'Logo visible',    offLabel: 'No logo',          onTag: 'logo accurately rendered and visible',        offTag: 'no logo',                     defaultOn: false },
  { id: 'text',        label: 'Text',          onLabel: 'With text',       offLabel: 'No text',          onTag: 'brand name as text element in composition',   offTag: 'no text',                     defaultOn: false },
  { id: 'brandColors', label: 'Brand palette', onLabel: 'Brand palette',   offLabel: 'Neutral palette',  onTag: 'brand colors dominant throughout scene',      offTag: 'neutral muted color palette', defaultOn: true  },
  { id: 'person',      label: 'Person',        onLabel: 'With person',     offLabel: 'No people',        onTag: 'person in scene',                            offTag: 'no people in frame',          defaultOn: false },
  { id: 'face',        label: 'Face',          onLabel: 'Face visible',    offLabel: 'Face hidden',      onTag: 'face clearly visible',                        offTag: 'no face visible, hands or back only', defaultOn: false },
  { id: 'copySpace',   label: 'Copy space',    onLabel: 'Space for copy',  offLabel: null,               onTag: 'generous negative space for text overlay',    offTag: null,                          defaultOn: false },
  { id: 'lifestyle',   label: 'Atmosphere',    onLabel: 'Lifestyle feel',  offLabel: 'Studio clean',     onTag: 'lifestyle atmosphere and context',            offTag: 'clean studio, minimal context', defaultOn: false },
];

function getDefaultBrandingMods(): BrandingModState {
  return Object.fromEntries(
    BRANDING_MODS.map(m => [m.id, { enabled: false, value: m.defaultOn }])
  ) as BrandingModState;
}

function buildPromptWithMods(base: string, mods: BrandingModState): string {
  const tags: string[] = [];
  for (const m of BRANDING_MODS) {
    const state = mods[m.id];
    if (!state?.enabled) continue;
    const tag = state.value ? m.onTag : m.offTag;
    if (tag) tags.push(tag);
  }
  return tags.length
    ? `${base}. Brand modifier guidance, apply only where compatible with the selected preset: ${tags.join('; ')}.`
    : base;
}

const GALLERY_IMAGES = [
  'Pg48FMPgTI-rmB9PLU4gKg@2k.webp',
  '08DgRDZTTfelVI63jQ84Og@2k.webp',
  'kM7cBDitTXeotDShQ8Ke4g@2k.webp',
  '69ghV_qZS--imXfFajkfWA@2k.webp',
  '7IbT6WXHRGmcWSjyZNHu0Q@2k.webp',
  '1FZLuZZkQtev5AqXouKbDg@2k.webp',
  '6OHyayxwRmOTtNB7g2EQMA@2k.webp',
  'HOjVXOx2SxS1FapmLEK6HA@2k.webp',
  'BLqzshvMQyyNEf96FetToA@2k.webp',
  'KWwMri4MQA-z9BrmksPemw@2k.webp',
  'o9L3elcnTdmKYXMeQF21zg@2k.webp',
  'y98zCiIpRMG8ehisdg4uUQ@2k.webp',
  'Uo1KvPSWRO2uiaJMaA4ygA@2k.webp',
  'nh06s92-SGqj9yPGwj6Qhw@2k.webp',
  '2KztG_IxT5iK97JvP-T9wA@2k.webp',
  'DnACmo47QX6LnSLBMjIGMw@2k.webp',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Resize + re-encode to JPEG before storing — keeps base64 payloads small
// enough to fit within Vercel's 4.5 MB serverless body limit.
// maxPx: longest edge in pixels. quality: JPEG 0–1.
function resizeImage(file: File, maxPx = 512, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

// Extract vivid dominant colors from a dataURL.
// Filters out grays and near-white/black. Weights vivid colors higher
// so brand accent colors beat JPEG-artifact grays in the ranking.
function extractDominantColors(dataURL: string, count = 10): Promise<string[]> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const size = 150;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const d = ctx.getImageData(0, 0, size, size).data;
      const freq: Record<string, number> = {};

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a < 128) continue;                         // transparent
        if (r > 235 && g > 235 && b > 235) continue;  // near-white
        if (r < 20  && g < 20  && b < 20)  continue;  // near-black

        const cmax = Math.max(r, g, b);
        const cmin = Math.min(r, g, b);
        const sat = cmax - cmin;                        // 0=gray, 255=vivid
        if (sat < 30) continue;                        // skip grays entirely

        // Finer quantization for vivid colors so they don't merge
        const step = sat > 80 ? 20 : 32;
        const rq = Math.round(r / step) * step;
        const gq = Math.round(g / step) * step;
        const bq = Math.round(b / step) * step;
        const k = `${rq},${gq},${bq}`;
        // Weight by saturation: vivid colors count 2-4x more
        freq[k] = (freq[k] ?? 0) + 1 + Math.floor(sat / 40);
      }

      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      const colors = sorted.slice(0, count).map(([k]) => {
        const [r, g, b] = k.split(',').map(Number);
        return '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
      });
      resolve(colors.length ? colors : []);
    };
    img.onerror = () => resolve([]);
    img.src = dataURL;
  });
}

function dataURLtoBase64(dataURL: string) {
  const [header, data] = dataURL.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  return { data, mimeType };
}

function createGenerationTrace(
  prompt: string,
  brand: Brand | null,
  refs: AttachedImage[],
  mode: GenerationTrace['mode'] = 'generate',
  status: GenerationTrace['status'] = 'generating',
): GenerationTrace {
  return {
    status,
    mode,
    prompt,
    brandName: brand?.name,
    hasLogo: !!brand?.logoImage,
    palette: brand?.palette ?? [],
    tone: brand?.voice,
    referenceCount: refs.length,
    referenceNames: refs.map(ref => ref.name),
    modelName: 'Gemini Flash Image',
  };
}

function formatDebugMarkdown(
  prompt: string,
  brand: Brand | null,
  refs: AttachedImage[],
  debug: {
    fullPrompt?: string;
    modelCandidates?: string[];
    selectedModels?: string[];
    assetManifest?: Array<{ role: string; mimeType: string; bytesApprox: number }>;
    partLabels?: string[];
  } | undefined,
  error?: string,
) {
  const selectedModels = debug?.selectedModels?.length ? debug.selectedModels : ['not returned yet'];
  const modelCandidates = debug?.modelCandidates ?? ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];
  const assetRows = [
    ...(brand?.logoImage ? [`- Brand logo: attached from Brand DNA`] : ['- Brand logo: none']),
    ...refs.map((ref, i) => `- Reference ${i + 1}: ${ref.name} (${ref.mimeType})`),
    ...(debug?.assetManifest ?? []).map(asset => `- Sent file: ${asset.role}, ${asset.mimeType}, ~${asset.bytesApprox} bytes`),
  ];

  return [
    '# generation-debug.md',
    '',
    '## Status',
    error ? `- Error: ${error}` : '- Result: generation request completed',
    `- Selected model(s): ${selectedModels.join(', ')}`,
    `- Model fallback order: ${modelCandidates.join(' -> ')}`,
    '',
    '## User Prompt',
    '```text',
    prompt,
    '```',
    '',
    '## Brand DNA Input',
    `- Brand: ${brand?.name ?? 'none'}`,
    `- Logo attached: ${brand?.logoImage ? 'yes' : 'no'}`,
    `- Tone / voice: ${brand?.voice || 'not specified'}`,
    `- Palette: ${brand?.palette?.join(', ') || 'not specified'}`,
    '',
    '## Files / Image Parts',
    ...assetRows,
    '',
    '## API Part Labels',
    ...(debug?.partLabels?.length ? debug.partLabels.map(label => `- ${label}`) : ['- not returned']),
    '',
    '## Actual Prompt Sent To Model',
    '```text',
    debug?.fullPrompt ?? 'Prompt was not returned by the API.',
    '```',
  ].join('\n');
}

function useLocalStorage<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage }: {
  page: string; setPage: (p: string) => void;
}) {
  const item = (id: string, icon: string, label: string, badge?: string) => (
    <button key={id} className={`sb-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
      <Icon name={icon} size={15}/><span>{label}</span>
      {badge && <span className="badge">{badge}</span>}
    </button>
  );
  return (
    <aside className="sb">
      <div className="sb-brand">
        <img className="sb-logo" src="/ideogram-logo.png" alt="Ideogram" />
        <div className="sb-name">ideogram</div>
      </div>
      {item('explore','explore','Explore')}
      {item('batch','grid','Batch')}
      <div className="sb-section">Library</div>
      {item('images','image2','My images')}
      {item('collections','folder','Collections')}
      {item('likes','heart','My likes')}
      <div className="sb-section">Elements</div>
      {item('models','cube','Models')}
      {item('styles','layers','Styles')}
      {item('brands','dna','Brand DNA','New')}
      {item('characters','user','Characters')}
      <div className="sb-foot">
        <button className="sb-user">
          <div className="sb-avatar">M</div>
          <div><div className="sb-user-name">Mary</div><div className="sb-user-plan">Plus plan</div></div>
        </button>
      </div>
    </aside>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({ value, setValue, onSend, brand, setActiveBrand, activePreset, setPreset,
  openCreateBrand, brands, attached, setAttached, compact = false, hideBrandPicker = false }: {
  value: string; setValue: (v: string) => void; onSend: (prompt: string) => void;
  brand: Brand | null; setActiveBrand: (id: string | null) => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void; brands: Brand[];
  attached: AttachedImage[]; setAttached: React.Dispatch<React.SetStateAction<AttachedImage[]>>;
  compact?: boolean; hideBrandPicker?: boolean;
}) {
  const [popOpen, setPopOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mods, setMods] = useState<BrandingModState>(getDefaultBrandingMods);
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const activeMods = BRANDING_MODS.filter(m => mods[m.id]?.enabled).length;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPopOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 260) + 'px';
  }, [value]);

  const addReferenceFiles = async (incoming: File[]) => {
    const imageFiles = incoming.filter(file => file.type.startsWith('image/'));
    const files = imageFiles.slice(0, Math.max(0, 5 - attached.length));
    if (!files.length) return;
    const refs = await Promise.all(files.map(async file => ({
      dataURL: await resizeImage(file, 512, 0.75),
      mimeType: 'image/jpeg',
      name: file.name,
    })));
    setAttached(prev => [...prev, ...refs].slice(0, 5));
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addReferenceFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    await addReferenceFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleSend = () => {
    if (!value.trim() && attached.length === 0) return;
    const base = value.trim() || 'Generate an on-brand image';
    onSend(buildPromptWithMods(base, mods));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div
      className={`composer ${compact ? 'compact' : ''} ${dragActive ? 'drag-active' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {dragActive && <div className="composer-drop-hint">Drop images to add references</div>}
      {attached.length > 0 && (
        <div className="composer-refs">
          {attached.map((img, idx) => (
            <div key={`${img.name}-${idx}`} className="composer-ref">
              <img src={img.dataURL} alt="" />
              <button
                onClick={() => setAttached(prev => prev.filter((_, i) => i !== idx))}
                aria-label="Remove reference image"
              >
                <Icon name="x" size={9}/>
              </button>
            </div>
          ))}
          <span className="composer-ref-count">{attached.length}/5 refs</span>
        </div>
      )}
      <textarea
        ref={taRef}
        placeholder="Describe an image — your Brand DNA will be applied automatically…"
        value={value} onChange={e=>setValue(e.target.value)} onKeyDown={handleKey}
        rows={1}
        onInput={e=>{const t=e.target as HTMLTextAreaElement;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,260)+'px';}}
      />
      <div className="composer-tools">
        {/* References */}
        <button className="tool-pill" onClick={()=>fileRef.current?.click()} title="Attach up to 5 campaign reference images">
          <Icon name="paperclip" size={12}/>{attached.length > 0 && <span className="tool-pill-badge">{attached.length}</span>}
        </button>
        <input ref={fileRef} type="file" className="upload-input" accept="image/*" multiple onChange={handleAttach}/>

        {/* Brand DNA picker */}
        {!hideBrandPicker && <div style={{position:'relative'}} ref={popRef}>
          <button className={`tool-pill ${brand ? 'active' : 'brand-empty'}`} onClick={()=>setPopOpen(o=>!o)}>
            {brand
              ? <><span className="swatch" style={{background:brand.palette[1]}}/>{brand.name.split(' ')[0]} DNA</>
              : <><Icon name="plus" size={11}/> Add Brand DNA</>}
            <Icon name="chevD" size={10}/>
          </button>
          {popOpen && (
            <div className="brand-pop" style={compact ? {bottom:'calc(100% + 6px)',left:0} : {top:'calc(100% + 6px)',left:0}}>
              <button className="brand-pop-create" onClick={()=>{openCreateBrand();setPopOpen(false);}}>
                <span className="create-icon"><Icon name="plus" size={13}/></span>
                <span>
                  <span className="create-title">Create new Brand DNA</span>
                  <span className="create-sub">Upload logo, colors, and voice</span>
                </span>
              </button>
              <div className="brand-pop-h">Popular Brand DNA</div>
              {brands.map(b=>(
                <div key={b.id} className={`brand-pop-row ${brand?.id===b.id?'active':''}`}
                  onClick={()=>{setActiveBrand(b.id);setPopOpen(false);}}>
                  <span className="pop-pal">{b.palette.slice(0,4).map((c,i)=><span key={i} style={{background:c}}/>)}</span>
                  <span className="nm">{b.name}</span>
                  {brand?.id===b.id && <Icon name="check" size={13}/>}
                </div>
              ))}
              <hr/>
              <div className={`brand-pop-row ${!brand?'active':''}`} onClick={()=>{setActiveBrand(null);setPopOpen(false);}}>
                <span className="pop-pal" style={{background:'var(--bg-3)',borderRadius:4}}/>
                <span className="nm" style={{color:'var(--text-3)'}}>No Brand DNA</span>
                {!brand && <Icon name="check" size={13}/>}
              </div>
            </div>
          )}
        </div>}

        {/* Fake display pills */}
        {!compact && <>
          <span className="tool-pill-display"><Icon name="sparkle" size={10}/> 3.0</span>
          <span className="tool-pill-display"><Icon name="image2" size={10}/> 2</span>
          <span className="tool-pill-display"><Icon name="ratio" size={10}/> 1:1</span>
        </>}

        {/* More settings */}
        <div style={{position:'relative'}} ref={settingsRef}>
          <button className={`tool-pill ${settingsOpen || activeMods > 0 ? 'active' : ''}`}
            onClick={() => setSettingsOpen(o => !o)} title="Branding settings">
            <Icon name="sliders" size={11}/>
            {activeMods > 0 && <span className="tool-pill-badge">{activeMods}</span>}
          </button>
          {settingsOpen && (
            <div className="composer-settings">
              <div className="cs-head">
                <span>Branding settings</span>
                <button className="cs-reset" onClick={() => setMods(getDefaultBrandingMods())}>Reset</button>
              </div>
              {BRANDING_MODS.map(m => {
                const state = mods[m.id] ?? { enabled: false, value: m.defaultOn };
                return (
                  <div key={m.id} className={`cs-row ${state.enabled ? 'enabled' : ''}`}>
                    <div className="cs-row-main">
                      <span className="cs-row-label">{m.label}</span>
                      <button
                        className={`cs-enable ${state.enabled ? 'active' : ''}`}
                        onClick={() => setMods(p => ({
                          ...p,
                          [m.id]: { ...(p[m.id] ?? { value: m.defaultOn }), enabled: !(p[m.id]?.enabled ?? false) },
                        }))}
                      >
                        {state.enabled ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                    <div className={`cs-row-btns ${state.enabled ? '' : 'disabled'}`}>
                      <button className={`cs-opt ${state.value ? 'active' : ''}`}
                        disabled={!state.enabled}
                        onClick={() => setMods(p => ({...p, [m.id]: { enabled: true, value: true }}))}>
                        {m.onLabel}
                      </button>
                      <button className={`cs-opt ${!state.value ? 'active' : ''}`}
                        disabled={!state.enabled}
                        onClick={() => setMods(p => ({...p, [m.id]: { enabled: true, value: false }}))}>
                        {m.offLabel ?? 'Off'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="spacer"/>
        <button className="send-btn" onClick={handleSend} disabled={!value.trim() && attached.length === 0}>
          <Icon name="arrowU" size={14} stroke={2.2}/>
        </button>
      </div>
    </div>
  );
}

// ── Explore gallery ───────────────────────────────────────────────────────────

function ExploreGallery() {
  return (
    <div style={{marginTop:32}}>
      <div className="sec-head" style={{marginTop:0,marginBottom:14}}>
        <h2>Explore <em>creations</em></h2>
      </div>
      <div className="explore-gallery-grid">
        {GALLERY_IMAGES.map((name, i)=>(
          <div key={name} className="gallery-image"
            onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.02)')}
            onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
          >
            <img src={`/ideogram/${name}`} alt={`Explore creation ${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Refine questionnaire ──────────────────────────────────────────────────────

const REFINE_Q1 = ['Colors off','Lighting / mood','Logo wrong','Composition','Style','Quality'];
const REFINE_Q2 = ['More contrast','Darker','Brighter','Warmer','Cooler','Different angle','More minimal','More dramatic'];
const REFINE_Q3 = ['Background','Subject','Logo','Color grade','Atmosphere','Textures'];

function RefineForm({ onSubmit, onCancel }: {
  onSubmit: (state: RefineState) => void;
  onCancel: () => void;
}) {
  const [q1, setQ1] = useState<string[]>([]);
  const [q2, setQ2] = useState<string[]>([]);
  const [q3, setQ3] = useState<string[]>([]);
  const [q4, setQ4] = useState('');

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const chips = (opts: string[], sel: string[], set: (v: string[]) => void) => (
    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:7}}>
      {opts.map(o => (
        <button key={o} onClick={() => toggle(sel, o, set)}
          style={{padding:'6px 14px',borderRadius:100,fontSize:12,border:'1px solid',cursor:'pointer',transition:'all 0.12s',fontWeight:500,
            borderColor: sel.includes(o) ? 'var(--accent)' : 'var(--line)',
            background: sel.includes(o) ? 'var(--accent-soft)' : 'var(--bg-2)',
            color: sel.includes(o) ? 'var(--accent-text)' : 'var(--text-2)'}}>
          {o}
        </button>
      ))}
    </div>
  );

  const row = (label: string, content: React.ReactNode, delay: number) => (
    <div style={{animation:`fadeSlideUp 0.22s ease ${delay}s both`}}>
      <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,letterSpacing:'0.04em',textTransform:'uppercase'}}>{label}</div>
      {content}
    </div>
  );

  return (
    <div style={{marginTop:10,padding:'14px 16px',background:'var(--bg-1)',border:'1px solid var(--line)',borderRadius:12,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',animation:'fadeSlideUp 0.18s ease both'}}>
        <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)'}}>What to fix?</span>
        <button onClick={onCancel} style={{color:'var(--text-3)',display:'flex'}}><Icon name="x" size={12}/></button>
      </div>
      {row('Issue', chips(REFINE_Q1, q1, setQ1), 0.04)}
      {row('Change', chips(REFINE_Q2, q2, setQ2), 0.08)}
      {row('Focus on', chips(REFINE_Q3, q3, setQ3), 0.12)}
      <div style={{animation:`fadeSlideUp 0.22s ease 0.16s both`}}>
        <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,letterSpacing:'0.04em',textTransform:'uppercase',marginBottom:7}}>Notes <span style={{fontWeight:400,textTransform:'none',letterSpacing:'normal'}}>(optional)</span></div>
        <textarea value={q4} onChange={e=>setQ4(e.target.value)}
          placeholder="e.g. warmer tones, logo larger, darker background…"
          style={{width:'100%',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:8,padding:'8px 10px',fontSize:12,color:'var(--text-1)',resize:'none',lineHeight:1.5,boxSizing:'border-box'}}
          rows={2}/>
      </div>
      <div style={{display:'flex',gap:6,justifyContent:'flex-end',animation:`fadeSlideUp 0.22s ease 0.2s both`}}>
        <button className="btn btn-ghost" style={{fontSize:12,padding:'7px 14px'}} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" style={{fontSize:12,padding:'7px 16px'}}
          onClick={() => onSubmit({ q1, q2, q3, q4 })}
          disabled={!q1.length && !q2.length && !q3.length && !q4.trim()}>
          Generate refined →
        </button>
      </div>
    </div>
  );
}

function GenerationTraceCard({ trace, error, onDebug }: {
  trace: GenerationTrace;
  error?: string;
  onDebug: (trace: GenerationTrace) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const modeLabel = trace.mode === 'refine' ? 'Refinement run' : trace.mode === 'regenerate' ? 'Regeneration run' : 'Generation run';
  const statusLabel = trace.status === 'generating' ? 'Generating' : trace.status === 'error' ? 'Needs attention' : 'Completed';
  const palette = trace.palette.slice(0, 5);
  const steps = [
    { label: 'Prompt', value: trace.prompt },
    { label: 'Brand', value: trace.brandName ?? 'No Brand DNA selected' },
    { label: 'Logo', value: trace.hasLogo ? 'Official logo attached and prioritized' : 'No logo attached' },
    { label: 'Tone', value: trace.tone?.trim() || 'Infer tone from references and prompt' },
    { label: 'References', value: trace.referenceCount ? `${trace.referenceCount} campaign reference${trace.referenceCount === 1 ? '' : 's'} attached` : 'No references attached' },
    { label: 'Priority', value: 'Brand DNA -> reference DNA -> user prompt scene -> quality pass' },
  ];

  return (
    <div className={`trace-card ${trace.status}`}>
      <div className="trace-top">
        <button className="trace-summary" onClick={() => setExpanded(v => !v)}>
          <div className="trace-eyebrow">{modeLabel}</div>
          <div className="trace-title">{statusLabel}</div>
        </button>
        <button
          className="trace-debug"
          onClick={() => onDebug(trace)}
          disabled={!trace.debugMarkdown}
          title="Open internal prompt/debug markdown"
        >
          debug.md
        </button>
        <span className="trace-status-dot"/>
      </div>
      <div className="trace-compact">
        <span>{trace.brandName ?? 'No brand'}</span>
        <span>{trace.hasLogo ? 'logo' : 'no logo'}</span>
        <span>{trace.referenceCount} refs</span>
        <span>{trace.modelName}</span>
      </div>
      {expanded && (
        <div className="trace-list">
          {steps.map(step => (
            <div key={step.label} className="trace-step">
              <div className="trace-step-label">{step.label}</div>
              <div className="trace-step-value">{step.value}</div>
            </div>
          ))}
        </div>
      )}
      {palette.length > 0 && (
        <div className="trace-palette">
          {palette.map((color, i) => <span key={`${color}-${i}`} style={{background: color}}/>)}
        </div>
      )}
      {expanded && trace.referenceNames.length > 0 && (
        <div className="trace-ref-names">
          {trace.referenceNames.slice(0, 3).map(name => <span key={name}>{name}</span>)}
          {trace.referenceNames.length > 3 && <span>+{trace.referenceNames.length - 3} more</span>}
        </div>
      )}
      {error && <div className="trace-error">{error}</div>}
    </div>
  );
}

// ── Explore active — right results panel ──────────────────────────────────────

function DebugMarkdownCanvas({ doc, onClose }: { doc: DebugDocState; onClose: () => void }) {
  return (
    <div className="debug-canvas">
      <div className="debug-head">
        <div>
          <div className="debug-kicker">Internal debug</div>
          <h2>{doc.title}</h2>
        </div>
        <button className="btn btn-ghost" onClick={onClose}><Icon name="x" size={13}/> Close</button>
      </div>
      <pre className="debug-markdown">{doc.markdown}</pre>
    </div>
  );
}

function ExploreResults({ stream, onRegenerate, onRefine, onOpenDetail, debugDoc, setDebugDoc }: {
  stream: StreamMessage[];
  onRegenerate: (msg: StreamMessage) => void;
  onRefine: (msg: StreamMessage, state: RefineState) => void;
  onOpenDetail: (msg: StreamMessage, imgIdx: number) => void;
  debugDoc: DebugDocState | null;
  setDebugDoc: (doc: DebugDocState | null) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  // Track which block is in "refine mode" — keyed by stream index
  const [refining, setRefining] = useState<number | null>(null);

  useEffect(() => {
    if (canvasRef.current) canvasRef.current.scrollTop = canvasRef.current.scrollHeight;
  }, [stream]);

  const asstMsgs = stream.map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'asst');

  if (debugDoc) return <DebugMarkdownCanvas doc={debugDoc} onClose={() => setDebugDoc(null)}/>;

  return (
    <div ref={canvasRef} className="gen-canvas">
      {asstMsgs.length === 0 && (
        <div className="canvas-empty">
          <div style={{textAlign:'center'}}>
            <div className="icon-circle"><Icon name="image" size={22}/></div>
            <div>Your generations will appear here.</div>
          </div>
        </div>
      )}
      {asstMsgs.map(({ m, i }) => (
        <div key={i} className="gen-block">
          <div className="gen-block-h">
            <div className="prompt">{m.loading ? '…' : m.prompt}</div>
            <div className="ts">just now</div>
          </div>
          {/* 2 image tiles */}
          <div className="gen-tiles">
            {m.loading
              ? [0,1].map(j=><div key={j} className="tile shimmer"/>)
              : m.error
                ? <div className="tile tile-error"><Icon name="image" size={20}/><span>{m.error}</span></div>
                : (m.images ?? []).slice(0,2).map((src,j)=>(
                    <div key={j} className="tile" onClick={()=>onOpenDetail(m,j)}>
                      <img src={src} alt="" className="tile-img"/>
                      <div className="tile-actions">
                        <a href={src} download={`gen-${i}-${j}.png`} className="tile-act" onClick={e=>e.stopPropagation()}>
                          <Icon name="download" size={12}/>
                        </a>
                        <div className="tile-act"><Icon name="expand" size={12}/></div>
                      </div>
                    </div>
                  ))
            }
          </div>
          {/* Actions / Refine questionnaire */}
          {!m.loading && !m.error && (
            refining === i
              ? <RefineForm
                  onSubmit={state => { setRefining(null); onRefine(m, state); }}
                  onCancel={() => setRefining(null)}
                />
              : <div style={{display:'flex',gap:6,marginTop:10}}>
                  <button className="action-pill" onClick={()=>onRegenerate(m)}>Regenerate</button>
                  <button className="action-pill" onClick={()=>setRefining(i)}>Refine</button>
                </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Prompt section (inline, replaces gallery) ────────────────────────────────

function PromptSection({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <div style={{marginTop: 32, animation: 'fadeSlideUp 0.22s ease both'}}>
      {PRESET_CATEGORIES.map(cat => {
        const items = PROMPT_SUGGESTIONS.filter(s => s.category === cat);
        return (
          <div key={cat} className="ps-category">
            <div className="ps-cat-head">
              <span className="ps-cat-name">{cat}</span>
              <div className="ps-cat-line"/>
              <span className="ps-cat-count">{items.length}</span>
            </div>
            <div className="ps-grid">
              {items.map(s => (
                <button key={s.id} className="ps-card" onClick={() => onSelect(s.prompt)}>
                  <p className="ps-text">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Explore page ──────────────────────────────────────────────────────────────

function ExplorePage({ brand, brands, activeBrand, setActiveBrand, prompt, setPrompt, onSend,
  activePreset, setPreset, openCreateBrand, stream, onRegenerate, onRefine,
  onOpenDetail, attached, setAttached, onReset, debugDoc, setDebugDoc }: {
  brand: Brand | null; brands: Brand[]; activeBrand: string | null;
  setActiveBrand: (id: string | null) => void;
  prompt: string; setPrompt: (v: string) => void; onSend: (prompt: string) => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void;
  stream: StreamMessage[];
  onRegenerate: (msg: StreamMessage) => void;
  onRefine: (msg: StreamMessage, state: RefineState) => void;
  onOpenDetail: (msg: StreamMessage, imgIdx: number) => void;
  attached: AttachedImage[]; setAttached: React.Dispatch<React.SetStateAction<AttachedImage[]>>;
  onReset: () => void;
  debugDoc: DebugDocState | null;
  setDebugDoc: (doc: DebugDocState | null) => void;
}) {
  const active = stream.length > 0;
  const [showGallery, setShowGallery] = useState(false);

  if (active) {
    // Split layout: left chat + right results
    return (
      <div className="gen">
        {/* Left: prompt history + composer */}
        <div className="gen-chat">
          <div className="chat-head">
            <button onClick={onReset} style={{display:'flex',alignItems:'center',gap:5,color:'var(--text-3)',fontSize:12,padding:'3px 6px',borderRadius:6,transition:'color 0.12s'}}
              onMouseEnter={e=>(e.currentTarget.style.color='var(--text-1)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-3)')}>
              <Icon name="chevL" size={13}/> New
            </button>
            <Icon name="sparkle" size={14}/>
            <div className="chat-head-title">Generation</div>
            <div style={{flex:1}}/>
          </div>
          <div className="chat-stream">
            <div className="trace-intro">
              <div className="trace-intro-title">Brand decision log</div>
              <div className="trace-intro-copy">Each run shows the actual priority stack used before image generation.</div>
            </div>
            {stream.filter(m => m.role === 'asst' && m.trace).map((m, i) => (
              <GenerationTraceCard
                key={i}
                trace={m.trace!}
                error={m.error}
                onDebug={trace => trace.debugMarkdown && setDebugDoc({ title: 'generation-debug.md', markdown: trace.debugMarkdown })}
              />
            ))}
          </div>
          <div className="composer-foot">
            <div className="composer-brand-strip">
              {brand ? (
                <div className="composer-brand-chip">
                  <span className="pop-pal">{brand.palette.slice(0,4).map((c,i)=><span key={i} style={{background:c}}/>)}</span>
                  <span>{brand.name} DNA</span>
                </div>
              ) : (
                <button className="composer-brand-chip empty" onClick={openCreateBrand}>
                  <Icon name="plus" size={11}/>
                  <span>Add Brand DNA</span>
                </button>
              )}
            </div>
            <Composer value={prompt} setValue={setPrompt} onSend={onSend}
              brand={brand} setActiveBrand={setActiveBrand} brands={brands}
              activePreset={activePreset} setPreset={setPreset}
              openCreateBrand={openCreateBrand} attached={attached} setAttached={setAttached} compact hideBrandPicker/>
          </div>
        </div>

        {/* Right: results */}
        <ExploreResults stream={stream} onRegenerate={onRegenerate} onRefine={onRefine}
          onOpenDetail={onOpenDetail} debugDoc={debugDoc} setDebugDoc={setDebugDoc}/>
      </div>
    );
  }

  // Idle: hero + composer + chips + flippable bottom section
  return (
    <div className="explore">
      <h1 className="hero-title">
        <span className="hero-kicker">What will you create</span>
        <em>on-brand</em> today?
      </h1>
      <Composer value={prompt} setValue={setPrompt} onSend={onSend}
        brand={brand} setActiveBrand={setActiveBrand} brands={brands}
        activePreset={activePreset} setPreset={setPreset}
        openCreateBrand={openCreateBrand} attached={attached} setAttached={setAttached}/>
      <div className="prompt-chips">
        {PRESET_CATEGORIES.slice(0, 3).map(cat => {
          const s = PROMPT_SUGGESTIONS.find(p => p.category === cat)!;
          return (
            <button key={cat} className="prompt-chip" onClick={() => setPrompt(s.prompt)}>
              <span className="chip-cat">{cat}</span>
              <span className="chip-text">{s.prompt.length > 38 ? s.prompt.slice(0, 36) + '…' : s.prompt}</span>
            </button>
          );
        })}
        <button className="prompt-chip prompt-chip-more" onClick={() => setShowGallery(v => !v)}>
          {showGallery ? '← Gallery' : 'All presets →'}
        </button>
      </div>
      {showGallery
        ? <PromptSection onSelect={p => setPrompt(p)}/>
        : <ExploreGallery/>
      }
    </div>
  );
}

// ── Brands page ───────────────────────────────────────────────────────────────

function BrandsPage({ brands, activeBrand, setActiveBrand, onCreate, onEdit }: {
  brands: Brand[]; activeBrand: string | null; setActiveBrand: (id: string | null) => void;
  onCreate: () => void; onEdit: (b: Brand) => void;
}) {
  return (
    <>
      <div className="page-head">
        <h1 className="page-h1">My <em>Brand DNA</em></h1>
        <p className="page-sub">Pick a brand to apply it to every generation.</p>
      </div>
      <div className="page-content">
        {/* Compact mini-card grid */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10}}>
          {brands.map(b => {
            const isActive = activeBrand === b.id;
            return (
              <div key={b.id}
                onClick={() => setActiveBrand(isActive ? null : b.id)}
                style={{
                  background: isActive ? 'var(--accent-soft)' : 'var(--bg-1)',
                  border:`1px solid ${isActive?'var(--accent)':'var(--line)'}`,
                  borderRadius:12, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s',
                }}>
                {/* Palette bar */}
                <div style={{height:5, borderRadius:100, overflow:'hidden', display:'flex', marginBottom:10}}>
                  {b.palette.map((c,i) => <span key={i} style={{flex:1, background:c}}/>)}
                </div>
                {/* Name row */}
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6}}>
                  <div>
                    <div style={{fontSize:13, fontWeight:500, color:'var(--text-1)', display:'flex', alignItems:'center', gap:5}}>
                      {isActive && <Icon name="check" size={11}/>}
                      {b.name}
                    </div>
                    {b.voice && <div style={{fontSize:11, color:'var(--text-3)', marginTop:2, lineHeight:1.3}}>{b.voice}</div>}
                  </div>
                  <button className="btn-icon" style={{flexShrink:0}}
                    onClick={e=>{e.stopPropagation(); onEdit(b);}}>
                    <Icon name="edit" size={12}/>
                  </button>
                </div>
              </div>
            );
          })}
          {/* Add new */}
          <button onClick={onCreate}
            style={{background:'transparent', border:'1.5px dashed var(--line-2)', borderRadius:12,
              padding:'12px 14px', cursor:'pointer', transition:'all 0.15s',
              display:'flex', alignItems:'center', gap:8, color:'var(--text-3)', minHeight:72}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';(e.currentTarget as HTMLElement).style.color='var(--accent-text)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--line-2)';(e.currentTarget as HTMLElement).style.color='var(--text-3)';}}>
            <Icon name="plus" size={16}/>
            <span style={{fontSize:12, fontWeight:500}}>New brand</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ── Brand DNA Editor ──────────────────────────────────────────────────────────

function BrandEditor({ brand: init, onBack, onSave }: {
  brand: Brand | null; onBack: () => void; onSave: (b: Brand) => void;
}) {
  const [name, setName] = useState(init?.name ?? '');
  const [voice, setVoice] = useState(init?.voice ?? '');
  // candidates: all detected colors from images; palette: user-selected subset
  const [candidates, setCandidates] = useState<string[]>([]);
  const [palette, setPalette] = useState<string[]>(init?.palette ?? []);
  const [logoImage, setLogoImage] = useState<string|undefined>(init?.logoImage);
  const [logoText, setLogoText] = useState(init?.logoText ?? '');
  const [detecting, setDetecting] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const customColorRef = useRef<HTMLInputElement>(null);

  const refreshCandidates = useCallback(async (logo: string | undefined) => {
    setDetecting(true);
    const seen = new Set<string>();
    const push = (cols: string[], out: string[]) => {
      for (const c of cols) { if (!seen.has(c)) { seen.add(c); out.push(c); } }
    };
    const all: string[] = [];
    if (logo) push(await extractDominantColors(logo, 10), all);
    const final = all.slice(0, 14);
    setCandidates(final);
    // Auto-select top 5 if user hasn't curated yet
    setPalette(prev => prev.length ? prev.filter(c => final.includes(c)) : final.slice(0, 5));
    setDetecting(false);
  }, []);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const d = await resizeImage(f, 800, 0.85);
    setLogoImage(d);
    if (!logoText) setLogoText(f.name.replace(/\.[^.]+$/, ''));
    await refreshCandidates(d);
  };

  const toggleColor = (c: string) => {
    setPalette(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addCustomColor = (hex: string) => {
    if (!palette.includes(hex)) setPalette(prev => [...prev, hex]);
    if (!candidates.includes(hex)) setCandidates(prev => [...prev, hex]);
  };

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: init?.id ?? Math.random().toString(36).slice(2),
      name: name.trim(), logoText: logoText || name.split(' ')[0], logoImage,
      palette, voice: voice.trim(), edited: 'just now',
      keywords: [], samples: init?.samples ?? ['grad-1', 'grad-3', 'grad-9'],
    });
  };

  // Build preview gradient from palette
  const previewGradient = palette.length >= 2
    ? `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 60%, ${palette[2] ?? palette[0]} 100%)`
    : palette.length === 1 ? palette[0] : undefined;

  return (
    <>
      <div className="page-head" style={{paddingBottom:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <button className="btn-bare" onClick={onBack}><Icon name="chevL" size={16}/></button>
          <span style={{fontSize:12,color:'var(--text-3)'}}>Brand DNA / {init ? 'Edit' : 'Create'}</span>
        </div>
        <h1 className="page-h1" style={{fontSize:24,marginBottom:4}}>{init ? <>Edit <em>{init.name}</em></> : <>New <em>Brand DNA</em></>}</h1>
      </div>
      <div className="page-content">
        <div className="editor">
          <div className="editor-main">

            {/* 1 — Brand basics */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">1</span> Brand basics</div>
              <div style={{display:'flex',gap:10}}>
                <div className="field" style={{flex:1,marginBottom:0}}>
                  <label className="field-label">Brand name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Foundry Coffee"/>
                </div>
              </div>
              <div className="field" style={{marginBottom:0,marginTop:10}}>
                <label className="field-label">Voice &amp; feel</label>
                <textarea className="textarea" style={{minHeight:60}} value={voice} onChange={e => setVoice(e.target.value)}
                  placeholder="e.g. Earthy, slow, handcrafted — warm textures, muted tones, tactile."/>
              </div>
            </div>

            {/* 2 — Logo (compact horizontal) */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">2</span> Logo</div>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div className={`logo-compact ${logoImage ? 'has-file' : ''}`} onClick={() => logoRef.current?.click()}>
                  {logoImage
                    ? <img src={logoImage} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain',padding:6}}/>
                    : <div style={{textAlign:'center',color:'var(--text-3)'}}><Icon name="upload" size={16}/><div style={{fontSize:10,marginTop:3}}>Upload</div></div>}
                </div>
                <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{fontSize:12,color:'var(--text-2)',fontWeight:500}}>{logoImage ? 'Logo uploaded' : 'No logo yet'}</div>
                  <div style={{fontSize:11,color:'var(--text-3)'}}>PNG, SVG, JPG — colors extracted automatically</div>
                  {logoImage && (
                    <div style={{display:'flex',gap:6}}>
                      <input className="input" style={{flex:1,padding:'5px 9px',fontSize:11}} placeholder="Wordmark text"
                        value={logoText} onChange={e => setLogoText(e.target.value)}/>
                      <button className="btn-icon" onClick={async () => { setLogoImage(undefined); setLogoText(''); await refreshCandidates(undefined); }}>
                        <Icon name="trash" size={12}/>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <input ref={logoRef} type="file" className="upload-input" accept="image/*" onChange={handleLogo}/>
            </div>

            {/* 3 — Color palette: toggleable candidates */}
            <div className="section-block">
              <div className="section-h-form">
                <span className="section-num">3</span> Color palette
                {detecting && <span style={{marginLeft:8,fontSize:10,color:'var(--text-3)'}}>Detecting…</span>}
                <span style={{marginLeft:'auto',fontSize:10,color:'var(--text-4)'}}>Tap to select · {palette.length} chosen</span>
              </div>

              {candidates.length === 0 && !detecting && (
                <p style={{fontSize:12,color:'var(--text-4)',margin:'4px 0 8px'}}>Upload a logo to auto-detect brand colors.</p>
              )}

              {/* Candidate swatches — tap to toggle */}
              {candidates.length > 0 && (
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                  {candidates.map(c => {
                    const selected = palette.includes(c);
                    return (
                      <button key={c} onClick={() => toggleColor(c)} title={c.toUpperCase()}
                        style={{position:'relative',width:36,height:36,borderRadius:8,background:c,border:`2px solid ${selected ? '#fff' : 'transparent'}`,
                          boxShadow: selected ? '0 0 0 2px var(--accent)' : '0 0 0 1px rgba(255,255,255,0.08)',
                          cursor:'pointer',transition:'all 0.12s',flexShrink:0}}>
                        {selected && (
                          <span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'#fff',textShadow:'0 1px 3px rgba(0,0,0,0.7)'}}>
                            <Icon name="check" size={12} stroke={2.5}/>
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {/* Custom color picker */}
                  <button onClick={() => customColorRef.current?.click()} title="Add custom color"
                    style={{width:36,height:36,borderRadius:8,border:'1.5px dashed var(--line-2)',background:'transparent',cursor:'pointer',display:'grid',placeItems:'center',color:'var(--text-3)',flexShrink:0,transition:'all 0.12s'}}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--accent)')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--line-2)')}>
                    <Icon name="plus" size={13}/>
                  </button>
                  <input ref={customColorRef} type="color" style={{opacity:0,width:0,height:0,position:'absolute'}}
                    onChange={e => addCustomColor(e.target.value)}/>
                </div>
              )}

              {/* Selected palette preview row */}
              {palette.length > 0 && (
                <div style={{display:'flex',gap:5,alignItems:'center',padding:'8px 10px',background:'var(--bg-2)',borderRadius:8,border:'1px solid var(--line)'}}>
                  <span style={{fontSize:10,color:'var(--text-4)',marginRight:4,whiteSpace:'nowrap'}}>Selected:</span>
                  {palette.map(c => (
                    <div key={c} style={{width:24,height:24,borderRadius:5,background:c,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}/>
                  ))}
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!name.trim()}><Icon name="check" size={13}/> Save Brand DNA</button>
            </div>
          </div>

          <aside className="editor-preview">
            <div className="preview-h">Live preview</div>
            <div className={`preview-card ${!previewGradient ? (init?.samples?.[0] ?? 'grad-1') : ''}`}
              style={previewGradient ? {background: previewGradient} : {}}>
              {logoImage
                ? <img src={logoImage} alt="" style={{position:'absolute',bottom:12,left:14,height:36,objectFit:'contain',maxWidth:'55%',filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.35))'}}/>
                : logoText ? <div className="corner-logo">{logoText}</div> : null}
            </div>
            {palette.length > 0 && (
              <div className="preview-pal">{palette.map((c, i) => <span key={i} style={{background:c}}/>)}</div>
            )}
            <div className="preview-row"><span className="k">Voice</span><span style={{maxWidth:160,textAlign:'right',fontSize:11}}>{voice || 'Not set'}</span></div>
            <div className="preview-row">
              <span className="k">Logo</span>
              <span style={{color:logoImage?'#C7F25E':'var(--text-3)'}}>{logoImage ? 'Uploaded' : 'None'}</span>
            </div>
            <div className="preview-row">
              <span className="k">Colors</span>
              <span style={{color:palette.length>0?'#C7F25E':'var(--text-3)'}}>
                {palette.length > 0 ? `${palette.length} selected` : 'Upload images'}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ detail, setDetail }: {
  detail: DetailState; setDetail: (d: DetailState | null) => void;
}) {
  const brand = detail.brand;
  const img = detail.images[detail.idx];
  return (
    <div className="detail-overlay" onClick={()=>setDetail(null)}>
      <div className="detail" onClick={e=>e.stopPropagation()}>
        <div className="detail-stage">
          <img className="img" src={img} alt="Generated"/>
        </div>
        <div className="detail-side">
          <div className="detail-side-head">
            <h3>Image {detail.idx+1} of {detail.images.length}</h3>
            <div style={{flex:1}}/>
            <button className="btn-icon" onClick={()=>setDetail(null)}><Icon name="x" size={14}/></button>
          </div>
          <div className="detail-side-body">
            <div style={{display:'flex',gap:6,marginBottom:18}}>
              <a href={img} download={`ideogram-${detail.idx}.png`} className="btn btn-ghost"
                style={{flex:1,justifyContent:'center',textDecoration:'none'}}>
                <Icon name="download" size={13}/> Download
              </a>
            </div>
            {detail.images.length>1 && (
              <div className="side-section">
                <div className="side-section-h">Variations</div>
                <div className="var-row">
                  {detail.images.map((g,i)=>(
                    <div key={i} className={`vt ${i===detail.idx?'active':''}`} onClick={()=>setDetail({...detail,idx:i})}>
                      <img src={g} alt=""/>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="side-section">
              <div className="side-section-h">Prompt</div>
              <div className="detail-prompt">{detail.prompt}</div>
            </div>
            {brand && (
              <div className="side-section">
                <div className="side-section-h">Applied Brand DNA</div>
                <div className="applied-card">
                  <div className={`sw ${brand.samples[0]??'grad-1'}`}/>
                  <div style={{flex:1}}>
                    <div className="meta-name">{brand.name}</div>
                    <div className="meta-sub">{brand.voice}</div>
                    <div className="applied-mini-pal">{brand.palette.map((c,i)=><span key={i} style={{background:c}}/>)}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="side-section">
              <div className="side-section-h">Details</div>
              <div className="kv"><span className="k">Model</span><span className="v">Gemini Flash Image</span></div>
              <div className="kv"><span className="k">Aspect</span><span className="v">1:1</span></div>
              {brand && <div className="kv"><span className="k">Brand</span><span className="v">{brand.name}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── My Images page ────────────────────────────────────────────────────────────

function ImagesPage({ images, onOpen }: { images: SavedImage[]; onOpen: (img: SavedImage) => void }) {
  if (images.length === 0) {
    return (
      <div className="placeholder-page">
        <div style={{maxWidth:520,textAlign:'center'}}>
          <div style={{width:60,height:60,borderRadius:'50%',background:'var(--bg-1)',border:'1px solid var(--line)',display:'grid',placeItems:'center',margin:'0 auto 18px',color:'var(--text-3)'}}>
            <Icon name="image2" size={22}/>
          </div>
          <h1 className="page-h1" style={{fontSize:28}}>My Images</h1>
          <p className="page-sub" style={{margin:'12px auto 0',fontSize:13}}>
            Images you generate will appear here. Start by creating something in <em>Explore</em>.
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1 className="page-h1">My <em>Images</em></h1>
        <p className="page-sub">{images.length} image{images.length!==1?'s':''} generated this session.</p>
      </div>
      <div className="page-content">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
          {images.map(img=>(
            <div key={img.id} onClick={()=>onOpen(img)}
              style={{borderRadius:12,overflow:'hidden',cursor:'pointer',background:'var(--bg-1)',border:'1px solid var(--line)',transition:'transform 0.15s'}}
              onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.02)')}
              onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
              <img src={img.src} alt={img.prompt} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover',display:'block'}}/>
              <div style={{padding:'8px 10px'}}>
                <div style={{fontSize:11,color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{img.prompt}</div>
                {img.brandName && <div style={{fontSize:10,color:'var(--accent-text)',marginTop:2}}>{img.brandName}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Placeholder ───────────────────────────────────────────────────────────────

const PLACEHOLDER_LABEL: Record<string,string> = {
  batch:'Batch', models:'Models', styles:'Styles', likes:'My likes',
  collections:'Collections', images:'My images', characters:'Characters',
};

function PlaceholderPage({ page }: { page: string }) {
  return (
    <div className="placeholder-page">
      <div style={{maxWidth:520,textAlign:'center'}}>
        <div style={{width:60,height:60,borderRadius:'50%',background:'var(--bg-1)',border:'1px solid var(--line)',display:'grid',placeItems:'center',margin:'0 auto 18px',color:'var(--text-3)'}}>
          <Icon name="sparkle" size={22}/>
        </div>
        <h1 className="page-h1" style={{fontSize:32}}>{PLACEHOLDER_LABEL[page]??'Coming soon'}</h1>
        <p className="page-sub" style={{margin:'12px auto 0',fontSize:13}}>
          This page exists in Ideogram already — for the sake of this prototype, only the{' '}
          <em style={{fontFamily:'var(--serif)',fontStyle:'italic',color:'var(--accent-text)'}}>Brand DNA</em>{' '}
          feature has been built out to demonstrate how it would co-exist with the rest of the product.
        </p>
        <a href="https://ideogram.ai" target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:18,fontSize:12,color:'var(--text-3)',textDecoration:'none',padding:'7px 12px',borderRadius:8,background:'var(--bg-1)',border:'1px solid var(--line)'}}>
          <Icon name="link" size={11}/> See on ideogram.ai
        </a>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState('explore');
  const [brands, setBrands] = useLocalStorage<Brand[]>('ideogram-brands', DEFAULT_BRANDS);
  const [activeBrand, setActiveBrand] = useLocalStorage<string|null>('ideogram-active-brand', null);
  const [editingBrand, setEditingBrand] = useState<Brand|null>(null);

  const [stream, setStream] = useState<StreamMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [activePreset, setActivePreset] = useState<string|null>(null);
  const [detail, setDetail] = useState<DetailState|null>(null);
  const [debugDoc, setDebugDoc] = useState<DebugDocState | null>(null);
  const [attached, setAttached] = useState<AttachedImage[]>([]);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);

  const brand = brands.find(b => b.id === activeBrand) ?? null;

  const generateImages = useCallback(async (
    userPrompt: string, msgIdx: number, attachedRefs: AttachedImage[]
  ) => {
    const currentBrand = brands.find(b => b.id === activeBrand) ?? null;

    const refImages = attachedRefs.slice(0, 5).map(img => dataURLtoBase64(img.dataURL));

    let logoData: { data: string; mimeType: string } | undefined;
    if (currentBrand?.logoImage) logoData = dataURLtoBase64(currentBrand.logoImage);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          brand: currentBrand ? { name: currentBrand.name, voice: currentBrand.voice, keywords: currentBrand.keywords, palette: currentBrand.palette } : null,
          referenceImages: refImages,
          logoImage: logoData,
          preset: activePreset,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        const message = json.error ?? 'Generation failed';
        const debugMarkdown = formatDebugMarkdown(userPrompt, currentBrand, attachedRefs, json.debug, message);
        setStream(prev => {
          const next = [...prev];
          const prevTrace = next[msgIdx]?.trace;
          next[msgIdx] = {
            role: 'asst',
            images: [],
            prompt: userPrompt,
            referenceImages: attachedRefs,
            variant: next[msgIdx]?.variant,
            error: message,
            trace: {
              ...(prevTrace ?? createGenerationTrace(userPrompt, currentBrand, attachedRefs, 'generate', 'error')),
              status: 'error',
              modelName: json.debug?.selectedModels?.[0] ?? prevTrace?.modelName ?? 'Gemini Flash Image',
              debugMarkdown,
            },
          };
          return next;
        });
        return;
      }

      const images: string[] = (json.images ?? []).map((img: { data: string; mimeType: string }) =>
        `data:${img.mimeType};base64,${img.data}`
      );

      const cappedImages = images.slice(0, 2);
      const debugMarkdown = formatDebugMarkdown(userPrompt, currentBrand, attachedRefs, json.debug);
      const modelName = json.debug?.selectedModels?.[0] ?? 'Gemini Flash Image';
      setSavedImages(prev => [
        ...cappedImages.map((src, j) => ({
          id: `${Date.now()}-${j}`,
          src,
          prompt: userPrompt,
          brandName: currentBrand?.name,
        })),
        ...prev,
      ].slice(0, 40));
      setStream(prev => {
        const next = [...prev];
        const prevTrace = next[msgIdx]?.trace;
        next[msgIdx] = {
          role: 'asst',
          images: cappedImages,
          prompt: userPrompt,
          referenceImages: attachedRefs,
          variant: next[msgIdx]?.variant,
          trace: prevTrace
            ? { ...prevTrace, status: 'complete', modelName, debugMarkdown }
            : { ...createGenerationTrace(userPrompt, currentBrand, attachedRefs, 'generate', 'complete'), modelName, debugMarkdown },
        };
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const debugMarkdown = formatDebugMarkdown(userPrompt, currentBrand, attachedRefs, undefined, message);
      setStream(prev => {
        const next = [...prev];
        const prevTrace = next[msgIdx]?.trace;
        next[msgIdx] = {
          role: 'asst',
          images: [],
          prompt: userPrompt,
          referenceImages: attachedRefs,
          variant: next[msgIdx]?.variant,
          error: message,
          trace: prevTrace
            ? { ...prevTrace, status: 'error', debugMarkdown }
            : { ...createGenerationTrace(userPrompt, currentBrand, attachedRefs, 'generate', 'error'), debugMarkdown },
        };
        return next;
      });
    }
  }, [brands, activeBrand, activePreset]);

  const send = useCallback((finalPrompt: string) => {
    if (!finalPrompt.trim() && attached.length === 0) return;
    const userPrompt = finalPrompt.trim() || 'Generate an on-brand image';
    const snap = attached.slice(0, 5);
    setPrompt('');
    setAttached([]);

    setStream(prev => {
      const userMsg: StreamMessage = { role: 'user', text: userPrompt, attachedImages: snap.map(img => img.dataURL), referenceImages: snap };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true, trace: createGenerationTrace(userPrompt, brand, snap) };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(userPrompt, idx, snap), 0);
      return next;
    });
  }, [attached, brand, generateImages]);

  const handleRegenerate = useCallback((msg: StreamMessage) => {
    if (!msg.prompt) return;
    const refs = msg.referenceImages ?? [];
    setStream(prev => {
      const userMsg: StreamMessage = { role: 'user', text: '↺ Regenerate', variant: 'regen' };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true, variant: 'regen', trace: createGenerationTrace(msg.prompt!, brand, refs, 'regenerate') };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(msg.prompt!, idx, refs), 0);
      return next;
    });
  }, [brand, generateImages]);

  const handleRefine = useCallback((msg: StreamMessage, state: RefineState) => {
    if (!msg.prompt) return;
    const issues = state.q1.length ? `Issues: ${state.q1.join(', ')}.` : '';
    const changes = state.q2.length ? `Changes needed: ${state.q2.join(', ')}.` : '';
    const focus = state.q3.length ? `Focus on: ${state.q3.join(', ')}.` : '';
    const notes = state.q4.trim() ? `Direction: ${state.q4.trim()}` : '';
    const feedback = [issues, changes, focus, notes].filter(Boolean).join(' ');
    const refinedPrompt = `${msg.prompt}\n\nREFINEMENT REQUEST: The previous generation had problems. ${feedback} Please generate a significantly improved version that fixes these specific issues while maintaining full brand DNA compliance.`;
    const refs = msg.referenceImages ?? [];

    setStream(prev => {
      const parts = [state.q1, state.q2, state.q3].flat().filter(Boolean);
      const label = parts.slice(0, 3).join(' · ') || 'Refinement';
      const userMsg: StreamMessage = { role: 'user', text: `✦ Refine: ${label}`, variant: 'refine' };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true, variant: 'refine', trace: createGenerationTrace(refinedPrompt, brand, refs, 'refine') };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(refinedPrompt, idx, refs), 0);
      return next;
    });
  }, [brand, generateImages]);

  const startCreate = () => { setEditingBrand(null); setPage('editor'); };
  const startEdit = (b: Brand) => { setEditingBrand(b); setPage('editor'); };
  const handleSaveBrand = (b: Brand) => {
    setBrands(prev => {
      const i = prev.findIndex(x => x.id === b.id);
      return i >= 0 ? prev.map(x => x.id===b.id?b:x) : [...prev, b];
    });
    setActiveBrand(b.id);
    setPage('brands');
  };

  const PLACEHOLDER_PAGES = ['batch','models','styles','likes','collections','characters'];

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage}/>
      <div className="main">
        {page === 'explore' && (
          <ExplorePage
            brand={brand} brands={brands} activeBrand={activeBrand} setActiveBrand={setActiveBrand}
            prompt={prompt} setPrompt={setPrompt} onSend={send}
            activePreset={activePreset} setPreset={setActivePreset}
            openCreateBrand={startCreate}
            stream={stream}
            onRegenerate={handleRegenerate}
            onRefine={handleRefine}
            onOpenDetail={(msg, imgIdx) => setDetail({ images: msg.images??[], idx: imgIdx, prompt: msg.prompt??'', brand: brand??undefined })}
            attached={attached} setAttached={setAttached}
            onReset={() => { setStream([]); setDebugDoc(null); }}
            debugDoc={debugDoc}
            setDebugDoc={setDebugDoc}
          />
        )}

        {page === 'brands' && (
          <BrandsPage brands={brands} activeBrand={activeBrand} setActiveBrand={setActiveBrand} onCreate={startCreate} onEdit={startEdit}/>
        )}

        {page === 'editor' && (
          <BrandEditor brand={editingBrand} onBack={()=>setPage('brands')} onSave={handleSaveBrand}/>
        )}

        {page === 'images' && <ImagesPage images={savedImages} onOpen={(img) => setDetail({ images: [img.src], idx: 0, prompt: img.prompt })}/>}
        {PLACEHOLDER_PAGES.includes(page) && <PlaceholderPage page={page}/>}
      </div>

      {detail && (
        <DetailModal detail={detail} setDetail={setDetail}/>
      )}
    </div>
  );
}
