'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Printer, FileText, User, Calendar, HardHat } from 'lucide-react'

export default function SiteInstructionDetail() {
  const { id, siid } = useParams()
  const router = useRouter()
  const [si, setSi] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSI() {
      const { data } = await supabase.from('site_instructions').select('*, project_contacts(company)').eq('id', siid).single()
      if (data) setSi(data)
      setLoading(false)
    }
    fetchSI()
  }, [siid])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Opening File...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-40 print:bg-white print:text-black" id="print-area">
      
      {/* 🖨️ PRINT STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.75in; size: portrait; }
          html, body, #__next, [data-reactroot], body > div { height: auto !important; overflow: visible !important; position: static !important; display: block !important; background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}} />

      {/* 🖨️ OFFICIAL HEADER (Print Only) */}
      <div className="hidden print:block border-b-4 border-black pb-6 mb-10">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-black">Site Instruction</h1>
        <div className="grid grid-cols-2 gap-8 mt-6">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Instruction #</p>
            <p className="text-xl font-black">SI-00{si?.si_number}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-400">Date Issued</p>
            <p className="text-xl font-black">{new Date(si?.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="mb-10 print:hidden flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Back to Log</button>
          <h1 className="text-3xl font-black uppercase italic leading-none">Instruction <span className="text-emerald-500">SI-00{si?.si_number}</span></h1>
        </div>
        <button onClick={() => window.print()} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase flex items-center gap-2 hover:bg-slate-700 transition-all border border-slate-700">
          <Printer size={16}/> Export PDF
        </button>
      </div>

      <div className="space-y-8">
        <div className="bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 print:border-2 print:border-black print:rounded-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Issued To</label>
              <p className="text-2xl font-black text-white italic uppercase print:text-black">{si?.project_contacts?.company || 'All Project Trades'}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Instruction Reason</label>
              <p className="text-2xl font-black text-white italic uppercase print:text-black">{si?.reason}</p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 print:border-black">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Instruction Subject</label>
             <h2 className="text-2xl font-black text-white uppercase mb-6 print:text-black">{si?.title}</h2>
             
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Detailed Directive</label>
             <div className="text-lg font-medium text-slate-300 leading-relaxed whitespace-pre-wrap print:text-black print:text-sm">
               {si?.description}
             </div>
          </div>
        </div>

        {/* SIGNATURE AREA */}
        <div className="pt-10 border-t border-slate-800 print:border-black print:flex print:justify-between print:items-end">
           <div className="w-64">
             <p className="text-[9px] font-black text-slate-500 uppercase mb-4">Authorized By Site Superintendent</p>
             <img src={si?.signature_url} className="h-20 object-contain invert print:invert-0" alt="Super Signature" />
             <div className="mt-4 border-t border-slate-800 pt-2 print:border-black">
                <p className="text-xs font-black uppercase print:text-black tracking-widest italic">Issued by: Bill — Site Super</p>
             </div>
           </div>
           
           <div className="hidden print:block text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Notice to Contractor</p>
              <p className="text-[8px] max-w-xs leading-tight text-slate-500 italic">
                This Site Instruction is a directive to perform work as described. If the contractor believes this instruction constitutes a change to the contract price or time, they must notify the Superintendent in writing prior to commencing the work.
              </p>
           </div>
        </div>
      </div>
    </div>
  )
}