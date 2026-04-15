'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, FileCheck, Plus, Search, 
  Clock, CheckCircle2, AlertCircle, FileText, ExternalLink, HardHat
} from 'lucide-react'

export default function SubmittalLog() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [submittals, setSubmittals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      const [proj, subs] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('project_submittals').select('*, project_contacts(company)').eq('project_id', id).order('created_at', { ascending: false })
      ])
      if (proj.data) setProject(proj.data)
      if (subs.data) setSubmittals(subs.data)
      setLoading(false)
    }
    fetchData()
  }, [id])

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      case 'Revise & Resubmit': return 'bg-red-500/10 text-red-500 border-red-500/30'
      case 'Under Review': return 'bg-blue-500/10 text-blue-500 border-blue-500/30'
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    }
  }

  const filtered = submittals.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Accessing Submittal Vault...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Submittal <span className="text-blue-500">Log</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">📂 {project?.name}</p>
        </div>
        <Link href={`/projects/${id}/submittals/new`} className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
          <Plus size={16} /> New Submittal
        </Link>
      </div>

      <div className="mb-8 relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
        <input 
          type="text" 
          placeholder="Search by title (e.g. Tile, HVAC, Structural Steel...)" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 p-6 pl-14 rounded-[28px] text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-xl text-white"
        />
      </div>

      {/* SUBMITTAL LIST */}
      <div className="space-y-4">
        {filtered.map(sub => (
          <div key={sub.id} className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 transition-all hover:border-blue-500 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${getStatusStyle(sub.status)}`}>
                  {sub.status}
                </span>
                <span className="text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest bg-slate-800 text-slate-400">
                  Rev: {sub.revision_number}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">{sub.title}</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <HardHat size={12} className="text-blue-500" /> {sub.project_contacts?.company || 'Internal Submittal'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-8">
              <div className="mr-6">
                <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Current Holder</p>
                <p className="text-[10px] font-black text-white uppercase">{sub.assigned_to || 'General Contractor'}</p>
              </div>
              <a href={sub.url} target="_blank" rel="noreferrer" className="bg-slate-800 p-4 rounded-2xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-lg">
                <ExternalLink size={20} />
              </a>
              <Link href={`/projects/${id}/submittals/${sub.id}`} className="bg-slate-800 p-4 rounded-2xl text-slate-400 hover:text-white transition-all shadow-lg">
                <FileText size={20} />
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[40px] text-slate-600 font-black uppercase text-[10px] tracking-widest bg-slate-900/20">
            No submittals found.
          </div>
        )}
      </div>
    </div>
  )
}