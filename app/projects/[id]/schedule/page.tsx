'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, Save, Loader2, GripVertical, 
  CalendarDays, HardHat, AlertTriangle, Link as LinkIcon
} from 'lucide-react'

// Helper: Convert YYYY-MM-DD to a JS Date at midnight local time
const parseDate = (d: string) => new Date(d + 'T00:00:00')
const DAY_MS = 86400000
const COL_WIDTH = 48 // Pixels per day in the grid

export default function ScheduleMaster() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  
  // Viewport/Grid state
  const [gridStartDate, setGridStartDate] = useState(new Date())
  
  // Drag State
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartOffset, setDragStartOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // New Task Form State
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', trade: '', start: '', duration: 1, deps: [] as string[] })

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      const [tData, trData] = await Promise.all([
        supabase.from('project_schedule').select('*, project_contacts(company)').eq('project_id', id).order('start_date', { ascending: true }),
        supabase.from('project_contacts').select('id, company').eq('project_id', id)
      ])
      
      if (tData.data) {
        setTasks(tData.data)
        // Set the grid start date to 3 days before the earliest task
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

  // --- ENGINE: Calculate Dependencies & Critical Path ---
  const { processedTasks, projectEndDate, criticalPathIds } = useMemo(() => {
    let pTasks = [...tasks]
    let maxEnd = 0
    let endMap: Record<string, number> = {}

    // 1. Calculate end dates for all tasks
    pTasks.forEach(t => {
      const startMs = parseDate(t.start_date).getTime()
      const endMs = startMs + (t.duration_days * DAY_MS)
      endMap[t.id] = endMs
      if (endMs > maxEnd) maxEnd = endMs
    })

    // 2. Determine Critical Path (Walk backwards from max end date)
    let cPath = new Set<string>()
    const findCriticalChain = (taskId: string) => {
      cPath.add(taskId)
      const task = pTasks.find(t => t.id === taskId)
      if (task && task.dependencies) {
        // Find the dependency that forces this task's start date
        let drivingDep = task.dependencies[0]
        let maxDepEnd = 0
        task.dependencies.forEach((dId: string) => {
          if (endMap[dId] > maxDepEnd) { maxDepEnd = endMap[dId]; drivingDep = dId }
        })
        if (drivingDep) findCriticalChain(drivingDep)
      }
    }

    // Find the terminal tasks (ones that end on the project max end date)
    pTasks.filter(t => endMap[t.id] === maxEnd).forEach(t => findCriticalChain(t.id))

    return { processedTasks: pTasks, projectEndDate: maxEnd, criticalPathIds: cPath }
  }, [tasks])


  // --- DRAG AND DROP LOGIC ---
  const handlePointerDown = (e: React.PointerEvent, taskId: string, start_date: string) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(taskId)
    setDragStartX(e.clientX)
    
    // Calculate current day offset from grid start
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
      
      // Optimitically update UI
      applyCascadeUpdate(draggingId, newStartDate.toISOString().split('T')[0])
      
      // Reset drag origin so we don't multiply the shift
      setDragStartX(e.clientX)
      setDragStartOffset(newOffset)
    }
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!draggingId) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingId(null)
    saveAllTasks() // Save the new cascaded dates to DB
  }

  // --- CASCADE ENGINE ---
  // When a task moves, push its dependents forward
  const applyCascadeUpdate = (movedTaskId: string, newStartDateStr: string) => {
    setTasks(prev => {
      let draft = JSON.parse(JSON.stringify(prev)) // Deep copy
      
      const updateDownstream = (taskId: string, startStr: string) => {
        const taskIndex = draft.findIndex((t: any) => t.id === taskId)
        if (taskIndex === -1) return
        
        draft[taskIndex].start_date = startStr
        const endMs = parseDate(startStr).getTime() + (draft[taskIndex].duration_days * DAY_MS)

        // Find tasks that depend on THIS task
        draft.forEach((child: any, cIdx: number) => {
          if (child.dependencies?.includes(taskId)) {
            const childStartMs = parseDate(child.start_date).getTime()
            // If the parent overlaps the child, push the child
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
    const updates = tasks.map(t => ({ id: t.id, start_date: t.start_date }))
    // Upsert all changed dates
    const { error } = await supabase.from('project_schedule').upsert(updates)
    if (error) alert("Failed to save schedule alignment.")
    setSaving(false)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('project_schedule').insert([{
      project_id: id, trade_id: newTask.trade || null, task_name: newTask.name,
      start_date: newTask.start, duration_days: newTask.duration, dependencies: newTask.deps
    }])
    if (!error) {
      setShowNewTask(false)
      window.location.reload()
    }
    setSaving(false)
  }

  // Generate 60 days of grid columns
  const gridDays = Array.from({ length: 60 }).map((_, i) => {
    const d = new Date(gridStartDate.getTime() + (i * DAY_MS))
    return { date: d, isWeekend: d.getDay() === 0 || d.getDay() === 6 }
  })

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Timeline...</div>

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Project <span className="text-blue-500">Schedule</span></h1>
          {projectEndDate > 0 && (
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
               Target Completion: <span className="text-emerald-500">{new Date(projectEndDate).toLocaleDateString()}</span>
             </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => saveAllTasks()} className="bg-slate-800 text-slate-300 text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
          <button onClick={() => setShowNewTask(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
            <Plus size={16}/> New Task
          </button>
        </div>
      </div>

      {/* GANTT CONTAINER */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[70vh]">
        
        {/* LEFT PANEL: Task List */}
        <div className="w-full md:w-80 border-r border-slate-800 bg-slate-950/50 flex flex-col z-20 shadow-xl">
          <div className="h-16 border-b border-slate-800 flex items-center px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900">
            Work Breakdown
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {processedTasks.map(t => (
              <div key={t.id} className="h-16 border-b border-slate-800/50 px-6 flex flex-col justify-center">
                <p className="text-xs font-bold text-white truncate">{t.task_name}</p>
                <p className="text-[9px] font-black text-blue-500 uppercase truncate tracking-widest mt-0.5">{t.project_contacts?.company || 'General'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Timeline Grid */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-950 relative" ref={containerRef}>
          
          {/* Timeline Header (Days) */}
          <div className="h-16 border-b border-slate-800 flex w-max bg-slate-900 sticky top-0 z-10">
            {gridDays.map((d, i) => (
              <div key={i} className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-800/50 ${d.isWeekend ? 'bg-slate-950/50' : ''}`} style={{ width: COL_WIDTH }}>
                <span className="text-[8px] font-black text-slate-500 uppercase">{d.date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className={`text-[10px] font-black ${d.isWeekend ? 'text-slate-600' : 'text-slate-300'}`}>{d.date.getDate()}</span>
              </div>
            ))}
          </div>

          {/* Timeline Rows (Tasks) */}
          <div className="relative w-max">
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {gridDays.map((d, i) => (
                 <div key={i} className={`flex-shrink-0 border-r border-slate-800/30 h-full ${d.isWeekend ? 'bg-slate-900/20' : ''}`} style={{ width: COL_WIDTH }} />
              ))}
            </div>

            {/* Task Bars */}
            {processedTasks.map((t, index) => {
              const startMs = parseDate(t.start_date).getTime()
              const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS)
              const isCritical = criticalPathIds.has(t.id)
              
              return (
                <div key={t.id} className="h-16 border-b border-slate-800/50 relative group">
                  {offsetDays >= 0 && (
                    <div 
                      className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-xl flex items-center px-3 cursor-grab active:cursor-grabbing shadow-lg transition-colors ${
                        isCritical ? 'bg-red-600/90 hover:bg-red-500 border border-red-400' : 'bg-blue-600/90 hover:bg-blue-500 border border-blue-400'
                      }`}
                      style={{ 
                        left: offsetDays * COL_WIDTH, 
                        width: Math.max(t.duration_days * COL_WIDTH, COL_WIDTH - 8) 
                      }}
                      onPointerDown={(e) => handlePointerDown(e, t.id, t.start_date)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    >
                      <GripVertical size={12} className="text-white/50 mr-2 flex-shrink-0" />
                      <span className="text-[10px] font-black text-white truncate pointer-events-none">
                        {t.duration_days}d
                      </span>
                    </div>
                  )}
                  {/* Dependency Indicators (Simple visual dots) */}
                  {t.dependencies?.length > 0 && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" title="Has prerequisites"><LinkIcon size={12}/></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* NEW TASK MODAL */}
      {showNewTask && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Add Schedule Item</h2>
            
            <input value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} placeholder="Task Name (e.g. Rough Framing)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
            
            <select value={newTask.trade} onChange={e => setNewTask({...newTask, trade: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none">
              <option value="">Assigned Trade (Optional)</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.company}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Start Date</label>
                <input type="date" value={newTask.start} onChange={e => setNewTask({...newTask, start: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none [color-scheme:dark]" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Duration (Days)</label>
                <input type="number" min="1" value={newTask.duration} onChange={e => setNewTask({...newTask, duration: parseInt(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
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
              <button onClick={() => setShowNewTask(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button onClick={handleCreateTask} disabled={!newTask.name || !newTask.start} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50">Save Task</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  )
}