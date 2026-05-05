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
const COL_WIDTH = 32 

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
  
  const [overlayProjects, setOverlayProjects] = useState<string[]>([])
  const [overlayTasks, setOverlayTasks] = useState<any[]>([])
  const [otherProjects, setOtherProjects] = useState<any[]>([])
  
  const [gridStartDate, setGridStartDate] = useState(new Date())
  
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
     if (typeof window !== 'undefined') {
       const saved = localStorage.getItem(`schedule_collapsed_${id}`);
       if (saved) return new Set(JSON.parse(saved));
     }
     return new Set();
  });

  // --- UPGRADED: COLUMN RESIZING STATE ---
  const [leftColWidths, setLeftColWidths] = useState(() => {
    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem(`schedule_cols_${id}`);
       if (saved) return JSON.parse(saved);
    }
    return {
      task: typeof window !== 'undefined' && window.innerWidth < 768 ? 160 : 260,
      start: 60,
      end: 60,
      dur: 45
    }
  })
  
  const [resizingCol, setResizingCol] = useState<keyof typeof leftColWidths | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragType, setDragType] = useState<'move' | 'extendEnd'>('move')
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartValue, setDragStartValue] = useState(0)
  
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [reorderingCategory, setReorderingCategory] = useState<string | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)

  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', trade: '', start: '', duration: 1, deps: [] as string[], category: 'Pre-con' })
  const [editingTask, setEditingTask] = useState<any>(null)
  
  const [isExporting, setIsExporting] = useState(false)

  // Save layout preferences
  useEffect(() => {
     if (typeof window !== 'undefined') {
       localStorage.setItem(`schedule_collapsed_${id}`, JSON.stringify(Array.from(collapsedCats)));
       localStorage.setItem(`schedule_cols_${id}`, JSON.stringify(leftColWidths));
     }
  }, [collapsedCats, leftColWidths, id]);

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

  // --- UPGRADED: NATIVE WINDOW RESIZING ENGINE ---
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!resizingCol) return;
      const deltaX = e.clientX - resizeStartX;
      const newWidth = Math.max(40, resizeStartWidth + deltaX);
      setLeftColWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
    };

    const handleUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    }

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [resizingCol, resizeStartX, resizeStartWidth]);

  const startColResize = (e: React.PointerEvent, colName: keyof typeof leftColWidths) => {
    e.preventDefault();
    setResizingCol(colName);
    setResizeStartX(e.clientX);
    setResizeStartWidth(leftColWidths[colName]);
  };

  const totalLeftWidth = leftColWidths.task + leftColWidths.start + leftColWidths.end + leftColWidths.dur;

  // --- ENGINE ---
  const { processedTasks, projectEndDate, criticalPathIds, groupedTasks, globalGroupedTasks, taskCoordinates } = useMemo(() => {
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

    let globalGrouped = { ...grouped }
    if (overlayProjects.length > 0) {
      const activeOverlayTasks = overlayTasks.filter(t => overlayProjects.includes(t.project_id))
      activeOverlayTasks.forEach(task => {
        const cat = task.category || 'Pre-con'
        if (!globalGrouped[cat]) globalGrouped[cat] = []
        globalGrouped[cat].push({ ...task, isOverlay: true })
      })
    }

    let currentY = 64; 
    const coords: Record<string, { xStart: number, xEnd: number, yCenter: number }> = {};
    
    Object.entries(globalGrouped as Record<string, any[]>).forEach(([cat, catTasks]) => {
      currentY += 48; 
      if (!collapsedCats.has(cat)) {
        catTasks.forEach((t: any) => {
          const startMs = parseDate(t.start_date).getTime();
          const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS);
          const durDays = t.duration_days;
          
          coords[t.id] = {
            xStart: offsetDays * COL_WIDTH,
            xEnd: (offsetDays + durDays) * COL_WIDTH,
            yCenter: currentY + 28 
          };
          currentY += 56; 
        });
      }
    });

    return { processedTasks: pTasks, projectEndDate: maxEnd, criticalPathIds: cPath, groupedTasks: grouped, globalGroupedTasks: globalGrouped, taskCoordinates: coords }
  }, [tasks, overlayTasks, overlayProjects, gridStartDate, collapsedCats])

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

  const handleDragStartTask = (e: React.DragEvent, taskId: string) => {
    setReorderingId(taskId)
    setReorderingCategory(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('dragType', 'task')
    if (e.target instanceof HTMLElement) e.dataTransfer.setDragImage(e.target.closest('.task-row') || e.target, 20, 20)
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

    if (dragType === 'category' && reorderingCategory) {
      if (reorderingCategory === targetCategory) return
      setTasks(prev => {
        let newTasks = [...prev]
        const draggedCats = newTasks.filter(t => t.category === reorderingCategory)
        newTasks = newTasks.filter(t => t.category !== reorderingCategory)
        const targetIndex = newTasks.findIndex(t => t.category === targetCategory)
        if (targetIndex !== -1) newTasks.splice(targetIndex, 0, ...draggedCats)
        else newTasks.push(...draggedCats)
        return newTasks.map((t, i) => ({ ...t, sort_order: i }))
      })
      setReorderingCategory(null)
      setTimeout(saveAllTasks, 100)
      return
    }

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

  // --- BULLETPROOF EXPORT METHOD (html2canvas) ---
  const handlePrint = async () => {
    setIsExporting(true);
    setSaving(true);

    setTimeout(async () => {
      try {
        const element = document.getElementById('gantt-export-clone');
        if (!element) throw new Error("Export container missing");

        // Switch to html2canvas, which parses SVGs and complex layouts much better
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Project_Schedule_${id}.pdf`);

      } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Failed to generate PDF. Check console.');
      } finally {
        setIsExporting(false);
        setSaving(false);
      }
    }, 1500); 
  }

  const calculateTotalDays = () => {
      if (projectEndDate === 0) return 120;
      const diffMs = projectEndDate - gridStartDate.getTime();
      const requiredDays = Math.ceil(diffMs / DAY_MS) + 45; 
      return Math.max(requiredDays, 120); 
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

  // --- REUSABLE GANTT COMPONENT ---
  const GanttChartContent = ({ isPrintMode }: { isPrintMode: boolean }) => {
    const activeTaskMap = overlayProjects.length > 0 ? globalGroupedTasks : groupedTasks;

    return (
      <div className={`w-max min-w-full relative ${isPrintMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-slate-100'}`}>

        {/* STICKY HEADER ROW */}
        <div className={`flex sticky top-0 z-50 border-b shadow-sm h-16 ${isPrintMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'}`}>
          
          <div className={`sticky left-0 z-50 flex shadow-[4px_0_15px_-3px_rgba(0,0,0,0.4)] ${isPrintMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'}`}>
            <div style={{ width: leftColWidths.task }} className={`relative shrink-0 p-2 border-r flex flex-col justify-end font-black text-[9px] md:text-[10px] uppercase tracking-widest ${isPrintMode ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>
              Trade / Task
              {!isPrintMode && <div className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => startColResize(e, 'task')} />}
            </div>
            <div style={{ width: leftColWidths.start }} className={`relative shrink-0 p-2 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest ${isPrintMode ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>
              Start
              {!isPrintMode && <div className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => startColResize(e, 'start')} />}
            </div>
            <div style={{ width: leftColWidths.end }} className={`relative shrink-0 p-2 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest ${isPrintMode ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>
              End
              {!isPrintMode && <div className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => startColResize(e, 'end')} />}
            </div>
            <div style={{ width: leftColWidths.dur }} className={`relative shrink-0 p-2 border-r flex flex-col justify-end items-center font-black text-[9px] md:text-[10px] uppercase tracking-widest ${isPrintMode ? 'border-slate-300 text-slate-700' : 'border-slate-800 text-slate-500'}`}>
              Dur.
              {!isPrintMode && <div className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 z-50 opacity-0 hover:opacity-100 transition-opacity" onPointerDown={(e) => startColResize(e, 'dur')} />}
            </div>
          </div>

          <div className="flex flex-col h-full">
            <div className={`flex border-b h-8 ${isPrintMode ? 'border-slate-300' : 'border-slate-800/50'}`}>
              {monthSpans.map((m, i) => (
                <div key={i} className={`px-2 py-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-r truncate ${isPrintMode ? 'border-slate-300 text-slate-800' : 'border-slate-800/50 text-blue-500'}`} style={{ width: m.colSpan * COL_WIDTH }}>{m.name}</div>
              ))}
            </div>
            <div className="flex h-8">
              {gridDays.map((d, i) => (
                <div key={i} className={`flex-shrink-0 flex items-center justify-center border-r ${isPrintMode ? `border-slate-300 ${d.isWeekend ? 'bg-slate-200' : 'bg-slate-50'}` : `border-slate-800/50 ${d.isWeekend ? 'bg-slate-950/50' : ''}`}`} style={{ width: COL_WIDTH }}>
                  <span className={`text-[8px] md:text-[9px] font-black ${isPrintMode ? (d.isWeekend ? 'text-slate-500' : 'text-slate-800') : (d.isWeekend ? 'text-slate-600' : 'text-slate-300')}`}>{d.date.getDate()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {Object.keys(activeTaskMap).length === 0 && (
           <div className={`p-12 text-center text-[10px] font-black uppercase tracking-widest ${isPrintMode ? 'text-slate-500' : 'text-slate-600'}`}>No tasks scheduled yet.</div>
        )}
        
        {Object.entries(activeTaskMap as Record<string, any[]>).map(([category, catTasks]) => {
          const isCollapsed = collapsedCats.has(category)
          const isDraggedCategory = reorderingCategory === category
          const catDates = getCategoryDates(catTasks);
          
          return (
            <div key={category} className={`group ${isDraggedCategory && !isPrintMode ? 'opacity-50' : ''}`} onDragOver={(e) => !isPrintMode && e.preventDefault()} onDrop={(e) => { if(!isPrintMode) {e.preventDefault(); handleDrop(e, category);} }}>
              
              {/* CATEGORY HEADER */}
              <div draggable={!isPrintMode} onDragStart={(e) => !isPrintMode && handleDragStartCategory(e, category)} className={`flex border-b h-12 sticky left-0 z-40 ${isPrintMode ? 'bg-slate-200 border-slate-300' : 'bg-slate-950 border-slate-800/50'}`}>
                
                <div className={`sticky left-0 z-40 flex shadow-[4px_0_15px_-3px_rgba(0,0,0,0.4)] ${isPrintMode ? 'bg-slate-200' : 'bg-slate-950'}`}>
                  <div style={{ width: leftColWidths.task }} className={`shrink-0 flex items-stretch border-r ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                    {!isPrintMode && (
                      <div className="hidden md:flex w-8 items-center justify-center cursor-grab active:cursor-grabbing border-r hover:bg-slate-900 text-slate-600 hover:text-white border-slate-800/50">
                        <GripVertical size={14} />
                      </div>
                    )}
                    <button onClick={() => !isPrintMode && toggleCategory(category)} className={`flex-1 p-2 flex items-center gap-1 text-left overflow-hidden ${isPrintMode ? '' : 'hover:bg-slate-900'}`}>
                      {!isPrintMode && (isCollapsed ? <ChevronRight size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />)}
                      <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest truncate ${isPrintMode ? 'text-slate-900' : 'text-white'}`}>{category}</span>
                      <span className={`text-[8px] md:text-[9px] font-bold ml-auto px-2 py-0.5 rounded hidden sm:inline-block ${isPrintMode ? 'text-slate-600 bg-slate-300' : 'text-slate-500 bg-slate-900'}`}>{catTasks.length}</span>
                    </button>
                  </div>
                  <div style={{ width: leftColWidths.start }} className={`shrink-0 flex items-center justify-center border-r ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                     {catDates && <span className={`text-[9px] font-bold ${isPrintMode ? 'text-slate-600' : 'text-slate-500'}`}>{catDates.start}</span>}
                  </div>
                  <div style={{ width: leftColWidths.end }} className={`shrink-0 flex items-center justify-center border-r ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                     {catDates && <span className={`text-[9px] font-bold ${isPrintMode ? 'text-slate-600' : 'text-slate-500'}`}>{catDates.end}</span>}
                  </div>
                  <div style={{ width: leftColWidths.dur }} className={`shrink-0 border-r ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`} />
                </div>
                
                <div className="flex-1 flex pointer-events-none" />
              </div>

              {/* TASK ROWS */}
              {!isCollapsed && catTasks.map((t: any) => {
                const startMs = parseDate(t.start_date).getTime()
                const endMs = startMs + (t.duration_days * DAY_MS)
                const offsetDays = Math.floor((startMs - gridStartDate.getTime()) / DAY_MS)
                const isCritical = criticalPathIds.has(t.id) && !t.isOverlay
                const isDraggedTask = reorderingId === t.id

                return (
                  <div 
                    key={`${t.id}-${t.isOverlay ? 'overlay' : 'base'}`} 
                    className={`flex border-b relative h-14 task-row ${isPrintMode ? 'border-slate-300 bg-white' : 'border-slate-800/50 hover:bg-slate-800/20'} ${isDraggedTask && !isPrintMode ? 'opacity-50' : ''} ${t.isOverlay ? (isPrintMode ? 'opacity-70 bg-slate-50' : 'opacity-60 bg-slate-950/50') : ''}`}
                    onDragOver={(e) => !isPrintMode && e.preventDefault()}
                    onDrop={(e) => { if(!isPrintMode){ e.preventDefault(); handleDrop(e, category, t.id) } }}
                  >
                    
                    {/* --- THE FIX: THIS Z-INDEX MUST BE HIGHER THAN THE TASK BAR Z-INDEX (20) --- */}
                    <div className={`sticky left-0 z-40 flex shadow-[4px_0_15px_-3px_rgba(0,0,0,0.4)] ${isPrintMode ? 'bg-white' : 'bg-slate-950'}`}>
                      <div style={{ width: leftColWidths.task }} className={`shrink-0 flex items-stretch border-r ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                        {!t.isOverlay && !isPrintMode && (
                          <div draggable onDragStart={(e) => handleDragStartTask(e, t.id)} className="hidden md:flex w-8 items-center justify-center border-r cursor-grab active:cursor-grabbing border-slate-800/50 hover:bg-slate-800 text-slate-600 hover:text-white">
                            <GripVertical size={14} />
                          </div>
                        )}
                        {t.isOverlay && !isPrintMode && <div className="hidden md:block w-8 border-r border-[inherit] bg-slate-950/30" />}
                        
                        <button onClick={() => !t.isOverlay && !isPrintMode && setEditingTask(t)} className={`flex-1 p-2 flex flex-col justify-center text-left overflow-hidden ${t.isOverlay || isPrintMode ? 'cursor-default pointer-events-none' : 'hover:bg-slate-900'}`}>
                          <div className="flex justify-between items-center w-full">
                            <p className={`text-[9px] md:text-[11px] font-bold truncate pr-2 ${isPrintMode ? (t.isOverlay ? 'text-indigo-600' : 'text-slate-900') : (t.isOverlay ? 'text-indigo-300' : 'text-white')}`}>{t.task_name}</p>
                            {!t.isOverlay && !isPrintMode && <Edit2 size={12} className="text-slate-600 shrink-0 hover:text-white hidden sm:block" />}
                          </div>
                          {t.isOverlay ? (
                            <p className={`text-[7px] md:text-[8px] font-black uppercase truncate tracking-widest mt-0.5 ${isPrintMode ? 'text-indigo-500' : 'text-indigo-500'}`}>{t.projects?.name}</p>
                          ) : (
                            <p className={`text-[7px] md:text-[8px] font-black uppercase truncate tracking-widest mt-0.5 ${isPrintMode ? 'text-slate-500' : 'text-slate-500'}`}>{t.project_contacts?.company || 'General'}</p>
                          )}
                        </button>
                      </div>
                      
                      <div style={{ width: leftColWidths.start }} className={`shrink-0 p-2 border-r flex items-center justify-center ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                        <span className={`text-[8px] md:text-[10px] font-bold ${isPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>{new Date(startMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
                      </div>

                      <div style={{ width: leftColWidths.end }} className={`shrink-0 p-2 border-r flex items-center justify-center ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                        <span className={`text-[8px] md:text-[10px] font-bold ${isPrintMode ? 'text-slate-700' : 'text-slate-400'}`}>{new Date(endMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</span>
                      </div>

                      <div style={{ width: leftColWidths.dur }} className={`shrink-0 p-2 border-r flex items-center justify-center ${isPrintMode ? 'border-slate-300' : 'border-slate-800'}`}>
                        <span className={`text-[9px] md:text-[11px] font-black ${isPrintMode ? 'text-slate-900' : 'text-white'}`}>{t.duration_days}d</span>
                      </div>
                    </div>

                    <div className="relative flex">
                      {gridDays.map((d, i) => (
                        <div key={i} className={`flex-shrink-0 border-r h-full ${isPrintMode ? `border-slate-300 ${d.isWeekend ? 'bg-slate-100' : ''}` : `border-slate-800/30 ${d.isWeekend ? 'bg-slate-900/20' : ''}`}`} style={{ width: COL_WIDTH }} />
                      ))}

                      {offsetDays >= 0 && (
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 h-8 rounded flex items-center group/bar overflow-hidden z-20 ${
                            isPrintMode ? 
                                (t.isOverlay ? 'bg-indigo-100 border-2 border-indigo-400 border-dashed' : isCritical ? 'bg-red-500 border-2 border-red-700' : 'bg-blue-500 border-2 border-blue-700') 
                            :
                                (t.isOverlay ? 'bg-indigo-600/30 border border-indigo-400 border-dashed pointer-events-none' : isCritical ? 'bg-red-600 hover:bg-red-500 border border-red-400 shadow-lg' : 'bg-blue-600 hover:bg-blue-500 border border-blue-400 shadow-lg')
                          }`}
                          style={{ left: offsetDays * COL_WIDTH, width: Math.max(t.duration_days * COL_WIDTH, COL_WIDTH - 4) }}
                        >
                          {!t.isOverlay && !isPrintMode && (
                            <div 
                              className="w-4 md:w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
                              onPointerDown={(e) => handleHPointerDown(e, t.id, t.start_date, 'move', t.duration_days)}
                              onPointerMove={handleHPointerMove}
                              onPointerUp={handleHPointerUp}
                            >
                              <GripVertical size={10} className="text-white/50 hidden md:block" />
                            </div>
                          )}

                          <div className="flex-1 truncate pointer-events-none px-2 flex items-center">
                            <span className={`text-[8px] md:text-[9px] font-black leading-none ${isPrintMode && t.isOverlay ? 'text-indigo-900' : 'text-white'}`}>
                              {t.dependencies?.length > 0 && <LinkIcon size={8} className="inline mr-1 opacity-70" />}
                              {t.isOverlay && t.project_contacts?.company}
                            </span>
                          </div>

                          {!t.isOverlay && !isPrintMode && (
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

        {/* DEPENDENCY ARROW SVG OVERLAY - RENDERED AT THE BOTTOM SO IT DRAWS OVER ROWS BUT UNDER LEFT PANEL */}
        <div className="absolute top-0 bottom-0 right-0 z-10 pointer-events-none overflow-hidden" style={{ left: totalLeftWidth }}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id={isPrintMode ? "arrowHeadPrint" : "arrowHeadScreen"} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={isPrintMode ? "#0f172a" : "#475569"} />
              </marker>
            </defs>
            {processedTasks.flatMap(task => {
              if (!task.dependencies || task.dependencies.length === 0 || task.isOverlay) return [];
              const endCoords = taskCoordinates[task.id];
              if (!endCoords) return []; 

              return task.dependencies.map((depId: string) => {
                const startCoords = taskCoordinates[depId];
                if (!startCoords) return null; 

                const startX = startCoords.xEnd;
                const startY = startCoords.yCenter;
                const endX = endCoords.xStart;
                const endY = endCoords.yCenter;

                let pathD = "";
                if (endX >= startX + 10) {
                    const midX = startX + 10;
                    pathD = `M ${startX},${startY} L ${midX},${startY} L ${midX},${endY} L ${endX},${endY}`;
                } else {
                    const dropY = startY + (endY > startY ? 14 : -14); 
                    const midX = endX - 10;
                    pathD = `M ${startX},${startY} L ${startX + 10},${startY} L ${startX + 10},${dropY} L ${midX},${dropY} L ${midX},${endY} L ${endX},${endY}`;
                }

                return (
                  <path 
                    key={`${depId}->${task.id}`} 
                    d={pathD} 
                    fill="none" 
                    stroke={isPrintMode ? "#0f172a" : "#334155"} 
                    strokeWidth={isPrintMode ? "2" : "1.5"} 
                    markerEnd={`url(#${isPrintMode ? "arrowHeadPrint" : "arrowHeadScreen"})`} 
                    className={isPrintMode ? "opacity-100" : "opacity-80"}
                  />
                );
              });
            })}
          </svg>
        </div>

      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Timeline...</div>

  return (
    <div className="max-w-[1800px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32 relative">
      
      {/* THE EXPORT CURTAIN */}
      {isExporting && (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
          <Loader2 size={64} className="animate-spin text-blue-500 mb-6" />
          <h2 className="text-3xl font-black text-white uppercase italic tracking-widest">Generating PDF</h2>
          <p className="text-slate-400 mt-2 font-bold text-sm">Drafting perfect blueprint. Please wait...</p>
        </div>
      )}

      {/* --- FIXED OFF-SCREEN CLONE FOR PDF EXPORT --- */}
      {/* 
        This is absolutely positioned far off-screen (-9999px).
        It is fully rendered and takes up physical dimensions so html2canvas can capture it perfectly,
        but the user never sees the white flash. 
      */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '2400px' }} id="gantt-export-clone">
         <div className="p-8 border border-slate-300 bg-white">
            <div className="mb-8 border-b-2 border-slate-300 pb-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Master Schedule</h1>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-2">Generated: {new Date().toLocaleDateString()}</p>
            </div>
            <GanttChartContent isPrintMode={true} />
         </div>
      </div>

      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Master <span className="text-blue-500">Schedule</span></h1>
          {projectEndDate > 0 && (
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
               Target Completion: <span className="text-emerald-500">{new Date(projectEndDate).toLocaleDateString()}</span>
             </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handlePrint} disabled={saving || isExporting} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl disabled:opacity-50">
            {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Printer size={14}/>} Export
          </button>
          <button onClick={saveAllTasks} disabled={saving} className="bg-slate-800 text-blue-400 border border-blue-900/50 text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync
          </button>
          <button onClick={() => setShowNewTask(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
            <Plus size={16}/> Task
          </button>
        </div>
      </div>

      {otherProjects.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-xl">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 pr-4 flex items-center gap-1">
            <Layers size={12}/> Compare Overlay:
          </span>
          {otherProjects.map(p => {
            const isActive = overlayProjects.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggleOverlayProject(p.id)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}
              >
                {isActive && <Check size={10} />}{p.name}
              </button>
            )
          })}
        </div>
      )}

      {/* --- LIVE SCREEN GANTT CANVAS --- */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden relative z-0">
        <div className="overflow-auto custom-scrollbar max-h-[75vh]" ref={containerRef}>
          <GanttChartContent isPrintMode={false} />
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