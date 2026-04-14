'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, FileQuestion, Save, Loader2, Calendar, User, FileText, CheckCircle2, MessageSquare, Printer, Trash2 } from 'lucide-react'

export default function RfiDetail() {
  const { id, rfiid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Lookups
  const [contacts, setContacts] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  
  // RFI State
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState('Open')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [planId, setPlanId] = useState('')
  const [createdAt, setCreatedAt] = useState('')

  useEffect(() => {
    async function fetchRfi() {
      if (!id || !rfiid) return
      
      const [cts, docs, rfi] = await Promise.all([
        supabase.from('project_contacts').select('*').eq('project_id', id),
        supabase.from('project_documents').select('id, title, revision_number').eq('project_id', id).eq('doc_type', 'Plan'),
        supabase.from('rfis').select('*').eq('id', rfiid).single()
      ])

      if (cts.data) setContacts(cts.data)
      if (docs.data) setPlans(docs.data)
      
      if (rfi.data) {
        setTitle(rfi.data.title)
        setQuestion(rfi.data.question)
        setAnswer(rfi.data.answer || '')
        setStatus(rfi.data.status || 'Open')
        setAssignedTo(rfi.data.assigned_to || '')
        setDueDate(rfi.data.due_date || '')
        setPlanId(rfi.data.plan_id || '')
        setCreatedAt(rfi.data.created_at)
      }
      
      setLoading(false)
    }
    fetchRfi()
  }, [id, rfiid])

  const handleSave = async () => {
    setSaving(true)
    
    // Auto-close if an answer is provided and status was still Open/Pending
    let finalStatus = status
    if (answer.trim() !== '' && (status === 'Open' || status === 'Pending')) {
      finalStatus = 'Answered'
      setStatus('Answered')
    }

    const payload = {
      title, question, answer, status: finalStatus,
      assigned_to: assignedTo || null, due_date: dueDate || null, plan_id: planId || null
    }

    const { error } = await supabase.from('rfis').update(payload).eq('id', rfiid)
    
    if (!error) {
      alert("RFI Updated Successfully")
    } else {
      alert(`Error updating RFI: ${error.message}`)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if(confirm("Are you sure you want to permanently delete this RFI?")) {
      await supabase.from('rfis').delete().eq('id', rfiid)
      router.push(`/projects/${id}/rfis`)
      router.refresh()
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Record...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40 print:bg-white print:text-black print:pb-0" id="print-area">
      
      {/* 🖨️ PDF PRINT STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.75in; size: portrait; }
          html, body { background: white !important; height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #__next, [data-reactroot], body > div { height: auto !important; overflow: visible !important; display: block !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />

      {/* 🖨️ FORMAL PDF HEADER */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-8 mt-2">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Request for Information</h1>
            <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">Status: {status}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date Submitted</p>
            <p className="text-lg font-black text-black">
              {createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* 💻 APP UI HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
            <ChevronLeft size={12}/> Back to Log
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
              RFI <span className="text-blue-500">Record</span>
            </h1>
          </div>
        </div>
        
        <select 
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest outline-none cursor-pointer appearance-none text-center border-2 ${
            status === 'Closed' ? 'bg-emerald-950/30 text-emerald-500 border-emerald-900' :
            status === 'Answered' ? 'bg-blue-950/30 text-blue-500 border-blue-900' :
            status === 'Pending' ? 'bg-amber-950/30 text-amber-500 border-amber-900' :
            'bg-red-950/30 text-red-500 border-red-900'
          }`}
        >
          <option value="Open">🔴 Open / Action Req.</option>
          <option value="Pending">🟡 Pending / Awaiting</option>
          <option value="Answered">🔵 Answered</option>
          <option value="Closed">🟢 Closed / Resolved</option>
        </select>
      </div>

      <div className="space-y-6 print:space-y-8">
        
        {/* TITLE & QUESTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-2 print:border-slate-300 print:rounded-2xl print:p-6 print:break-inside-avoid">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
            <FileQuestion size={14} className="text-blue-500 print:text-black"/> Subject & Query
          </label>
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-t-2xl font-black text-white text-lg outline-none print:hidden" 
          />
          <div className="hidden print:block text-2xl font-black text-black mb-4 uppercase italic">{title}</div>
          
          <textarea 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            className="w-full h-40 bg-slate-950 border border-t-0 border-slate-800 p-5 rounded-b-2xl font-bold text-slate-300 outline-none resize-none print:hidden" 
          />
          <div className="hidden print:block text-black font-medium text-sm whitespace-pre-wrap leading-relaxed">
            {question || 'No question provided.'}
          </div>
        </div>

        {/* OFFICIAL RESPONSE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-blue-900/50 relative overflow-hidden print:bg-slate-50 print:border-2 print:border-slate-300 print:rounded-2xl print:p-6 print:break-inside-avoid">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-600 print:hidden" />
          <label className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 ml-2">
            <MessageSquare size={14} /> Official Response
          </label>
          <textarea 
            value={answer} 
            onChange={(e) => setAnswer(e.target.value)} 
            placeholder="Type the official answer or resolution here..."
            className="w-full h-48 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-blue-500 transition-all leading-relaxed print:hidden" 
          />
          <div className="hidden print:block text-black font-semibold text-sm whitespace-pre-wrap leading-relaxed p-4 border border-slate-300 rounded-xl bg-white">
            {answer || 'Awaiting official response...'}
          </div>
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print:mt-8">
          
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:border print:border-slate-300 print:rounded-xl print:p-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <User size={14} className="text-amber-500 print:text-black"/> Assigned To
            </label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none print:hidden appearance-none">
              <option value="">Unassigned</option>
              {contacts.map(c => <option key={c.id} value={c.company}>{c.company}</option>)}
            </select>
            <div className="hidden print:block text-black font-bold text-sm">{assignedTo || 'Unassigned'}</div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:border print:border-slate-300 print:rounded-xl print:p-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <FileText size={14} className="text-blue-500 print:text-black"/> Linked Drawing
            </label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none print:hidden appearance-none">
              <option value="">None / General</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div className="hidden print:block text-black font-bold text-sm">
              {plans.find(p => p.id === planId)?.title || 'General Inquiry'}
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:border print:border-slate-300 print:rounded-xl print:p-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <Calendar size={14} className="text-red-500 print:text-black"/> Due Date
            </label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none print:hidden" />
            <div className="hidden print:block text-black font-bold text-sm">
              {dueDate ? new Date(dueDate).toLocaleDateString() : 'No Due Date'}
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50 print:hidden">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button onClick={handleDelete} className="bg-red-950/50 text-red-500 border border-red-900/50 w-14 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
          
          <button onClick={() => window.print()} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg hover:bg-slate-700">
            <Printer size={16}/> Export PDF
          </button>
          
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            Save Updates
          </button>
        </div>
      </div>

    </div>
  )
}