'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, FileQuestion, Send, Loader2, Calendar, User, FileText } from 'lucide-react'

export default function NewRfi() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data for dropdowns
  const [contacts, setContacts] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  
  // Form State
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [planId, setPlanId] = useState('')

  useEffect(() => {
    async function initForm() {
      if (!id) return
      
      const [cts, docs] = await Promise.all([
        supabase.from('project_contacts').select('*').eq('project_id', id),
        supabase.from('project_documents').select('id, title, revision_number').eq('project_id', id).eq('doc_type', 'Plan')
      ])

      if (cts.data) setContacts(cts.data)
      if (docs.data) setPlans(docs.data)
      
      // Default due date to 7 days from now
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      setDueDate(nextWeek.toISOString().split('T')[0])
      
      setLoading(false)
    }
    initForm()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !question) return alert("Please provide a title and a question.")
    
    setSaving(true)
    
    const payload = {
      project_id: id,
      title,
      question,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      plan_id: planId || null,
      status: 'Open'
    }

    const { error } = await supabase.from('rfis').insert([payload])
    
    if (!error) {
      router.push(`/projects/${id}/rfis`)
      router.refresh()
    } else {
      alert(`Error submitting RFI: ${error.message}`)
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Form...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
          <ChevronLeft size={12}/> Discard RFI
        </button>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
          Draft <span className="text-blue-500">RFI</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SUBJECT */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <FileQuestion size={14} className="text-blue-500"/> Subject / Title
          </label>
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="e.g., Clarification on Detail 4/A3.1" 
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black text-white outline-none focus:border-blue-500 transition-all" 
            required
          />
        </div>

        {/* THE QUESTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <FileText size={14} className="text-blue-500"/> The Question
          </label>
          <textarea 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            placeholder="Describe the discrepancy, missing info, or site condition..." 
            className="w-full h-48 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-blue-500 transition-all leading-relaxed" 
            required
          />
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* ASSIGN TO */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <User size={14} className="text-amber-500"/> Assign To
            </label>
            <select 
              value={assignedTo} 
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-amber-500 cursor-pointer appearance-none"
            >
              <option value="">Unassigned</option>
              {contacts.map(c => (
                <option key={c.id} value={c.company}>{c.company} ({c.trade_role})</option>
              ))}
            </select>
          </div>

          {/* LINK TO BLUEPRINT */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <FileText size={14} className="text-blue-500"/> Tag Drawing
            </label>
            <select 
              value={planId} 
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500 cursor-pointer appearance-none"
            >
              <option value="">None / General</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.title} (Rev: {p.revision_number})</option>
              ))}
            </select>
          </div>

          {/* DUE DATE */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <Calendar size={14} className="text-red-500"/> Reply Needed By
            </label>
            <input 
              type="date" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-slate-300 outline-none focus:border-red-500"
            />
          </div>

        </div>
      </form>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button type="button" onClick={() => router.back()} disabled={saving} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-700">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            Submit RFI
          </button>
        </div>
      </div>

    </div>
  )
}