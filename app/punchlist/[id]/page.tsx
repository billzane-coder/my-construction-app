'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PunchlistDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTicket() {
      const { data, error } = await supabase
        .from('punch_list')
        .select('*')
        .eq('id', id)
        .single()
      
      if (data) setTicket(data)
      if (error) console.error("Fetch Error:", error)
      setLoading(false)
    }
    fetchTicket()
  }, [id])

  const toggleStatus = async () => {
    if (!ticket) return
    const newStatus = ticket.status === 'Open' ? 'Resolved' : 'Open'
    
    // Optimistic UI update
    setTicket({ ...ticket, status: newStatus })

    const { error } = await supabase
      .from('punch_list')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert("Failed to update status. Check connection.")
      setTicket({ ...ticket, status: ticket.status }) // Revert on fail
    }
  }

  if (loading) return <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse bg-slate-950 min-h-screen">Loading Ticket...</div>
  if (!ticket) return <div className="p-10 text-center font-black text-red-500 uppercase bg-slate-950 min-h-screen">Ticket Not Found</div>

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 print:bg-white print:text-slate-900 print:p-0">
      
      {/* NAVIGATION */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800 print:hidden">
        <button onClick={() => router.push('/punchlist')} className="text-[10px] font-black uppercase text-slate-500 hover:text-white tracking-widest transition-all">
          ← Back to List
        </button>
        <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase hover:bg-slate-700 transition-all">
          Print Ticket
        </button>
      </div>

      {/* HEADER TICKET INFO */}
      <div className="mb-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter print:text-slate-900">Deficiency <span className="text-red-500 underline decoration-4">Ticket</span></h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase mt-2">ID: {ticket.id.split('-')[0]}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border ${
              ticket.status === 'Resolved' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30 print:bg-emerald-100 print:text-emerald-800' : 'bg-red-900/40 text-red-400 border-red-500/30 print:bg-red-100 print:text-red-800'
            }`}>
              {ticket.status}
            </span>
            <span className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-blue-900/40 text-blue-400 border border-blue-500/30 print:bg-blue-100 print:text-blue-800">
              TRADE: {ticket.assigned_to}
            </span>
          </div>
        </div>
      </div>

      {/* TICKET DETAILS */}
      <div className="bg-slate-900 rounded-[32px] border border-slate-800 p-6 md:p-8 mb-8 print:border-slate-300 print:bg-transparent">
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Location / Phase</h2>
        <p className="text-lg font-bold text-white mb-8 print:text-slate-800">{ticket.location}</p>

        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Issue Description</h2>
        <p className="text-xl font-black text-red-400 mb-8 leading-relaxed print:text-red-700">
          {ticket.description}
        </p>

        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">System Notes</h2>
        <p className="text-sm font-bold text-slate-400 italic print:text-slate-600">
          {ticket.notes || 'No additional notes provided.'}
        </p>
        
        {/* DISPLAY ATTACHED PHOTO IF IT EXISTS */}
        {ticket.photo_url && (
          <div className="mt-8 pt-8 border-t border-slate-800 print:border-slate-300 print:break-inside-avoid">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Reference Photo</h2>
            <img src={ticket.photo_url} alt="Deficiency" className="w-full max-h-96 object-contain rounded-2xl border border-slate-800 bg-black print:border-slate-300" />
          </div>
        )}
      </div>

      {/* RESOLUTION ACTION */}
      <div className="flex justify-center pt-6 border-t border-slate-800 print:hidden">
        <button 
          onClick={toggleStatus}
          className={`w-full md:w-auto px-12 py-5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all ${
            ticket.status === 'Resolved' 
              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
              : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
          }`}
        >
          {ticket.status === 'Resolved' ? 'Re-Open Ticket' : 'Mark as Resolved'}
        </button>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: #0f172a !important; }
          .print\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}