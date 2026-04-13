'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

// --- TYPES ---
type Tool = 'select' | 'arrow' | 'cloud' | 'text'
type Status = 'Open' | 'In Review' | 'Resolved'

export default function PhotoMarkupTool() {
  const { id, photoId } = useParams()
  const router = useRouter()
  
  // Data States
  const [photo, setPhoto] = useState<any>(null)
  const [markups, setMarkups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // UI States
  const [activeTool, setActiveTool] = useState<Tool>('arrow')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  
  // Coordinate Tracking
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })

  const imgRef = useRef<HTMLImageElement>(null)

  // 1. INITIAL FETCH
  useEffect(() => {
    async function init() {
      if (!photoId) return
      const [p, m] = await Promise.all([
        supabase.from('project_photos').select('*').eq('id', photoId).single(),
        supabase.from('photo_markups').select('*').eq('photo_id', photoId)
      ])
      setPhoto(p.data)
      setMarkups(m.data || [])
      setLoading(false)
    }
    init()
  }, [photoId])

  // 2. UTILITIES
  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'Resolved': return '#10b981' // Emerald 500
      case 'In Review': return '#f59e0b' // Amber 500
      default: return '#dc2626' // Red 600
    }
  }

  const updateStatus = async (mId: string, newStatus: Status) => {
    const { error } = await supabase.from('photo_markups').update({ status: newStatus }).eq('id', mId)
    if (!error) {
      setMarkups(prev => prev.map(m => m.id === mId ? { ...m, status: newStatus } : m))
    }
  }

  const deleteMarkup = async (mId: string) => {
    const { error } = await supabase.from('photo_markups').delete().eq('id', mId)
    if (!error) {
      setMarkups(prev => prev.filter(m => m.id !== mId))
      setSelectedId(null)
    }
  }

  // 3. COORDINATE ENGINE
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgRef.current) return { x: 0, y: 0 }
    const rect = imgRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    
    // Return relative % of the image
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    }
  }

  // 4. INTERACTION HANDLERS
  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'select') {
        setSelectedId(null)
        return
    }
    setIsDrawing(true)
    const coords = getCoords(e)
    setStartPos(coords)
    setCurrentPos(coords)
  }

  const handleEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    setIsDrawing(false)
    const endPos = getCoords(e)

    let textVal = ""
    if (activeTool === 'text') {
      textVal = prompt("Enter Note Details:") || ""
      if (!textVal) return
    }

    const { data: newMarkup, error } = await supabase.from('photo_markups').insert([{
      project_id: id,
      photo_id: photoId,
      markup_type: activeTool,
      x_percent: startPos.x,
      y_percent: startPos.y,
      end_x_percent: endPos.x,
      end_y_percent: endPos.y,
      markup_text: textVal,
      status: 'Open'
    }]).select().single()

    if (!error && newMarkup) {
      setMarkups([...markups, newMarkup])
      setSelectedId(newMarkup.id)
      setActiveTool('select') // Switch to select to allow status editing
    }
  }

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Photo Engine...</div>
    </div>
  )

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden font-sans select-none">
      
      {/* --- PRO TOOLBAR (Hidden during print) --- */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap justify-between items-center z-50 gap-4 print:hidden">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="text-[10px] font-black text-slate-500 hover:text-white uppercase transition-all">← Back to Site</button>
          <div className="h-6 w-[1px] bg-slate-800" />
          
          {/* Tool Selection */}
          <div className="flex gap-1 bg-black/40 p-1 rounded-2xl border border-slate-800">
            {(['select', 'arrow', 'cloud', 'text'] as Tool[]).map(t => (
              <button 
                key={t} 
                onClick={() => { setActiveTool(t); setSelectedId(null); }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTool === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:bg-slate-800'}`}
              >
                {t === 'select' ? '🖱️' : t === 'arrow' ? '↗️' : t === 'cloud' ? '☁️' : '📝'} 
                <span className="hidden md:inline">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Markup Controls */}
        {selectedId && (
          <div className="flex gap-2 items-center animate-in slide-in-from-top-2 duration-300">
             <select 
              value={markups.find(m => m.id === selectedId)?.status}
              onChange={(e) => updateStatus(selectedId, e.target.value as Status)}
              className="bg-slate-950 text-white font-black text-[10px] uppercase px-4 py-2.5 rounded-xl border border-slate-700 outline-none focus:border-blue-500 transition-all"
            >
              <option value="Open">🔴 Open Deficiency</option>
              <option value="In Review">🟡 Ready for Inspection</option>
              <option value="Resolved">🟢 Resolved / Closed</option>
            </select>
            <button 
              onClick={() => deleteMarkup(selectedId)}
              className="bg-red-600/10 text-red-500 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-red-600/30 hover:bg-red-600 hover:text-white transition-all"
            >
              🗑️ Delete
            </button>
          </div>
        )}

        <button onClick={() => window.print()} className="bg-white text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-50 transition-all">Export Photo Report</button>
      </div>

      {/* --- VIEWPORT --- */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] print:p-0 print:bg-white">
        <div className="relative inline-block shadow-2xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">
          
          <img 
            ref={imgRef}
            src={photo?.url} 
            alt="Site Photo"
            className="max-h-[80vh] w-auto select-none pointer-events-none block"
            onDragStart={e => e.preventDefault()}
          />

          {/* INTERACTIVE MARKUP LAYER */}
          <svg 
            className={`absolute inset-0 w-full h-full z-10 ${activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
            onMouseDown={handleStart}
            onMouseMove={(e) => isDrawing && setCurrentPos(getCoords(e))}
            onMouseUp={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={(e) => isDrawing && setCurrentPos(getCoords(e))}
            onTouchEnd={handleEnd}
          >
            {markups.map((m) => {
              const color = getStatusColor(m.status)
              const isSelected = selectedId === m.id
              
              return (
                <g key={m.id} onClick={(e) => { e.stopPropagation(); setSelectedId(m.id); setActiveTool('select'); }} className="cursor-pointer group">
                  
                  {/* Deficiency Arrow */}
                  {m.markup_type === 'arrow' && (
                    <line 
                        x1={`${m.x_percent}%`} y1={`${m.y_percent}%`} 
                        x2={`${m.end_x_percent}%`} y2={`${m.end_y_percent}%`} 
                        stroke={color} 
                        strokeWidth={isSelected ? "5" : "3"} 
                        markerEnd={`url(#arrowhead-${m.id})`} 
                        className="transition-all"
                    />
                  )}

                  {/* Deficiency Cloud */}
                  {m.markup_type === 'cloud' && (
                    <rect 
                        x={`${Math.min(m.x_percent, m.end_x_percent)}%`} 
                        y={`${Math.min(m.y_percent, m.end_y_percent)}%`} 
                        width={`${Math.abs(m.end_x_percent - m.x_percent)}%`} 
                        height={`${Math.abs(m.end_y_percent - m.y_percent)}%`} 
                        fill={isSelected ? `${color}20` : "transparent"} 
                        stroke={color} 
                        strokeWidth={isSelected ? "4" : "2"} 
                        strokeDasharray="10,5" 
                        rx="12" 
                        className="transition-all"
                    />
                  )}

                  {/* Text Note */}
                  {m.markup_text && (
                    <text 
                        x={`${m.x_percent}%`} 
                        y={`${m.y_percent}%`} 
                        fill={color} 
                        className="text-[14px] font-black italic tracking-tight" 
                        style={{ paintOrder: 'stroke', stroke: 'black', strokeWidth: '0.75px' }}
                    >
                      {m.markup_text}
                    </text>
                  )}
                  
                  {/* Dynamic Arrowheads */}
                  <defs>
                    <marker id={`arrowhead-${m.id}`} markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                    </marker>
                  </defs>
                </g>
              )
            })}

            {/* LIVE DRAWING PREVIEW */}
            {isDrawing && activeTool === 'arrow' && (
              <line x1={`${startPos.x}%`} y1={`${startPos.y}%`} x2={`${currentPos.x}%`} y2={`${currentPos.y}%`} stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" />
            )}
            {isDrawing && activeTool === 'cloud' && (
              <rect 
                x={`${Math.min(startPos.x, currentPos.x)}%`} 
                y={`${Math.min(startPos.y, currentPos.y)}%`} 
                width={`${Math.abs(currentPos.x - startPos.x)}%`} 
                height={`${Math.abs(currentPos.y - startPos.y)}%`} 
                fill="rgba(59,130,246,0.1)" 
                stroke="#3b82f6" 
                strokeWidth="2" 
                strokeDasharray="5,5" 
                rx="10" 
              />
            )}
          </svg>
        </div>
      </div>

      {/* --- PRINT INJECTION --- */}
      <style jsx global>{`
        @media print {
          @page { margin: 0; size: landscape; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  )
}