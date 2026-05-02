'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferenceImage {
  id: string;
  data: string; // base64 data URL
  mimeType: string;
}

interface Brand {
  id: string;
  name: string;
  logoText: string;
  logoImage?: string; // base64 data URL
  palette: string[];
  voice: string;
  edited: string;
  keywords: string[];
  samples: string[]; // gradient CSS classes (for demo cards)
  referenceImages: ReferenceImage[];
}

interface StreamMessage {
  role: 'user' | 'asst';
  text?: string;
  loading?: boolean;
  images?: string[]; // base64 data URLs of generated images
  prompt?: string;
  error?: string;
}

interface DetailState {
  images: string[];
  idx: number;
  prompt: string;
  brand?: Brand;
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
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
  palette: <><path d="M12 22a10 10 0 1 1 10-10c0 2-1 3-3 3h-2a3 3 0 0 0-3 3 3 3 0 0 1-2 3"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></>,
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
  eye: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  star: <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z"/>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></>,
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
  {
    id: 'foundry',
    name: 'Foundry Coffee',
    logoText: 'Foundry',
    palette: ['#3D1F12', '#C97A3A', '#E9D5B5', '#F5EBDB'],
    voice: 'Earthy, crafted, slow.',
    edited: '2d ago',
    keywords: ['warm grain', 'matte ceramic', 'shadow play'],
    samples: ['grad-1', 'grad-3', 'grad-9'],
    referenceImages: [],
  },
  {
    id: 'aria',
    name: 'Aria Skincare',
    logoText: 'aria',
    palette: ['#F5E6D3', '#E8C5A0', '#A87856', '#3F2A1E'],
    voice: 'Soft, considered, luminous.',
    edited: '5h ago',
    keywords: ['diffused light', 'milky beige', 'glassy'],
    samples: ['grad-6', 'grad-2', 'grad-11'],
    referenceImages: [],
  },
  {
    id: 'monsoon',
    name: 'Monsoon Tech',
    logoText: 'Monsoon',
    palette: ['#0F1F3A', '#4A90E2', '#8FB8E8', '#FFFFFF'],
    voice: 'Confident, calm, technical.',
    edited: 'last week',
    keywords: ['cool gradients', 'blue glass', 'clean type'],
    samples: ['grad-7', 'grad-12', 'grad-4'],
    referenceImages: [],
  },
  {
    id: 'plume',
    name: 'Plume Studio',
    logoText: 'Plume',
    palette: ['#FFE5EC', '#FF7AA2', '#5B1339', '#FFFFFF'],
    voice: 'Playful, bold, expressive.',
    edited: '3d ago',
    keywords: ['soft pinks', 'high contrast', 'paper textures'],
    samples: ['grad-2', 'grad-5', 'grad-8'],
    referenceImages: [],
  },
];

const PRESETS = [
  { id: 'general', name: 'General' },
  { id: 'editorial', name: 'Editorial', cover: 'grad-1' },
  { id: 'product', name: 'Product', cover: 'grad-11' },
  { id: 'lifestyle', name: 'Lifestyle', cover: 'grad-2' },
  { id: 'social', name: 'Social post', cover: 'grad-9' },
  { id: 'banner', name: 'Web banner', cover: 'grad-7' },
  { id: 'package', name: 'Packaging', cover: 'grad-12' },
];

const FEATURED = [
  { id: 'f1', brand: 'Foundry Coffee', tag: 'Editorial', cover: 'grad-1', big: true },
  { id: 'f2', brand: 'Aria Skincare', tag: 'Product', cover: 'grad-11' },
  { id: 'f3', brand: 'Plume Studio', tag: 'Social', cover: 'grad-2' },
  { id: 'f4', brand: 'Monsoon Tech', tag: 'Banner', cover: 'grad-7' },
  { id: 'f5', brand: 'Foundry Coffee', tag: 'Packaging', cover: 'grad-3' },
];

const COMMUNITY = [
  { id: 'c1', brand: 'Aria Skincare', cover: 'grad-6' },
  { id: 'c2', brand: 'Plume Studio', cover: 'grad-5' },
  { id: 'c3', brand: 'Monsoon Tech', cover: 'grad-12' },
  { id: 'c4', brand: 'Foundry Coffee', cover: 'grad-9' },
  { id: 'c5', brand: 'Aria Skincare', cover: 'grad-8' },
  { id: 'c6', brand: 'Plume Studio', cover: 'grad-4' },
  { id: 'c7', brand: 'Foundry Coffee', cover: 'grad-10' },
  { id: 'c8', brand: 'Monsoon Tech', cover: 'grad-13' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLtoBase64(dataURL: string) {
  const [header, data] = dataURL.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  return { data, mimeType };
}

function useLocalStorage<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, activeBrand, brands }: {
  page: string; setPage: (p: string) => void;
  activeBrand: string | null; brands: Brand[];
}) {
  const brand = brands.find(b => b.id === activeBrand);
  const item = (id: string, icon: string, label: string, badge?: string) => (
    <button className={`sb-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)} key={id}>
      <Icon name={icon} size={15} />
      <span>{label}</span>
      {badge && <span className="badge">{badge}</span>}
    </button>
  );
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo"></div>
        <div className="sb-name">ideogram</div>
      </div>
      {item('explore', 'explore', 'Explore')}
      {item('batch', 'grid', 'Batch')}
      <div className="sb-section">Library</div>
      {item('images', 'image2', 'My images')}
      {item('collections', 'folder', 'Collections')}
      {item('likes', 'heart', 'My likes')}
      <div className="sb-section">Elements</div>
      {item('models', 'cube', 'Models')}
      {item('styles', 'layers', 'Styles')}
      {item('brands', 'dna', 'Brand DNA', 'New')}
      {item('characters', 'user', 'Characters')}

      <div className="sb-foot">
        <div className="sb-credits">
          <div className="lbl">Active brand</div>
          <div className="val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {brand ? (
              <>
                <span style={{ display: 'flex', height: 14, width: 24, borderRadius: 3, overflow: 'hidden' }}>
                  {brand.palette.slice(0, 4).map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
                </span>
                <span style={{ fontSize: 12 }}>{brand.name.split(' ')[0]}</span>
              </>
            ) : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>None</span>}
          </div>
          <button className="upgrade" onClick={() => setPage('brands')}>Manage brands</button>
        </div>
        <button className="sb-user">
          <div className="sb-avatar">M</div>
          <div>
            <div className="sb-user-name">Mary</div>
            <div className="sb-user-plan">Plus plan</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({ value, setValue, onSend, brand, setActiveBrand, activePreset, setPreset, openCreateBrand, brands }: {
  value: string; setValue: (v: string) => void; onSend: () => void;
  brand: Brand | null; setActiveBrand: (id: string | null) => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void; brands: Brand[];
}) {
  const [popOpen, setPopOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPopOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="composer">
      <textarea
        placeholder="Describe an image — your Brand DNA will be applied automatically…"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        style={{ height: 'auto' }}
        onInput={e => {
          const t = e.target as HTMLTextAreaElement;
          t.style.height = 'auto';
          t.style.height = Math.min(t.scrollHeight, 160) + 'px';
        }}
      />
      <div className="composer-tools">
        <div style={{ position: 'relative' }} ref={popRef}>
          <button className="tool-pill active" onClick={() => setPopOpen(o => !o)}>
            {brand ? (
              <>
                <span className="swatch" style={{ background: brand.palette[1] }} />
                {brand.name.split(' ')[0]} DNA
              </>
            ) : (
              <><Icon name="dna" size={11} /> Add Brand DNA</>
            )}
            <Icon name="chevD" size={10} />
          </button>
          {popOpen && (
            <div className="brand-pop" style={{ top: 'calc(100% + 6px)', left: 0 }}>
              <div className="brand-pop-h">Apply Brand DNA</div>
              {brands.map(b => (
                <div key={b.id} className={`brand-pop-row ${brand?.id === b.id ? 'active' : ''}`}
                  onClick={() => { setActiveBrand(b.id); setPopOpen(false); }}>
                  <span className="pop-pal">{b.palette.slice(0, 4).map((c, i) => <span key={i} style={{ background: c }} />)}</span>
                  <span className="nm">{b.name}</span>
                  {brand?.id === b.id && <Icon name="check" size={13} />}
                </div>
              ))}
              {brands.length > 0 && <hr />}
              <button className="brand-pop-add" onClick={() => { openCreateBrand(); setPopOpen(false); }}>
                <Icon name="plus" size={12} /> Create new brand
              </button>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button className={`tool-pill ${activePreset ? 'active' : ''}`}
            onClick={() => setPreset(activePreset ? null : 'editorial')}>
            <Icon name="layers" size={11} />
            {activePreset ? PRESETS.find(p => p.id === activePreset)?.name ?? 'Style' : 'Style'}
          </button>
        </div>
        <button className="tool-pill"><Icon name="ratio" size={11} /> 1:1</button>
        <div className="spacer" />
        <span className="composer-side">
          <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={11} /> Brand-locked
          </span>
        </span>
        <button className="send-btn" onClick={onSend} disabled={!value.trim()}>
          <Icon name="arrowU" size={14} stroke={2.2} />
        </button>
      </div>
    </div>
  );
}

// ── Explore page ──────────────────────────────────────────────────────────────

function ExplorePage({ brand, brands, activeBrand, setActiveBrand, prompt, setPrompt, onSend, activePreset, setPreset, openCreateBrand, goPage }: {
  brand: Brand | null; brands: Brand[]; activeBrand: string | null;
  setActiveBrand: (id: string | null) => void;
  prompt: string; setPrompt: (v: string) => void; onSend: () => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void; goPage: (p: string) => void;
}) {
  return (
    <div className="explore">
      <h1 className="hero-title">What will you create<br /><em>on-brand</em> today?</h1>
      <Composer
        value={prompt} setValue={setPrompt} onSend={onSend}
        brand={brand} setActiveBrand={setActiveBrand} brands={brands}
        activePreset={activePreset} setPreset={setPreset}
        openCreateBrand={openCreateBrand}
      />
      <div className="cat-strip">
        {PRESETS.map(p => (
          <button key={p.id} className={`cat-card ${activePreset === p.id ? 'active' : ''}`}
            onClick={() => setPreset(activePreset === p.id ? null : p.id)}>
            <span className="label">{p.name}</span>
            {p.cover && (
              <span className="stack">
                <div className={p.cover} />
                <div className={p.cover} />
                <div className={p.cover} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="sec-head">
        <h2>Featured <em>Brand DNA</em></h2>
        <button className="more" onClick={() => goPage('brands')}>View library →</button>
      </div>
      <div className="dna-grid">
        {FEATURED.map((f, i) => (
          <div key={f.id} className={`dna-card ${i === 0 ? 'feature' : ''}`} onClick={() => goPage('brands')}>
            <div className={`dna-cover ${f.cover}`}>
              <div className="tag">{f.tag}</div>
              <div className="palette-strip">
                {(DEFAULT_BRANDS.find(b => b.name === f.brand)?.palette ?? []).slice(0, 4).map((c, j) => (
                  <span key={j} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="dna-meta">
              <div>
                <div className="nm">{f.brand}</div>
                <div className="author">by {f.brand.split(' ')[0].toLowerCase()}_team</div>
              </div>
              <div className="heart"><Icon name="heart" size={12} /> {120 + i * 38}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sec-head">
        <h2>From the <em>community</em></h2>
        <button className="more">Explore more →</button>
      </div>
      <div className="dna-grid">
        {COMMUNITY.map(c => (
          <div key={c.id} className="dna-card" onClick={() => goPage('brands')}>
            <div className={`dna-cover ${c.cover}`}>
              <div className="palette-strip">
                {(DEFAULT_BRANDS.find(b => b.name === c.brand)?.palette ?? []).slice(0, 4).map((cc, j) => (
                  <span key={j} style={{ background: cc }} />
                ))}
              </div>
            </div>
            <div className="dna-meta">
              <div className="nm" style={{ fontSize: 12 }}>{c.brand}</div>
              <div className="heart"><Icon name="heart" size={11} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Brands page ───────────────────────────────────────────────────────────────

function BrandsPage({ brands, activeBrand, setActiveBrand, onCreate, onEdit }: {
  brands: Brand[]; activeBrand: string | null;
  setActiveBrand: (id: string | null) => void;
  onCreate: () => void; onEdit: (b: Brand) => void;
}) {
  return (
    <>
      <div className="page-head">
        <h1 className="page-h1">My <em>Brand DNA</em></h1>
        <p className="page-sub">A library of identities Ideogram can apply to any prompt. Pick one, and every image you generate stays on-brand — colors, type, mood and all.</p>
      </div>
      <div className="page-content">
        <div className="brand-cards">
          {brands.map(b => (
            <div key={b.id} className={`brand-card ${activeBrand === b.id ? 'active' : ''}`} onClick={() => setActiveBrand(b.id)}>
              <div className={`top ${b.samples[0] ?? 'grad-1'}`} style={{ position: 'relative' }}>
                {b.logoImage ? (
                  <img src={b.logoImage} alt={b.name} className="logo-preview" />
                ) : (
                  <div className="logo-mk">{b.logoText}</div>
                )}
                {activeBrand === b.id && (
                  <div className="active-badge"><Icon name="check" size={10} /> Active</div>
                )}
              </div>
              <div className="body">
                <div className="nm-row">
                  <div className="nm">{b.name}</div>
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); onEdit(b); }}>
                    <Icon name="edit" size={12} />
                  </button>
                </div>
                <div className="voice">{b.voice}</div>
                <div className="pal">
                  {b.palette.map((c, i) => <span key={i} style={{ background: c }} />)}
                </div>
                <div className="ed" style={{ marginTop: 8 }}>Edited {b.edited}</div>
              </div>
            </div>
          ))}
          <button className="add-card" onClick={onCreate}>
            <Icon name="plus" size={20} />
            <div>Create Brand DNA</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', maxWidth: 160, textAlign: 'center' }}>
              Upload a logo and reference images
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

// ── Brand DNA Editor ──────────────────────────────────────────────────────────

function BrandEditor({ brand: initialBrand, onBack, onSave }: {
  brand: Brand | null; onBack: () => void;
  onSave: (b: Brand) => void;
}) {
  const [name, setName] = useState(initialBrand?.name ?? '');
  const [voice, setVoice] = useState(initialBrand?.voice ?? '');
  const [keywords, setKeywords] = useState<string[]>(initialBrand?.keywords ?? []);
  const [newKeyword, setNewKeyword] = useState('');
  const [palette, setPalette] = useState<string[]>(initialBrand?.palette ?? ['#F5E6D3', '#A87856', '#3F2A1E', '#1A0F0A']);
  const [logoImage, setLogoImage] = useState<string | undefined>(initialBrand?.logoImage);
  const [logoText, setLogoText] = useState(initialBrand?.logoText ?? '');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initialBrand?.referenceImages ?? []);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    setLogoImage(dataURL);
    if (!logoText) setLogoText(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 5 - referenceImages.length;
    for (const file of files.slice(0, remaining)) {
      const dataURL = await readFileAsDataURL(file);
      const { mimeType } = dataURLtoBase64(dataURL);
      setReferenceImages(prev => [...prev, { id: Math.random().toString(36).slice(2), data: dataURL, mimeType }]);
    }
    e.target.value = '';
  };

  const removeRef = (id: string) => setReferenceImages(prev => prev.filter(r => r.id !== id));

  const addKeyword = () => {
    const k = newKeyword.trim();
    if (k && !keywords.includes(k)) setKeywords(prev => [...prev, k]);
    setNewKeyword('');
  };

  const save = () => {
    if (!name.trim()) return;
    const b: Brand = {
      id: initialBrand?.id ?? Math.random().toString(36).slice(2),
      name: name.trim(),
      logoText: logoText || name.split(' ')[0],
      logoImage,
      palette,
      voice: voice.trim(),
      edited: 'just now',
      keywords,
      samples: initialBrand?.samples ?? ['grad-1', 'grad-3', 'grad-9'],
      referenceImages,
    };
    onSave(b);
  };

  const previewGrad = initialBrand?.samples?.[0] ?? 'grad-1';

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button className="btn-bare" onClick={onBack}><Icon name="chevL" size={16} /></button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Brand DNA / {initialBrand ? 'Edit' : 'Create'}</span>
        </div>
        <h1 className="page-h1">
          {initialBrand ? <>Edit <em>{initialBrand.name}</em></> : <>Define a new <em>Brand DNA</em></>}
        </h1>
        <p className="page-sub">Save your brand identity once. Apply it to any prompt to keep generations on-brand.</p>
      </div>
      <div className="page-content">
        <div className="editor">
          <div className="editor-main">
            {/* Section 1: Basics */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">1</span> Brand basics</div>
              <div className="field">
                <label className="field-label">Brand name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Foundry Coffee" />
              </div>
              <div className="field">
                <label className="field-label">Voice &amp; feel</label>
                <textarea className="textarea" value={voice} onChange={e => setVoice(e.target.value)} placeholder="A few words about how the brand feels" />
              </div>
              <div className="field">
                <label className="field-label">Style keywords</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {keywords.map((k, i) => (
                    <span key={i} className="tool-pill" style={{ cursor: 'default' }}>
                      {k}
                      <button onClick={() => setKeywords(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--text-3)', display: 'flex' }}>
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      className="input" style={{ width: 120, padding: '4px 8px', fontSize: 12 }}
                      placeholder="Add keyword"
                      value={newKeyword}
                      onChange={e => setNewKeyword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    />
                    <button className="tool-pill" onClick={addKeyword}><Icon name="plus" size={10} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 & 3: Logo + Colors */}
            <div className="editor-grid">
              <div className="section-block">
                <div className="section-h-form"><span className="section-num">2</span> Logo</div>
                <div className={`logo-drop ${logoImage ? 'has-file' : ''}`}
                  onClick={() => logoInputRef.current?.click()}>
                  {logoImage ? (
                    <img src={logoImage} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 8 }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <Icon name="upload" size={18} />
                      <div style={{ marginTop: 6 }}>Click to upload logo</div>
                      <div style={{ fontSize: 10, marginTop: 2, color: 'var(--text-4)' }}>SVG, PNG, JPG</div>
                    </div>
                  )}
                </div>
                <input ref={logoInputRef} type="file" className="upload-input" accept="image/*" onChange={handleLogoUpload} />
                {logoImage && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input className="input" style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                      placeholder="Logo name / wordmark" value={logoText}
                      onChange={e => setLogoText(e.target.value)} />
                    <button className="btn-icon" onClick={() => { setLogoImage(undefined); setLogoText(''); }}>
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="section-block">
                <div className="section-h-form"><span className="section-num">3</span> Colors</div>
                <div className="swatch-row">
                  {palette.map((c, i) => (
                    <div key={i} className="swatch">
                      <input type="color" value={c} onChange={e => setPalette(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                        style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--line)', padding: 2, background: 'var(--bg-2)', cursor: 'pointer' }} />
                      <div className="swatch-hex">{c.toUpperCase()}</div>
                    </div>
                  ))}
                  {palette.length < 6 && (
                    <div className="swatch">
                      <div className="swatch-add" onClick={() => setPalette(prev => [...prev, '#888888'])}>
                        <Icon name="plus" size={12} />
                      </div>
                      <div className="swatch-hex" style={{ opacity: 0 }}>add</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Typography */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">4</span> Typography</div>
              <div className="type-pair">
                <div className="type-card">
                  <div className="preview" style={{ fontFamily: 'Instrument Serif, serif' }}>Display Aa</div>
                  <div className="meta">Instrument Serif · 400</div>
                </div>
                <div className="type-card">
                  <div className="preview" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Body Aa</div>
                  <div className="meta">Inter · 500</div>
                </div>
              </div>
            </div>

            {/* Section 5: Reference imagery */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">5</span> Reference imagery</div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                Upload up to 5 examples. These guide the visual feel of generated images.
              </p>
              <div className="ref-grid">
                {referenceImages.map(img => (
                  <div key={img.id} className="ref-tile" style={{ position: 'relative' }}>
                    <img src={img.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removeRef(img.id)}
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,0.6)', color: 'white', display: 'grid', placeItems: 'center' }}>
                      <Icon name="x" size={10} />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 5 && (
                  <div className="ref-tile add" onClick={() => refInputRef.current?.click()}>
                    <Icon name="plus" size={14} />
                  </div>
                )}
                {Array.from({ length: Math.max(0, 3 - referenceImages.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="ref-tile add" onClick={() => refInputRef.current?.click()}>
                    <Icon name="plus" size={14} />
                  </div>
                ))}
              </div>
              <input ref={refInputRef} type="file" className="upload-input" accept="image/*" multiple onChange={handleRefUpload} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
                <Icon name="check" size={13} /> Save Brand DNA
              </button>
            </div>
          </div>

          <aside className="editor-preview">
            <div className="preview-h">Live preview</div>
            <div className={`preview-card ${previewGrad}`}>
              {logoImage ? (
                <img src={logoImage} alt={logoText} style={{ position: 'absolute', bottom: 12, left: 14, height: 40, objectFit: 'contain', maxWidth: '60%' }} />
              ) : logoText ? (
                <div className="corner-logo">{logoText}</div>
              ) : null}
            </div>
            <div className="preview-pal">
              {palette.map((c, i) => <span key={i} style={{ background: c }} />)}
            </div>
            <div className="preview-row"><span className="k">Display</span><span style={{ fontFamily: 'Instrument Serif, serif', fontSize: 14 }}>Instrument Serif</span></div>
            <div className="preview-row"><span className="k">Body</span><span>Inter</span></div>
            <div className="preview-row"><span className="k">Voice</span><span style={{ maxWidth: 180, textAlign: 'right' }}>{voice || 'Not set'}</span></div>
            <div className="preview-row"><span className="k">References</span><span style={{ color: referenceImages.length > 0 ? '#C7F25E' : 'var(--text-3)' }}>{referenceImages.length} / 5</span></div>
          </aside>
        </div>
      </div>
    </>
  );
}

// ── Generate page ─────────────────────────────────────────────────────────────

function GeneratePage({ stream, prompt, setPrompt, onSend, onRegenerate, brand, brands, activeBrand, setActiveBrand, activePreset, setPreset, openCreateBrand, openDetail }: {
  stream: StreamMessage[]; prompt: string; setPrompt: (v: string) => void;
  onSend: () => void; onRegenerate: (msg: StreamMessage, idx: number) => void;
  brand: Brand | null; brands: Brand[]; activeBrand: string | null;
  setActiveBrand: (id: string | null) => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void;
  openDetail: (msg: StreamMessage, idx: number) => void;
}) {
  const streamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [stream]);

  return (
    <div className="gen">
      <div className="gen-chat">
        <div className="chat-head">
          <Icon name="sparkle" size={14} />
          <div className="chat-head-title">New generation</div>
          <div style={{ flex: 1 }} />
          <button className="btn-icon"><Icon name="more" size={14} /></button>
        </div>
        <div className="chat-stream" ref={streamRef}>
          {stream.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Describe an image to begin.
            </div>
          )}
          {stream.map((m, i) => (
            m.role === 'user'
              ? <div key={i} className="msg-user">{m.text}</div>
              : (
                <div key={i} className="msg-asst">
                  <div className="asst-head">
                    <span className={`dot ${m.loading ? 'generating-dot' : ''}`} />
                    {m.loading
                      ? `Generating${brand ? ` with ${brand.name} DNA` : ''}…`
                      : m.error ? 'Error' : 'Ideogram'}
                  </div>
                  {!m.loading && m.error && (
                    <div className="error-banner">{m.error}</div>
                  )}
                  {!m.loading && !m.error && <div>{m.text}</div>}
                  {!m.loading && (
                    <div className="asst-actions">
                      <button className="action-pill" onClick={() => onRegenerate(m, i)}>
                        <Icon name="refresh" size={11} /> Regenerate
                      </button>
                      <button className="action-pill"><Icon name="edit" size={11} /> Refine</button>
                    </div>
                  )}
                </div>
              )
          ))}
        </div>
        <div className="composer-foot">
          <Composer
            value={prompt} setValue={setPrompt} onSend={onSend}
            brand={brand} setActiveBrand={setActiveBrand} brands={brands}
            activePreset={activePreset} setPreset={setPreset}
            openCreateBrand={openCreateBrand}
          />
        </div>
      </div>

      <div className="gen-canvas">
        {stream.length === 0 ? (
          <div className="canvas-empty">
            <div style={{ textAlign: 'center' }}>
              <div className="icon-circle"><Icon name="image" size={22} /></div>
              <div>Your generations will appear here.</div>
            </div>
          </div>
        ) : (
          stream.filter(m => m.role === 'asst').map((m, i) => (
            <div key={i} className="gen-block">
              <div className="gen-block-h">
                <div className="prompt">{m.loading ? '…' : m.prompt}</div>
                <div className="ts">just now</div>
              </div>
              <div className="gen-tiles">
                {m.loading
                  ? [0, 1].map(j => <div key={j} className="tile shimmer" />)
                  : (m.images && m.images.length > 0)
                    ? m.images.map((imgSrc, j) => (
                      <div key={j} className="tile" onClick={() => openDetail(m, j)}>
                        <img src={imgSrc} alt={`Generated ${j + 1}`} className="tile-img" />
                        <div className="tile-actions">
                          <a href={imgSrc} download={`ideogram-${i}-${j}.png`} className="tile-act" onClick={e => e.stopPropagation()}>
                            <Icon name="download" size={12} />
                          </a>
                          <div className="tile-act"><Icon name="expand" size={12} /></div>
                        </div>
                      </div>
                    ))
                    : m.error
                      ? <div className="tile tile-error"><Icon name="image" size={20} /><span>{m.error}</span></div>
                      : null
                }
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ detail, setDetail }: { detail: DetailState; setDetail: (d: DetailState | null) => void }) {
  const brand = detail.brand;
  const img = detail.images[detail.idx];
  return (
    <div className="detail-overlay" onClick={() => setDetail(null)}>
      <div className="detail" onClick={e => e.stopPropagation()}>
        <div className="detail-stage">
          <img className="img" src={img} alt="Generated" />
        </div>
        <div className="detail-side">
          <div className="detail-side-head">
            <h3>Image {detail.idx + 1} of {detail.images.length}</h3>
            <div style={{ flex: 1 }} />
            <button className="btn-icon" onClick={() => setDetail(null)}><Icon name="x" size={14} /></button>
          </div>
          <div className="detail-side-body">
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              <a href={img} download={`ideogram-${detail.idx}.png`} className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                <Icon name="download" size={13} /> Download
              </a>
            </div>

            {detail.images.length > 1 && (
              <div className="side-section">
                <div className="side-section-h">Variations</div>
                <div className="var-row">
                  {detail.images.map((g, i) => (
                    <div key={i} className={`vt ${i === detail.idx ? 'active' : ''}`}
                      onClick={() => setDetail({ ...detail, idx: i })}>
                      <img src={g} alt={`Variation ${i + 1}`} />
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
                  <div className={`sw ${brand.samples[0] ?? 'grad-1'}`} />
                  <div style={{ flex: 1 }}>
                    <div className="meta-name">{brand.name}</div>
                    <div className="meta-sub">{brand.voice}</div>
                    <div className="applied-mini-pal">
                      {brand.palette.map((c, i) => <span key={i} style={{ background: c }} />)}
                    </div>
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

// ── Placeholder ───────────────────────────────────────────────────────────────

const PLACEHOLDER_LABEL: Record<string, string> = {
  batch: 'Batch', models: 'Models', styles: 'Styles',
  likes: 'My likes', collections: 'Collections',
  images: 'My images', characters: 'Characters',
};

function PlaceholderPage({ page }: { page: string }) {
  return (
    <div className="placeholder-page">
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-1)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--text-3)' }}>
          <Icon name="sparkle" size={22} />
        </div>
        <h1 className="page-h1" style={{ fontSize: 32 }}>{PLACEHOLDER_LABEL[page] ?? 'Coming soon'}</h1>
        <p className="page-sub" style={{ margin: '12px auto 0', fontSize: 13 }}>
          This page exists in Ideogram already — for the sake of this prototype, only the{' '}
          <em style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--accent-text)' }}>Brand DNA</em>{' '}
          feature has been built out to demonstrate how it would co-exist with the rest of the product.
        </p>
        <a href="https://ideogram.ai" target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', padding: '7px 12px', borderRadius: 8, background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
          <Icon name="link" size={11} /> See on ideogram.ai
        </a>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<string>('explore');
  const [brands, setBrands] = useLocalStorage<Brand[]>('ideogram-brands', DEFAULT_BRANDS);
  const [activeBrand, setActiveBrand] = useLocalStorage<string | null>('ideogram-active-brand', 'foundry');
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const [stream, setStream] = useState<StreamMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);

  const brand = brands.find(b => b.id === activeBrand) ?? null;

  const generate = useCallback(async (userPrompt: string, msgIndex: number) => {
    const currentBrand = brands.find(b => b.id === activeBrand) ?? null;

    // Prepare reference images (strip data URL prefix for API)
    const refImages = (currentBrand?.referenceImages ?? []).slice(0, 3).map(img => {
      const { data, mimeType } = dataURLtoBase64(img.data);
      return { data, mimeType };
    });

    // Prepare logo image
    let logoData: { data: string; mimeType: string } | undefined;
    if (currentBrand?.logoImage) {
      logoData = dataURLtoBase64(currentBrand.logoImage);
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          brand: currentBrand ? {
            name: currentBrand.name,
            voice: currentBrand.voice,
            keywords: currentBrand.keywords,
            palette: currentBrand.palette,
          } : null,
          referenceImages: refImages,
          logoImage: logoData,
          preset: activePreset,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error ?? 'Generation failed');
      }

      const images: string[] = (json.images ?? []).map((img: { data: string; mimeType: string }) =>
        `data:${img.mimeType};base64,${img.data}`
      );

      setStream(prev => {
        const next = [...prev];
        next[msgIndex] = {
          role: 'asst',
          text: `Generated ${images.length} image${images.length !== 1 ? 's' : ''}${currentBrand ? ` with ${currentBrand.name} DNA` : ''}`,
          images,
          prompt: userPrompt,
        };
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStream(prev => {
        const next = [...prev];
        next[msgIndex] = {
          role: 'asst',
          text: '',
          images: [],
          prompt: userPrompt,
          error: message,
        };
        return next;
      });
    }
  }, [brands, activeBrand, activePreset]);

  const send = useCallback(() => {
    if (!prompt.trim()) return;
    const userPrompt = prompt;
    setPrompt('');

    const userMsg: StreamMessage = { role: 'user', text: userPrompt };
    const loadingMsg: StreamMessage = { role: 'asst', loading: true };

    setStream(prev => {
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      // Fire generation after state update
      setTimeout(() => generate(userPrompt, idx), 0);
      return next;
    });
  }, [prompt, generate]);

  const handleRegenerate = useCallback((msg: StreamMessage, idx: number) => {
    if (!msg.prompt) return;
    setStream(prev => {
      const next = [...prev];
      next[idx] = { role: 'asst', loading: true };
      setTimeout(() => generate(msg.prompt!, idx), 0);
      return next;
    });
  }, [generate]);

  const goGenerate = () => setPage('batch');

  const startCreate = () => { setEditingBrand(null); setPage('editor'); };
  const startEdit = (b: Brand) => { setEditingBrand(b); setPage('editor'); };

  const handleSaveBrand = (b: Brand) => {
    setBrands(prev => {
      const exists = prev.findIndex(x => x.id === b.id);
      return exists >= 0 ? prev.map(x => x.id === b.id ? b : x) : [...prev, b];
    });
    setActiveBrand(b.id);
    setPage('brands');
  };

  const PLACEHOLDER_PAGES = ['models', 'styles', 'likes', 'collections', 'images', 'characters'];

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} activeBrand={activeBrand} brands={brands} />
      <div className="main">
        <div className="top-strip" />

        {page === 'explore' && (
          <ExplorePage
            brand={brand} brands={brands}
            activeBrand={activeBrand} setActiveBrand={setActiveBrand}
            prompt={prompt} setPrompt={setPrompt}
            onSend={() => { goGenerate(); setTimeout(send, 50); }}
            activePreset={activePreset} setPreset={setActivePreset}
            openCreateBrand={startCreate}
            goPage={setPage}
          />
        )}

        {page === 'brands' && (
          <BrandsPage
            brands={brands} activeBrand={activeBrand}
            setActiveBrand={setActiveBrand}
            onCreate={startCreate} onEdit={startEdit}
          />
        )}

        {page === 'editor' && (
          <BrandEditor brand={editingBrand} onBack={() => setPage('brands')} onSave={handleSaveBrand} />
        )}

        {page === 'batch' && (
          <GeneratePage
            stream={stream} prompt={prompt} setPrompt={setPrompt}
            onSend={send} onRegenerate={handleRegenerate}
            brand={brand} brands={brands}
            activeBrand={activeBrand} setActiveBrand={setActiveBrand}
            activePreset={activePreset} setPreset={setActivePreset}
            openCreateBrand={startCreate}
            openDetail={(msg, idx) => setDetail({ images: msg.images ?? [], idx, prompt: msg.prompt ?? '', brand: brand ?? undefined })}
          />
        )}

        {PLACEHOLDER_PAGES.includes(page) && <PlaceholderPage page={page} />}
      </div>

      {detail && (
        <DetailModal detail={detail} setDetail={setDetail} />
      )}
    </div>
  );
}
