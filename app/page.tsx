'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferenceImage {
  id: string;
  data: string;
  mimeType: string;
}

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
  referenceImages: ReferenceImage[];
}

interface StreamMessage {
  role: 'user' | 'asst';
  text?: string;
  loading?: boolean;
  images?: string[];
  prompt?: string;
  attachedImage?: string;
  error?: string;
  variant?: 'regen' | 'refine';
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
  { id: 'foundry', name: 'Foundry Coffee', logoText: 'Foundry', palette: ['#3D1F12','#C97A3A','#E9D5B5','#F5EBDB'], voice: 'Earthy, crafted, slow.', edited: '2d ago', keywords: ['warm grain','matte ceramic','shadow play'], samples: ['grad-1','grad-3','grad-9'], referenceImages: [] },
  { id: 'aria', name: 'Aria Skincare', logoText: 'aria', palette: ['#F5E6D3','#E8C5A0','#A87856','#3F2A1E'], voice: 'Soft, considered, luminous.', edited: '5h ago', keywords: ['diffused light','milky beige','glassy'], samples: ['grad-6','grad-2','grad-11'], referenceImages: [] },
  { id: 'monsoon', name: 'Monsoon Tech', logoText: 'Monsoon', palette: ['#0F1F3A','#4A90E2','#8FB8E8','#FFFFFF'], voice: 'Confident, calm, technical.', edited: 'last week', keywords: ['cool gradients','blue glass','clean type'], samples: ['grad-7','grad-12','grad-4'], referenceImages: [] },
  { id: 'plume', name: 'Plume Studio', logoText: 'Plume', palette: ['#FFE5EC','#FF7AA2','#5B1339','#FFFFFF'], voice: 'Playful, bold, expressive.', edited: '3d ago', keywords: ['soft pinks','high contrast','paper textures'], samples: ['grad-2','grad-5','grad-8'], referenceImages: [] },
];

const PROMPT_SUGGESTIONS = [
  {
    label: 'Product shot',
    sub: 'Studio · clean background',
    prompt: 'Professional studio product shot on a clean minimal surface, brand logo clearly visible, sharp focus, neutral background',
  },
  {
    label: 'Lifestyle moment',
    sub: 'Candid · natural light',
    prompt: 'Authentic lifestyle photo of someone using the product in a natural on-brand moment, warm natural light, shallow depth of field',
  },
  {
    label: 'Campaign hero',
    sub: 'Editorial · full bleed',
    prompt: 'Bold campaign hero image, dramatic lighting, minimal composition with strong negative space, publication-ready quality',
  },
];

// Placeholder gallery — 16 gradient tiles in a 4-col grid
const GALLERY_GRADS = [
  'grad-1','grad-7','grad-2','grad-11',
  'grad-9','grad-4','grad-6','grad-13',
  'grad-3','grad-12','grad-5','grad-8',
  'grad-10','grad-2','grad-7','grad-1',
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

// Extract N dominant colors from a dataURL using canvas pixel sampling.
// Quantizes to 32-step buckets to merge near-identical shades.
function extractDominantColors(dataURL: string, count = 5): Promise<string[]> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 60; canvas.height = 60;
      canvas.getContext('2d')!.drawImage(img, 0, 0, 60, 60);
      const d = canvas.getContext('2d')!.getImageData(0, 0, 60, 60).data;
      const freq: Record<string, number> = {};
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue; // skip transparent
        const r = Math.round(d[i] / 32) * 32;
        const g = Math.round(d[i + 1] / 32) * 32;
        const b = Math.round(d[i + 2] / 32) * 32;
        // Skip near-white and near-black (too common, not brand colors)
        if (r > 230 && g > 230 && b > 230) continue;
        if (r < 25 && g < 25 && b < 25) continue;
        const k = `${r},${g},${b}`;
        freq[k] = (freq[k] ?? 0) + 1;
      }
      const colors = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([k]) => {
          const [r, g, b] = k.split(',').map(Number);
          return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        });
      resolve(colors.length ? colors : ['#888888']);
    };
    img.onerror = () => resolve(['#888888']);
    img.src = dataURL;
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
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, activeBrand, brands }: {
  page: string; setPage: (p: string) => void; activeBrand: string | null; brands: Brand[];
}) {
  const brand = brands.find(b => b.id === activeBrand);
  const item = (id: string, icon: string, label: string, badge?: string) => (
    <button key={id} className={`sb-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
      <Icon name={icon} size={15}/><span>{label}</span>
      {badge && <span className="badge">{badge}</span>}
    </button>
  );
  return (
    <aside className="sb">
      <div className="sb-brand"><div className="sb-logo"/><div className="sb-name">ideogram</div></div>
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
        <div className="sb-credits">
          <div className="lbl">Active brand</div>
          <div className="val" style={{display:'flex',alignItems:'center',gap:8}}>
            {brand ? (
              <><span style={{display:'flex',height:14,width:24,borderRadius:3,overflow:'hidden'}}>
                {brand.palette.slice(0,4).map((c,i)=><span key={i} style={{flex:1,background:c}}/>)}
              </span><span style={{fontSize:12}}>{brand.name.split(' ')[0]}</span></>
            ) : <span style={{fontSize:12,color:'var(--text-3)'}}>None</span>}
          </div>
          <button className="upgrade" onClick={()=>setPage('brands')}>Manage brands</button>
        </div>
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
  openCreateBrand, brands, attached, setAttached, compact = false }: {
  value: string; setValue: (v: string) => void; onSend: () => void;
  brand: Brand | null; setActiveBrand: (id: string | null) => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void; brands: Brand[];
  attached: AttachedImage | null; setAttached: (img: AttachedImage | null) => void;
  compact?: boolean;
}) {
  const [popOpen, setPopOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setPopOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataURL = await resizeImage(file, 512, 0.75);
    setAttached({ dataURL, mimeType: 'image/jpeg', name: file.name });
    e.target.value = '';
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="composer">
      {attached && (
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'6px 8px',background:'var(--bg-3)',borderRadius:8}}>
          <img src={attached.dataURL} alt="" style={{width:36,height:36,borderRadius:6,objectFit:'cover'}}/>
          <span style={{fontSize:12,color:'var(--text-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{attached.name}</span>
          <button onClick={()=>setAttached(null)} style={{color:'var(--text-3)',display:'flex'}}><Icon name="x" size={12}/></button>
        </div>
      )}
      <textarea
        placeholder="Describe an image — your Brand DNA will be applied automatically…"
        value={value} onChange={e=>setValue(e.target.value)} onKeyDown={handleKey}
        rows={1}
        onInput={e=>{const t=e.target as HTMLTextAreaElement;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,140)+'px';}}
      />
      <div className="composer-tools">
        {/* Image attach */}
        <button className="tool-pill" onClick={()=>fileRef.current?.click()} title="Attach image">
          <Icon name="paperclip" size={11}/>
        </button>
        <input ref={fileRef} type="file" className="upload-input" accept="image/*" onChange={handleAttach}/>

        {/* Brand DNA picker */}
        <div style={{position:'relative'}} ref={popRef}>
          <button className="tool-pill active" onClick={()=>setPopOpen(o=>!o)}>
            {brand
              ? <><span className="swatch" style={{background:brand.palette[1]}}/>{brand.name.split(' ')[0]} DNA</>
              : <><Icon name="dna" size={11}/> Brand DNA</>}
            <Icon name="chevD" size={10}/>
          </button>
          {popOpen && (
            <div className="brand-pop" style={{bottom:'calc(100% + 6px)',left:0}}>
              <div className="brand-pop-h">Apply Brand DNA</div>
              {/* No brand option */}
              <div className={`brand-pop-row ${!brand?'active':''}`} onClick={()=>{setActiveBrand(null);setPopOpen(false);}}>
                <span className="pop-pal" style={{background:'var(--bg-3)',borderRadius:4}}/>
                <span className="nm" style={{color:'var(--text-3)'}}>No brand DNA</span>
                {!brand && <Icon name="check" size={13}/>}
              </div>
              {brands.map(b=>(
                <div key={b.id} className={`brand-pop-row ${brand?.id===b.id?'active':''}`}
                  onClick={()=>{setActiveBrand(b.id);setPopOpen(false);}}>
                  <span className="pop-pal">{b.palette.slice(0,4).map((c,i)=><span key={i} style={{background:c}}/>)}</span>
                  <span className="nm">{b.name}</span>
                  {brand?.id===b.id && <Icon name="check" size={13}/>}
                </div>
              ))}
              <hr/>
              <button className="brand-pop-add" onClick={()=>{openCreateBrand();setPopOpen(false);}}>
                <Icon name="plus" size={12}/> Create new brand
              </button>
            </div>
          )}
        </div>

        {!compact && (
          <button className={`tool-pill ${activePreset?'active':''}`} onClick={()=>setPreset(activePreset?null:'editorial')}>
            <Icon name="layers" size={11}/> Style
          </button>
        )}
        <button className="tool-pill"><Icon name="ratio" size={11}/> 1:1</button>
        <div className="spacer"/>
        <button className="send-btn" onClick={onSend} disabled={!value.trim() && !attached}>
          <Icon name="arrowU" size={14} stroke={2.2}/>
        </button>
      </div>
    </div>
  );
}

// ── Placeholder gallery ───────────────────────────────────────────────────────

function ExploreGallery() {
  return (
    <div style={{marginTop:32}}>
      <div className="sec-head" style={{marginTop:0,marginBottom:14}}>
        <h2>Explore <em>creations</em></h2>
        <button className="more">See more →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {GALLERY_GRADS.map((g,i)=>(
          <div key={i} className={`${g}`} style={{
            aspectRatio:'1/1',borderRadius:12,cursor:'pointer',
            transition:'transform 0.18s',border:'1px solid var(--line)',
          }}
          onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.02)')}
          onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}
          />
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

// ── Explore active — right results panel ──────────────────────────────────────

function ExploreResults({ stream, onRegenerate, onRefine, onOpenDetail }: {
  stream: StreamMessage[];
  onRegenerate: (msg: StreamMessage) => void;
  onRefine: (msg: StreamMessage, state: RefineState) => void;
  onOpenDetail: (msg: StreamMessage, imgIdx: number) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  // Track which block is in "refine mode" — keyed by stream index
  const [refining, setRefining] = useState<number | null>(null);

  useEffect(() => {
    if (canvasRef.current) canvasRef.current.scrollTop = canvasRef.current.scrollHeight;
  }, [stream]);

  const asstMsgs = stream.map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'asst');

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

// ── Explore page ──────────────────────────────────────────────────────────────

function ExplorePage({ brand, brands, activeBrand, setActiveBrand, prompt, setPrompt, onSend,
  activePreset, setPreset, openCreateBrand, stream, onRegenerate, onRefine,
  onOpenDetail, attached, setAttached, onReset }: {
  brand: Brand | null; brands: Brand[]; activeBrand: string | null;
  setActiveBrand: (id: string | null) => void;
  prompt: string; setPrompt: (v: string) => void; onSend: () => void;
  activePreset: string | null; setPreset: (id: string | null) => void;
  openCreateBrand: () => void;
  stream: StreamMessage[];
  onRegenerate: (msg: StreamMessage) => void;
  onRefine: (msg: StreamMessage, state: RefineState) => void;
  onOpenDetail: (msg: StreamMessage, imgIdx: number) => void;
  attached: AttachedImage | null; setAttached: (img: AttachedImage | null) => void;
  onReset: () => void;
}) {
  const active = stream.length > 0;

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
            {stream.map((m,i)=>(
              m.role==='user' ? (
                <div key={i} className={`msg-user ${m.variant ? `msg-user-${m.variant}` : ''}`}>
                  {m.attachedImage && (
                    <img src={m.attachedImage} alt="" style={{display:'block',width:120,borderRadius:8,marginBottom:6,objectFit:'cover'}}/>
                  )}
                  {m.text}
                </div>
              ) : (
                <div key={i} className={`msg-asst ${m.variant ? `msg-asst-${m.variant}` : ''}`}>
                  <div className="asst-head">
                    <span className={`dot ${m.loading ? 'generating-dot' : ''}`}/>
                    <span style={{fontSize:12,color:'var(--text-3)'}}>
                      {m.loading
                        ? <>{brand ? <><span style={{color:'var(--accent-text)',fontWeight:500}}>{brand.name}</span> DNA</> : 'Ideogram'} · Generating…</>
                        : m.error ? 'Error' : m.variant === 'regen' ? 'Regenerated' : m.variant === 'refine' ? 'Refined' : 'Ideogram'}
                    </span>
                  </div>
                  {!m.loading && m.error && <div className="error-banner">{m.error}</div>}
                  {!m.loading && !m.error && (
                    <div style={{fontSize:12,color:'var(--text-2)'}}>{m.text}</div>
                  )}
                </div>
              )
            ))}
          </div>
          <div className="composer-foot">
            <Composer value={prompt} setValue={setPrompt} onSend={onSend}
              brand={brand} setActiveBrand={setActiveBrand} brands={brands}
              activePreset={activePreset} setPreset={setPreset}
              openCreateBrand={openCreateBrand} attached={attached} setAttached={setAttached} compact/>
          </div>
        </div>

        {/* Right: results */}
        <ExploreResults stream={stream} onRegenerate={onRegenerate} onRefine={onRefine}
          onOpenDetail={onOpenDetail}/>
      </div>
    );
  }

  // Idle: hero + composer + gallery
  return (
    <div className="explore">
      <h1 className="hero-title">What will you create<br/><em>on-brand</em> today?</h1>
      <Composer value={prompt} setValue={setPrompt} onSend={onSend}
        brand={brand} setActiveBrand={setActiveBrand} brands={brands}
        activePreset={activePreset} setPreset={setPreset}
        openCreateBrand={openCreateBrand} attached={attached} setAttached={setAttached}/>
      <div className="prompt-suggestions">
        {PROMPT_SUGGESTIONS.map(s=>(
          <button key={s.label} className="suggestion-card" onClick={()=>{ setPrompt(s.prompt); }}>
            <div className="suggestion-label">{s.label}</div>
            <div className="suggestion-sub">{s.sub}</div>
          </button>
        ))}
      </div>
      <ExploreGallery/>
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
                {/* Ref count */}
                {b.referenceImages.length > 0 && (
                  <div style={{marginTop:8, fontSize:10, color:'var(--text-4)', display:'flex', alignItems:'center', gap:4}}>
                    <Icon name="image2" size={10}/> {b.referenceImages.length} ref image{b.referenceImages.length!==1?'s':''}
                  </div>
                )}
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
  const [palette, setPalette] = useState<string[]>(init?.palette ?? []);
  const [logoImage, setLogoImage] = useState<string|undefined>(init?.logoImage);
  const [logoText, setLogoText] = useState(init?.logoText ?? '');
  const [refImages, setRefImages] = useState<ReferenceImage[]>(init?.referenceImages ?? []);
  const logoRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);

  // Logo is the primary color source (up to 5 colors). Reference images only
  // fill remaining slots (1-2 each) if the logo doesn't saturate the palette.
  const refreshPalette = useCallback(async (logo: string | undefined, refs: ReferenceImage[]) => {
    const seen = new Set<string>();
    const dedup = (cols: string[]) => cols.filter(c => { if (seen.has(c)) return false; seen.add(c); return true; });

    const all: string[] = [];

    if (logo) {
      const logoColors = await extractDominantColors(logo, 5);
      all.push(...dedup(logoColors));
    }

    // Only pull from refs if logo didn't fill the palette
    if (all.length < 6) {
      for (const ref of refs.slice(0, 4)) {
        if (all.length >= 6) break;
        const refColors = await extractDominantColors(ref.data, 2);
        all.push(...dedup(refColors));
      }
    }

    if (!all.length && refs.length) {
      // No logo — fall back to refs as primary
      for (const ref of refs.slice(0, 3)) {
        const refColors = await extractDominantColors(ref.data, 2);
        all.push(...dedup(refColors));
      }
    }

    setPalette(all.slice(0, 6));
  }, []);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const d = await resizeImage(f, 800, 0.85);
    setLogoImage(d);
    if (!logoText) setLogoText(f.name.replace(/\.[^.]+$/, ''));
    await refreshPalette(d, refImages);
  };

  const handleRefs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newRefs: ReferenceImage[] = [];
    for (const f of files.slice(0, 5 - refImages.length)) {
      const d = await resizeImage(f, 512, 0.75);
      newRefs.push({ id: Math.random().toString(36).slice(2), data: d, mimeType: 'image/jpeg' });
    }
    const updated = [...refImages, ...newRefs];
    setRefImages(updated);
    await refreshPalette(logoImage, updated);
    e.target.value = '';
  };

  const removeRef = async (id: string) => {
    const updated = refImages.filter(r => r.id !== id);
    setRefImages(updated);
    await refreshPalette(logoImage, updated);
  };

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: init?.id ?? Math.random().toString(36).slice(2),
      name: name.trim(), logoText: logoText || name.split(' ')[0], logoImage,
      palette, voice: voice.trim(), edited: 'just now',
      keywords: [], samples: init?.samples ?? ['grad-1', 'grad-3', 'grad-9'],
      referenceImages: refImages,
    });
  };

  return (
    <>
      <div className="page-head">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <button className="btn-bare" onClick={onBack}><Icon name="chevL" size={16}/></button>
          <span style={{fontSize:12,color:'var(--text-3)'}}>Brand DNA / {init ? 'Edit' : 'Create'}</span>
        </div>
        <h1 className="page-h1">{init ? <>Edit <em>{init.name}</em></> : <>Define a new <em>Brand DNA</em></>}</h1>
        <p className="page-sub">Save your brand identity once. Apply it to any prompt to keep generations on-brand.</p>
      </div>
      <div className="page-content">
        <div className="editor">
          <div className="editor-main">

            {/* 1 — Brand basics */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">1</span> Brand basics</div>
              <div className="field">
                <label className="field-label">Brand name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Foundry Coffee"/>
              </div>
              <div className="field" style={{marginBottom:0}}>
                <label className="field-label">Voice &amp; feel <span style={{color:'var(--text-4)',fontWeight:400}}> — how does this brand feel?</span></label>
                <textarea className="textarea" value={voice} onChange={e => setVoice(e.target.value)}
                  placeholder="e.g. Earthy, slow, handcrafted — warm textures, muted tones, tactile."/>
              </div>
            </div>

            {/* 2 — Logo */}
            <div className="section-block">
              <div className="section-h-form"><span className="section-num">2</span> Logo</div>
              <div className={`logo-drop ${logoImage ? 'has-file' : ''}`} onClick={() => logoRef.current?.click()}>
                {logoImage
                  ? <img src={logoImage} alt="Logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',padding:8}}/>
                  : <div style={{textAlign:'center'}}><Icon name="upload" size={18}/><div style={{marginTop:6}}>Click to upload logo</div><div style={{fontSize:10,marginTop:2,color:'var(--text-4)'}}>SVG, PNG, JPG</div></div>}
              </div>
              <input ref={logoRef} type="file" className="upload-input" accept="image/*" onChange={handleLogo}/>
              {logoImage && (
                <div style={{marginTop:8,display:'flex',gap:6}}>
                  <input className="input" style={{flex:1,padding:'6px 10px',fontSize:12}} placeholder="Wordmark text"
                    value={logoText} onChange={e => setLogoText(e.target.value)}/>
                  <button className="btn-icon" onClick={async () => { setLogoImage(undefined); setLogoText(''); await refreshPalette(undefined, refImages); }}>
                    <Icon name="trash" size={13}/>
                  </button>
                </div>
              )}
            </div>

            {/* 3 — Reference imagery */}
            <div className="section-block">
              <div className="section-h-form">
                <span className="section-num">3</span> Reference imagery
                <span style={{marginLeft:'auto',fontSize:10,color:'var(--accent-text)',background:'var(--accent-soft)',padding:'2px 8px',borderRadius:100}}>Highest priority</span>
              </div>
              <p style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>
                Upload up to 5 example images. The model extracts their visual style for every generation.
                Colors are auto-detected from your logo and references.
              </p>
              <div className="ref-grid">
                {refImages.map(img => (
                  <div key={img.id} className="ref-tile" style={{position:'relative'}}>
                    <img src={img.data} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    <button onClick={() => removeRef(img.id)}
                      style={{position:'absolute',top:4,right:4,width:20,height:20,borderRadius:4,background:'rgba(0,0,0,0.6)',color:'white',display:'grid',placeItems:'center'}}>
                      <Icon name="x" size={10}/>
                    </button>
                  </div>
                ))}
                {Array.from({length: Math.max(0, 5 - refImages.length)}).map((_, i) => (
                  <div key={`add-${i}`} className="ref-tile add" onClick={() => refRef.current?.click()}>
                    <Icon name="plus" size={14}/>
                  </div>
                ))}
              </div>
              <input ref={refRef} type="file" className="upload-input" accept="image/*" multiple onChange={handleRefs}/>
            </div>

            {/* Auto-detected palette (read-only) */}
            {palette.length > 0 && (
              <div className="section-block">
                <div className="section-h-form"><span className="section-num">4</span> Detected color palette
                  <span style={{marginLeft:'auto',fontSize:10,color:'var(--text-4)'}}>Auto-detected from your images</span>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                  {palette.map((c, i) => (
                    <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{width:40,height:40,borderRadius:8,background:c,border:'1px solid var(--line)'}}/>
                      <div style={{fontSize:10,color:'var(--text-3)',fontFamily:'monospace'}}>{c.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!name.trim()}><Icon name="check" size={13}/> Save Brand DNA</button>
            </div>
          </div>

          <aside className="editor-preview">
            <div className="preview-h">Live preview</div>
            <div className={`preview-card ${init?.samples?.[0] ?? 'grad-1'}`}>
              {logoImage
                ? <img src={logoImage} alt="" style={{position:'absolute',bottom:12,left:14,height:40,objectFit:'contain',maxWidth:'60%'}}/>
                : logoText ? <div className="corner-logo">{logoText}</div> : null}
            </div>
            {palette.length > 0 && (
              <div className="preview-pal">{palette.map((c, i) => <span key={i} style={{background:c}}/>)}</div>
            )}
            <div className="preview-row"><span className="k">Voice</span><span style={{maxWidth:160,textAlign:'right',fontSize:11}}>{voice || 'Not set'}</span></div>
            <div className="preview-row">
              <span className="k">References</span>
              <span style={{color:refImages.length>0?'#C7F25E':'var(--text-3)'}}>
                {refImages.length > 0 ? `${refImages.length} / 5 ✓` : '0 / 5'}
              </span>
            </div>
            <div className="preview-row">
              <span className="k">Logo</span>
              <span style={{color:logoImage?'#C7F25E':'var(--text-3)'}}>{logoImage ? 'Uploaded' : 'None'}</span>
            </div>
            <div className="preview-row">
              <span className="k">Colors</span>
              <span style={{color:palette.length>0?'#C7F25E':'var(--text-3)'}}>
                {palette.length > 0 ? `${palette.length} detected` : 'Upload images'}
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
  const [attached, setAttached] = useState<AttachedImage|null>(null);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);

  const brand = brands.find(b => b.id === activeBrand) ?? null;

  const generateImages = useCallback(async (
    userPrompt: string, msgIdx: number, attachedImg: AttachedImage | null
  ) => {
    const currentBrand = brands.find(b => b.id === activeBrand) ?? null;

    const refImages = (currentBrand?.referenceImages ?? []).slice(0,3).map(img => {
      const { data, mimeType } = dataURLtoBase64(img.data);
      return { data, mimeType };
    });

    // If user attached an image, prepend it to references
    if (attachedImg) {
      const { data, mimeType } = dataURLtoBase64(attachedImg.dataURL);
      refImages.unshift({ data, mimeType });
    }

    let logoData: { data: string; mimeType: string } | undefined;
    if (currentBrand?.logoImage) logoData = dataURLtoBase64(currentBrand.logoImage);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          brand: currentBrand ? { name: currentBrand.name, voice: currentBrand.voice, keywords: currentBrand.keywords, palette: currentBrand.palette } : null,
          referenceImages: refImages.slice(0,3),
          logoImage: logoData,
          preset: activePreset,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Generation failed');

      const images: string[] = (json.images ?? []).map((img: { data: string; mimeType: string }) =>
        `data:${img.mimeType};base64,${img.data}`
      );

      const cappedImages = images.slice(0, 2);
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
        next[msgIdx] = {
          role: 'asst',
          text: `Generated ${cappedImages.length} image${cappedImages.length!==1?'s':''}${currentBrand?` with ${currentBrand.name} DNA`:''}`,
          images: cappedImages,
          prompt: userPrompt,
        };
        return next;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStream(prev => {
        const next = [...prev];
        next[msgIdx] = { role: 'asst', images: [], prompt: userPrompt, error: message };
        return next;
      });
    }
  }, [brands, activeBrand, activePreset]);

  const send = useCallback(() => {
    if (!prompt.trim() && !attached) return;
    const userPrompt = prompt.trim() || 'Generate an on-brand image';
    const snap = attached;
    setPrompt('');
    setAttached(null);

    setStream(prev => {
      const userMsg: StreamMessage = { role: 'user', text: userPrompt, attachedImage: snap?.dataURL };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(userPrompt, idx, snap), 0);
      return next;
    });
  }, [prompt, attached, generateImages]);

  const handleRegenerate = useCallback((msg: StreamMessage) => {
    if (!msg.prompt) return;
    setStream(prev => {
      const userMsg: StreamMessage = { role: 'user', text: '↺ Regenerate', variant: 'regen' };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true, variant: 'regen' };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(msg.prompt!, idx, null), 0);
      return next;
    });
  }, [generateImages]);

  const handleRefine = useCallback((msg: StreamMessage, state: RefineState) => {
    if (!msg.prompt) return;
    const issues = state.q1.length ? `Issues: ${state.q1.join(', ')}.` : '';
    const changes = state.q2.length ? `Changes needed: ${state.q2.join(', ')}.` : '';
    const focus = state.q3.length ? `Focus on: ${state.q3.join(', ')}.` : '';
    const notes = state.q4.trim() ? `Direction: ${state.q4.trim()}` : '';
    const feedback = [issues, changes, focus, notes].filter(Boolean).join(' ');
    const refinedPrompt = `${msg.prompt}\n\nREFINEMENT REQUEST: The previous generation had problems. ${feedback} Please generate a significantly improved version that fixes these specific issues while maintaining full brand DNA compliance.`;

    setStream(prev => {
      const parts = [state.q1, state.q2, state.q3].flat().filter(Boolean);
      const label = parts.slice(0, 3).join(' · ') || 'Refinement';
      const userMsg: StreamMessage = { role: 'user', text: `✦ Refine: ${label}`, variant: 'refine' };
      const loadingMsg: StreamMessage = { role: 'asst', loading: true, variant: 'refine' };
      const next = [...prev, userMsg, loadingMsg];
      const idx = next.length - 1;
      setTimeout(() => generateImages(refinedPrompt, idx, null), 0);
      return next;
    });
  }, [generateImages]);

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
      <Sidebar page={page} setPage={setPage} activeBrand={activeBrand} brands={brands}/>
      <div className="main">
        <div className="top-strip"/>

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
            onReset={() => setStream([])}
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
