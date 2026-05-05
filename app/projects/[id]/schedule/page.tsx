'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, Save, Loader2, GripVertical, 
  CalendarDays, HardHat, AlertTriangle, Link as LinkIcon, Edit2, Trash2, Printer, ChevronDown, ChevronRight, Layers, Check
} from 'lucide-react'

const parseDate = (d: string) => new Date(d + 'T00:00:00')
const DAY_MS = 86400000
// 1. CONDENSE SCREEN: Reduce column width
const COL_WIDTH = 32 

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
  
  // --- UPGRADED: SPECIFIC OVERLAY SELECTION ---
  const [overlayProjects, setOverlayProjects] = useState<string[]>([])
  const [overlayTasks, setOverlayTasks] = useState<any[]>([])
  const [otherProjects, setOtherProjects] = useState<any[]>([])
  
  const [gridStartDate, setGridStartDate] = useState(new Date())
  
  // 2. PERSIST COLLAPSE STATE: Initialize from localStorage if available
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
     if (typeof window !== 'undefined') {
       const saved = localStorage.getItem(`schedule_collapsed_${id}`);
       if (saved) return new Set(JSON.parse(saved));
     }
     return new Set();
  });
  
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
  
  const [isPrinting, setIsPrinting] = useState(false)

  // Save collapsed state to local storage whenever it changes
  useEffect(() => {
     if (typeof window !== 'undefined') {
       localStorage.setItem(`schedule_collapsed_${id}`, JSON.stringify(Array.from(collapsedCats)));
     }
  }, [collapsedCats, id]);

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      
      const [tData, trData, projectsData] = await Promise.all([
        supabase.from('project_schedule').select('*, project_contacts(company)').eq('project_id', id).order('sort_order', { ascending: true }),
        supabase.from('project_contacts').select('id, company').eq('project_id', id),
        supabase.from('projects').select('id, name, status').neq('status', 'Closed')
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
      
      if (projectsData.data) {
        const otherProjs = projectsData.data.filter(p => p.id !== id)
        setOtherProjects(otherProjs)
        
        if (otherProjs.length > 0) {
          const otherIds = otherProjs.map(p => p.id)
          const { data: overlayData } = await supabase
            .from('project_schedule')
            .select('*, projects(name), project_contacts(company)')
            .in('project_id', otherIds)
            
          if (overlayData) setOverlayTasks(overlayData)
        }
      }
      
      setLoading(false)
    }
    fetchData()
  }, [id])

  const toggleOverlayProject = (projectId: string) => {
    setOverlayProjects(prev => 
      prev.includes(projectId) ? prev.filter(pid => pid !== projectId) : [...prev, projectId]
    )
  }

  // --- ENGINE ---
  const { processedTasks, projectEndDate, criticalPathIds, groupedTasks, globalGroupedTasks } = useMemo(() => {
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

    // Apply Specific Overlays
    let globalGrouped = { ...grouped }
    if (overlayProjects.length > 0) {
      const activeOverlayTasks = overlayTasks.filter(t => overlayProjects.includes(t.project_id))
      activeOverlayTasks.forEach(task => {
        const cat = task.category || 'Pre-con'
        if (!globalGrouped[cat]) globalGrouped[cat] = []
        globalGrouped[cat].push({ ...task, isOverlay: true })
      })
    }

    return { processedTasks: pTasks, projectEndDate: maxEnd, criticalPathIds: cPath, groupedTasks: grouped, globalGroupedTasks: globalGrouped }
  }, [tasks, overlayTasks, overlayProjects])

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

  const handlePrint = async () => {
    const element = document.getElementById('gantt-canvas')
    if (!element) return
    
    setSaving(true)
    setIsPrinting(true) // Trigger print styles

    try {
      // Small delay to allow react to render print styles before capture
      await new Promise(r => setTimeout(r, 100));

      const { toJpeg } = await import('html-to-image')
      const { jsPDF } = await import('jspdf')

      const imgData = await toJpeg(element, {
        quality: 0.9,
        backgroundColor: '#ffffff', // Force white background for capture
        pixelRatio: 2, 
      })

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (element.scrollHeight * pdfWidth) / element.scrollWidth

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Project_Schedule_${id}.pdf`)

    } catch (error) {
      console.error('PDF Export Error:', error)
      alert('Failed to generate PDF. Check console.')
    } finally {
        setIsPrinting(false)
        setSaving(false)
    }
  }

  // 4. FIX INFINITE ABYSS: Calculate required timeline length dynamically
  const calculateTotalDays = () => {
      if (projectEndDate === 0) return 120; // Default if no tasks
      // Calculate days between start of grid and end of project, plus a 30 day buffer
      const diffMs = projectEndDate - gridStartDate.getTime();
      const requiredDays = Math.ceil(diffMs / DAY_MS) + 30;
      return Math.max(requiredDays, 120); // At least 120 days
  };

  const totalDays = calculateTotalDays();

  const gridDays = Array.from({ length: totalDays }).map((_, i) => {
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

  // 5. CALCULATE CATEGORY DATES: Helper function
  const getCategoryDates = (tasksInCategory: any[]) => {
      if (!tasksInCategory || tasksInCategory.length === 0) return null;
      let earliest = Infinity;
      let latest = 0;
      tasksInCategory.forEach(t => {
          const s = parseDate(t.start_date).getTime();
          const e = s + (t.duration_days * DAY_MS);
          if (s < earliest) earliest = s;
          if (e > latest) latest = e;
      });
      return {
          start: new Date(earliest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          end: new Date(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Timeline...</div>

  const activeTaskMap = overlayProjects.length > 0 ? globalGroupedTasks : groupedTasks;

  return (
    <div className={`max-w-[1800px] mx-auto p-4 md:p-8 min-h-screen font-sans pb-32 transition-colors duration-300 ${isPrinting ? 'bg-white text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      
      {/* HEADER */}
      <div className={`mb-8 border-b-4 pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 ${isPrinting ? 'border-slate-800' : 'border-blue-600'}`}>
        <div>
          <button onClick={() => router.back()} className={`text-[10px] font-black uppercase mb-4 flex items-center gap-1 transition-all ${isPrinting ? 'text-slate-600' : 'text-slate-500 hover:text-white'}`}><ChevronLeft size={12}/> War Room</button>
          <h1 className={`text-4xl font-black tracking-tighter uppercase italic leading-none ${isPrinting ? 'text-slate-900' : 'text-white'}`}>Master <span className="text-blue-500">Schedule</span></h1>
          {projectEndDate > 0 && (
             <p className={`text-[10px] font-black uppercase tracking-widest mt-3 flex items-center gap-2 ${isPrinting ? 'text-slate-600' : 'text-slate-500'}`}>
               Target Completion: <span className={isPrinting ? 'text-slate-900' : 'text-emerald-500'}>{new Date(projectEndDate).toLocaleDateString()}</span>
             </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          
          <button onClick={handlePrint} disabled={saving} className={`text-[10px] font-black px-6 py-4 rounded-2xl uppercase transition-all flex items-center gap-2 shadow-xl ${isPrinting ? 'hidden' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>} Export
          </button>
          <button onClick={saveAllTasks} disabled={saving} className={`text-[10px] font-black px-6 py-4 rounded-2xl uppercase transition-all flex items-center gap-2 shadow-xl border ${isPrinting ? 'hidden' : 'bg-slate-800 text-blue-400 border-blue-900/50 hover:bg-slate-700'}`}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
          <button onClick={() => setShowNewTask(true)} className={`text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg transition-all flex items-center gap-2 ${isPrinting ? 'hidden' : 'bg-blue-600 text-white shadow-blue-900/20 hover:bg-blue-500'}`}>
            <Plus size={16}/> Task
          </button>
        </div>
      </div>

      {/* --- SPECIFIC PROJECT OVERLAY SELECTOR --- */}
      {otherProjects.length > 0 && !isPrinting && (
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-xl">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 pr-4 flex items-center gap-1">
            <Layers size={12}/> Compare Overlay:
          </span>
          {otherProjects.map(p => {
            const isActive = overlayProjects.includes(p.id);
            return (
              <button 
                key={p.id}
                onClick={() => toggleOverlayProject(p.id)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
              >
                {isActive && <Check size={10} />}
                {p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* PC GANTT CANVAS */}
      <div className={`rounded-[32px] border shadow-2xl overflow-hidden relative z-0 transition-colors duration-300 ${isPrinting ? 'bg-white border-slate-300 shadow-none' : 'bg-slate-900 border-slate-800'}`}>
        <div className={`overflow-auto custom-scrollbar max-h-[75vh] relative ${isPrinting ? 'max-h-none overflow-visible' : ''}`} ref={containerRef}>
          <div id="gantt-canvas" className={`w-max min-w-full transition-colors duration-300 ${isPrinting ? 'bg-white' : 'bg-slate-900'}`}>

            {/* STICKY HEADER ROW */}
            <div className={`flex sticky top-0 z-40 border-b shadow-sm transition-colors duration-300 ${isPrinting ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'}`}>
              <div className={`w-40 md:w-[280px] shrink-0 sticky left-0 z-50 p-2 md:p-4 border-r flex flex-col justify-end font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-colors duration-300 ${isPrinting ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Trade / Task</div>
              <div className={`w-[60px] md:w-[80px] shrink-0 p-2 md:p-4 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-colors duration-300 ${isPrinting ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>Start</div>
              <div className={`w-[60px] md:w-[80px] shrink-0 p-2 md:p-4 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-colors duration-300 ${isPrinting ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>End</div>
              <div className={`w-[40px] md:w-[60px] shrink-0 p-2 md:p-4 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-colors duration-300 ${isPrinting ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>Dur.</div>

              <div className="flex flex-col">
                <div className={`flex border-b h-8 transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800/50'}`}>
                  {monthSpans.map((m, i) => (
                    <div key={i} className={`px-2 md:px-4 py-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-r truncate transition-colors duration-300 ${isPrinting ? 'text-slate-800 border-slate-300' : 'text-blue-500 border-slate-800/50'}`} style={{ width: m.colSpan * COL_WIDTH }}>{m.name}</div>
                  ))}
                </div>
                <div className="flex h-8">
                  {gridDays.map((d, i) => (
                    <div key={i} className={`flex-shrink-0 flex items-center justify-center border-r transition-colors duration-300 ${isPrinting ? `border-slate-200 ${d.isWeekend ? 'bg-slate-50' : ''}` : `border-slate-800/50 ${d.isWeekend ? 'bg-slate-950/50' : ''}`}`} style={{ width: COL_WIDTH }}>
                      <span className={`text-[8px] md:text-[9px] font-black ${isPrinting ? (d.isWeekend ? 'text-slate-400' : 'text-slate-700') : (d.isWeekend ? 'text-slate-600' : 'text-slate-300')}`}>{d.date.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {Object.keys(activeTaskMap).length === 0 && (
               <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">No tasks scheduled yet.</div>
            )}
            
            {Object.entries(activeTaskMap as Record<string, any[]>).map(([category, catTasks]) => {
              const isCollapsed = collapsedCats.has(category)
              const isDraggedCategory = reorderingCategory === category
              const catDates = getCategoryDates(catTasks);
              
              return (
                <div 
                  key={category} 
                  className={`group ${isDraggedCategory ? 'opacity-50' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleDrop(e, category); }}
                >
                  <div draggable onDragStart={(e) => handleDragStartCategory(e, category)} className={`flex border-b sticky left-0 z-30 transition-colors duration-300 ${isPrinting ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/50 border-slate-800/50'}`}>
                    <div className={`w-40 md:w-[280px] shrink-0 sticky left-0 z-30 flex items-stretch border-r transition-colors duration-300 ${isPrinting ? 'bg-slate-100 border-slate-300' : 'bg-slate-950/80 border-slate-800'}`}>
                      <div className={`hidden md:flex w-8 items-center justify-center cursor-grab active:cursor-grabbing border-r transition-colors duration-300 ${isPrinting ? 'text-slate-400 border-slate-300' : 'hover:bg-slate-900 text-slate-600 hover:text-white border-slate-800/50'}`}>
                        <GripVertical size={14} />
                      </div>
                      <button onClick={() => toggleCategory(category)} className={`flex-1 p-2 md:p-3 flex items-center gap-1 md:gap-2 transition-colors text-left overflow-hidden ${isPrinting ? '' : 'hover:bg-slate-900'}`}>
                        {isCollapsed ? <ChevronRight size={14} className={isPrinting ? 'text-slate-500' : 'text-slate-500 shrink-0'} /> : <ChevronDown size={14} className={isPrinting ? 'text-slate-500' : 'text-slate-500 shrink-0'} />}
                        <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest truncate ${isPrinting ? 'text-slate-900' : 'text-white'}`}>{category}</span>
                        <span className={`text-[8px] md:text-[9px] font-bold ml-auto px-2 py-0.5 rounded hidden sm:inline-block transition-colors duration-300 ${isPrinting ? 'text-slate-500 bg-slate-200' : 'text-slate-500 bg-slate-900'}`}>{catTasks.length}</span>
                      </button>
                    </div>
                    {/* 5. ADD CATEGORY DATES: Display date range in category header */}
                    <div className={`flex-1 flex pointer-events-none transition-colors duration-300 ${isPrinting ? 'bg-slate-50' : 'bg-slate-950/50'}`}>
                      <div className={`w-[60px] md:w-[80px] shrink-0 border-r flex items-center justify-center transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`}>
                         {catDates && <span className={`text-[9px] font-bold ${isPrinting ? 'text-slate-600' : 'text-slate-500'}`}>{catDates.start}</span>}
                      </div>
                      <div className={`w-[60px] md:w-[80px] shrink-0 border-r flex items-center justify-center transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`}>
                         {catDates && <span className={`text-[9px] font-bold ${isPrinting ? 'text-slate-600' : 'text-slate-500'}`}>{catDates.end}</span>}
                      </div>
                      <div className={`w-[40px] md:w-[60px] shrink-0 border-r transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`} />
                    </div>
                  </div>

                  {!isCollapsed && catTasks.map((t: any) => {
                    const startMs = parseDate(t.start_date).getTime()
                    const endMs = startMs + (t.duration_days * DAY_MS)
                    const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS)
                    const isCritical = criticalPathIds.has(t.id) && !t.isOverlay
                    const isDraggedTask = reorderingId === t.id

                    return (
                      <div 
                        key={`${t.id}-${t.isOverlay ? 'overlay' : 'base'}`} 
                        className={`flex border-b relative h-12 md:h-16 task-row transition-colors duration-300 ${isPrinting ? 'border-slate-200 bg-white' : 'border-slate-800/50 hover:bg-slate-800/20'} ${isDraggedTask ? 'opacity-50' : ''} ${t.isOverlay ? (isPrinting ? 'opacity-70 bg-slate-50' : 'opacity-60 bg-slate-950/50') : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleDrop(e, category, t.id) }}
                      >
                        
                        <div className={`w-40 md:w-[280px] shrink-0 sticky left-0 z-20 border-r flex items-stretch transition-colors duration-300 ${isPrinting ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
                          {!t.isOverlay && (
                            <div draggable onDragStart={(e) => handleDragStartTask(e, t.id)} className={`hidden md:flex w-8 items-center justify-center border-r cursor-grab active:cursor-grabbing transition-colors duration-300 ${isPrinting ? 'border-slate-300 text-slate-300' : 'border-slate-800/50 hover:bg-slate-800 text-slate-600 hover:text-white'}`}>
                              <GripVertical size={14} />
                            </div>
                          )}
                          {t.isOverlay && <div className={`hidden md:block w-8 border-r transition-colors duration-300 ${isPrinting ? 'border-slate-300 bg-slate-50' : 'border-slate-800/50 bg-slate-950/30'}`} />}
                          
                          <button onClick={() => !t.isOverlay && setEditingTask(t)} className={`flex-1 p-2 md:p-3 flex flex-col justify-center text-left transition-colors overflow-hidden ${t.isOverlay ? 'cursor-default pointer-events-none' : (isPrinting ? '' : 'hover:bg-slate-900')}`}>
                            <div className="flex justify-between items-center w-full">
                              <p className={`text-[9px] md:text-[11px] font-bold truncate transition-colors pr-2 ${isPrinting ? (t.isOverlay ? 'text-indigo-600' : 'text-slate-800') : (t.isOverlay ? 'text-indigo-300' : 'text-white')}`}>{t.task_name}</p>
                              {!t.isOverlay && !isPrinting && <Edit2 size={12} className="text-slate-600 shrink-0 hover:text-white hidden sm:block" />}
                            </div>
                            {t.isOverlay ? (
                              <p className={`text-[7px] md:text-[8px] font-black uppercase truncate tracking-widest mt-0.5 ${isPrinting ? 'text-indigo-400' : 'text-indigo-500'}`}>{t.projects?.name}</p>
                            ) : (
                              <p className={`text-[7px] md:text-[8px] font-black uppercase truncate tracking-widest mt-0.5 ${isPrinting ? 'text-slate-500' : 'text-slate-500'}`}>{t.project_contacts?.company || 'General'}</p>
                            )}
                          </button>
                        </div>
                        
                        <div className={`w-[60px] md:w-[80px] shrink-0 p-2 md:p-4 border-r flex items-center justify-center transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`}>
                          <span className={`text-[8px] md:text-[10px] font-bold ${isPrinting ? 'text-slate-600' : 'text-slate-400'}`}>{new Date(startMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
                        </div>

                        <div className={`w-[60px] md:w-[80px] shrink-0 p-2 md:p-4 border-r flex items-center justify-center transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`}>
                          <span className={`text-[8px] md:text-[10px] font-bold ${isPrinting ? 'text-slate-600' : 'text-slate-400'}`}>{new Date(endMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
                        </div>

                        <div className={`w-[40px] md:w-[60px] shrink-0 p-2 md:p-4 border-r flex items-center justify-center transition-colors duration-300 ${isPrinting ? 'border-slate-300' : 'border-slate-800'}`}>
                          <span className={`text-[9px] md:text-[11px] font-black ${isPrinting ? 'text-slate-800' : 'text-white'}`}>{t.duration_days}d</span>
                        </div>

                        <div className="relative flex">
                          {gridDays.map((d, i) => (
                            <div key={i} className={`flex-shrink-0 border-r h-full transition-colors duration-300 ${isPrinting ? `border-slate-200 ${d.isWeekend ? 'bg-slate-50' : ''}` : `border-slate-800/30 ${d.isWeekend ? 'bg-slate-900/20' : ''}`}`} style={{ width: COL_WIDTH }} />
                          ))}

                          {offsetDays >= 0 && (
                            <div 
                              className={`absolute top-1/2 -translate-y-1/2 h-6 md:h-8 rounded flex items-center transition-colors group/bar overflow-hidden ${
                                isPrinting ? 
                                    (t.isOverlay ? 'bg-indigo-100 border border-indigo-300 border-dashed' : isCritical ? 'bg-red-200 border border-red-400' : 'bg-blue-200 border border-blue-400') 
                                :
                                    (t.isOverlay ? 'bg-indigo-600/30 border border-indigo-400 border-dashed pointer-events-none' : isCritical ? 'bg-red-600 hover:bg-red-500 border border-red-400 shadow-lg' : 'bg-blue-600 hover:bg-blue-500 border border-blue-400 shadow-lg')
                              }`}
                              style={{ left: offsetDays * COL_WIDTH, width: Math.max(t.duration_days * COL_WIDTH, COL_WIDTH - 4) }}
                            >
                              {!t.isOverlay && !isPrinting && (
                                <div 
                                  className="w-4 md:w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                                  onPointerDown={(e) => handleHPointerDown(e, t.id, t.start_date, 'move', t.duration_days)}
                                  onPointerMove={handleHPointerMove}
                                  onPointerUp={handleHPointerUp}
                                >
                                  <GripVertical size={10} className="text-white/50 hidden md:block" />
                                </div>
                              )}

                              <div className="flex-1 truncate pointer-events-none px-1 flex items-center">
                                <span className={`text-[8px] md:text-[9px] font-black leading-none ${isPrinting ? 'text-slate-800' : 'text-white'}`}>
                                  {/* Ensure link icon is visible on print */}
                                  {t.dependencies?.length > 0 && <LinkIcon size={8} className="inline mr-1 opacity-70" />}
                                  {t.isOverlay && t.project_contacts?.company}
                                </span>
                              </div>

                              {!t.isOverlay && !isPrinting && (
                                <div 
                                  className="w-3 md:w-4 h-full cursor-col-resize shrink-0 hover:bg-white/20 rounded-r"
                                  onPointerDown={(e) => handleHPointerDown(e, t.id, t.start_date, 'extendEnd', t.duration_days)}
                                  onPointerMove={handleHPointerMove}
                                  onPointerUp={handleHPointerUp}
                                />
                              )}
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
                {tasks.filter(t => t.id !== editingTask.id && !t.isOverlay).map(t => (
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