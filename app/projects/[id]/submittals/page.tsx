'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, FileCheck, Plus, Search, 
  Clock, CheckCircle2, AlertCircle, FileText, ExternalLink, HardHat, Circle, CheckCircle, Loader2, XCircle
} from 'lucide-react'

export default function SubmittalLog() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [submittals, setSubmittals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Batch Action State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [proj, subs] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('project_submittals').select('*, project_contacts(company)').eq('project_id', id).order('created_at', { ascending: false })
    ])
    if (proj.data) setProject(proj.data)
    if (subs.data) setSubmittals(subs.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
      case 'Revise & Resubmit': return 'bg-red-500/10 text-red-500 border-red-500/30'
      case 'Under Review': return 'bg-blue-500/10 text-blue-500 border-blue-500/30'
      default: return 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    }
  }

  const toggleSelection = (subId: string) => {
    setSelectedIds(prev => 
      prev.includes(subId) ? prev.filter(i => i !== subId) : [...prev, subId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(s => s.id))
    }
  }

  const handleBatchUpdate = async (targetIds: string[], newStatus: string) => {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('project_submittals')
        .update({ status: newStatus })
        .in('id', targetIds)

      if (error) throw error

      // Refresh UI locally to feel instant
      setSubmittals(prev => prev.map(sub => 
        targetIds.includes(sub.id) ? { ...sub, status: newStatus } : sub
      ))
      
      setSelectedIds([])
    } catch (err: any) {
      alert(`Update failed: ${err.message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  const filtered = submittals.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Accessing Submittal Vault...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40 relative">
      
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

      <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text" 
            placeholder="Search by title (e.g. Tile, HVAC, Structural Steel...)" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-6 pl-14 rounded-[28px] text-base md:text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-xl text-white"
          />
        </div>
        
        {/* SELECT ALL BUTTON */}
        <button 
          onClick={toggleSelectAll} 
          className="shrink-0 w-full sm:w-auto bg-slate-900 border border-slate-800 hover:border-slate-600 p-6 rounded-[28px] text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          {selectedIds.length === filtered.length && filtered.length > 0 ? <CheckCircle size={16} className="text-blue-500" /> : <Circle size={16} />}
          Select All
        </button>
      </div>

      {/* SUBMITTAL LIST */}
      <div className="space-y-4">
        {filtered.map(sub => {
          const isSelected = selectedIds.includes(sub.id)
          return (
            <div 
              key={sub.id} 
              className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-950/10' : 'border-slate-800 hover:border-slate-600'}`}
            >
              <div className="flex items-start gap-4 flex-1">
                {/* SELECTION TOGGLE */}
                <button onClick={() => toggleSelection(sub.id)} className="mt-1 shrink-0 transition-all hover:scale-110 active:scale-95">
                  {isSelected ? <CheckCircle size={24} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> : <Circle size={24} className="text-slate-700" />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border ${getStatusStyle(sub.status)}`}>
                      {sub.status}
                    </span>
                    <span className="text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest bg-slate-800 text-slate-400">
                      Rev: {sub.revision_number}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tight mb-2 truncate pr-4">{sub.title}</h3>
                  <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 truncate">
                    <HardHat size={12} className="text-blue-500 shrink-0" /> {sub.project_contacts?.company || 'Internal Submittal'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-8 ml-10 lg:ml-0">
                <div className="mr-auto lg:mr-6">
                  <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Current Holder</p>
                  <p className="text-[10px] font-black text-white uppercase truncate max-w-[120px]">{sub.assigned_to || 'General Contractor'}</p>
                </div>
                
                {/* QUICK SINGLE APPROVE BUTTON */}
                {sub.status !== 'Approved' && (
                  <button 
                    onClick={() => handleBatchUpdate([sub.id], 'Approved')}
                    disabled={isUpdating}
                    className="bg-emerald-950/40 border border-emerald-900/50 p-4 rounded-2xl text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all shadow-lg active:scale-95"
                    title="Quick Approve"
                  >
                    <CheckCircle2 size={20} />
                  </button>
                )}

                {sub.url && (
                  <a href={sub.url} target="_blank" rel="noreferrer" className="bg-slate-800 p-4 rounded-2xl text-blue-400 hover:bg-blue-600 hover:text-white transition-all shadow-lg active:scale-95">
                    <ExternalLink size={20} />
                  </a>
                )}
                
                <Link href={`/projects/${id}/submittals/${sub.id}`} className="bg-slate-800 p-4 rounded-2xl text-slate-400 hover:text-white transition-all shadow-lg active:scale-95">
                  <FileText size={20} />
                </Link>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[40px] text-slate-600 font-black uppercase text-[10px] tracking-widest bg-slate-900/20">
            No submittals found.
          </div>
        )}
      </div>

      {/* FLOATING BATCH ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-auto bg-slate-900 border-2 border-blue-500 p-2 pl-6 rounded-full shadow-[0_10px_40px_-10px_rgba(59,130,246,0.5)] flex items-center justify-between gap-4 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 text-white h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black">
               {selectedIds.length}
             </div>
             <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest hidden sm:inline-block">Selected</span>
          </div>
          
          <div className="h-6 w-px bg-slate-800 hidden sm:block"></div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={() => handleBatchUpdate(selectedIds, 'Revise & Resubmit')}
               disabled={isUpdating}
               className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 px-4 py-3 rounded-full transition-all flex items-center gap-2 disabled:opacity-50"
             >
               <XCircle size={14} className="hidden sm:block" /> Reject
             </button>
             <button 
               onClick={() => handleBatchUpdate(selectedIds, 'Approved')}
               disabled={isUpdating}
               className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 px-6 py-3 rounded-full shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
             >
               {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve All
             </button>
          </div>
        </div>
      )}
    </div>
  )
}