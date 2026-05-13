'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Save, Loader2, Printer, 
  RefreshCw, FileSpreadsheet, CalendarDays,
  CalendarRange, CalendarDays as CalendarMonth
} from 'lucide-react'

export default function ScheduleMaster() {
  const { id } = useParams()
  const router = useRouter()
  const ganttContainer = useRef<HTMLDivElement>(null)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [projectName, setProjectName] = useState("Project")

  useEffect(() => {
    if (typeof window === 'undefined' || !id) return
    
    let wheelHandler: (e: WheelEvent) => void;

    async function setupGantt() {
      const { gantt } = await import('dhtmlx-gantt')
      await import('dhtmlx-gantt/codebase/dhtmlxgantt.css')

      // 1. Core Plugins
      gantt.plugins({
        auto_scheduling: true,
        critical_path: true,
        drag_timeline: true // <--- ENABLED PANNING PLUGIN
      });

      // 2. Load Export Bridge
      if (!document.getElementById('gantt-export-script')) {
        const script = document.createElement('script')
        script.id = 'gantt-export-script'
        script.src = 'https://export.dhtmlx.com/gantt/api.js'
        script.async = true
        document.body.appendChild(script)
      }

      /* --- GANTT ENGINE CONFIGURATION --- */
      gantt.config.xml_date = "%Y-%m-%d"
      gantt.config.date_format = "%Y-%m-%d"
      gantt.config.row_height = 42
      gantt.config.grid_width = 440 
      gantt.config.order_branch = true;
      gantt.config.order_branch_free = true;
      
      // Date Grid Template
      gantt.templates.date_grid = (date: Date, task: any, column?: string) => {
        return gantt.date.date_to_str("%M %d")(date);
      };

      gantt.config.columns = [
        { name: "text", label: "Task Description", tree: true, width: '*', resize: true },
        { name: "start_date", label: "Start", align: "center", width: 80, template: (obj: any) => gantt.templates.date_grid(obj.start_date, obj, "start_date") },
        { name: "end_date", label: "End", align: "center", width: 80, template: (obj: any) => gantt.templates.date_grid(gantt.date.add(obj.end_date, -1, "minute"), obj, "end_date") },
        { name: "duration", label: "Days", align: "center", width: 40 },
        { name: "add", label: "", width: 40 }
      ]

      // Zoom Levels
      gantt.ext.zoom.init({
        levels: [
          { name: "day", scale_height: 50, min_column_width: 35, scales: [{ unit: "month", format: "%F, %Y" }, { unit: "day", step: 1, format: "%j" }] },
          { name: "week", scale_height: 50, min_column_width: 50, scales: [{ unit: "month", format: "%F, %Y" }, { unit: "week", step: 1, format: "W%W" }] },
          { name: "month", scale_height: 50, min_column_width: 100, scales: [{ unit: "year", step: 1, format: "%Y" }, { unit: "month", step: 1, format: "%M" }] }
        ]
      })
      gantt.ext.zoom.setLevel("day")

      // Lightbox Editor (Includes Predecessors)
      gantt.config.lightbox.sections = [
        { name: "description", height: 70, map_to: "text", type: "textarea", focus: true },
        { name: "predecessors", type: "predecessor", map_to: "auto" }, 
        { name: "time", height: 72, type: "duration", map_to: "auto" }
      ]

      // Advanced Link & Auto-Schedule behavior
      gantt.config.auto_scheduling = true;
      gantt.config.auto_scheduling_strict = true;
      gantt.config.drag_links = true;
      gantt.config.select_link = true;
      
      // DRAG TIMELINE (PANNING) BEHAVIOR
      gantt.config.drag_timeline = {
        ignore: ".gantt_task_line, .gantt_task_link",
        useKey: false // Allows dragging freely without holding a modifier key
      };
      
      gantt.attachEvent("onLinkDblClick", function(linkId) {
        gantt.modalbox({
          text: "Delete this dependency arrow?",
          buttons: ["Yes", "No"],
          callback: function(result) {
            if (result === "0") gantt.deleteLink(linkId);
          }
        });
        return false;
      });

      // 3. DATABASE FETCH
      const [tRes, lRes, pRes] = await Promise.all([
        supabase.from('project_schedule').select('*').eq('project_id', id).order('sort_order'),
        supabase.from('project_schedule_links').select('*').eq('project_id', id),
        supabase.from('projects').select('name').eq('id', id).maybeSingle()
      ])

      if (pRes.data) setProjectName(pRes.data.name);

      if (tRes.data && ganttContainer.current) {
        // Build Category Headers (The Folders)
        const catNodes = Array.from(new Set(tRes.data.map(t => t.category).filter(Boolean))).map(cat => ({
          id: `cat_${cat}`, text: String(cat).toUpperCase(), open: true, type: "project"
        }))
        
        // Build Tasks
        const taskNodes = tRes.data.map(t => ({
          id: t.id, text: t.task_name || "", start_date: t.start_date, duration: t.duration_days,
          parent: t.category ? `cat_${t.category}` : null
        }))
        
        // Build Links
        const formattedLinks = (lRes.data || []).map(l => ({
          id: l.id, source: l.source_id, target: l.target_id, type: l.type
        }))

        gantt.init(ganttContainer.current)
        gantt.clearAll()
        gantt.parse({ data: [...catNodes, ...taskNodes], links: formattedLinks })

        // 4. MOUSE WHEEL ZOOM LISTENER
        wheelHandler = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) { // Requires Ctrl/Cmd to be held down
            e.preventDefault();
            e.deltaY > 0 ? gantt.ext.zoom.zoomOut() : gantt.ext.zoom.zoomIn();
          }
        };

        // Attach event securely
        ganttContainer.current.addEventListener('wheel', wheelHandler, { passive: false });
      }
      setLoading(false)
    }

    setupGantt()

    // 5. CLEANUP LISTENER ON UNMOUNT
    return () => {
      const cleanup = async () => {
        const { gantt } = await import('dhtmlx-gantt')
        gantt.clearAll()
        if (ganttContainer.current && wheelHandler) {
          ganttContainer.current.removeEventListener('wheel', wheelHandler);
        }
      }
      cleanup()
    }
  }, [id])

/* --- ATOMIC SYNC LOGIC --- */
  const handleSync = async () => {
    setSaving(true)
    const { gantt } = await import('dhtmlx-gantt')
    const state = gantt.serialize()
    
    const taskUpdates = state.data
      .filter((t: any) => !String(t.id).startsWith('cat_'))
      .map((t: any, index: number) => {
        const liveTask = gantt.getTask(t.id);
        
        const parentId = String(t.parent);
        const resolvedCategory = parentId.startsWith('cat_') ? parentId.replace('cat_', '') : null;

        return {
          id: t.id,
          project_id: id,
          task_name: t.text,
          start_date: liveTask.start_date ? gantt.templates.format_date(liveTask.start_date as Date) : null,
          duration_days: t.duration,
          sort_order: index,
          category: resolvedCategory
        }
      })

    const linkUpdates = state.links
      .filter((l: any) => !String(l.source).startsWith('cat_') && !String(l.target).startsWith('cat_'))
      .map((l: any) => ({
        id: String(l.id),
        project_id: id,
        source_id: String(l.source),
        target_id: String(l.target),
        type: String(l.type)
      }))

    try {
      // Step 1: Purge old links
      const { error: delError } = await supabase.from('project_schedule_links').delete().eq('project_id', id)
      if (delError) throw delError;

      // Step 2: Upsert Tasks
      const { error: taskError } = await supabase.from('project_schedule').upsert(taskUpdates)
      if (taskError) throw taskError;

      // Step 3: Insert New Links
      if (linkUpdates.length > 0) {
        const { error: linkError } = await supabase.from('project_schedule_links').insert(linkUpdates)
        if (linkError) throw linkError;
      }

      alert("Matrix Synced Successfully")
    } catch (err: any) {
      console.error("Sync Failure Details:", JSON.stringify(err, null, 2))
      alert(`Sync Error: ${err.message || err.details || 'Check console log'}`)
    }
    
    setSaving(false)
  }

  // Zoom Trigger
  const setZoom = async (level: string) => {
    const { gantt } = await import('dhtmlx-gantt')
    gantt.ext.zoom.setLevel(level)
  }

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617] z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-900 rounded-full transition-all">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black uppercase italic tracking-tighter">
            Schedule <span className="text-blue-500">Master</span>
          </h1>
        </div>

        {/* ZOOM CONTROLS */}
        <div className="hidden lg:flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
          <button onClick={() => setZoom("day")} className="px-4 py-1.5 text-[9px] font-black uppercase hover:text-blue-400 border-r border-slate-800 flex items-center gap-2"><CalendarDays size={12}/> Days</button>
          <button onClick={() => setZoom("week")} className="px-4 py-1.5 text-[9px] font-black uppercase hover:text-blue-400 border-r border-slate-800 flex items-center gap-2"><CalendarRange size={12}/> Weeks</button>
          <button onClick={() => setZoom("month")} className="px-4 py-1.5 text-[9px] font-black uppercase hover:text-blue-400 flex items-center gap-2"><CalendarMonth size={12}/> Months</button>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              const { gantt } = await import('dhtmlx-gantt')
              if (gantt.exportToExcel) gantt.exportToExcel({ 
                name: `${projectName.replace(/\s+/g, '_')}_Schedule.xlsx`, 
                visual: true 
              })
            }}
            className="bg-slate-800 px-4 py-2 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-slate-700 border border-slate-700"
          >
            <FileSpreadsheet size={14} className="text-emerald-500"/> Excel
          </button>

          <button 
            onClick={async () => {
              const { gantt } = await import('dhtmlx-gantt')
              if (gantt.exportToPDF) gantt.exportToPDF({ 
                header: `<h1 style="text-align:center; color:#0f172a; text-transform:uppercase;">${projectName} - Master Schedule</h1>`, 
                skin: "material" 
              })
            }}
            className="bg-slate-800 px-4 py-2 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-slate-700 border border-slate-700"
          >
            <Printer size={14}/> PDF
          </button>
          
          <button 
            onClick={handleSync}
            disabled={saving}
            className="bg-blue-600 px-4 py-2 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-blue-500 shadow-xl shadow-blue-900/20"
          >
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Sync Cloud
          </button>
        </div>
      </div>

      {/* GANTT VIEWPORT */}
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 z-[200] bg-[#020617] flex flex-col items-center justify-center gap-4">
            <RefreshCw className="animate-spin text-blue-500" size={32} />
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse text-center">
              Retrieving Data... <br /> <span className="opacity-50 text-[8px]">Syncing Grid</span>
            </h2>
          </div>
        )}
        <div ref={ganttContainer} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" style={{ visibility: loading ? 'hidden' : 'visible' }} />
      </div>

      <style jsx global>{`
        .gantt_grid_head_cell { background-color: #0f172a !important; color: #94a3b8 !important; font-weight: 900 !important; text-transform: uppercase !important; font-size: 10px !important; border-right: 1px solid #1e293b !important; }
        .gantt_task_line { background-color: #2563eb !important; border: 1px solid #1d4ed8 !important; border-radius: 4px !important; }
        .gantt_task_content { font-size: 10px !important; font-weight: 800 !important; text-transform: uppercase !important; color: #fff !important; }
        .gantt_project { background-color: #1e293b !important; }
        .gantt_add { color: #10b981 !important; }
        .gantt_task_link .gantt_line_wrapper div { background-color: #475569 !important; }
        .gantt_link_selected .gantt_line_wrapper div { background-color: #ef4444 !important; }
      `}</style>
    </div>
  )
}