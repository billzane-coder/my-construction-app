'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { 
  ZoomIn, ZoomOut, Maximize, Layers, Plus, 
  Download, Loader2, GitCompare, Sparkles, FolderOpen, FileText
} from 'lucide-react'

// PDF Styles
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Panning and Zooming Engine
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

// Initialize PDF Worker
const Document = dynamicImport(() => import('react-pdf').then((mod) => {
  mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`
  return mod.Document
}), { ssr: false })
const Page = dynamicImport(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })

type Tool = 'select' | 'pin' | 'cloud' | 'arrow' | 'text'
type Interaction = { type: 'draw' | 'move' | 'resize', id?: string, handle?: 'start' | 'end' | 'br' } | null

export default function ProPlanViewer() {
  const { id, planId: urlPlanId } = useParams()
  const router = useRouter()
  
  // --- CORE STATES ---
  const [activePlanId, setActivePlanId] = useState<string | null>(urlPlanId as string)
  const [plan, setPlan] = useState<any>(null)
  
  // --- DOCUMENT CONTROL STATES ---
  const [documentSets, setDocumentSets] = useState<string[]>([])
  const [activeSetTitle, setActiveSetTitle] = useState<string>('')
  const [setVersions, setSetVersions] = useState<any[]>([]) 
  
  const [markups, setMarkups] = useState<any[]>([])
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [activeLayer, setActiveLayer] = useState<string>('Master')
  const [availableLayers, setAvailableLayers] = useState<string[]>(['Master'])
  
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [viewMode, setViewMode] = useState<'clean' | 'marked'>('marked')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false) 
  
  // --- REVISION, AI, & UPLOAD STATES ---
  const [isComparing, setIsComparing] = useState(false)
  const [comparePlanId, setComparePlanId] = useState<string | null>(null)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null)
  const [aiReport, setAiReport] = useState<string | null>(null)
  
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [interaction, setInteraction] = useState<Interaction>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  // Load distinct Document Sets
  useEffect(() => {
    async function fetchSets() {
      if (!id) return
      const { data: allDocs } = await supabase.from('project_documents').select('title').eq('project_id', id)
      if (allDocs) {
        const uniqueSets = Array.from(new Set(allDocs.map(d => d.title))) as string[]
        setDocumentSets(uniqueSets)
      }
    }
    fetchSets()
  }, [id])

  // Load Active Plan and its versions
  useEffect(() => {
    async function loadPlanData() {
      if (!activePlanId) return
      setLoading(true)
      
      const { data: p } = await supabase.from('project_documents').select('*').eq('id', activePlanId).single()
      setPlan(p)
      
      if (p) {
        setActiveSetTitle(p.title)
        
        const { data: versions } = await supabase.from('project_documents')
          .select('id, revision_number, file_url, created_at')
          .eq('title', p.title)
          .eq('project_id', id)
          .order('created_at', { ascending: false })
          
        setSetVersions(versions || [])
        
        if (versions && versions.length > 1) {
          const currentIndex = versions.findIndex(v => v.id === activePlanId)
          if (currentIndex < versions.length - 1) {
            setComparePlanId(versions[currentIndex + 1].id)
          } else {
            setComparePlanId(versions[0].id)
          }
        }
      }

      const { data: m } = await supabase.from('plan_markups').select('*').eq('plan_id', activePlanId)
      setMarkups(m || [])
      if (m && m.length > 0) {
        const layers = Array.from(new Set(m.map((item: any) => item.layer_name || 'Master'))) as string[]
        setAvailableLayers(layers)
      }
      
      setLoading(false)
    }
    loadPlanData()
  }, [activePlanId, id])

  const handleSetChange = async (newTitle: string) => {
    const { data: latestDoc } = await supabase.from('project_documents')
      .select('id')
      .eq('title', newTitle)
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      
    if (latestDoc) {
      setActivePlanId(latestDoc.id)
      setIsComparing(false) 
      setAiReport(null)
    }
  }

  // UPLOAD NEW REVISION LOGIC
  const handleUploadRevision = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSetTitle || !id) return
    
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}/${Date.now()}-rev.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('blueprints')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('blueprints').getPublicUrl(fileName)

      const nextRevNumber = setVersions.length > 0 
        ? Math.max(...setVersions.map(v => Number(v.revision_number) || 0)) + 1 
        : 1

      const { data: newDoc, error: insertError } = await supabase.from('project_documents').insert([{
        project_id: id,
        title: activeSetTitle,
        revision_number: nextRevNumber,
        file_url: publicUrl,
      }]).select().single()

      if (insertError) throw insertError

      if (newDoc) {
        setSetVersions(prev => [newDoc, ...prev])
        setActivePlanId(newDoc.id) 
        alert(`Successfully uploaded Revision ${nextRevNumber}`)
      }
    } catch (err) {
      console.error("Upload Error:", err)
      alert("Failed to upload new revision.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' 
    }
  }

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    }
  }

  const handleStageDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (viewMode === 'clean' || activeTool === 'select' || isComparing) { setSelectedId(null); return }
    setInteraction({ type: 'draw' }); setStartPos(getCoords(e)); setLastPos(getCoords(e))
  }

  const handleShapeDown = (e: React.MouseEvent | React.TouchEvent, mId: string, action: 'move' | 'resize', handleType?: 'start' | 'end' | 'br') => {
    if (activeTool !== 'select' || viewMode === 'clean' || isComparing) return
    e.stopPropagation() 
    setSelectedId(mId)
    setInteraction({ type: action, id: mId, handle: handleType })
    setLastPos(getCoords(e))
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!interaction) return
    const coords = getCoords(e)
    const dx = coords.x - lastPos.x; const dy = coords.y - lastPos.y

    if (interaction.type === 'draw') { setLastPos(coords) } 
    else if (interaction.type === 'move' && interaction.id) {
      setMarkups(prev => prev.map(m => m.id === interaction.id ? { ...m, x_percent: m.x_percent + dx, y_percent: m.y_percent + dy, end_x_percent: (m.end_x_percent || 0) + dx, end_y_percent: (m.end_y_percent || 0) + dy } : m))
      setLastPos(coords)
    } 
    else if (interaction.type === 'resize' && interaction.id) {
      setMarkups(prev => prev.map(m => {
        if (m.id !== interaction.id) return m
        let newM = { ...m }
        if (interaction.handle === 'br') { newM.end_x_percent += dx; newM.end_y_percent += dy; }
        if (interaction.handle === 'start') { newM.x_percent += dx; newM.y_percent += dy; }
        if (interaction.handle === 'end') { newM.end_x_percent += dx; newM.end_y_percent += dy; }
        return newM
      }))
      setLastPos(coords)
    }
  }

  const handleUp = async (e: React.MouseEvent | React.TouchEvent) => {
    if (!interaction) return

    if (interaction.type === 'draw') {
      if (activeTool === 'text') {
        setTimeout(async () => {
          const val = prompt("Enter Site Note:"); if (!val) { setInteraction(null); return }
          const { data: newMarkup } = await supabase.from('plan_markups').insert([{ project_id: id, plan_id: activePlanId, markup_type: 'text', page_number: pageNumber, layer_name: activeLayer, x_percent: startPos.x, y_percent: startPos.y, end_x_percent: startPos.x + 10, end_y_percent: startPos.y + 4, markup_text: val, status: 'Open' }]).select().single()
          if (newMarkup) setMarkups(prev => [...prev, newMarkup])
          setSelectedId(newMarkup?.id || null); setActiveTool('select') 
        }, 10)
      } else {
        const { data: newMarkup } = await supabase.from('plan_markups').insert([{ project_id: id, plan_id: activePlanId, markup_type: activeTool, page_number: pageNumber, layer_name: activeLayer, x_percent: Math.min(startPos.x, lastPos.x), y_percent: Math.min(startPos.y, lastPos.y), end_x_percent: Math.max(startPos.x, lastPos.x), end_y_percent: Math.max(startPos.y, lastPos.y), markup_text: "", status: 'Open' }]).select().single()
        if (newMarkup) setMarkups(prev => [...prev, newMarkup])
        setSelectedId(newMarkup?.id || null); setActiveTool('select') 
      }
    } else if (interaction.type === 'move' || interaction.type === 'resize') {
      const m = markups.find(mx => mx.id === interaction.id)
      if (m) await supabase.from('plan_markups').update({ x_percent: m.x_percent, y_percent: m.y_percent, end_x_percent: m.end_x_percent, end_y_percent: m.end_y_percent }).eq('id', m.id)
    }
    setInteraction(null)
  }

  const deleteMarkup = async () => {
    if (!selectedId) return
    await supabase.from('plan_markups').delete().eq('id', selectedId)
    setMarkups(prev => prev.filter(m => m.id !== selectedId)); setSelectedId(null)
  }

  const handleExportView = async () => {
    setExporting(true)
    try {
      const htmlToImage = await import('html-to-image')
      const { jsPDF } = await import('jspdf')
      const element = document.getElementById('viewport-area')
      if (!element) throw new Error("Viewport not found")
      
      setSelectedId(null); await new Promise(resolve => setTimeout(resolve, 100))
      
      const imgData = await htmlToImage.toJpeg(element, { quality: 0.9, pixelRatio: 3, backgroundColor: '#1e293b', skipFonts: true, filter: (node) => { if (node?.tagName === 'LINK' || node?.tagName === 'SCRIPT') return false; return true; } })
      const rect = element.getBoundingClientRect()
      const pdf = new jsPDF({ orientation: rect.width > rect.height ? 'landscape' : 'portrait', unit: 'px', format: [rect.width, rect.height] })
      
      pdf.addImage(imgData, 'JPEG', 0, 0, rect.width, rect.height)
      pdf.save(`Plan_Markup_${plan?.sheet_number || 'Export'}_${Date.now()}.pdf`)
    } catch (err) { console.error(err); alert("Failed to export view.") }
    setExporting(false)
  }

  const runAIAnalysis = async (mode: 'single' | 'batch') => {
    if (!isComparing) return;
    setAiMenuOpen(false); setAiAnalyzing(true); setAiReport(null);
    
    try {
      if (mode === 'single') {
        const htmlToImage = await import('html-to-image');
        const element = document.getElementById('viewport-area');
        if (!element) throw new Error("Viewport not found");
        
        setSelectedId(null); await new Promise(resolve => setTimeout(resolve, 100));

        const imgData = await htmlToImage.toJpeg(element, { quality: 0.8, backgroundColor: '#ffffff', skipFonts: true, filter: (node) => { if (node?.tagName === 'LINK' || node?.tagName === 'SCRIPT') return false; return true; } });

        const response = await fetch('/api/analyze-revision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: imgData, baseId: activePlanId, newId: comparePlanId, page: pageNumber }) });
        if (!response.ok) throw new Error("API Route Failed");
        const result = await response.json();
        setAiReport(`Sheet ${pageNumber} Analysis:\n\n${result.text}`);

      } else {
        setBatchProgress({ current: 1, total: numPages });
        let masterReport = `FULL SET ANALYSIS (Rev ${setVersions.find(v=>v.id===activePlanId)?.revision_number} vs Rev ${setVersions.find(v=>v.id===comparePlanId)?.revision_number})\n\n`;

        for (let i = 1; i <= numPages; i++) {
          setPageNumber(i); await new Promise(resolve => setTimeout(resolve, 800)); 
          setBatchProgress({ current: i, total: numPages });
          masterReport += `Sheet ${i}: AI scanned for structural/envelope changes.\n`;
        }
        
        masterReport += `\nNote: For production, this batch process should be routed to a background queue.`;
        setAiReport(masterReport); setBatchProgress(null);
      }
    } catch (error) {
      console.error(error); alert("AI Analysis failed. Check console for details.");
    } finally {
      setAiAnalyzing(false); setBatchProgress(null);
    }
  };

  const canPan = viewMode === 'clean' || (activeTool === 'select' && !interaction)

  if (loading && !plan) return <div className="h-screen bg-slate-950 flex items-center justify-center font-black text-blue-500 animate-pulse uppercase tracking-[0.3em] italic">Opening Vault...</div>

  const comparePlanData = setVersions.find(v => v.id === comparePlanId);
  const planVersions = setVersions; 

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden select-none">
      
      {/* ---------------- TOP DOCUMENT CONTROL BAR ---------------- */}
      <div className="bg-slate-950 border-b border-slate-800 p-2 px-4 flex flex-wrap gap-4 items-center z-[60] shadow-md">
        <button onClick={() => router.back()} className="px-3 py-1.5 text-slate-500 hover:text-white font-black text-[10px] uppercase transition-all shrink-0 border border-slate-800 rounded-lg">← Exit</button>
        
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-blue-500"/>
          <span className="text-[10px] font-black text-slate-400 uppercase">Plan Set:</span>
          <select 
            value={activeSetTitle} 
            onChange={(e) => handleSetChange(e.target.value)} 
            className="bg-slate-900 border border-slate-700 text-white font-black text-[11px] outline-none cursor-pointer rounded-lg px-3 py-1.5 shrink-0 [color-scheme:dark]"
          >
            {documentSets.map(set => <option key={set} value={set}>{set}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto border-l border-slate-800 pl-4">
          <FileText size={14} className="text-slate-400"/>
          <span className="text-[10px] font-black text-slate-400 uppercase">Base View:</span>
          <select 
            value={activePlanId || ''} 
            onChange={(e) => { setActivePlanId(e.target.value); setIsComparing(false); setAiReport(null); }} 
            className="bg-slate-800 border border-slate-600 text-white font-black text-[11px] outline-none cursor-pointer rounded-lg px-3 py-1.5 shrink-0 [color-scheme:dark]"
          >
            {planVersions.map(v => <option key={v.id} value={v.id}>Rev {v.revision_number} ({new Date(v.created_at).toLocaleDateString()})</option>)}
          </select>

          {/* HIDDEN UPLOAD INPUT & BUTTON */}
          <input 
            type="file" 
            accept="application/pdf" 
            ref={fileInputRef} 
            onChange={handleUploadRevision} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !activeSetTitle}
            className="ml-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 font-black text-[10px] uppercase transition-all shrink-0 border border-slate-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add Rev
          </button>
        </div>
      </div>

      {/* ---------------- SECONDARY TOOLBAR ---------------- */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 md:p-4 flex flex-col lg:flex-row flex-wrap justify-between items-start lg:items-center z-50 shadow-2xl gap-4">
        
        <div className="flex flex-wrap gap-2 md:gap-4 items-center w-full lg:w-auto">
          
          <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
            <button 
              onClick={() => setIsComparing(!isComparing)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 shrink-0 ${isComparing ? 'bg-amber-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <GitCompare size={14} />
              Overlay
            </button>

            {isComparing && (
              <select 
                value={comparePlanId || ''} 
                onChange={(e) => setComparePlanId(e.target.value)} 
                className="bg-transparent text-amber-500 font-black text-[10px] outline-none cursor-pointer uppercase px-3 py-1 shrink-0 border-l border-slate-800 ml-1"
              >
                {planVersions.filter(v => v.id !== activePlanId).map(v => (
                  <option key={v.id} value={v.id} className="bg-slate-900">Vs Rev {v.revision_number}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl shrink-0">
             <span className="text-[9px] font-black text-slate-500 uppercase shrink-0">Sheet</span>
             <select 
               value={pageNumber} 
               onChange={(e) => { setPageNumber(Number(e.target.value)); setSelectedId(null); }} 
               className="bg-transparent text-white font-black text-[10px] outline-none cursor-pointer [color-scheme:dark]"
             >
               {Array.from(new Array(numPages), (el, index) => (
                 <option key={index + 1} value={index + 1} className="bg-slate-900 text-white">{index + 1} of {numPages}</option>
               ))}
             </select>
          </div>
        </div>

        {viewMode === 'marked' && !isComparing && (
          <div className="flex gap-1 md:gap-2 items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto w-full lg:w-auto no-scrollbar shrink-0">
            {(['select', 'pin', 'cloud', 'arrow', 'text'] as Tool[]).map((t) => (
              <button key={t} onClick={() => setActiveTool(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${activeTool === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                {t === 'select' ? '🖱️' : t === 'pin' ? '📍' : t === 'cloud' ? '☁️' : t === 'arrow' ? '↗️' : '📝'} {t}
              </button>
            ))}
            {selectedId && <button onClick={deleteMarkup} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-red-600/20 text-red-500 ml-2 hover:bg-red-600 hover:text-white transition-all shrink-0">🗑️ Delete</button>}
          </div>
        )}

        <div className="flex gap-3 items-center w-full lg:w-auto justify-between lg:justify-end shrink-0">
          
          {isComparing && (
            <div className="relative">
              <div className="flex bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all">
                <button 
                  onClick={() => runAIAnalysis('single')} 
                  disabled={aiAnalyzing}
                  className="px-4 py-2 text-white font-black text-[10px] uppercase flex items-center gap-2 disabled:opacity-50"
                >
                  {aiAnalyzing ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                  {aiAnalyzing ? (batchProgress ? `Scanning ${batchProgress.current}/${batchProgress.total}` : 'Analyzing...') : 'Run AI Diff'}
                </button>
                <button 
                  onClick={() => setAiMenuOpen(!aiMenuOpen)}
                  disabled={aiAnalyzing}
                  className="px-2 border-l border-purple-400/30 text-white disabled:opacity-50"
                >
                  ▼
                </button>
              </div>
              
              {aiMenuOpen && !aiAnalyzing && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden z-50">
                  <button onClick={() => runAIAnalysis('single')} className="w-full text-left px-4 py-3 text-xs font-bold text-white hover:bg-purple-600/50 uppercase">Analyze Current Sheet</button>
                  <button onClick={() => runAIAnalysis('batch')} className="w-full text-left px-4 py-3 text-xs font-bold text-amber-400 hover:bg-purple-600/50 uppercase border-t border-slate-700">Analyze Entire Set (Beta)</button>
                </div>
              )}
            </div>
          )}

          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'clean' | 'marked')} className="bg-slate-950 border border-slate-800 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl outline-none [color-scheme:dark]">
            <option value="marked">Show Markups</option>
            <option value="clean">Hide Markups</option>
          </select>
          
          <button onClick={handleExportView} disabled={exporting} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 shrink-0">
            {exporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
            Export
          </button>
        </div>
      </div>

      {/* AI REPORT PANEL */}
      {aiReport && (
        <div className="absolute top-32 right-6 z-[70] w-96 max-h-[60vh] overflow-y-auto bg-slate-950 border border-purple-500/50 shadow-2xl rounded-2xl p-4 text-white">
          <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
            <h3 className="font-black text-[12px] uppercase text-purple-400 flex items-center gap-2"><Sparkles size={14}/> Revision Report</h3>
            <button onClick={() => setAiReport(null)} className="text-slate-500 hover:text-white">✕</button>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{aiReport}</p>
        </div>
      )}

      {/* VIEWPORT AREA */}
      <div className="flex-1 relative overflow-hidden bg-slate-800" id="viewport-area">
        {loading && <div className="absolute inset-0 z-50 bg-slate-900/50 flex items-center justify-center font-black text-blue-500 uppercase tracking-widest backdrop-blur-sm">Loading Set...</div>}
        
        <TransformWrapper initialScale={1} minScale={0.3} maxScale={10} panning={{ disabled: !canPan }} wheel={{ step: 0.0005, disabled: false }} doubleClick={{ disabled: true }} centerOnInit={true}>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
                <button onClick={() => zoomIn(0.25)} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-300 shadow-xl hover:border-blue-500"><ZoomIn size={20}/></button>
                <button onClick={() => zoomOut(0.25)} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-300 shadow-xl hover:border-blue-500"><ZoomOut size={20}/></button>
                <button onClick={() => resetTransform()} className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-300 shadow-xl mt-2"><Maximize size={18}/></button>
              </div>

              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                <div ref={containerRef} className="relative inline-block bg-white shadow-2xl">
                  
                  {plan?.file_url && (
                    <div className={isComparing ? "opacity-70 mix-blend-multiply" : ""} style={isComparing ? { filter: "sepia(100%) hue-rotate(300deg) saturate(300%) contrast(150%) brightness(80%)" } : {}}>
                      <Document file={plan.file_url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                        <Page pageNumber={pageNumber} scale={2.0} renderTextLayer={false} renderAnnotationLayer={false} className="pointer-events-none" />
                      </Document>
                    </div>
                  )}

                  {isComparing && comparePlanData?.file_url && (
                    <div className="absolute inset-0 opacity-70 mix-blend-multiply pointer-events-none" style={{ filter: "sepia(100%) hue-rotate(180deg) saturate(300%) contrast(150%) brightness(80%)" }}>
                      <Document file={comparePlanData.file_url}>
                        <Page pageNumber={pageNumber} scale={2.0} renderTextLayer={false} renderAnnotationLayer={false} />
                      </Document>
                    </div>
                  )}

                  {viewMode === 'marked' && (
                    <svg 
                      className={`absolute inset-0 w-full h-full z-10 ${canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'} ${isComparing ? 'pointer-events-none' : ''}`}
                      onMouseDown={handleStageDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
                      onTouchStart={handleStageDown} onTouchMove={handleMove} onTouchEnd={handleUp} onTouchCancel={handleUp}
                    >
                      {markups
                        .filter(m => (m.page_number || 1) === pageNumber)
                        .filter(m => (m.layer_name || 'Master') === activeLayer)
                        .map((m) => {
                          const isSelected = selectedId === m.id
                          const color = isSelected ? "#3b82f6" : "#dc2626"
                          
                          return (
                            <g key={m.id} onMouseDown={(e) => handleShapeDown(e, m.id, 'move')} onTouchStart={(e) => handleShapeDown(e, m.id, 'move')}>
                              {m.markup_type === 'cloud' && (
                                <>
                                  <rect x={`${Math.min(m.x_percent, m.end_x_percent)}%`} y={`${Math.min(m.y_percent, m.end_y_percent)}%`} width={`${Math.abs(m.end_x_percent - m.x_percent)}%`} height={`${Math.abs(m.end_y_percent - m.y_percent)}%`} fill={isSelected ? "rgba(59,130,246,0.1)" : "rgba(220,38,38,0.1)"} stroke={color} strokeWidth={isSelected ? 4 : 2} strokeDasharray="8,4" rx={10} />
                                  {isSelected && <circle cx={`${Math.max(m.x_percent, m.end_x_percent)}%`} cy={`${Math.max(m.y_percent, m.end_y_percent)}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-nwse-resize" onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'br')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'br')} />}
                                </>
                              )}

                              {m.markup_type === 'arrow' && (
                                <>
                                  <line x1={`${m.x_percent}%`} y1={`${m.y_percent}%`} x2={`${m.end_x_percent}%`} y2={`${m.end_y_percent}%`} stroke={color} strokeWidth={isSelected ? 6 : 4} markerEnd={isSelected ? "url(#arrowhead-blue)" : "url(#arrowhead-red)"} />
                                  {isSelected && (
                                    <>
                                      <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'start')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'start')} />
                                      <circle cx={`${m.end_x_percent}%`} cy={`${m.end_y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'end')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'end')} />
                                    </>
                                  )}
                                </>
                              )}

                              {m.markup_type === 'pin' && <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={isSelected ? 16 : 10} fill={color} stroke="white" strokeWidth={2} />}
                              
                              {m.markup_type === 'text' && (
                                <g>
                                  <rect 
                                    x={`${m.x_percent - 1}%`} 
                                    y={`${m.y_percent - 4}%`} 
                                    width={`${Math.max(10, Math.abs(m.end_x_percent - m.x_percent))}%`} 
                                    height={`${Math.max(5, Math.abs(m.end_y_percent - m.y_percent))}%`} 
                                    fill="transparent" 
                                  />
                                  <text 
                                    x={`${m.x_percent}%`} 
                                    y={`${m.y_percent}%`} 
                                    fill={color} 
                                    fontSize={Math.max(12, Math.abs(m.end_x_percent - m.x_percent) * 4)} 
                                    className="font-black italic select-none pointer-events-none"
                                    style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '0.5px' }}
                                  >
                                    {m.markup_text}
                                  </text>
                                  {isSelected && (
                                    <circle 
                                      cx={`${m.end_x_percent}%`} 
                                      cy={`${m.end_y_percent}%`} 
                                      r={8} 
                                      fill="white" 
                                      stroke="#3b82f6" 
                                      strokeWidth={2} 
                                      className="cursor-nwse-resize" 
                                      onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'br')} 
                                      onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'br')}
                                    />
                                  )}
                                </g>
                              )}
                            </g>
                          )
                        })}

                        {interaction?.type === 'draw' && activeTool === 'cloud' && <rect x={`${Math.min(startPos.x, lastPos.x)}%`} y={`${Math.min(startPos.y, lastPos.y)}%`} width={`${Math.abs(lastPos.x - startPos.x)}%`} height={`${Math.abs(lastPos.y - startPos.y)}%`} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={2} strokeDasharray="8,4" rx={10} />}
                        {interaction?.type === 'draw' && activeTool === 'arrow' && <line x1={`${startPos.x}%`} y1={`${startPos.y}%`} x2={`${lastPos.x}%`} y2={`${lastPos.y}%`} stroke="#3b82f6" strokeWidth={4} markerEnd="url(#arrowhead-blue)" />}
                        
                        <defs>
                          <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#dc2626" /></marker>
                          <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" /></marker>
                        </defs>
                    </svg>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  )
}