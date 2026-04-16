'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, Search, Calendar, Users, 
  CloudRain, ChevronRight, ChevronLeft, Loader2, Plus
} from 'lucide-react'

export default function ProjectLogArchive() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      const [projData, logData] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false })
      ])
      if (projData.data) setProject(projData.data)
      if (logData.data) setLogs(logData.data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Syncing Archives...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER WITH NEW BUTTON */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Log <span className="text-blue-500">Archive</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <FileText size={14} className="text-blue-500" /> {project?.name || 'Project Reports'}
          </p>
        </div>
        
        <Link href={`/projects/${id}/logs/new`} className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
          <Plus size={16} /> New Entry
        </Link>
      </div>

      {/* LOG LIST */}
      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
            No reports filed yet.
          </div>
        ) : (
          logs.map(log => (
            <Link href={`/projects/${id}/logs/${log.id}`} key={log.id} className="block group">
              <div className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:scale-[1.01] ${
                log.status === 'Draft' ? 'border-amber-900/50 hover:border-amber-500' : 'border-slate-800 hover:border-blue-500'
              }`}>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${log.status === 'Final' ? 'bg-emerald-950/30 text-emerald-500 border border-emerald-900/30' : 'bg-amber-950/30 text-amber-500 border border-amber-900/50'}`}>
                      {log.status === 'Final' ? 'Signed' : 'Draft'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                    <Calendar className="text-slate-500" size={20}/>
                    
                    {/* ✅ THE FIX: Appended 'T12:00:00' to force local timezone calculation */}
                    {new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    
                  </h3>
                </div>

                <div className="flex flex-col gap-2 md:w-64 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <Users size={14} className="text-blue-500" /> {log.manpower || 'No headcount'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <CloudRain size={14} className="text-blue-500" /> {log.weather || 'No weather'}
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-end w-12">
                  <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-all">
                    <ChevronRight size={16} className="text-slate-500 group-hover:text-white" />
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}