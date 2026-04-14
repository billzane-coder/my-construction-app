'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, Search, Calendar, Users, 
  CloudRain, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Clock, Plus
} from 'lucide-react'

export default function ProjectLogArchive() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      setLoading(true)
      
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

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.work_performed || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.manpower || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || log.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalLogs = logs.length
  const draftCount = logs.filter(l => l.status === 'Draft').length

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
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

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-slate-900/50 p-6 md:p-8 rounded-[32px] border border-slate-800 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Reports</p>
            <p className="text-4xl font-black text-white tracking-tighter">{totalLogs}</p>
          </div>
          <CheckCircle2 size={32} className="text-emerald-500/50 hidden md:block" />
        </div>
        <div className={`p-6 md:p-8 rounded-[32px] border flex items-center justify-between shadow-xl ${draftCount > 0 ? 'bg-amber-950/20 border-amber-900/50' : 'bg-slate-900/50 border-slate-800'}`}>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${draftCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>Unsigned Drafts</p>
            <p className={`text-4xl font-black tracking-tighter ${draftCount > 0 ? 'text-amber-500' : 'text-white'}`}>{draftCount}</p>
          </div>
          <Clock size={32} className={`${draftCount > 0 ? 'text-amber-500/50' : 'text-slate-700'} hidden md:block`} />
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Search work performed or trades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-6 pl-14 rounded-[28px] text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-lg"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-blue-500 transition-all appearance-none text-center min-w-[160px] shadow-lg"
        >
          <option value="All">All Status</option>
          <option value="Final">Signed (Final)</option>
          <option value="Draft">Unsigned (Draft)</option>
        </select>
      </div>

      {/* LOG LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Syncing Archives...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
              No reports match your filters.
            </div>
          ) : (
            filteredLogs.map(log => (
              <Link href={`/projects/${id}/logs/${log.id}`} key={log.id} className="block group">
                <div className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:scale-[1.01] ${
                  log.status === 'Draft' ? 'border-amber-900/50 hover:border-amber-500' : 'border-slate-800 hover:border-blue-500'
                }`}>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                        log.status === 'Final' ? 'bg-emerald-950/30 text-emerald-500 border border-emerald-900/30' : 'bg-amber-950/30 text-amber-500 border border-amber-900/50'
                      }`}>
                        {log.status === 'Final' ? 'Signed' : 'Draft'}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                      <Calendar className="text-slate-500" size={20}/>
                      {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
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
      )}
    </div>
  )
}