'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, Save, Loader2, GripVertical, 
  CalendarDays, HardHat, AlertTriangle, Link as LinkIcon, Edit2, Trash2, Printer
} from 'lucide-react'

const parseDate = (d: string) => new Date(d + 'T00:00:00')
const DAY_MS = 86400000
const COL_WIDTH = 48 

export default function ScheduleMaster() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  
  const [gridStartDate, setGridStartDate] = useState(new Date())
  
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartOffset, setDragStartOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Modals
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', trade: '', start: '', duration: 1, deps: [] as string[] })
  const [editingTask, setEditingTask] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      const [tData, trData] = await Promise.all([
        supabase.from('project_schedule').select('*, project_contacts(company)').eq('project_id', id).order('start_date', { ascending: true }),
        supabase.from('project_contacts').select('id, company').eq('project_id', id)
      ])
      
      if (tData.data) {
        setTasks(tData.data)
        if (tData.data.length > 0) {
          const earliest = new Date(Math.min(...tData.data.map(t => parseDate(t.start_date).getTime())))
          earliest.setDate(earliest.getDate() - 3)
          setGridStartDate(earliest)
        }
      }
      if (trData.data) setTrades(trData.data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  // --- ENGINE ---
  const { processedTasks, projectEndDate, criticalPathIds } = useMemo(() => {
    let pTasks = [...tasks]
    let maxEnd = 0
    let endMap: Record<string, number> = {}

    pTasks.forEach(t => {
      const startMs = parseDate(t.start_date).getTime()
      const endMs = startMs + (t.duration_days * DAY_MS)
      endMap[t.id] = endMs
      if (endMs > maxEnd) maxEnd = endMs
    })

    let cPath = new Set<string>()
    const findCriticalChain = (taskId: string) => {
      cPath.add(taskId)
      const task = pTasks.find(t => t.id === taskId)
      if (task && task.dependencies?.length > 0) {
        let drivingDep = task.dependencies[0]
        let maxDepEnd = 0
        task.dependencies.forEach((dId: string) => {
          if (endMap[dId] > maxDepEnd) { maxDepEnd = endMap[dId]; drivingDep = dId }
        })
        if (drivingDep) findCriticalChain(drivingDep)
      }
    }

    pTasks.filter(t => endMap[t.id] === maxEnd).forEach(t => findCriticalChain(t.id))

    return { processedTasks: pTasks, projectEndDate: maxEnd, criticalPathIds: cPath }
  }, [tasks])


  // --- DRAG LOGIC ---
  const handlePointerDown = (e: React.PointerEvent, taskId: string, start_date: string) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(taskId)
    setDragStartX(e.clientX)
    const startMs = parseDate(start_date).getTime()
    const diffDays = Math.round((startMs - gridStartDate.getTime()) / DAY_MS)
    setDragStartOffset(diffDays)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return
    const deltaX = e.clientX - dragStartX
    const daysShifted = Math.round(deltaX / COL_WIDTH)
    
    if (daysShifted !== 0) {
      const newOffset = dragStartOffset + daysShifted
      const newStartDate = new Date(gridStartDate.getTime() + (newOffset * DAY_MS))
      applyCascadeUpdate(draggingId, newStartDate.toISOString().split('T')[0])
      setDragStartX(e.clientX)
      setDragStartOffset(newOffset)
    }
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!draggingId) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingId(null)
    saveAllTasks() 
  }

  const applyCascadeUpdate = (movedTaskId: string, newStartDateStr: string) => {
    setTasks(prev => {
      let draft = JSON.parse(JSON.stringify(prev)) 
      
      const updateDownstream = (taskId: string, startStr: string) => {
        const taskIndex = draft.findIndex((t: any) => t.id === taskId)
        if (taskIndex === -1) return
        
        draft[taskIndex].start_date = startStr
        const endMs = parseDate(startStr).getTime() + (draft[taskIndex].duration_days * DAY_MS)

        draft.forEach((child: any) => {
          if (child.dependencies?.includes(taskId)) {
            const childStartMs = parseDate(child.start_date).getTime()
            if (endMs > childStartMs) {
              const newChildStart = new Date(endMs).toISOString().split('T')[0]
              updateDownstream(child.id, newChildStart)
            }
          }
        })
      }
      
      updateDownstream(movedTaskId, newStartDateStr)
      return draft
    })
  }

  const saveAllTasks = async () => {
    setSaving(true)
    const updates = tasks.map(t => ({ id: t.id, project_id: id, start_date: t.start_date, task_name: t.task_name, duration_days: t.duration_days }))
    const { error } = await supabase.from('project_schedule').upsert(updates)
    if (error) alert(`Sync failed: ${error.message}`)
    setSaving(false)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('project_schedule').insert([{
      project_id: id, trade_id: newTask.trade || null, task_name: newTask.name,
      start_date: newTask.start, duration_days: newTask.duration, dependencies: newTask.deps
    }])
    if (!error) { setShowNewTask(false); window.location.reload(); }
    setSaving(false)
  }

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('project_schedule').update({
      task_name: editingTask.task_name,
      duration_days: editingTask.duration_days,
      start_date: editingTask.start_date
    }).eq('id', editingTask.id)
    
    if (!error) { setEditingTask(null); window.location.reload(); }
    setSaving(false)
  }

  const handleDeleteTask = async () => {
    if(!confirm("Delete this task? Downstream dependencies will NOT be deleted automatically.")) return;
    setSaving(true)
    await supabase.from('project_schedule').delete().eq('id', editingTask.id)
    setEditingTask(null)
    window.location.reload()
  }

  const handlePrint = () => {
    window.print()
  }

  // --- GRID GENERATION ---
  const gridDays = Array.from({ length: 120 }).map((_, i) => {
    const d = new Date(gridStartDate.getTime() + (i * DAY_MS))
    return { date: d, isWeekend: d.getDay() === 0 || d.getDay() === 6, month: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) }
  })

  let monthSpans: { name: string, colSpan: number }[] = []
  let currentMonth = gridDays[0].month
  let currentCount = 0
  
  gridDays.forEach(d => {
    if (d.month === currentMonth) { currentCount++ } 
    else { monthSpans.push({ name: currentMonth, colSpan: currentCount }); currentMonth = d.month; currentCount = 1 }
  })
  monthSpans.push({ name: currentMonth, colSpan: currentCount })

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Timeline...</div>

  return (
    <div className="max-w-[1800px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32 print:bg-white print:text-black">
      
      {/* 🖨️ PDF EXPORT STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          .print-border { border-color: #cbd5e1 !important; }
          .print-text { color: #0f172a !important; }
          .print-bg-white { background-color: #ffffff !important; }
          .print-bg-stripes { background-color: #f8fafc !important; }
        }
      `}} />

      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end print-border">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all print-hidden"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white print-text tracking-tighter uppercase italic leading-none">Master <span className="text-blue-500">Schedule</span></h1>
          {projectEndDate > 0 && (
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
               Target Completion: <span className="text-emerald-500">{new Date(projectEndDate).toLocaleDateString()}</span>
             </p>
          )}
        </div>
        <div className="flex gap-3 print-hidden">
          <button onClick={handlePrint} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl">
            <Printer size={14}/> Export PDF
          </button>
          <button onClick={() => saveAllTasks()} disabled={saving} className="bg-slate-800 text-blue-400 border border-blue-900/50 text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
          <button onClick={() => setShowNewTask(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
            <Plus size={16}/> New Task
          </button>
        </div>
      </div>

      {/* PC GANTT CANVAS (Continuous Row Layout) */}
      <div className="bg-slate-900 print-bg-white rounded-[32px] border border-slate-800 print-border shadow-2xl overflow-hidden print:overflow-visible">
        
        {/* Scrollable X & Y Viewport */}
        <div className="overflow-auto custom-scrollbar max-h-[75vh] print:max-h-none print:overflow-visible relative" ref={containerRef}>
          <div className="w-max min-w-full print:w-auto">

            {/* STICKY HEADER ROW */}
            <div className="flex sticky top-0 z-30 bg-slate-900 print-bg-white border-b border-slate-800 print-border shadow-sm">
              
              {/* Locked Data Columns */}
              <div className="w-[280px] shrink-0 sticky left-0 z-40 bg-slate-900 print-bg-white p-4 border-r border-slate-800 print-border flex flex-col justify-end font-black text-[10px] text-slate-500 uppercase tracking-widest">
                Trade / Task
              </div>
              <div className="w-[90px] shrink-0 p-4 border-r border-slate-800 print-border flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">
                Start
              </div>
              <div className="w-[90px] shrink-0 p-4 border-r border-slate-800 print-border flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">
                End
              </div>
              <div className="w-[60px] shrink-0 p-4 border-r border-slate-800 print-border flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">
                Dur.
              </div>

              {/* Scrolling Timeline Header */}
              <div className="flex flex-col">
                <div className="flex border-b border-slate-800/50 print-border h-8">
                  {monthSpans.map((m, i) => (
                    <div key={i} className="px-4 py-2 text-[10px] font-black text-blue-500 uppercase tracking-widest border-r border-slate-800/50 print-border" style={{ width: m.colSpan * COL_WIDTH }}>
                      {m.name}
                    </div>
                  ))}
                </div>
                <div className="flex h-8">
                  {gridDays.map((d, i) => (
                    <div key={i} className={`flex-shrink-0 flex items-center justify-center border-r border-slate-800/50 print-border ${d.isWeekend ? 'bg-slate-950/50 print-bg-stripes' : ''}`} style={{ width: COL_WIDTH }}>
                      <span className={`text-[9px] font-black ${d.isWeekend ? 'text-slate-600' : 'text-slate-300 print-text'}`}>{d.date.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* TASK ROWS */}
            {processedTasks.length === 0 && (
               <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">No tasks scheduled yet.</div>
            )}
            
            {processedTasks.map((t) => {
              const startMs = parseDate(t.start_date).getTime()
              const endMs = startMs + (t.duration_days * DAY_MS)
              const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS)
              const isCritical = criticalPathIds.has(t.id)

              return (
                <div key={t.id} className="flex border-b border-slate-800/50 print-border group hover:bg-slate-800/20 print:hover:bg-transparent transition-colors relative h-16">
                  
                  {/* Locked Data Columns */}
                  <button 
                    onClick={() => setEditingTask(t)}
                    className="w-[280px] shrink-0 sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900 print-bg-white p-4 border-r border-slate-800 print-border flex flex-col justify-center text-left transition-colors print:cursor-default"
                  >
                    <div className="flex justify-between items-center w-full">
                      <p className="text-xs font-bold text-white print-text truncate group-hover:text-blue-400 print:group-hover:text-black transition-colors">{t.task_name}</p>
                      <Edit2 size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity print-hidden" />
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase truncate tracking-widest mt-0.5">{t.project_contacts?.company || 'General'}</p>
                  </button>
                  
                  <div className="w-[90px] shrink-0 p-4 border-r border-slate-800 print-border flex items-center justify-center">
                    <span className="bg-slate-900 print-bg-stripes px-2 py-1 rounded text-[10px] font-bold text-slate-400 print-text border border-slate-800 print-border">
                      {new Date(startMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>

                  <div className="w-[90px] shrink-0 p-4 border-r border-slate-800 print-border flex items-center justify-center">
                    <span className="bg-slate-900 print-bg-stripes px-2 py-1 rounded text-[10px] font-bold text-slate-400 print-text border border-slate-800 print-border">
                      {new Date(endMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>

                  <div className="w-[60px] shrink-0 p-4 border-r border-slate-800 print-border flex items-center justify-center">
                    <span className="text-[11px] font-black text-white print-text">{t.duration_days}d</span>
                  </div>

                  {/* Timeline Bar Area */}
                  <div className="relative flex">
                    {/* Background Grid Lines */}
                    {gridDays.map((d, i) => (
                      <div key={i} className={`flex-shrink-0 border-r border-slate-800/30 print-border h-full ${d.isWeekend ? 'bg-slate-900/20 print-bg-stripes' : ''}`} style={{ width: COL_WIDTH }} />
                    ))}

                    {/* Draggable Bar */}
                    {offsetDays >= 0 && (
                      <div 
                        className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-xl flex items-center px-3 cursor-grab active:cursor-grabbing shadow-lg transition-colors print:border print:border-black ${
                          isCritical ? 'bg-red-600 hover:bg-red-500 border border-red-400' : 'bg-blue-600 hover:bg-blue-500 border border-blue-400'
                        }`}
                        style={{ left: offsetDays * COL_WIDTH, width: Math.max(t.duration_days * COL_WIDTH, COL_WIDTH - 8) }}
                        onPointerDown={(e) => handlePointerDown(e, t.id, t.start_date)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                      >
                        <GripVertical size={12} className="text-white/50 mr-2 flex-shrink-0 print-hidden" />
                        <span className="text-[10px] font-black text-white truncate pointer-events-none print-text print:text-white">
                          {t.dependencies?.length > 0 && <LinkIcon size={10} className="inline mr-1" />}
                          {t.duration_days}d
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- EDIT TASK MODAL --- */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md print-hidden">
          <form onSubmit={handleUpdateTask} className="bg-slate-900 border-2 border-amber-500 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Edit Task</h2>
            
            <input value={editingTask.task_name} onChange={e => setEditingTask({...editingTask, task_name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Start Date</label>
                <input type="date" value={editingTask.start_date} onChange={e => setEditingTask({...editingTask, start_date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none [color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Duration (Days)</label>
                <input type="number" min="1" value={editingTask.duration_days} onChange={e => setEditingTask({...editingTask, duration_days: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setEditingTask(null)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button type="button" onClick={handleDeleteTask} className="w-14 bg-red-950 text-red-500 border border-red-900/50 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
              <button type="submit" disabled={saving} className="flex-1 bg-amber-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50 flex justify-center items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin"/>} Save Updates
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NEW TASK MODAL */}
      {showNewTask && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md print-hidden">
          <form onSubmit={handleCreateTask} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Add Schedule Item</h2>
            
            <input required value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} placeholder="Task Name (e.g. Rough Framing)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
            
            <select value={newTask.trade} onChange={e => setNewTask({...newTask, trade: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none">
              <option value="">Assigned Trade (Optional)</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.company}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Start Date</label>
                <input required type="date" value={newTask.start} onChange={e => setNewTask({...newTask, start: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none [color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Duration (Days)</label>
                <input required type="number" min="1" value={newTask.duration} onChange={e => setNewTask({...newTask, duration: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Prerequisite Task (Depends On)</label>
              <select onChange={e => setNewTask({...newTask, deps: e.target.value ? [e.target.value] : []})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none">
                <option value="">No Dependencies</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.task_name}</option>)}
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowNewTask(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50">Save Task</button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #020617; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 3px solid #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  )
}