'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Toaster, toast } from 'sonner';

// ─── Types (inline to avoid any external dependency issues) ─────────────────

interface PerfumeData {
  name: string;
  brand: string;
  gender?: 'men' | 'women' | 'unisex';
  notes?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
}

interface GeneratedImage {
  format: 'story' | 'post' | 'landscape';
  label: string;
  aspectRatio: string;
  url: string;
  dimensions: { width: number; height: number };
}

interface VideoInfo {
  id: string;
  aspectRatio: '9:16' | '16:9';
  status: string;
  videoUrl?: string | null;
  progress?: number;
  eta_sec?: number;
  error?: string;
  voiceoverText?: string;
  scenarioName?: string;
  hook?: string;
}

type Step = 'input' | 'generating' | 'output';
type Tab = 'overview' | 'images' | 'videos' | 'publish';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP — One-Click Magic Engine v2.0
// ═══════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const [step, setStep] = useState<Step>('input');
  const [productUrl, setProductUrl] = useState('');
  const [loadingStatus, setLoadingStatus] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');

  // Product data
  const [perfumeData, setPerfumeData] = useState<PerfumeData | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [videoCaptions, setVideoCaptions] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [voiceoverText, setVoiceoverText] = useState('');
  const [vibe, setVibe] = useState('');

  // Image uploads
  const [bottlePreview, setBottlePreview] = useState('');
  const [bottleBase64, setBottleBase64] = useState('');
  const [charPreview, setCharPreview] = useState('');
  const [charBase64, setCharBase64] = useState('');
  const bottleRef = useRef<HTMLInputElement>(null);
  const charRef = useRef<HTMLInputElement>(null);

  // Scheduling
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [metricoolOk, setMetricoolOk] = useState(false);

  // Video polling
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const videosRef = useRef<VideoInfo[]>([]);

  // Check Metricool
  useEffect(() => {
    fetch('/api/metricool/config').then(r => r.json()).then(d => setMetricoolOk(d.connected === true)).catch(() => {});
  }, []);

  // Sync ref
  useEffect(() => { videosRef.current = videos; }, [videos]);

  // ── Image upload handler ────────────────────────────────────────────────
  const onUpload = (type: 'bottle' | 'char', e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('ملف غير صالح'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('الحجم أكبر من 10MB'); return; }
    const r = new FileReader();
    r.onload = (ev) => {
      const b64 = ev.target?.result as string;
      if (type === 'bottle') { setBottleBase64(b64); setBottlePreview(b64); }
      else { setCharBase64(b64); setCharPreview(b64); }
    };
    r.readAsDataURL(f);
  };

  const removeImg = (type: 'bottle' | 'char') => {
    if (type === 'bottle') { setBottleBase64(''); setBottlePreview(''); if (bottleRef.current) bottleRef.current.value = ''; }
    else { setCharBase64(''); setCharPreview(''); if (charRef.current) charRef.current.value = ''; }
  };

  // ── Video Polling ───────────────────────────────────────────────────────
  const pollVideos = useCallback(async () => {
    const pending = videosRef.current.filter(v => v.id && ['pending', 'processing', 'queued', 'finalizing'].includes(v.status));
    if (!pending.length) {
      setPolling(false);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    try {
      const res = await fetch('/api/poll-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: pending.map(v => ({ id: v.id, aspectRatio: v.aspectRatio })) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setVideos(prev => {
        const u = [...prev];
        for (const r of data.results) {
          const i = u.findIndex(v => v.aspectRatio === r.aspectRatio);
          if (i !== -1) u[i] = { ...u[i], status: r.status, videoUrl: r.videoUrl || u[i].videoUrl, progress: r.progress ?? u[i].progress, eta_sec: r.eta_sec, error: r.error };
        }
        return u;
      });
      if (data.allComplete) {
        setPolling(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        toast.success('تم توليد الفيديوهات بنجاح!');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!polling) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const t = setTimeout(() => pollVideos(), 8000);
    pollRef.current = setInterval(() => pollVideos(), 12000);
    return () => { clearTimeout(t); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [polling, pollVideos]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAGIC GENERATE — the one and only button handler
  // ═══════════════════════════════════════════════════════════════════════════
  const handleMagic = async () => {
    if (!productUrl.trim()) { toast.error('أدخل رابط المنتج'); return; }
    setStep('generating'); setLoadingProgress(0);

    try {
      // 1. Scrape
      setLoadingStatus('جاري استخراج بيانات المنتج...'); setLoadingProgress(10);
      const scrapeRes = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: productUrl.trim() }) });
      if (!scrapeRes.ok) throw new Error((await scrapeRes.json()).error || 'فشل استخراج البيانات');
      const sd = await scrapeRes.json();
      const pd: PerfumeData = { name: sd.product.name ?? '', brand: sd.product.brand ?? '', gender: sd.product.gender ?? 'unisex', notes: sd.product.notes, description: sd.product.description, imageUrl: sd.product.imageUrl, price: sd.product.price };
      setPerfumeData(pd);
      const v = sd.recommendation?.vibe || 'oriental_palace';
      const att = sd.recommendation?.attire || 'saudi_bisht';
      setVibe(v);

      // 2. Images
      setLoadingStatus('جاري توليد الصور السينمائية...'); setLoadingProgress(25);
      const genRes = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfumeData: pd, vibe: v, attire: att, bottleImageBase64: bottleBase64 || undefined, characterImageBase64: charBase64 || undefined }) });
      if (!genRes.ok) throw new Error((await genRes.json()).error || 'فشل توليد الصور');
      const gd = await genRes.json();

      let done: GeneratedImage[] = [];
      if (gd.status === 'completed' && gd.images) {
        done = gd.images.map((i: any) => ({ format: i.format, label: i.label, dimensions: i.dimensions, url: i.url, aspectRatio: i.aspectRatio }));
      } else if (gd.pendingImages) {
        let pend = gd.pendingImages;
        for (let c = 0; c < 60 && pend?.length; c++) {
          setLoadingStatus(`جاري توليد الصور... (${c * 3}ث)`); setLoadingProgress(25 + Math.min(c, 30));
          await new Promise(r => setTimeout(r, 3000));
          const pr = await fetch('/api/poll-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pendingImages: pend }) });
          if (!pr.ok) continue;
          const pp = await pr.json();
          for (const r of pp.results) {
            if (r.status === 'COMPLETED' && r.imageUrl) {
              const f = r.format as 'story' | 'post' | 'landscape';
              done.push({ format: f, label: r.label, dimensions: r.dimensions, url: r.imageUrl, aspectRatio: f === 'story' ? '9:16' : f === 'post' ? '1:1' : '16:9' });
            }
          }
          pend = pp.results.filter((r: any) => r.status !== 'COMPLETED' && r.status !== 'FAILED');
          if (pp.allCompleted) break;
        }
      }
      if (!done.length) throw new Error('فشل توليد الصور');
      setImages(done);

      // 3. Captions
      setLoadingStatus('جاري كتابة الكابشنات...'); setLoadingProgress(60);
      try {
        const cr = await fetch('/api/captions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfumeData: pd, vibe: v, attire: att, productUrl: productUrl.trim() }) });
        if (cr.ok) { const cd = await cr.json(); setCaptions(cd.captions || {}); }
      } catch {}

      // Show results immediately
      setStep('output'); setTab('overview');
      toast.success('حملتك جاهزة! جاري توليد الفيديوهات...');

      // 4. Videos (background)
      setLoadingProgress(80);
      try {
        const storyUrl = done.find(i => i.format === 'story')?.url;
        const landUrl = done.find(i => i.format === 'landscape')?.url;
        if (storyUrl || landUrl) {
          setVideos([{ id: '', aspectRatio: '9:16', status: 'pending', progress: 0 }, { id: '', aspectRatio: '16:9', status: 'pending', progress: 0 }]);
          const vr = await fetch('/api/generate-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfumeData: pd, imageUrl: storyUrl || landUrl, landscapeImageUrl: landUrl || storyUrl, vibe: v }) });
          if (vr.ok) {
            const vd = await vr.json();
            setVoiceoverText(vd.voiceoverText || '');
            const nv: VideoInfo[] = vd.videos.map((x: any) => ({ id: x.id, aspectRatio: x.aspectRatio, status: x.status || 'queued', progress: 0, error: x.error, voiceoverText: x.voiceoverText, scenarioName: x.scenarioName, hook: x.hook }));
            setVideos(nv); videosRef.current = nv;
            if (nv.some(x => x.id && x.status !== 'failed' && x.status !== 'error')) setPolling(true);
            // Video captions
            try {
              const vc = await fetch('/api/video-captions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfumeData: pd, productUrl: productUrl.trim(), vibe: v }) });
              if (vc.ok) { const vcd = await vc.json(); setVideoCaptions(vcd.captions || {}); }
            } catch {}
          }
        }
      } catch { toast.info('فشل التوليد التلقائي للفيديو'); }
    } catch (e: any) {
      toast.error(e?.message || 'خطأ غير متوقع');
      setStep('input');
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────
  const reset = () => {
    setStep('input'); setProductUrl(''); setPerfumeData(null); setImages([]); setCaptions({}); setVideoCaptions({});
    setVideos([]); setVoiceoverText(''); setTab('overview'); setLoadingStatus(''); setLoadingProgress(0);
    setBottleBase64(''); setBottlePreview(''); setCharBase64(''); setCharPreview('');
    setPolling(false); setScheduleDate(''); setScheduleTime(''); setVibe('');
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (bottleRef.current) bottleRef.current.value = '';
    if (charRef.current) charRef.current.value = '';
  };

  const downloadAll = () => {
    const urls = [...images.map(i => i.url), ...videos.filter(v => v.videoUrl).map(v => v.videoUrl!)];
    if (!urls.length) { toast.error('لا توجد ملفات'); return; }
    urls.forEach(u => window.open(u, '_blank'));
    toast.success(`جاري تحميل ${urls.length} ملفات`);
  };

  const downloadCaptions = () => {
    if (!perfumeData) return;
    const all = { ...captions, ...videoCaptions };
    const lines = [`كابشنات: ${perfumeData.name}\n${'='.repeat(40)}`];
    for (const [k, v] of Object.entries(all)) {
      if (v) lines.push(`\n[${k.replace(/_/g, ' ').toUpperCase()}]\n${v}\n${'-'.repeat(30)}`);
    }
    const b = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = `captions-${perfumeData.name.substring(0, 20)}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleSmartPublish = async () => {
    if (!perfumeData) return;
    try {
      toast.info('جاري النشر الذكي عبر Metricool...');
      const res = await fetch('/api/metricool/smart-publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfumeName: perfumeData.name, perfumeBrand: perfumeData.brand, productUrl,
          captions, videoCaptions,
          imageUrls: { story: images.find(i => i.format === 'story')?.url, post: images.find(i => i.format === 'post')?.url, landscape: images.find(i => i.format === 'landscape')?.url },
          videoUrls: { vertical: videos.find(v => v.aspectRatio === '9:16' && v.videoUrl)?.videoUrl, horizontal: videos.find(v => v.aspectRatio === '16:9' && v.videoUrl)?.videoUrl },
        }),
      });
      const data = await res.json();
      if (data.success) toast.success(`تم جدولة ${data.summary?.totalScheduled || 0} منشور بنجاح!`);
      else toast.error(data.error || 'فشل النشر');
    } catch { toast.error('خطأ في النشر'); }
  };

  const completedVids = videos.filter(v => v.status === 'complete' && v.videoUrl);
  const pendingVids = videos.filter(v => ['pending', 'processing', 'queued', 'finalizing'].includes(v.status));

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100" dir="rtl">
      <Toaster richColors position="top-center" />

      {/* ── Header ── */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"/></svg>
            </div>
            <div>
              <h1 className="font-bold text-base">Mahwous Magic Engine</h1>
              <p className="text-[10px] text-gray-500">One-Click Content Generation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${metricoolOk ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-[10px] text-gray-500">{metricoolOk ? 'Metricool Connected' : 'Metricool Offline'}</span>
            </div>
            {step === 'output' && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-amber-400 transition px-3 py-1.5 rounded-lg border border-white/10 hover:border-amber-400/50">
                حملة جديدة
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ═══════════════════════════════════════════════════════════════════
            INPUT — 3 fields + 1 magic button
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'input' && (
          <div className="flex flex-col items-center justify-center min-h-[75vh] text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"/></svg>
                Magic Engine v2.0
              </div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 bg-clip-text text-transparent">
                حملتك الإعلانية بضغطة زر
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
                أدخل رابط المنتج وارفع الصور، واترك الباقي علينا.<br />صور سينمائية + فيديوهات بصوت عربي + كابشنات لكل المنصات + نشر ذكي
              </p>
            </div>

            <div className="w-full max-w-xl space-y-5">
              {/* 1. Product URL */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  رابط المنتج
                </label>
                <input
                  type="url"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition"
                  placeholder="https://mahwous.com/products/..."
                  value={productUrl}
                  onChange={e => setProductUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMagic()}
                  dir="ltr"
                />
              </div>

              {/* 2 & 3. Image Uploads */}
              <div className="grid grid-cols-2 gap-4">
                {/* Bottle */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    صورة الزجاجة (اختياري)
                  </label>
                  {!bottlePreview ? (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-amber-400/50 hover:bg-white/[0.02] transition group">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600 group-hover:text-amber-400 mb-2 transition"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span className="text-[10px] text-gray-600 group-hover:text-amber-400 transition">ارفع صورة الزجاجة</span>
                      <input ref={bottleRef} type="file" accept="image/*" className="hidden" onChange={e => onUpload('bottle', e)} />
                    </label>
                  ) : (
                    <div className="relative h-32 rounded-xl border border-amber-400/50 bg-white/[0.02] flex items-center justify-center p-2">
                      <img src={bottlePreview} alt="" className="max-h-full object-contain rounded-lg" />
                      <button onClick={() => removeImg('bottle')} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-500/30 hover:bg-red-500/60 flex items-center justify-center transition">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Character */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    صورة الشخصية (اختياري)
                  </label>
                  {!charPreview ? (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-purple-400/50 hover:bg-white/[0.02] transition group">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600 group-hover:text-purple-400 mb-2 transition"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span className="text-[10px] text-gray-600 group-hover:text-purple-400 transition">ارفع صورة الشخصية</span>
                      <input ref={charRef} type="file" accept="image/*" className="hidden" onChange={e => onUpload('char', e)} />
                    </label>
                  ) : (
                    <div className="relative h-32 rounded-xl border border-purple-400/50 bg-white/[0.02] flex items-center justify-center p-2">
                      <img src={charPreview} alt="" className="max-h-full object-contain rounded-lg" />
                      <button onClick={() => removeImg('char')} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-500/30 hover:bg-red-500/60 flex items-center justify-center transition">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* MAGIC BUTTON */}
              <button
                onClick={handleMagic}
                disabled={!productUrl.trim()}
                className="w-full py-4 text-base font-bold rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-30 disabled:shadow-none disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                <span className="text-xl">✨</span>
                Generate Magic Content
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-gray-500">
              {['3 صور سينمائية', '2 فيديو بصوت عربي', 'كابشنات لـ 15 منصة', 'جدولة ونشر ذكي', 'حزمة أوفلاين'].map(f => (
                <span key={f} className="px-3 py-1.5 rounded-full border border-white/5 bg-white/[0.02]">{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            GENERATING — spinner + progress
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center min-h-[75vh] text-center space-y-8">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <div className="absolute inset-3 rounded-full border-2 border-amber-300 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              <span className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">✨</span>
            </div>
            <div>
              <p className="text-xl font-bold mb-2">Magic Engine Working...</p>
              <p className="text-sm text-amber-400 animate-pulse">{loadingStatus}</p>
            </div>
            <div className="w-full max-w-sm">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700" style={{ width: `${loadingProgress}%` }} />
              </div>
              <p className="text-[10px] text-gray-600 mt-2">{loadingProgress}%</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OUTPUT — Results Dashboard
            ═══════════════════════════════════════════════════════════════════ */}
        {step === 'output' && perfumeData && (
          <div className="space-y-6">
            {/* Product Card */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-5">
              {perfumeData.imageUrl && <img src={perfumeData.imageUrl} alt="" className="w-20 h-20 object-contain rounded-xl bg-black/30 p-1" />}
              <div className="flex-1">
                <h3 className="font-bold text-lg">{perfumeData.name}</h3>
                <p className="text-sm text-gray-500">{perfumeData.brand}</p>
                {perfumeData.price && <p className="text-sm text-amber-400 font-medium mt-1">{perfumeData.price}</p>}
              </div>
              <div className="flex flex-col items-end gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-green-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  {images.length} صور
                </span>
                {completedVids.length > 0 && <span className="flex items-center gap-1.5 text-blue-400"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>{completedVids.length} فيديو</span>}
                {pendingVids.length > 0 && <span className="flex items-center gap-1.5 text-amber-400 animate-pulse">⏳ {pendingVids.length} قيد التوليد</span>}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'تحميل الكل', icon: '📥', color: 'green', fn: downloadAll },
                { label: 'الكابشنات', icon: '📝', color: 'purple', fn: downloadCaptions },
                { label: 'نشر ذكي', icon: '🚀', color: 'amber', fn: handleSmartPublish },
                { label: 'حملة جديدة', icon: '✨', color: 'gray', fn: reset },
              ].map(a => (
                <button key={a.label} onClick={a.fn} className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/10 hover:border-amber-400/30 hover:bg-white/[0.02] transition text-sm">
                  <span className="text-lg">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1.5 bg-white/[0.03] rounded-xl">
              {[
                { key: 'overview' as Tab, label: 'نظرة عامة' },
                { key: 'images' as Tab, label: 'الصور والكابشنات' },
                { key: 'videos' as Tab, label: 'الفيديو' },
                { key: 'publish' as Tab, label: 'الجدولة والنشر' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-amber-400 text-black' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                  {t.label}
                  {t.key === 'videos' && pendingVids.length > 0 && <span className="ml-2 inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
                </button>
              ))}
            </div>

            {/* ── Overview Tab ── */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Images */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h3 className="text-base font-bold text-amber-400 mb-4">الصور المولدة ({images.length})</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {images.map(img => (
                      <div key={img.format} className="relative rounded-xl overflow-hidden border border-white/10 group">
                        <img src={img.url} alt={img.label} className="w-full h-48 object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <p className="text-xs font-medium">{img.label}</p>
                          <p className="text-[10px] text-gray-400">{img.aspectRatio}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Videos */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h3 className="text-base font-bold text-blue-400 mb-4">الفيديوهات</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {videos.map(v => (
                      <div key={v.aspectRatio} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">{v.aspectRatio === '9:16' ? 'عمودي (TikTok/Reels)' : 'أفقي (YouTube)'}</span>
                          {v.status === 'complete' && <span className="text-green-400 text-xs">مكتمل ✓</span>}
                          {['pending', 'processing', 'queued', 'finalizing'].includes(v.status) && <span className="text-amber-400 text-xs animate-pulse">⏳ {v.progress || 0}%</span>}
                          {(v.status === 'failed' || v.status === 'error') && <span className="text-red-400 text-xs">فشل ✗</span>}
                        </div>
                        {v.videoUrl && <video src={v.videoUrl} controls className="w-full rounded-lg" />}
                        {!v.videoUrl && !v.error && <div className="h-28 flex items-center justify-center text-gray-600 text-xs">جاري المعالجة...</div>}
                        {v.error && <p className="text-xs text-red-400 mt-2">{v.error}</p>}
                        {v.voiceoverText && <p className="text-xs text-gray-500 mt-2 line-clamp-2" dir="rtl">{v.voiceoverText}</p>}
                      </div>
                    ))}
                    {!videos.length && <div className="col-span-2 py-8 text-center text-sm text-gray-600">جاري بدء توليد الفيديوهات...</div>}
                  </div>
                </div>

                {/* Captions Preview */}
                {Object.keys(captions).length > 0 && (
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <h3 className="text-base font-bold text-purple-400 mb-4">الكابشنات</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(captions).slice(0, 6).map(([k, v]) => (
                        <div key={k} className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                          <p className="text-[10px] text-amber-400 font-medium mb-1">{k.replace(/_/g, ' ').toUpperCase()}</p>
                          <p className="text-xs text-gray-400 line-clamp-3">{v?.substring(0, 120)}...</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setTab('images')} className="text-xs text-amber-400 mt-3 hover:underline">عرض الكل &larr;</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Images Tab ── */}
            {tab === 'images' && (
              <div className="space-y-6">
                {/* Full size images */}
                <div className="space-y-4">
                  {images.map(img => (
                    <div key={img.format} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">{img.label} ({img.aspectRatio})</h4>
                        <a href={img.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline">فتح بالحجم الكامل</a>
                      </div>
                      <img src={img.url} alt={img.label} className="w-full rounded-xl" />
                    </div>
                  ))}
                </div>
                {/* All captions */}
                {Object.keys(captions).length > 0 && (
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <h3 className="font-bold mb-4">جميع الكابشنات</h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {Object.entries({ ...captions, ...videoCaptions }).map(([k, v]) => v ? (
                        <div key={k} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-amber-400 font-bold">{k.replace(/_/g, ' ').toUpperCase()}</p>
                            <button onClick={() => { navigator.clipboard.writeText(v); toast.success('تم النسخ'); }} className="text-[10px] text-gray-500 hover:text-amber-400 transition">نسخ</button>
                          </div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed" dir="rtl">{v}</p>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Videos Tab ── */}
            {tab === 'videos' && (
              <div className="space-y-4">
                {videos.length > 0 ? videos.map(v => (
                  <div key={v.aspectRatio} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                    <h4 className="font-bold mb-3">{v.aspectRatio === '9:16' ? 'فيديو عمودي — TikTok / Reels / Stories' : 'فيديو أفقي — YouTube'}</h4>
                    {v.videoUrl ? (
                      <video src={v.videoUrl} controls className="w-full max-w-lg mx-auto rounded-xl" />
                    ) : v.error ? (
                      <p className="text-red-400 text-sm">{v.error}</p>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="inline-block w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm text-gray-500">جاري التوليد... {v.progress ? `${v.progress}%` : ''}</p>
                        {v.eta_sec && <p className="text-xs text-gray-600 mt-1">الوقت المتبقي: ~{Math.ceil(v.eta_sec / 60)} دقيقة</p>}
                      </div>
                    )}
                    {v.voiceoverText && <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/5"><p className="text-xs text-gray-500 mb-1">النص الصوتي:</p><p className="text-sm text-gray-300" dir="rtl">{v.voiceoverText}</p></div>}
                    {v.hook && <p className="text-xs text-amber-400 mt-2">Hook: {v.hook}</p>}
                  </div>
                )) : (
                  <div className="py-16 text-center">
                    <div className="inline-block w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-500">جاري بدء توليد الفيديوهات...</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Publish Tab ── */}
            {tab === 'publish' && (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h3 className="font-bold text-amber-400 mb-4">جدولة النشر عبر Metricool</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">التاريخ</label>
                      <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-100 focus:outline-none focus:border-amber-400/50 transition" dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">الوقت</label>
                      <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-gray-100 focus:outline-none focus:border-amber-400/50 transition" dir="ltr" />
                    </div>
                  </div>
                  {!metricoolOk && <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 mb-4">Metricool غير متصل — أضف METRICOOL_API_TOKEN في Vercel</div>}
                  <button onClick={handleSmartPublish} disabled={!metricoolOk} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-sm disabled:opacity-30 transition hover:shadow-lg hover:shadow-amber-500/20">
                    🚀 نشر ذكي لجميع المنصات
                  </button>
                </div>

                {/* Summary */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <h4 className="font-bold mb-3">المحتوى المتاح للنشر</h4>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <p className="text-2xl font-bold text-green-400">{images.length}</p>
                      <p className="text-gray-500 mt-1">صور</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <p className="text-2xl font-bold text-blue-400">{completedVids.length}</p>
                      <p className="text-gray-500 mt-1">فيديوهات</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                      <p className="text-2xl font-bold text-purple-400">{Object.keys(captions).length + Object.keys(videoCaptions).length}</p>
                      <p className="text-gray-500 mt-1">كابشنات</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-4 mt-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-[10px] text-gray-600">Mahwous AI Content Engine</p>
          <span className="text-[10px] px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 font-medium border border-amber-400/20">
            v2.0 - Magic Engine Active
          </span>
        </div>
      </footer>
    </div>
  );
}
