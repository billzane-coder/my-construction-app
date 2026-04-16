'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { 
  ZoomIn, ZoomOut, Maximize, Link as LinkIcon, 
  Paperclip, ChevronLeft, ChevronRight, Layers, Plus, Trash2
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
  const { id, planId } = useParams()
  const router = useRouter()
  
  const [plan, setPlan] = useState<any>(null)
  const [planVersions, setPlanVersions] = useState<any[]>([])
  const [markups, setMarkups] = useState<any[]>([])
  
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [activeLayer, setActiveLayer] = useState<string>('Master')
  const [availableLayers, setAvailableLayers] = useState<string[]>(['Master'])
  
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [viewMode, setViewMode] = useState<'clean' | 'marked'>('marked')
  const [loading, setLoading] = useState(true)
  
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [interaction, setInteraction] = useState<Interaction>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      if (!planId) return
      const { data: p } = await supabase.from('project_documents').select('*').eq('id', planId).single()
      const [versions, m] = await Promise.all([
        supabase.from('project_documents').select('id, revision_number').eq('title', p?.title).eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('plan_markups').select('*').eq('plan_id', planId)
      ])
      
      setPlan(p); 
      setPlanVersions(versions.data || []); 
      setMarkups(m.data || []); 
      
      if (m.data) {
        const layers = Array.from(new Set(m.data.map((item: any) => item.layer_name || 'Master'))) as string[]
        setAvailableLayers(layers.length > 0 ? layers : ['Master'])
      }
      setLoading(false)
    }
    init()
  }, [planId, id])

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
    if (viewMode === 'clean' || activeTool === 'select') {
      setSelectedId(null)
      return
    }
    setInteraction({ type: 'draw' })
    const coords = getCoords(e)
    setStartPos(coords)
    setLastPos(coords)
  }

  const handleShapeDown = (e: React.MouseEvent | React.TouchEvent, mId: string, action: 'move' | 'resize', handleType?: 'start' | 'end' | 'br') => {
    if (activeTool !== 'select' || viewMode === 'clean') return
    e.stopPropagation() 
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
      setMarkups(prev => prev.map(m => m.id === interaction.id ? { 
        ...m, x_percent: m.x_percent + dx, y_percent: m.y_percent + dy, 
        end_x_percent: (m.end_x_percent || 0) + dx, end_y_percent: (m.end_y_percent || 0) + dy 
      } : m))
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
      if (activeTool === 'text') {
        setTimeout(async () => {
          const val = prompt("Enter Site Note:")
          if (!val) {
            setInteraction(null)
            return
          }
          const { data: newMarkup } = await supabase.from('plan_markups').insert([{
            project_id: id, plan_id: planId, markup_type: 'text',
            page_number: pageNumber, layer_name: activeLayer,
            x_percent: startPos.x, y_percent: startPos.y,
            end_x_percent: startPos.x + 10, 
            end_y_percent: startPos.y + 4,
            markup_text: val, status: 'Open'
          }]).select().single()
          if (newMarkup) setMarkups(prev => [...prev, newMarkup])
          setSelectedId(newMarkup?.id || null)
          setActiveTool('select') 
        }, 10)
      } else {
        const { data: newMarkup } = await supabase.from('plan_markups').insert([{
          project_id: id, plan_id: planId, markup_type: activeTool,
          page_number: pageNumber, layer_name: activeLayer,
          x_percent: Math.min(startPos.x, lastPos.x), y_percent: Math.min(startPos.y, lastPos.y),
          end_x_percent: Math.max(startPos.x, lastPos.x), end_y_percent: Math.max(startPos.y, lastPos.y),
          markup_text: "", status: 'Open'
        }]).select().single()
        if (newMarkup) setMarkups(prev => [...prev, newMarkup])
        setSelectedId(newMarkup?.id || null)
        setActiveTool('select') 
      }
    } else if (interaction.type === 'move' || interaction.type === 'resize') {
      const m = markups.find(mx => mx.id === interaction.id)
      if (m) await supabase.from('plan_markups').update({ 
        x_percent: m.x_percent, y_percent: m.y_percent, 
        end_x_percent: m.end_x_percent, end_y_percent: m.end_y_percent 
      }).eq('id', m.id)
    }
    setInteraction(null)
  }

  const deleteMarkup = async () => {
    if (!selectedId) return
    await supabase.from('plan_markups').delete().eq('id', selectedId)
    setMarkups(prev => prev.filter(m => m.id !== selectedId))
    setSelectedId(null)
  }

  const canPan = viewMode === 'clean' || (activeTool === 'select' && !interaction)

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center font-black text-blue-500 animate-pulse uppercase tracking-[0.3em] italic">Opening Vault...</div>

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden select-none">
      
      {/* TOOLBAR */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex flex-wrap justify-between items-center z-50 shadow-2xl gap-4">
        <div className="flex gap-4 items-center">
          <button onClick={() => router.back()} className="px-4 py-2 text-slate-500 hover:text-white font-black text-[10px] uppercase transition-all">← Exit</button>
          
          {/* VERSION SELECTOR (FIXED VISIBILITY) */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl">
             <Layers size={14} className="text-amber-500" />
             <select 
               value={activeLayer} 
               onChange={(e) => { setActiveLayer(e.target.value); setSelectedId(null); }} 
               className="bg-slate-900 text-white font-black text-[10px] outline-none cursor-pointer uppercase [color-scheme:dark]"
             >
               {availableLayers.map(layer => (
                 <option key={layer} value={layer} className="bg-slate-900 text-white">{layer}</option>
               ))}
             </select>
             <button onClick={() => { const n = prompt("New Version Name:"); if(n) {setAvailableLayers([...availableLayers, n]); setActiveLayer(n); } }} className="ml-2 text-blue-500 hover:text-white"><Plus size={14}/></button>
          </div>

          {/* PAGE SELECTOR (FIXED VISIBILITY) */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl">
             <span className="text-[9px] font-black text-slate-500 uppercase">Sheet</span>
             <select 
               value={pageNumber} 
               onChange={(e) => { setPageNumber(Number(e.target.value)); setSelectedId(null); }} 
               className="bg-slate-900 text-white font-black text-[10px] outline-none cursor-pointer [color-scheme:dark]"
             >
               {Array.from(new Array(numPages), (el, index) => (
                 <option key={index + 1} value={index + 1} className="bg-slate-900 text-white">{index + 1} of {numPages}</option>
               ))}
             </select>
          </div>
        </div>

        {viewMode === 'marked' && (
          <div className="flex gap-2 items-center bg-slate-900 p-1 rounded-2xl border border-slate-800">
            {(['select', 'pin', 'cloud', 'arrow', 'text'] as Tool[]).map((t) => (
              <button key={t} onClick={() => setActiveTool(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTool === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                {t === 'select' ? '🖱️' : t === 'pin' ? '📍' : t === 'cloud' ? '☁️' : t === 'arrow' ? '↗️' : '📝'} {t}
              </button>
            ))}
            {selectedId && <button onClick={deleteMarkup} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-red-600/20 text-red-500 ml-2 hover:bg-red-600 hover:text-white transition-all">🗑️ Delete</button>}
          </div>
        )}

        <div className="flex gap-3 items-center">
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value as 'clean' | 'marked')} 
            className="bg-slate-900 border border-slate-700 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl outline-none [color-scheme:dark]"
          >
            <option value="marked" className="bg-slate-900">Show Markups</option>
            <option value="clean" className="bg-slate-900">Hide Markups</option>
          </select>
        </div>
      </div>

      {/* VIEWPORT AREA */}
      <div className="flex-1 relative overflow-hidden bg-slate-800">
        <TransformWrapper
          initialScale={1} 
          minScale={0.3} 
          maxScale={10}
          panning={{ disabled: !canPan }} 
          wheel={{ step: 0.0005, disabled: false }}
          doubleClick={{ disabled: true }}
          centerOnInit={true}
        >
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
                    <Document 
                      file={plan.file_url} 
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      loading={<div className="p-20 text-slate-500 font-black uppercase tracking-widest animate-pulse">Rendering Blueprint...</div>}
                    >
                      <Page pageNumber={pageNumber} scale={2.0} renderTextLayer={false} renderAnnotationLayer={false} className="pointer-events-none" />
                    </Document>
                  )}

                  {/* SVG INTERACTION LAYER */}
                  {viewMode === 'marked' && (
                    <svg 
                      className={`absolute inset-0 w-full h-full z-10 ${canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                      onMouseDown={handleStageDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
                    >
                      {markups
                        .filter(m => (m.page_number || 1) === pageNumber)
                        .filter(m => (m.layer_name || 'Master') === activeLayer)
                        .map((m) => {
                          const isSelected = selectedId === m.id
                          const color = isSelected ? "#3b82f6" : "#dc2626"
                          
                          return (
                            <g key={m.id} onMouseDown={(e) => handleShapeDown(e, m.id, 'move')}>
                              {m.markup_type === 'cloud' && (
                                <>
                                  <rect x={`${Math.min(m.x_percent, m.end_x_percent)}%`} y={`${Math.min(m.y_percent, m.end_y_percent)}%`} width={`${Math.abs(m.end_x_percent - m.x_percent)}%`} height={`${Math.abs(m.end_y_percent - m.y_percent)}%`} fill={isSelected ? "rgba(59,130,246,0.1)" : "rgba(220,38,38,0.1)"} stroke={color} strokeWidth={isSelected ? 4 : 2} strokeDasharray="8,4" rx={10} />
                                  {isSelected && <circle cx={`${Math.max(m.x_percent, m.end_x_percent)}%`} cy={`${Math.max(m.y_percent, m.end_y_percent)}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} className="cursor-nwse-resize" onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'br')} />}
                                </>
                              )}

                              {m.markup_type === 'arrow' && (
                                <>
                                  <line x1={`${m.x_percent}%`} y1={`${m.y_percent}%`} x2={`${m.end_x_percent}%`} y2={`${m.end_y_percent}%`} stroke={color} strokeWidth={isSelected ? 6 : 4} markerEnd={isSelected ? "url(#arrowhead-blue)" : "url(#arrowhead-red)"} />
                                  {isSelected && (
                                    <>
                                      <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'start')} />
                                      <circle cx={`${m.end_x_percent}%`} cy={`${m.end_y_percent}%`} r={8} fill="white" stroke="#3b82f6" strokeWidth={2} onMouseDown={(e) => handleShapeDown(e, m.id, 'resize', 'end')} />
                                    </>
                                  )}
                                </>
                              )}

                              {m.markup_type === 'pin' && <circle cx={`${m.x_percent}%`} cy={`${m.y_percent}%`} r={isSelected ? 16 : 10} fill={color} stroke="white" strokeWidth={2} />}
                              
                              {/* TEXT MARKUP (WITH DYNAMIC RESIZING) */}
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
                                    />
                                  )}
                                </g>
                              )}
                            </g>
                          )
                        })}

                        {/* DRAW PREVIEWS */}
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