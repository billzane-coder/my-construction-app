'use client'

import { useEffect, useRef } from 'react'
import { gantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'

export default function GanttChart({ tasks, onDataChange }: { tasks: any[], onDataChange: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Config
    gantt.config.xml_date = "%Y-%m-%d"
    gantt.config.date_format = "%Y-%m-%d"
    gantt.config.row_height = 45
    gantt.config.grid_width = 350
    
    // War Room Columns
    gantt.config.columns = [
      { name: "text", label: "Task / Phase", tree: true, width: '*', resize: true },
      { name: "start_date", label: "Start", align: "center", width: 90 },
      { name: "duration", label: "Days", align: "center", width: 50 },
      { name: "add", label: "", width: 44 }
    ]

    gantt.init(containerRef.current)
    gantt.clearAll()
    gantt.parse({ data: tasks, links: [] })

    // Listen for changes to trigger a sync
    gantt.attachEvent("onAfterTaskUpdate", onDataChange)
    gantt.attachEvent("onAfterTaskAdd", onDataChange)
    gantt.attachEvent("onAfterTaskDelete", onDataChange)

    return () => { gantt.clearAll() }
  }, [tasks]) // Re-load only if data changes

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}