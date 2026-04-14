'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, FileQuestion, Calendar, HardHat, 
  Clock, DollarSign, CalendarDays, Upload, 
  MessageSquare, CheckCircle2, Circle, Loader2, Save
} from 'lucide-react'

export default function RfiDetails() {
  const { id, rfiid } = useParams()
  const router = useRouter()
  
  const [rfi, setRfi] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Resolution State
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'Open' | 'Closed'>('Open')

  const fetchRfi = async () => {
    if (!rfiid) return
    setLoading(true)
    
    const { data, error } = await supabase
      .from('rfis')
      .select('*, projects(name)')
      .eq('id', rfiid)
      .single()

    if (!error && data) {
      setRfi(data)
      setAnswer(data.answer || '')
      setStatus(data.status || 'Open')
    }
    setLoading(false)
  }

  useEffect(() => { fetchRfi() }, [rfiid])
  const handleUpdateRfi = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('rfis')
      .update({ answer, status })
      .eq('id', rfiid)

    if (!error) {
      alert('RFI Updated Successfully')
      fetchRfi()
    } else {
      alert(`Error updating RFI: ${error.message}`)
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Loading RFI Details...</div>
  if (!rfi) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-500 font-black uppercase tracking-[0.5em]">RFI Not Found</div>

  const isLate = status === 'Open' && new Date(rfi.due_date) < new Date()

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8">
        <button onClick={() => router.push(`/projects/${id}/rfis`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-6 hover:text-white transition-all">
          <ChevronLeft size={14} /> Back to RFI Log
        </button>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-md uppercase tracking-widest ${
                status === 'Closed' ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 text-white'
              }`}>
                {status}
              </span>
              {isLate && (
                <span className="text-[10px] font-black px-4 py-1.5 rounded-md uppercase tracking-widest bg-red-950/30 text-red-500 border border-red-900/50">
                  Overdue
                </span>
              )}
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-2">
                RFI #{rfi.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-tight mb-2">
              {rfi.subject}
            </h1>
            <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
              {rfi.projects?.name}
            </p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setStatus(status === 'Open' ? 'Closed' : 'Open')}
              className={`flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl w-full md:w-auto ${
                status === 'Closed' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/20'
              }`}
            >
              {status === 'Closed' ? <><Circle size={16} /> Reopen RFI</> : <><CheckCircle2 size={16} /> Mark Closed</>}
            </button>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: The Question & Answer */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* THE QUESTION */}
          <div className="bg-slate-900/50 p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-xl">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
              <FileQuestion size={16} className="text-blue-500" /> Original Request
            </h3>
            <p className="text-lg font-medium text-slate-200 whitespace-pre-wrap leading-relaxed">
              {rfi.question}
            </p>
            
            <div className="mt-8 pt-6 border-t border-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Submitted: {new Date(rfi.created_at).toLocaleString()}
            </div>
          </div>

          {/* THE ANSWER (Interactive) */}
          <div className={`p-6 md:p-8 rounded-[32px] border shadow-xl transition-colors ${
            status === 'Closed' ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-slate-900 border-slate-800'
          }`}>
            <h3 className={`text-[11px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 border-b pb-4 ${
              status === 'Closed' ? 'text-emerald-500 border-emerald-900/30' : 'text-blue-500 border-slate-800'
            }`}>
              <MessageSquare size={16} /> Official Response
            </h3>
            
            <textarea 
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type the official answer or architectural directive here..."
              className={`w-full h-48 bg-slate-950 border p-6 rounded-[24px] font-medium text-white outline-none resize-none transition-all ${
                status === 'Closed' ? 'border-emerald-900/50 focus:border-emerald-500' : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleUpdateRfi}
                disabled={saving}
                className={`flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-xl disabled:opacity-50 ${
                  status === 'Closed' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                }`}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Response'}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Meta Data & Attachments */}
        <div className="space-y-6">
          
          {/* ASSIGNMENT CARD */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3">Routing</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HardHat size={12}/> Assigned To</p>
                <p className="text-sm font-black text-white uppercase truncate">{rfi.assigned_to}</p>
              </div>
              
              <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Calendar size={12}/> Date Required</p>
                <p className={`text-sm font-black uppercase ${isLate ? 'text-red-500' : 'text-white'}`}>
                  {new Date(rfi.due_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* IMPACT CARD */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3">Project Impact</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800/50">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={12}/> Cost</p>
                <span className={`text-[10px] font-black px-3 py-1 rounded border uppercase ${
                  rfi.cost_impact === 'Yes' ? 'bg-amber-950/30 text-amber-500 border-amber-900/50' : 'border-slate-800 text-slate-400'
                }`}>
                  {rfi.cost_impact}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800/50">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays size={12}/> Schedule</p>
                <span className={`text-[10px] font-black px-3 py-1 rounded border uppercase ${
                  rfi.schedule_impact === 'Yes' ? 'bg-amber-950/30 text-amber-500 border-amber-900/50' : 'border-slate-800 text-slate-400'
                }`}>
                  {rfi.schedule_impact}
                </span>
              </div>
            </div>
          </div>

          {/* ATTACHMENT CARD */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center gap-2">
              <Upload size={14} className="text-blue-500" /> Reference Material
            </h3>
            
            {rfi.attachment_url ? (
              <div className="space-y-4">
                {rfi.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <div className="aspect-video rounded-xl overflow-hidden border border-slate-800">
                    <img src={rfi.attachment_url} alt="RFI Attachment" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Document Attached</p>
                  </div>
                )}
                
                <a 
                  href={rfi.attachment_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-slate-800 hover:bg-blue-600 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                >
                  View Full File
                </a>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-2xl">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">No Attachments</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}