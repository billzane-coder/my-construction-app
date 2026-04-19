'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, Save, Loader2, GripVertical, 
  CalendarDays, HardHat, AlertTriangle, Link as LinkIcon, Edit2, Trash2, Printer, ChevronDown, ChevronRight
} from 'lucide-react'

const parseDate = (d: string) => new Date(d + 'T00:00:00')
const DAY_MS = 86400000
const COL_WIDTH = 48 

// --- CATEGORIES ---
const DEFAULT_CATEGORIES = [
  'Pre-con', 'General & Prep', 'Substructure', 'Exterior Shell', 
  'MEP Rough-ins', 'Interior Finishes', 'MEP Trim-out', 'Final & Handover'
]

export default function ScheduleMaster() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  
  const [gridStartDate, setGridStartDate] = useState(new Date())
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  
  // Drag State (Horizontal)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragType, setDragType] = useState<'move' | 'extendEnd'>('move')
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  
  // Drag State (Vertical Tasks & Categories)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [reorderingCategory, setReorderingCategory] = useState<string | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Modals
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', trade: '', start: '', duration: 1, deps: [] as string[], category: 'Pre-con' })
  const [editingTask, setEditingTask] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      const [tData, trData] = await Promise.all([
        supabase.from('project_schedule').select('*, project_contacts(company)').eq('project_id', id).order('sort_order', { ascending: true }),
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
  const { processedTasks, projectEndDate, criticalPathIds, groupedTasks } = useMemo(() => {
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

    const grouped = pTasks.reduce((acc, task) => {
      const cat = task.category || 'Pre-con'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(task)
      return acc
    }, {} as Record<string, any[]>)

    return { processedTasks: pTasks, projectEndDate: maxEnd, criticalPathIds: cPath, groupedTasks: grouped }
  }, [tasks])


  // --- HORIZONTAL DRAG LOGIC ---
  const handleHPointerDown = (e: React.PointerEvent, taskId: string, start_date: string, type: 'move' | 'extendEnd', duration: number) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(taskId)
    setDragType(type)
    setDragStartX(e.clientX)
    
    if (type === 'move') {
      const startMs = parseDate(start_date).getTime()
      setDragStartValue(Math.round((startMs - gridStartDate.getTime()) / DAY_MS))
    } else {
      setDragStartValue(duration)
    }
  }

  const handleHPointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return
    const deltaX = e.clientX - dragStartX
    const daysShifted = Math.round(deltaX / COL_WIDTH)
    
    if (daysShifted !== 0) {
      if (dragType === 'move') {
        const newOffset = dragStartValue + daysShifted
        const newStartDate = new Date(gridStartDate.getTime() + (newOffset * DAY_MS))
        applyCascadeUpdate(draggingId, newStartDate.toISOString().split('T')[0])
        setDragStartX(e.clientX)
        setDragStartValue(newOffset)
      } else if (dragType === 'extendEnd') {
        const newDuration = Math.max(1, dragStartValue + daysShifted)
        setTasks(prev => prev.map(t => t.id === draggingId ? { ...t, duration_days: newDuration } : t))
        setDragStartX(e.clientX)
        setDragStartValue(newDuration)
        const task = tasks.find(t => t.id === draggingId)
        if(task) applyCascadeUpdate(draggingId, task.start_date, newDuration)
      }
    }
  }

  const handleHPointerUp = async (e: React.PointerEvent) => {
    if (!draggingId) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingId(null)
    saveAllTasks() 
  }

  const applyCascadeUpdate = (movedTaskId: string, newStartDateStr: string, forceDuration?: number) => {
    setTasks(prev => {
      let draft = JSON.parse(JSON.stringify(prev)) 
      
      const updateDownstream = (taskId: string, startStr: string, dur?: number) => {
        const taskIndex = draft.findIndex((t: any) => t.id === taskId)
        if (taskIndex === -1) return
        
        draft[taskIndex].start_date = startStr
        if(dur) draft[taskIndex].duration_days = dur
        
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
      
      updateDownstream(movedTaskId, newStartDateStr, forceDuration)
      return draft
    })
  }

  // --- VERTICAL DRAG LOGIC (Tasks & Categories) ---
  const handleDragStartTask = (e: React.DragEvent, taskId: string) => {
    setReorderingId(taskId)
    setReorderingCategory(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dragType', 'task')
    if (e.target instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.target.closest('.task-row') || e.target, 20, 20)
    }
  }

  const handleDragStartCategory = (e: React.DragEvent, category: string) => {
    setReorderingCategory(category)
    setReorderingId(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dragType', 'category')
  }

  const handleDrop = async (e: React.DragEvent, targetCategory: string, targetTaskId?: string) => {
    e.preventDefault()
    e.stopPropagation() 

    const dragType = e.dataTransfer.getData('dragType') || (reorderingCategory ? 'category' : 'task')

    // 1. Handle Dropping an Entire Category
    if (dragType === 'category' && reorderingCategory) {
      if (reorderingCategory === targetCategory) return

      setTasks(prev => {
        let newTasks = [...prev]
        
        const draggedCats = newTasks.filter(t => t.category === reorderingCategory)
        newTasks = newTasks.filter(t => t.category !== reorderingCategory)

        const targetIndex = newTasks.findIndex(t => t.category === targetCategory)

        if (targetIndex !== -1) {
          newTasks.splice(targetIndex, 0, ...draggedCats)
        } else {
          newTasks.push(...draggedCats)
        }

        return newTasks.map((t, i) => ({ ...t, sort_order: i }))
      })
      
      setReorderingCategory(null)
      setTimeout(saveAllTasks, 100)
      return
    }

    // 2. Handle Dropping a Single Task
    if (dragType === 'task' && reorderingId && reorderingId !== targetTaskId) {
      setTasks(prev => {
        let newTasks = [...prev]
        const draggedTaskIndex = newTasks.findIndex(t => t.id === reorderingId)
        if (draggedTaskIndex === -1) return prev

        const draggedTask = { ...newTasks[draggedTaskIndex], category: targetCategory }
        newTasks.splice(draggedTaskIndex, 1)

        if (targetTaskId) {
          const targetIndex = newTasks.findIndex(t => t.id === targetTaskId)
          newTasks.splice(targetIndex, 0, draggedTask)
        } else {
          const catTasks = newTasks.filter(t => t.category === targetCategory)
          const lastCatIndex = catTasks.length > 0 ? newTasks.indexOf(catTasks[catTasks.length - 1]) : newTasks.length
          newTasks.splice(lastCatIndex + 1, 0, draggedTask)
        }

        return newTasks.map((t, i) => ({ ...t, sort_order: i }))
      })
      
      setReorderingId(null)
      setTimeout(saveAllTasks, 100) 
    }
  }


  const saveAllTasks = async () => {
    setSaving(true)
    const updates = tasks.map((t, i) => ({ 
      id: t.id, project_id: id, start_date: t.start_date, 
      task_name: t.task_name, duration_days: t.duration_days,
      category: t.category, sort_order: i
    }))
    const { error } = await supabase.from('project_schedule').upsert(updates)
    if (error) alert(`Sync failed: ${error.message}`)
    setSaving(false)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('project_schedule').insert([{
      project_id: id, trade_id: newTask.trade || null, task_name: newTask.name,
      start_date: newTask.start, duration_days: newTask.duration, dependencies: newTask.deps,
      category: newTask.category, sort_order: tasks.length
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
      start_date: editingTask.start_date,
      trade_id: editingTask.trade_id || null,     
      dependencies: editingTask.dependencies || [],
      category: editingTask.category
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

  const toggleCategory = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

// --- UPGRADED PDF EXPORT ENGINE (html-to-image + jsPDF) ---
  const handlePrint = async () => {
    const element = document.getElementById('gantt-canvas')
    if (!element) return
    
    setSaving(true)

    try {
      // 1. Dynamically import the modern image engine
      const { toJpeg } = await import('html-to-image')
      const { jsPDF } = await import('jspdf')

      // 2. Snapshot the grid using the browser's native rendering
      const imgData = await toJpeg(element, {
        quality: 0.8,
        backgroundColor: '#0f172a', // Matches slate-900 background
        pixelRatio: 2, // High-res export
      })

      // 3. Create an A3 Landscape PDF
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
      
      // Calculate aspect ratio using the DOM element's actual pixel dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (element.scrollHeight * pdfWidth) / element.scrollWidth

      // 4. Bake the image onto the PDF
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      
      // 5. Download it
      pdf.save(`Project_Schedule_${id}.pdf`)

    } catch (error) {
      console.error('PDF Export Error:', error)
      alert('Failed to generate PDF. Check console.')
    }
    
    setSaving(false)
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
    <div className="max-w-[1800px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Master <span className="text-blue-500">Schedule</span></h1>
          {projectEndDate > 0 && (
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
               Target Completion: <span className="text-emerald-500">{new Date(projectEndDate).toLocaleDateString()}</span>
             </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} disabled={saving} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>} Export PDF
          </button>
          <button onClick={saveAllTasks} disabled={saving} className="bg-slate-800 text-blue-400 border border-blue-900/50 text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
          <button onClick={() => setShowNewTask(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
            <Plus size={16}/> New Task
          </button>
        </div>
      </div>

      {/* PC GANTT CANVAS */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden">
        
        <div className="overflow-auto custom-scrollbar max-h-[75vh] relative" ref={containerRef}>
          {/* 🎯 TARGET CANVAS FOR PDF EXPORT */}
          <div id="gantt-canvas" className="w-max min-w-full bg-slate-900">

            {/* STICKY HEADER ROW */}
            <div className="flex sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-sm">
              <div className="w-[320px] shrink-0 sticky left-0 z-50 bg-slate-900 p-4 border-r border-slate-800 flex flex-col justify-end font-black text-[10px] text-slate-500 uppercase tracking-widest">Trade / Task</div>
              <div className="w-[80px] shrink-0 p-4 border-r border-slate-800 flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">Start</div>
              <div className="w-[80px] shrink-0 p-4 border-r border-slate-800 flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">End</div>
              <div className="w-[60px] shrink-0 p-4 border-r border-slate-800 flex flex-col justify-end items-center font-black text-[10px] text-slate-500 uppercase tracking-widest">Dur.</div>

              <div className="flex flex-col">
                <div className="flex border-b border-slate-800/50 h-8">
                  {monthSpans.map((m, i) => (
                    <div key={i} className="px-4 py-2 text-[10px] font-black text-blue-500 uppercase tracking-widest border-r border-slate-800/50" style={{ width: m.colSpan * COL_WIDTH }}>{m.name}</div>
                  ))}
                </div>
                <div className="flex h-8">
                  {gridDays.map((d, i) => (
                    <div key={i} className={`flex-shrink-0 flex items-center justify-center border-r border-slate-800/50 ${d.isWeekend ? 'bg-slate-950/50' : ''}`} style={{ width: COL_WIDTH }}>
                      <span className={`text-[9px] font-black ${d.isWeekend ? 'text-slate-600' : 'text-slate-300'}`}>{d.date.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CATEGORY & TASK ROWS */}
            {Object.keys(groupedTasks).length === 0 && (
               <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">No tasks scheduled yet.</div>
            )}
            
            {Object.entries(groupedTasks as Record<string, any[]>).map(([category, catTasks]) => {
              const isCollapsed = collapsedCats.has(category)
              const isDraggedCategory = reorderingCategory === category
              
              return (
                <div 
                  key={category} 
                  className={`group ${isDraggedCategory ? 'opacity-50' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(e, category);
                  }}
                >
                  {/* CATEGORY HEADER */}
                  <div 
                    draggable
                    onDragStart={(e) => handleDragStartCategory(e, category)}
                    className="flex bg-slate-950/50 border-b border-slate-800/50 sticky left-0 z-30"
                  >
                    <div className="w-[320px] shrink-0 sticky left-0 z-30 bg-slate-950/80 flex items-stretch border-r border-slate-800">
                      {/* Category Drag Handle */}
                      <div className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-slate-900 text-slate-600 hover:text-white border-r border-slate-800/50">
                        <GripVertical size={14} />
                      </div>
                      <button 
                        onClick={() => toggleCategory(category)}
                        className="flex-1 p-3 flex items-center gap-2 hover:bg-slate-900 transition-colors text-left"
                      >
                        {isCollapsed ? <ChevronRight size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                        <span className="text-xs font-black text-white uppercase tracking-widest">{category}</span>
                        <span className="text-[9px] font-bold text-slate-500 ml-auto bg-slate-900 px-2 py-0.5 rounded">{catTasks.length}</span>
                      </button>
                    </div>
                    {/* Empty Grid Fill */}
                    <div className="flex-1 flex bg-slate-950/50 pointer-events-none">
                      <div className="w-[80px] shrink-0 border-r border-slate-800" />
                      <div className="w-[80px] shrink-0 border-r border-slate-800" />
                      <div className="w-[60px] shrink-0 border-r border-slate-800" />
                    </div>
                  </div>

                  {/* TASKS IN THIS CATEGORY */}
                  {!isCollapsed && catTasks.map((t: any) => {
                    const startMs = parseDate(t.start_date).getTime()
                    const endMs = startMs + (t.duration_days * DAY_MS)
                    const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS)
                    const isCritical = criticalPathIds.has(t.id)
                    const isDraggedTask = reorderingId === t.id

                    return (
                      <div 
                        key={t.id} 
                        className={`flex border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors relative h-16 task-row ${isDraggedTask ? 'opacity-50' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          handleDrop(e, category, t.id)
                        }}
                      >
                        
                        {/* Locked Data Columns */}
                        <div className="w-[320px] shrink-0 sticky left-0 z-20 bg-slate-950 border-r border-slate-800 flex items-stretch">
                          {/* Task Vertical Drag Handle */}
                          <div 
                            draggable
                            onDragStart={(e) => handleDragStartTask(e, t.id)}
                            className="w-8 flex items-center justify-center border-r border-slate-800/50 cursor-grab active:cursor-grabbing hover:bg-slate-800 text-slate-600 hover:text-white"
                          >
                            <GripVertical size={14} />
                          </div>
                          
                          <button 
                            onClick={() => setEditingTask(t)}
                            className="flex-1 p-3 flex flex-col justify-center text-left hover:bg-slate-900 transition-colors overflow-hidden"
                          >
                            <div className="flex justify-between items-center w-full">
                              <p className="text-xs font-bold text-white truncate transition-colors pr-2">{t.task_name}</p>
                              <Edit2 size={12} className="text-slate-600 shrink-0 hover:text-white" />
                            </div>
                            <p className="text-[9px] font-black text-slate-500 uppercase truncate tracking-widest mt-0.5">{t.project_contacts?.company || 'General'}</p>
                          </button>
                        </div>
                        
                        <div className="w-[80px] shrink-0 p-4 border-r border-slate-800 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(startMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                          </span>
                        </div>

                        <div className="w-[80px] shrink-0 p-4 border-r border-slate-800 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(endMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}
                          </span>
                        </div>

                        <div className="w-[60px] shrink-0 p-4 border-r border-slate-800 flex items-center justify-center">
                          <span className="text-[11px] font-black text-white">{t.duration_days}d</span>
                        </div>

                        {/* Timeline Bar Area */}
                        <div className="relative flex">
                          {/* Background Grid Lines */}
                          {gridDays.map((d, i) => (
                            <div key={i} className={`flex-shrink-0 border-r border-slate-800/30 h-full ${d.isWeekend ? 'bg-slate-900/20' : ''}`} style={{ width: COL_WIDTH }} />
                          ))}

                          {/* Draggable Bar */}
                          {offsetDays >= 0 && (
                            <div 
                              className={`absolute top-1/2 -translate-y-1/2 h-10 rounded-xl flex items-center shadow-lg transition-colors group/bar ${
                                isCritical ? 'bg-red-600 hover:bg-red-500 border border-red-400' : 'bg-blue-600 hover:bg-blue-500 border border-blue-400'
                              }`}
                              style={{ left: offsetDays * COL_WIDTH, width: Math.max(t.duration_days * COL_WIDTH, COL_WIDTH - 8) }}
                            >
                              {/* Left Edge (For moving) */}
                              <div 
                                className="w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                                onPointerDown={(e) => handleHPointerDown(e, t.id, t.start_date, 'move', t.duration_days)}
                                onPointerMove={handleHPointerMove}
                                onPointerUp={handleHPointerUp}
                              >
                                <GripVertical size={12} className="text-white/50" />
                              </div>

                              {/* Center Content */}
                              <div className="flex-1 truncate pointer-events-none px-1">
                                <span className="text-[10px] font-black text-white">
                                  {t.dependencies?.length > 0 && <LinkIcon size={10} className="inline mr-1" />}
                                </span>
                              </div>

                              {/* Right Edge (For extending duration) */}
                              <div 
                                className="w-4 h-full cursor-col-resize shrink-0 hover:bg-white/20 rounded-r-xl"
                                onPointerDown={(e) => handleHPointerDown(e, t.id, t.start_date, 'extendEnd', t.duration_days)}
                                onPointerMove={handleHPointerMove}
                                onPointerUp={handleHPointerUp}
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* --- EDIT TASK MODAL --- */}
      {editingTask && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={handleUpdateTask} className="bg-slate-900 border-2 border-amber-500 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Edit Task</h2>
            
            <input value={editingTask.task_name} onChange={e => setEditingTask({...editingTask, task_name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />

            <div className="grid grid-cols-2 gap-4">
              <select 
                value={editingTask.category || 'Pre-con'} 
                onChange={e => setEditingTask({...editingTask, category: e.target.value})} 
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-blue-400 outline-none"
              >
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select 
                value={editingTask.trade_id || ''} 
                onChange={e => setEditingTask({...editingTask, trade_id: e.target.value})} 
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none"
              >
                <option value="">No Trade Assigned</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.company}</option>)}
              </select>
            </div>

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

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase pl-2">Prerequisite Task (Depends On)</label>
              <select 
                value={editingTask.dependencies?.[0] || ''} 
                onChange={e => setEditingTask({...editingTask, dependencies: e.target.value ? [e.target.value] : []})} 
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none"
              >
                <option value="">No Dependencies</option>
                {tasks.filter(t => t.id !== editingTask.id).map(t => (
                  <option key={t.id} value={t.id}>{t.task_name}</option>
                ))}
              </select>
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
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={handleCreateTask} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Add Schedule Item</h2>
            
            <input required value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} placeholder="Task Name (e.g. Rough Framing)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
            
            <div className="grid grid-cols-2 gap-4">
              <select value={newTask.category} onChange={e => setNewTask({...newTask, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-blue-400 outline-none">
                {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select value={newTask.trade} onChange={e => setNewTask({...newTask, trade: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-slate-400 outline-none">
                <option value="">No Trade Assigned</option>
                {trades.map(t => <option key={t.id} value={t.id}>{t.company}</option>)}
              </select>
            </div>

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