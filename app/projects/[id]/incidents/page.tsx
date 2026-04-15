'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, Plus, ShieldAlert, Calendar, Clock, ArrowRight } from 'lucide-react'

export default function IncidentLog() {
  const { id } = useParams()
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIncidents() {
      const { data } = await supabase.from('incidents').select('*').eq('project_id', id).order('incident_date', { ascending: false })
      if (data) setIncidents(data)
      setLoading(false)
    }
    fetchIncidents()
  }, [id])

  const getSeverityStyle = (sev: string) => {
    switch(sev) {
      case 'Critical': return 'bg-red-500 text-white border-red-500'
      case 'High': return 'bg-orange-500/10 text-orange-500 border-orange-500/30'
      case 'Medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/30'
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/30'
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-orange-500 font-black animate-pulse uppercase tracking-widest">Accessing Safety Records...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      <div className="mb-10 border-b-4 border-orange-600 pb-8 flex justify-between items-end">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Safety <span className="text-orange-500">Incidents</span></h1>
        </div>
        <Link href={`/projects/${id}/incidents/new`} className="bg-orange-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-orange-900/20 hover:bg-orange-500 transition-all flex items-center gap-2">
          <Plus size={16}/> Report Incident
        </Link>
      </div>

      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[40px] bg-slate-900/20">
            <ShieldAlert size={48} className="mx-auto mb-4 text-slate-800" />
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest">No safety incidents recorded for this project.</p>
          </div>
        ) : (
          incidents.map(inc => (
            <Link href={`/projects/${id}/incidents/${inc.id}`} key={inc.id} className="block group">
              <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 transition-all hover:border-orange-500 flex flex-col md:flex-row justify-between gap-6 shadow-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase border ${getSeverityStyle(inc.severity)}`}>
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                      <Calendar size={12}/> {new Date(inc.incident_date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tight group-hover:text-orange-500 transition-all">{inc.title}</h3>
                  <p className="text-slate-400 text-sm mt-2 line-clamp-1">{inc.description}</p>
                </div>
                <div className="flex items-center justify-end">
                   <div className="bg-slate-950 p-4 rounded-2xl text-slate-500 group-hover:text-white transition-all">
                     <ArrowRight size={20} />
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