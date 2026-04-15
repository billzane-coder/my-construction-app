'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileSpreadsheet, Plus, ArrowRight, User, Calendar } from 'lucide-react'

export default function SiteInstructionLog() {
  const { id } = useParams()
  const router = useRouter()
  const [instructions, setInstructions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSI() {
      const { data } = await supabase
        .from('site_instructions')
        .select('*, project_contacts(company)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      
      if (data) setInstructions(data)
      setLoading(false)
    }
    fetchSI()
  }, [id])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Accessing Directive Vault...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex justify-between items-end">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Site <span className="text-emerald-500">Instructions</span></h1>
        </div>
        <Link href={`/projects/${id}/site-instructions/new`} className="bg-emerald-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center gap-2">
          <Plus size={16}/> Issue New SI
        </Link>
      </div>

      <div className="space-y-4">
        {instructions.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[40px] bg-slate-900/20">
            <p className="text-slate-600 font-black uppercase text-[10px] tracking-widest italic">No Site Instructions issued yet.</p>
          </div>
        ) : (
          instructions.map(si => (
            <Link href={`/projects/${id}/site-instructions/${si.id}`} key={si.id} className="block group">
              <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 transition-all hover:border-emerald-500 flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[9px] font-black px-3 py-1 rounded bg-emerald-950 text-emerald-500 uppercase tracking-widest border border-emerald-900/30">
                      SI #00{si.si_number}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                      <Calendar size={12}/> {new Date(si.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tight group-hover:text-emerald-500 transition-all">{si.title}</h3>
                  <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2">
                    <User size={12} className="text-emerald-500"/> {si.project_contacts?.company || 'All Trades'}
                  </p>
                </div>
                <div className="flex items-center">
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