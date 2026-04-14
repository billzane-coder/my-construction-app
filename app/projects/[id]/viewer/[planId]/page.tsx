'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Panning and Zooming Engine
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

// Initialize PDF Worker
const Document = dynamic(() => import('react-pdf').then((mod) => {
  mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`
  return mod.Document
}), { ssr: false })
const Page = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false })

type Tool = 'select' | 'pin' | 'cloud' | 'arrow' | 'text'
type Interaction = { type: 'draw' | 'move' | 'resize', id?: string, handle?: 'start' | 'end' | 'br' } | null

export default function ProPlanViewer() {
  const { id, planId } = useParams()
  const router = useRouter()
  
  const [plan, setPlan] = useState<any>(null)
  const [planVersions, setPlanVersions] = useState<any[]>([])
  const [markups, setMarkups] = useState<any[]>([])
  
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [viewMode, setViewMode] = useState<'clean' | 'marked'>('clean')
  const [loading, setLoading] = useState(true)
  
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [interaction, setInteraction] = useState<Interaction>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: p } = await supabase.from('project_documents').select('*').eq('id', planId).single()
      const [versions, m] = await Promise.all([
        supabase.from('project_documents').select('id, revision_number').eq('title', p.title).eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('plan_markups').select('*').eq('plan_id', planId)
      ])
      
      setPlan(p); setPlanVersions(versions.data || []); setMarkups(m.data || []); setLoading(false)
    }
    init()
  }, [planId, id])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && activeTool === 'select') {
        await deleteMarkup(selectedId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, activeTool])

  const deleteMarkup = async (markupId: string) => {
    await supabase.from('plan_markups').delete().eq('id', markupId)
    setMarkups(prev => prev.filter(m => m.id !== markupId))
    setSelectedId(null)
  }

  // --- COORDINATE MATH (Still works perfectly with TransformWrapper zooming) ---
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

  // --- INTERACTION HANDLERS ---
  const handleStageDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (viewMode === 'clean' || activeTool === 'select') {
      setSelectedId(null)
      return // TransformWrapper will automatically handle panning here
    }
    setInteraction({ type: 'draw' })
    const coords = getCoords(e)
    setStartPos(coords)
    setLastPos(coords)
  }

  const handleShapeDown = (e: React.MouseEvent | React.TouchEvent, mId: string, action: 'move' | 'resize', handleType?: 'start' | 'end' | 'br') => {
    if (activeTool !== 'select' || viewMode === 'clean') return
    e.stopPropagation() // Crucial: Prevents TransformWrapper from panning while dragging shapes
    setSelectedId(mId)
    setInteraction({ type: action, id: mId, handle: handleType })
    setLastPos(getCoords(e))
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!interaction) return
    const coords = getCoords(e)
    const dx = coords.x - lastPos.x
    const dy = coords.y - lastPos.y

    if (interaction.type === 'draw') {
      setLastPos(coords)
    } else if (interaction.type === 'move' && interaction.id) {
      setMarkups(prev => prev.map(m => m.id === interaction.id ? { ...m, x_percent: m.x_percent + dx, y_percent: m.y_percent + dy, end_x_percent: (m.end_x_percent || 0) + dx, end_y_percent: (m.end_y_percent || 0) + dy } : m))
      setLastPos(coords)
    } else if (interaction.type === 'resize' && interaction.id) {
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
      let textVal = ""
      if (activeTool === 'text') textVal = prompt("Enter text:") || "New Note"
      
      let finalEnd = lastPos
      if (activeTool === 'cloud' && Math.abs(finalEnd.x - startPos.x) < 1) finalEnd = { x: startPos.x + 8, y: startPos.y + 5 }

      const { data: newMarkup } = await supabase.from('plan_markups').insert([{
        project_id: id, plan_id: planId, markup_type: activeTool,
        x_percent: Math.min(startPos.x, finalEnd.x), y_percent: Math.min(startPos.y, finalEnd.y),
        end_x_percent: Math.max(startPos.x, finalEnd.x), end_y_percent: Math.max(startPos.y, finalEnd.y),
        markup_text: textVal, status: 'Open'
      }]).select().single()

      if (newMarkup) setMarkups([...markups, newMarkup])
      setSelectedId(newMarkup?.id || null)
      if (activeTool !== 'text') setActiveTool('select') 

    } else if (interaction.type === 'move' || interaction.type === 'resize') {
      const m = markups.find(mx => mx.id === interaction.id)
      if (m) await supabase.from('plan_markups').update({ x_percent: m.x_percent, y_percent: m.y_percent, end_x_percent: m.end_x_percent, end_y_percent: m.end_y_percent }).eq('id', m.id)
    }
    setInteraction(null)
  }

  // Calculate if the user is allowed to pan the map
  // Allowed if: View mode is clean, OR we are on the Select tool AND not currently dragging a shape
  const canPan = viewMode === 'clean' || (activeTool === 'select' && !interaction)

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center font-black text-blue-500 animate-pulse tracking-widest uppercase">Rendering Vault...</div>

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden print:bg-white print:h-auto print:overflow-visible">
      
      {/* TOOLBAR */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex flex-wrap justify-between items-center z-50 shadow-2xl print:hidden gap-4">
        <div className="flex gap-4 items-center">
          <button onClick={() => router.back()} className="px-4 py-2 text-slate-500 hover:text-white font-black text-[10px] uppercase transition-all">← Exit</button>
          <div className="h-8 w-[1px] bg-slate-800" />
          
          <select value={planId as string} onChange={(e) => router.push(`/projects/${id}/viewer/${e.target.value}`)} className="bg-slate-900 border border-slate-700 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl outline-none">
            {planVersions.map(v => <option key={v.id} value={v.id}>{plan?.title} - {v.revision_number}</option>)}
          </select>

          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'clean' | 'marked')} className={`font-black text-[10px] uppercase px-4 py-2 rounded-xl outline-none border ${viewMode === 'marked' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}`}>
            <option value="clean">Clean Document</option>
            <option value="marked">Active Markups</option>
          </select>
        </div>

        {viewMode === 'marked' && (
          <div className="flex gap-2 items-center bg-slate-900 p-1 rounded-2xl border border-slate-800">
            {(['select', 'pin', 'cloud', 'arrow', 'text'] as Tool[]).map((t) => (
              <button key={t} onClick={() => setActiveTool(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTool === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                {t === 'select' ? '🖱️' : t === 'pin' ? '📍' : t === 'cloud' ? '☁️' : t === 'arrow' ? '↗️' : '📝'} {t}
              </button>
            ))}
            {selectedId && (
              <button onClick={() => deleteMarkup(selectedId)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white transition-all ml-2">
                🗑️ Delete
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 items-center">
          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border border-slate-700">
            Export PDF
          </button>
        </div>
      </div>

      {/* VIEWPORT AREA */}
      <div className="flex-1 relative overflow-hidden bg-slate-800 select-none print:bg-white print:overflow-visible">
        
        {/* TransformWrapper handles the Pan & Zoom Engine */}
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={6}
          panning={{ disabled: !canPan }} // Disables panning when drawing
          wheel={{ step: 0.1 }}
          centerOnInit={true}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Floating Zoom Controls */}
              <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 print:hidden">
                <button onClick={() => zoomIn()} className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:border-blue-500 shadow-xl transition-all"><ZoomIn size={20}/></button>
                <button onClick={() => zoomOut()} className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:border-blue-500 shadow-xl transition-all"><ZoomOut size={20}/></button>
                <button onClick={() => resetTransform()} className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:border-blue-500 shadow-xl transition-all mt-2"><Maximize size={18}/></button>
              </div>

              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                <div ref={containerRef} className="relative inline-block shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-white print:shadow-none print:w-full">
                  
                  {plan?.file_url && (
                    <Document file={plan.file_url} loading={<div className="p-20 text-slate-500 font-black">Rendering Document...</div>}>
                      {/* Scale set to 2.0 to ensure sharp text when zooming in */}
                      <Page pageNumber={1} scale={2.0} renderTextLayer={false} renderAnnotationLayer={false} className="pointer-events-none print:w-full" />
                    </Document>
                  )}

                  {/* SVG EDIT LAYER */}
                  {(viewMode === 'marked' || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
                    <svg 
                      className={`absolute inset-0 w-full h-full z-10 ${canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                      onMouseDown={handleStageDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
                      onTouchStart={handleStageDown} onTouchMove={handleMove} onTouchEnd={handleUp}
                    >
                      {markups.map((m) => {
                        const isSelected = selectedId === m.id
                        const dynamicStroke = isSelected ? 4 : 2 
                        
                        return (
                          <g key={m.id} className={activeTool === 'select' ? 'cursor-move' : ''} onMouseDown={(e) => handleShapeDown(e, m.id, 'move')} onTouchStart={(e) => handleShapeDown(e, m.id, 'move')}>
                            {m.markup_type === 'cloud' && (
                              <>
                                <rect x={`${Math.min(m.x_percent, m.end_x_percent)}%`} y={`${Math.min(m.y_percent, m.end_y_percent)}%`} width={`${Math.abs(m.end_x_percent - m.x_percent)}%`} height={`${Math.abs(m.end_y_percent - m.y_percent)}%`} fill={isSelected ? "rgba(59,130,246,0.1)" : "rgba(220,38,38,0.1)"} stroke={isSelected ? "#3b82f6" : "#dc2626"} strokeWidth={dynamicStroke} strokeDasharray={`8,4`} rx={10} />
                                {isSelected && <circle cx={`${Math.max(m.x_percent, m.end_x_percent)}%`} cy={`${Math.max(m.y_percent, m.end_y_percent)}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-nwse-resize print:hidden" onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'br')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'br')} />}
                              </>
                            )}

                            {m.markup_type === 'arrow' && (
                              <>
                                <line x1={`${m.x_percent}%`} y1={`${m.y_percent}%`} x2={`${m.end_x_percent}%`} y2={`${m.end_y_percent}%`} stroke={isSelected ? "#3b82f6" : "#dc2626"} strokeWidth={dynamicStroke * 1.5} markerEnd={isSelected ? "url(#arrowhead-blue)" : "url(#arrowhead-red)"} />
                                {isSelected && (
                                  <>
                                    <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} className="print:hidden" onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'start')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'start')} />
                                    <circle cx={`${m.end_x_percent}%`} cy={`${m.end_y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} className="print:hidden" onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'end')} onTouchStart={(e) => handleShapeDown(e, m.id, 'resize', 'end')} />
                                  </>
                                )}
                              </>
                            )}

                            {m.markup_type === 'pin' && (
                              <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={isSelected ? 16 : 10} fill={isSelected ? "#3b82f6" : "#dc2626"} stroke="white" strokeWidth={2} />
                            )}

                            {m.markup_type === 'text' && (
                              <text x={`${m.x_percent}%`} y={`${m.y_percent}%`} fill={isSelected ? "#3b82f6" : "#dc2626"} fontSize={16} className="font-black italic select-none" style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: `0.5px` }}>{m.markup_text}</text>
                            )}
                          </g>
                        )
                      })}

                      {interaction?.type === 'draw' && activeTool === 'cloud' && <rect x={`${Math.min(startPos.x, lastPos.x)}%`} y={`${Math.min(startPos.y, lastPos.y)}%`} width={`${Math.abs(lastPos.x - startPos.x)}%`} height={`${Math.abs(lastPos.y - startPos.y)}%`} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={2} strokeDasharray={`8,4`} rx={10} />}
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

      {/* PRINT STYLES - Ensures TransformWrapper releases its grip during print */}
      <style jsx global>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { background: white; margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          
          /* Override Zoom Library during Print */
          .react-transform-wrapper, .react-transform-component {
            transform: none !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  )
}