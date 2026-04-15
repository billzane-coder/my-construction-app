'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, ClipboardCheck, AlertTriangle, Plus, ArrowRight, Calendar } from 'lucide-react'

export default function SafetyHub() {
  const { id } = useParams()
  const router = useRouter()
  const [inspections, setInspections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSafety() {
      const { data } = await supabase.from('safety_inspections').select('*').eq('project_id', id).order('inspection_date', { ascending: false })
      if (data) setInspections(data)
      setLoading(false)
    }
    fetchSafety()
  }, [id])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Safety Vault...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-red-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Safety <span className="text-red-600">Command</span></h1>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <Link href={`/projects/${id}/incidents`} className="flex-1 md:flex-none bg-slate-900 text-red-500 text-[10px] font-black px-6 py-4 rounded-2xl uppercase border border-red-900/30 hover:bg-red-900/20 transition-all flex items-center justify-center gap-2">
            <AlertTriangle size={14}/> Incident Logs
          </Link>
          <Link href={`/projects/${id}/safety/new`} className="flex-1 md:flex-none bg-red-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-red-900/20 hover:bg-red-500 transition-all flex items-center justify-center gap-2">
            <Plus size={14}/> New Inspection
          </Link>
        </div>
      </div>

      {/* INSPECTION LOG */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Proactive Inspection History</h2>
        {inspections.map(insp => (
          <Link href={`/projects/${id}/safety/${insp.id}`} key={insp.id} className="block group">
            <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 transition-all hover:border-red-600 flex flex-col md:flex-row justify-between gap-6 shadow-xl">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black px-3 py-1 rounded bg-slate-950 text-emerald-500 uppercase tracking-widest border border-slate-800">
                    Passed Walk
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                    <Calendar size={12}/> {new Date(insp.inspection_date).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tight group-hover:text-red-500 transition-all">Site Safety Walk</h3>
                <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Inspector: {insp.inspector_name}</p>
              </div>
              <div className="flex items-center">
                 <div className="bg-slate-950 p-4 rounded-2xl text-slate-500 group-hover:text-white transition-all">
                   <ArrowRight size={20} />
                 </div>
              </div>
            </div>
          </Link>
        ))}
        {inspections.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[40px] text-slate-700 font-black uppercase text-[10px] tracking-widest italic">
            No safety walks recorded.
          </div>
        )}
      </div>
    </div>
  )
}