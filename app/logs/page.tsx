'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  FileText, Search, Calendar, Users, 
  CloudRain, ChevronRight, ArrowLeft, Loader2, CheckCircle2, Clock
} from 'lucide-react'

export default function GlobalLogArchive() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Fetch ALL logs across ALL projects
  const fetchLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_logs')
      .select(`
        *,
        projects (name)
      `)
      .order('log_date', { ascending: false })

    if (!error && data) {
      setLogs(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  // Filtering Logic
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.projects?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.work_performed || '').toLowerCase().includes(search.toLowerCase()) ||
      (log.manpower || '').toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || log.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Quick stats
  const totalLogs = logs.length
  const draftCount = logs.filter(l => l.status === 'Draft').length

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ArrowLeft size={14} /> Back to Command Center
          </Link>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Master <span className="text-blue-500">Logs</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <FileText size={14} className="text-blue-500" /> Portfolio-Wide Daily Reports
          </p>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-slate-900/50 p-6 md:p-8 rounded-[32px] border border-slate-800 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Reports Filed</p>
            <p className="text-5xl font-black text-white tracking-tighter">{totalLogs}</p>
          </div>
          <CheckCircle2 size={40} className="text-emerald-500/50 hidden md:block" />
        </div>
        <div className={`p-6 md:p-8 rounded-[32px] border flex items-center justify-between shadow-xl ${draftCount > 0 ? 'bg-amber-950/20 border-amber-900/50' : 'bg-slate-900/50 border-slate-800'}`}>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${draftCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>Unsigned Drafts</p>
            <p className={`text-5xl font-black tracking-tighter ${draftCount > 0 ? 'text-amber-500' : 'text-white'}`}>{draftCount}</p>
          </div>
          <Clock size={40} className={`${draftCount > 0 ? 'text-amber-500/50' : 'text-slate-700'} hidden md:block`} />
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Search by site name, work performed, or trades..."
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

      {/* GLOBAL LOG LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Syncing Field Reports...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
              No daily reports match your filters.
            </div>
          ) : (
            filteredLogs.map(log => (
              // This links directly into the specific project's log archive so you see the context
              <Link href={`/projects/${log.project_id}/logs`} key={log.id} className="block group">
                <div className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:scale-[1.01] ${
                  log.status === 'Draft' ? 'border-amber-900/50 hover:border-amber-500' : 'border-slate-800 hover:border-blue-500'
                }`}>
                  
                  {/* Left Block: Core Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                        log.status === 'Final' ? 'bg-emerald-950/30 text-emerald-500 border border-emerald-900/30' : 'bg-amber-950/30 text-amber-500 border border-amber-900/50'
                      }`}>
                        {log.status === 'Final' ? 'Signed' : 'Draft'}
                      </span>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-900/30">
                        {log.projects?.name || 'Unknown Site'}
                      </span>
                    </div>
                    
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                      <Calendar className="text-slate-500" size={24}/>
                      {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h3>
                  </div>

                  {/* Middle Block: Details */}
                  <div className="flex flex-col gap-3 md:w-64 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Users size={14} className="text-blue-500" /> {log.manpower || 'No headcount logged'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <CloudRain size={14} className="text-blue-500" /> {log.weather || 'No weather logged'}
                    </div>
                  </div>

                  {/* Right Block: Action */}
                  <div className="hidden md:flex items-center justify-end w-12">
                    <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-all">
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-white" />
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