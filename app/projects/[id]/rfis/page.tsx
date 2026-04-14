'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, FileQuestion, Plus, Search, 
  MessageSquare, Clock, CheckCircle2, AlertCircle, FileText
} from 'lucide-react'

export default function RfiArchive() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [rfis, setRfis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      
      const [projData, rfiData] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('rfis').select('*, project_documents(title, revision_number)').eq('project_id', id).order('created_at', { ascending: false })
      ])

      if (projData.data) setProject(projData.data)
      if (rfiData.data) setRfis(rfiData.data)
      
      setLoading(false)
    }
    fetchData()
  }, [id])

  // --- FILTERING ---
  const filteredRfis = rfis.filter(rfi => {
    const matchesSearch = 
      (rfi.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (rfi.question || '').toLowerCase().includes(search.toLowerCase()) ||
      (rfi.assigned_to || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || rfi.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // --- KPI COUNTS ---
  const openCount = rfis.filter(r => r.status === 'Open').length
  const pendingCount = rfis.filter(r => r.status === 'Pending').length
  const closedCount = rfis.filter(r => r.status === 'Closed' || r.status === 'Answered').length

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Open': return 'bg-red-500/10 text-red-500 border-red-500/30'
      case 'Pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/30'
      case 'Answered': return 'bg-blue-500/10 text-blue-500 border-blue-500/30'
      case 'Closed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/30'
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing RFI Log...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            RFI <span className="text-blue-500">Log</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <FileQuestion size={14} className="text-blue-500" /> {project?.name || 'Project Log'}
          </p>
        </div>
        
        <Link href={`/projects/${id}/rfis/new`} className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
          <Plus size={16} /> Draft New RFI
        </Link>
      </div>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className={`p-6 rounded-[32px] border shadow-xl flex flex-col justify-between ${openCount > 0 ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900/50 border-slate-800'}`}>
          <div className="flex justify-between items-start mb-6">
            <p className={`text-[9px] font-black uppercase tracking-widest ${openCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>Action Required</p>
            <AlertCircle size={20} className={`${openCount > 0 ? 'text-red-500/50' : 'text-slate-700'}`} />
          </div>
          <p className={`text-5xl font-black tracking-tighter ${openCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>{openCount}</p>
        </div>
        
        <div className={`p-6 rounded-[32px] border shadow-xl flex flex-col justify-between ${pendingCount > 0 ? 'bg-amber-950/20 border-amber-900/50' : 'bg-slate-900/50 border-slate-800'}`}>
          <div className="flex justify-between items-start mb-6">
            <p className={`text-[9px] font-black uppercase tracking-widest ${pendingCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>Awaiting Reply</p>
            <Clock size={20} className={`${pendingCount > 0 ? 'text-amber-500/50' : 'text-slate-700'}`} />
          </div>
          <p className={`text-5xl font-black tracking-tighter ${pendingCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{pendingCount}</p>
        </div>

        <div className="p-6 rounded-[32px] border border-slate-800 bg-slate-900/50 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Resolved / Closed</p>
            <CheckCircle2 size={20} className="text-emerald-500/30" />
          </div>
          <p className="text-5xl font-black tracking-tighter text-slate-300">{closedCount}</p>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Search RFI titles, questions, or assignees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-6 pl-14 rounded-[28px] text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-lg text-white"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-blue-500 transition-all appearance-none text-center min-w-[180px] shadow-lg"
        >
          <option value="All">All Statuses</option>
          <option value="Open">🔴 Action Required</option>
          <option value="Pending">🟡 Awaiting Reply</option>
          <option value="Answered">🔵 Answered</option>
          <option value="Closed">🟢 Closed</option>
        </select>
      </div>

      {/* RFI LIST */}
      <div className="space-y-4">
        {filteredRfis.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-800 rounded-[40px] text-slate-600 font-black uppercase text-[10px] tracking-widest bg-slate-900/20">
            No active RFIs match your search.
          </div>
        ) : (
          filteredRfis.map(rfi => (
            <Link href={`/projects/${id}/rfis/${rfi.id}`} key={rfi.id} className="block group">
              <div className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:scale-[1.01] ${
                rfi.status === 'Open' ? 'border-red-900/50 hover:border-red-500' : 
                rfi.status === 'Pending' ? 'border-amber-900/50 hover:border-amber-500' :
                'border-slate-800 hover:border-blue-500'
              }`}>
                
                {/* RFI MAIN INFO */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${getStatusColor(rfi.status)}`}>
                      {rfi.status}
                    </span>
                    {rfi.project_documents && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest bg-slate-800 text-slate-400">
                        <FileText size={10} /> {rfi.project_documents.title}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-black text-white italic tracking-tight mb-2 group-hover:text-blue-400 transition-colors">
                    {rfi.title}
                  </h3>
                  <p className="text-sm font-medium text-slate-400 line-clamp-2 leading-relaxed">
                    {rfi.question}
                  </p>
                </div>

                {/* META DATA */}
                <div className="flex flex-col gap-3 lg:w-64 border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-8">
                  <div>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Assigned To</p>
                    <p className="text-xs font-bold text-white uppercase">{rfi.assigned_to || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Due Date</p>
                    <p className={`text-xs font-bold uppercase ${
                      rfi.due_date && new Date(rfi.due_date) < new Date() && rfi.status !== 'Closed' && rfi.status !== 'Answered' 
                        ? 'text-red-500' : 'text-slate-300'
                    }`}>
                      {rfi.due_date ? new Date(rfi.due_date).toLocaleDateString() : 'No Due Date'}
                    </p>
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