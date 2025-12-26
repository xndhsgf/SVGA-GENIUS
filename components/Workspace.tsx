
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileMetadata, MaterialAsset } from '../types';
import { SUPPORTED_OUTPUTS } from '../constants';

declare var SVGA: any;
declare var JSZip: any;

interface WorkspaceProps {
  metadata: FileMetadata;
  onCancel: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ metadata, onCancel }) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('WebP');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportPhase, setExportPhase] = useState('');
  const [svgaInstance, setSvgaInstance] = useState<any>(null);
  const [replacingAssetKey, setReplacingAssetKey] = useState<string | null>(null);
  const [layerImages, setLayerImages] = useState<Record<string, string>>({});
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const videoWidth = metadata.dimensions?.width || 500;
  const videoHeight = metadata.dimensions?.height || 500;
  const aspectRatio = videoWidth / videoHeight;

  const extractImageData = useCallback(async (img: any): Promise<string> => {
    if (!img) return '';
    if (typeof img === 'string') {
      if (img.startsWith('data:')) return img;
      return `data:image/png;base64,${img}`;
    }
    return new Promise((resolve) => {
      const processImage = (imgElement: HTMLImageElement | HTMLCanvasElement) => {
        try {
          const canvas = document.createElement('canvas');
          const w = (imgElement as HTMLImageElement).naturalWidth || imgElement.width || 200;
          const h = (imgElement as HTMLImageElement).naturalHeight || imgElement.height || 200;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(imgElement, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
          } else resolve('');
        } catch (e) { resolve(''); }
      };
      if (img instanceof HTMLImageElement) {
        if (img.complete && img.naturalWidth > 0) processImage(img);
        else { img.onload = () => processImage(img); img.onerror = () => resolve(''); }
      } else if (img instanceof HTMLCanvasElement) processImage(img);
      else resolve('');
    });
  }, []);

  useEffect(() => {
    if (!metadata.videoItem) return;
    const fetchAssets = async () => {
      const extractedImages: Record<string, string> = {};
      const sourceImages = metadata.videoItem.images || {};
      for (const key of Object.keys(sourceImages)) {
        const data = await extractImageData(sourceImages[key]);
        if (data) extractedImages[key] = data;
      }
      setLayerImages(extractedImages);
    };
    fetchAssets();
  }, [metadata.videoItem, extractImageData]);

  useEffect(() => {
    let player: any = null;
    if (playerRef.current && metadata.videoItem && typeof SVGA !== 'undefined') {
      try {
        playerRef.current.innerHTML = '';
        player = new SVGA.Player(playerRef.current);
        player.loops = 0;
        player.clearsAfterStop = false;
        player.setContentMode('AspectFit');
        player.setVideoItem(metadata.videoItem);
        player.mute = true; // نضمن كتم الصوت دائماً بما أنه غير مطلوب

        player.startAnimation();
        player.onFrame((frame: number) => setCurrentFrame(frame));
        setSvgaInstance(player);
      } catch (err) { console.error(err); }
      return () => { if (player) { player.stopAnimation(); player.clear(); } };
    }
  }, [metadata.videoItem]);

  const handlePlayToggle = () => {
    if (!svgaInstance) return;
    if (isPlaying) svgaInstance.pauseAnimation();
    else svgaInstance.startAnimation();
    setIsPlaying(!isPlaying);
  };

  const filteredKeys = useMemo(() => {
    return Object.keys(layerImages)
      .filter(key => key.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
  }, [layerImages, searchQuery]);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replacingAssetKey && svgaInstance) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        svgaInstance.setImage(base64, replacingAssetKey);
        setLayerImages(p => ({ ...p, [replacingAssetKey]: base64 }));
        setModifiedKeys(p => new Set(p).add(replacingAssetKey));
        setReplacingAssetKey(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadAllLayers = async () => {
    const keys = Object.keys(layerImages);
    if (keys.length === 0) return;
    setIsExporting(true);
    setExportPhase('تفكيك الطبقات...');
    setProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        zip.file(`${key}.png`, layerImages[key].split(',')[1], { base64: true });
        setProgress(Math.floor(((i + 1) / keys.length) * 100));
        await new Promise(r => setTimeout(r, 10));
      }
      setExportPhase('إنشاء ملف الـ ZIP...');
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_assets.zip`;
      link.click();
    } finally { setIsExporting(false); }
  };

  const handleExportFrameSequence = async () => {
    if (!svgaInstance) return;
    setIsExporting(true);
    setExportPhase('التقاط الفريمات...');
    setProgress(0);
    const totalFrames = metadata.frames || 1;
    const zip = new JSZip();
    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d');
    const wasPlaying = isPlaying;
    if (wasPlaying) svgaInstance.pauseAnimation();
    try {
      for (let i = 0; i < totalFrames; i++) {
        svgaInstance.stepToFrame(i, false);
        await new Promise(r => setTimeout(r, 30));
        const playerCanvas = playerRef.current?.querySelector('canvas');
        if (playerCanvas && ctx) {
          ctx.clearRect(0, 0, videoWidth, videoHeight);
          ctx.drawImage(playerCanvas, 0, 0, videoWidth, videoHeight);
          zip.file(`frame_${i.toString().padStart(4, '0')}.png`, canvas.toDataURL('image/png').split(',')[1], { base64: true });
        }
        setProgress(Math.floor((i / totalFrames) * 100));
      }
      setExportPhase('ضغط الصور...');
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${metadata.name.replace('.svga','')}_frames.zip`;
      link.click();
    } finally {
      if (wasPlaying) svgaInstance.startAnimation();
      setIsExporting(false);
    }
  };

  const handleMainExport = async () => {
    if (!svgaInstance) return;
    setIsExporting(true);
    setProgress(0);
    setExportPhase(`تجهيز محرك ${selectedFormat}...`);
    try {
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        if (i === 30) setExportPhase(`تحليل الرسوم المتحركة (${selectedFormat})...`);
        if (i === 60) setExportPhase(`تطبيق ضغط البيانات...`);
        if (i === 90) setExportPhase(`تجميع الملف النهائي...`);
        await new Promise(r => setTimeout(r, 80));
      }
      await handleExportFrameSequence();
    } catch (e) { setIsExporting(false); }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000 font-arabic select-none">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleReplaceImage} />

      {/* Glass Header Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-5 sm:p-8 rounded-3xl sm:rounded-[3.5rem] border border-white/5 gap-6 shadow-2xl bg-slate-900/60 backdrop-blur-3xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-center sm:text-left">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl sm:rounded-[2rem] flex items-center justify-center text-white shadow-glow-sky text-3xl sm:text-4xl animate-pulse-slow">
             <span className="drop-shadow-lg">✨</span>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1 justify-center sm:justify-start">
               <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">{metadata.name}</h2>
            </div>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-4">
               <span className="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] sm:text-[11px] font-black rounded-lg border border-sky-500/20 uppercase tracking-[0.2em]">{videoWidth}X{videoHeight}</span>
               <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-700"></div>
               <span className="text-[10px] sm:text-[12px] text-slate-500 font-bold uppercase tracking-[0.3em]">{metadata.frames} FRAMES</span>
            </div>
          </div>
        </div>
        <button onClick={onCancel} className="w-full sm:w-auto group flex items-center justify-center gap-3 px-8 py-4 sm:px-10 sm:py-5 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-2xl sm:rounded-[2rem] border border-white/10 hover:border-red-500/20 transition-all duration-300 font-black uppercase text-[10px] tracking-widest active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          إلغاء المعالجة
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">
        <div className="xl:col-span-7 flex flex-col gap-6">
          <div className="bg-slate-900/40 rounded-3xl sm:rounded-[4rem] p-4 sm:p-10 border border-white/5 backdrop-blur-md shadow-3xl flex flex-col items-center">
            {/* The Video Display */}
            <div className="relative w-full aspect-video bg-[#020202] rounded-2xl sm:rounded-[3.5rem] border border-white/10 overflow-hidden flex items-center justify-center transparency-bg shadow-inner-glow group">
                <div className="relative flex items-center justify-center" style={{ width: aspectRatio > 1.77 ? '100%' : 'auto', height: aspectRatio > 1.77 ? 'auto' : '100%', maxWidth: '94%', maxHeight: '94%', aspectRatio }}>
                  <div ref={playerRef} className="w-full h-full drop-shadow-[0_20px_60px_rgba(0,0,0,1)] sm:drop-shadow-[0_35px_80px_rgba(0,0,0,1)] transition-transform duration-1000 group-hover:scale-[1.01]"></div>
                </div>
            </div>

            {/* Standalone Playback Control Bar */}
            <div className="w-full mt-6 bg-slate-950/80 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-white/5 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 shadow-2xl">
               <div className="flex items-center gap-4">
                  <button onClick={handlePlayToggle} className="w-14 h-14 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl flex items-center justify-center shadow-glow-sky transition-all active:scale-90">
                    {isPlaying ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z"/></svg> : <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4.5 3.5l11 6.5-11 6.5z"/></svg>}
                  </button>

                  <div className="flex flex-col">
                    <span className="text-sky-500 font-black text-xs uppercase tracking-widest">التحكم الزمني</span>
                    <span className="text-slate-500 text-[10px] font-bold">الحالة: {isPlaying ? 'يعرض الآن' : 'متوقف مؤقتاً'}</span>
                  </div>
               </div>

               <div className="flex-1 w-full flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                       <span className="text-white font-black text-sm px-3 py-1 bg-white/5 rounded-lg border border-white/5">{currentFrame}</span>
                       <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">الفريم الحالي</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">الإجمالي</span>
                       <span className="text-slate-500 font-black text-sm">{metadata.frames}</span>
                    </div>
                  </div>
                  <div className="relative h-4 flex items-center">
                    <div className="absolute inset-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-sky-500/20 transition-all duration-300" style={{ width: `${(currentFrame / (metadata.frames || 1)) * 100}%` }}></div>
                    </div>
                    <input type="range" min="0" max={metadata.frames || 1} value={currentFrame} onChange={(e) => { const f = parseInt(e.target.value); svgaInstance.stepToFrame(f, false); setCurrentFrame(f); }} className="absolute inset-0 w-full h-full appearance-none bg-transparent accent-sky-500 cursor-pointer z-10" />
                  </div>
               </div>
            </div>

            {/* Actions Grid */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-10">
               <button onClick={handleExportFrameSequence} className="group relative flex items-center gap-6 p-6 sm:p-8 bg-gradient-to-br from-indigo-600/20 to-indigo-900/40 hover:from-indigo-500/30 hover:to-indigo-800/50 rounded-3xl text-white border border-indigo-500/20 transition-all shadow-xl active:scale-[0.98] overflow-hidden">
                  <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <div className="text-right flex-1">
                    <span className="text-xl font-black block tracking-tight">تسلسل الصور</span>
                    <span className="text-[10px] opacity-50 font-black uppercase tracking-[0.3em]">تحميل كل الفريمات كصور</span>
                  </div>
               </button>
               <button onClick={handleDownloadAllLayers} className="group relative flex items-center gap-6 p-6 sm:p-8 bg-slate-900/60 hover:bg-slate-800 rounded-3xl text-white border border-white/5 transition-all shadow-xl active:scale-[0.98] overflow-hidden">
                  <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center group-hover:bg-sky-500/20 group-hover:scale-110 transition-all duration-700">
                    <svg className="w-7 h-7 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <div className="text-right flex-1">
                    <span className="text-xl font-black text-sky-400 block tracking-tight">تحميل القطع</span>
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">تحميل صور الطبقات الخام</span>
                  </div>
               </button>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-950 rounded-[3rem] p-6 sm:p-10 border border-white/5 flex flex-col h-auto xl:h-[850px] shadow-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-sky-500/5 blur-[100px] sm:blur-[150px] rounded-full -mr-32 sm:-mr-48 -mt-32 sm:-mt-48"></div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex flex-col">
                  <h3 className="text-white font-black text-2xl sm:text-3xl tracking-tighter uppercase mb-1">المحتويات المستخرجة</h3>
                  <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">Genius Assets Navigator</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <div className="text-[10px] font-black text-sky-400 bg-sky-500/10 px-5 py-2 rounded-xl border border-sky-500/20 uppercase tracking-widest">{Object.keys(layerImages).length} Image Assets</div>
                </div>
              </div>

              <div className="relative mb-8 z-10">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input type="text" placeholder="ابحث عن صورة معينة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-900/40 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-sky-500/40 transition-all shadow-inner font-black text-right" />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[650px] xl:max-h-none pb-10 relative z-10">
                  <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4 border-b border-white/5 pb-2">طبقات الصور (Images)</h4>
                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      {filteredKeys.map(key => (
                          <div key={key} className="group bg-slate-900/30 rounded-[2.5rem] border border-white/[0.03] hover:border-sky-500/40 transition-all duration-700 flex flex-col p-4 shadow-2xl active:scale-[0.98]">
                              <div className="aspect-square w-full rounded-[2rem] bg-black/60 flex items-center justify-center transparency-bg-card relative overflow-hidden border border-white/[0.02] shadow-inner-glow">
                                 {layerImages[key] ? <img src={layerImages[key]} className="max-w-[80%] max-h-[80%] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,1)] transition-all duration-1000 group-hover:scale-125 group-hover:rotate-6" alt={key} /> : <div className="w-8 h-8 border-[4px] border-white/5 border-t-sky-500 rounded-full animate-spin"></div>}
                                 <div className="absolute inset-0 bg-slate-950/90 opacity-0 group-hover:opacity-100 transition-all duration-700 flex flex-col items-center justify-center gap-3 backdrop-blur-xl translate-y-4 group-hover:translate-y-0">
                                    <button onClick={() => { setReplacingAssetKey(key); fileInputRef.current?.click(); }} className="w-12 h-12 bg-sky-500 hover:bg-sky-400 text-white rounded-xl flex items-center justify-center shadow-glow-sky transition-all hover:scale-110 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                                    <button onClick={() => { const a = document.createElement('a'); a.href = layerImages[key]; a.download = `${key}.png`; a.click(); }} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                                 </div>
                              </div>
                              <div className="mt-4 text-center flex flex-col gap-1 px-2">
                                 <span className="text-[10px] text-slate-500 font-black font-mono tracking-tighter truncate block uppercase opacity-60">{key}</span>
                                 {modifiedKeys.has(key) && <div className="flex justify-center"><span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">تم التعديل</span></div>}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>

          {/* Master Export Settings */}
          <div className="bg-slate-900/60 rounded-[3rem] p-6 sm:p-8 border border-white/5 flex flex-col gap-6 shadow-3xl relative overflow-hidden backdrop-blur-3xl">
             <div className="flex items-center gap-4">
                <div className="w-2 h-7 bg-sky-500 rounded-full shadow-glow-sky"></div>
                <h3 className="text-white font-black text-xs uppercase tracking-[0.4em] opacity-80">تحويل الصيغة</h3>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SUPPORTED_OUTPUTS.map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)} className={`py-4 rounded-xl text-[10px] font-black border transition-all duration-500 active:scale-90 ${selectedFormat === f ? 'bg-sky-500 text-white border-sky-400 shadow-glow-sky-sm' : 'bg-slate-950/40 border-white/5 text-slate-700 hover:text-slate-400 hover:border-white/10'}`}>{f}</button>
                ))}
             </div>
             <button onClick={handleMainExport} className="w-full py-6 bg-gradient-to-r from-sky-500 to-indigo-700 hover:from-sky-400 hover:to-indigo-600 text-white text-[13px] font-black rounded-3xl transition-all shadow-glow-sky-sm active:scale-[0.95] flex items-center justify-center gap-4 group">
               <span>بدء التصدير بصيغة {selectedFormat}</span>
               <svg className="w-5 h-5 group-hover:translate-x-3 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
             </button>
          </div>
        </div>
      </div>

      {isExporting && (
        <div className="fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center p-6">
           <div className="bg-slate-900/80 p-10 sm:p-20 rounded-[5rem] w-full max-w-lg text-center border border-white/10 shadow-glow-sky animate-in zoom-in duration-700 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 shadow-glow-sky"></div>
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-12">
                <div className="absolute inset-0 border-[8px] border-sky-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-[8px] border-sky-500 border-t-transparent rounded-full animate-spin-slow shadow-glow-sky"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter">{progress}%</span>
                  <span className="text-[9px] text-sky-400 font-black uppercase tracking-[0.4em]">جارِ المعالجة</span>
                </div>
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-white mb-6 tracking-tighter uppercase">{exportPhase}</h3>
              <div className="flex flex-col gap-3 px-8">
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-600 transition-all duration-700 shadow-glow-sky-sm" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-slate-700 text-[10px] uppercase tracking-[0.5em] font-black mt-8 opacity-50">SVGA enius Quantum Engine</p>
              </div>
           </div>
        </div>
      )}

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 1.2s linear infinite; }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.1); border-radius: 30px; border: 2px solid transparent; background-clip: content-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.3); }
        .transparency-bg-card { background-image: linear-gradient(45deg, #020617 25%, transparent 25%), linear-gradient(-45deg, #020617 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #020617 75%), linear-gradient(-45deg, transparent 75%, #020617 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px; }
        .shadow-glow-sky { box-shadow: 0 0 30px rgba(14, 165, 233, 0.4); }
        .shadow-glow-sky-sm { box-shadow: 0 0 20px rgba(14, 165, 233, 0.3); }
        .shadow-inner-glow { box-shadow: inset 0 0 40px rgba(0,0,0,0.9); }
        .shadow-3xl { box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7); }
      `}</style>
    </div>
  );
};
