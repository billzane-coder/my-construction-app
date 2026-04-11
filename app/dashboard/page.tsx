'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ProjectDashboard() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function getProjects() {
      const { data } = await supabase.from('projects').select('*').order('name')
      if (data) setProjects(data)
    }
    getProjects()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    
    async function getProjectData() {
      setLoading(true)
      const [logsRes, incRes, matRes, timeRes] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('project_id', selectedId).order('created_at', { ascending: false }),
        supabase.from('site_incidents').select('*').eq('project_id', selectedId).order('created_at', { ascending: false }),
        supabase.from('site_materials').select('*').eq('project_id', selectedId).neq('status', 'Delivered').order('expected_delivery', { ascending: true }),
        supabase.from('site_timesheets').select('*').eq('project_id', selectedId).order('date_worked', { ascending: false })
      ])
      
      setLogs(logsRes.data || [])
      setIncidents(incRes.data || [])
      setMaterials(matRes.data || [])
      setTimesheets(timeRes.data || [])
      setLoading(false)
    }
    getProjectData()
  }, [selectedId])

  const selectedProject = projects.find(p => p.id === selectedId)
  const totalHours = timesheets.reduce((acc, curr) => acc + Number(curr.hours_regular) + Number(curr.hours_overtime), 0)

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 bg-slate-50 min-h-screen font-sans pb-20">
      
      {/* 🔝 SELECTOR BAR */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Site Command</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Master Project Audit [cite: 32]</p>
        </div>
        <select 
          value={selectedId} 
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full md:w-80 p-4 bg-slate-100 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-blue-500 transition-all"
        >
          <option value="">Choose Project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!selectedId ? (
        <div className="text-center py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Select a project to load site data</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* 📍 PROJECT HEADER CARD */}
          <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-1">{selectedProject?.name}</h2>
              <p className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-8">{selectedProject?.address}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                  <p className="text-[9px] font-black text-white/50 uppercase mb-1">Daily Logs [cite: 94]</p>
                  <p className="text-xl font-black">{logs.length}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                  <p className="text-[9px] font-black text-white/50 uppercase mb-1">Safety [cite: 101]</p>
                  <p className={`text-xl font-black ${incidents.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{incidents.length}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                  <p className="text-[9px] font-black text-white/50 uppercase mb-1">Open Orders [cite: 110]</p>
                  <p className={`text-xl font-black ${materials.length > 0 ? 'text-amber-400' : 'text-white'}`}>{materials.length}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                  <p className="text-[9px] font-black text-white/50 uppercase mb-1">Total Man Hours</p>
                  <p className="text-xl font-black">{totalHours.toFixed(1)}</p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
          </div>

          {/* ⚡ 4-COLUMN MASTER VIEW */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            
            {/* COLUMN 1: PROGRESS */}
            <div className="space-y-4 bg-slate-200/50 p-3 rounded-[36px]">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Daily Logs</h3>
              {logs.map(log => (
                <div key={log.id} className="bg-white p-5 rounded-[28px] border border-slate-200">
                  <p className="text-[10px] font-black text-blue-600 uppercase mb-2">{new Date(log.created_at).toLocaleDateString()}</p>
                  <p className="text-xs font-bold text-slate-800 line-clamp-2 italic">"{log.work_performed}"</p>
                </div>
              ))}
            </div>

            {/* COLUMN 2: SAFETY */}
            <div className="space-y-4 bg-slate-200/50 p-3 rounded-[36px]">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Safety [cite: 101]</h3>
              {incidents.map(inc => (
                <div key={inc.id} className={`p-5 rounded-[28px] border-2 ${inc.severity === 'Critical' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                   <span className="text-[8px] font-black bg-slate-900 text-white px-2 py-1 rounded-lg uppercase mb-2 inline-block">{inc.classification}</span>
                   <p className="text-xs font-bold text-slate-800">{inc.description}</p>
                </div>
              ))}
            </div>

            {/* COLUMN 3: LOGISTICS */}
            <div className="space-y-4 bg-slate-200/50 p-3 rounded-[36px]">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Materials [cite: 110]</h3>
              {materials.map(mat => (
                <div key={mat.id} className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-amber-600 uppercase mb-1">{mat.supplier}</p>
                  <h4 className="text-sm font-black text-slate-900">{mat.quantity} {mat.item_name}</h4>
                </div>
              ))}
            </div>

            {/* COLUMN 4: LABOR */}
            <div className="space-y-4 bg-slate-200/50 p-3 rounded-[36px]">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Labor Hours</h3>
              {timesheets.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-[28px] border border-slate-200 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase">{t.worker_name}</h4>
                    <p className="text-[9px] font-bold text-slate-400">{t.trade_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{Number(t.hours_regular) + Number(t.hours_overtime)}h</p>
                    <p className="text-[8px] font-black text-blue-600 uppercase">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}