'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Send, Loader2, FileText, HardHat, User } from 'lucide-react'

export default function NewSubmittal() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  
  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [category, setCategory] = useState('Shop Drawing')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    async function fetchContacts() {
      const { data } = await supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id)
      if (data) setContacts(data)
      setLoading(false)
    }
    fetchContacts()
  }, [id])

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!file || !title || !contactId) return alert("Trade, Title, and PDF are required.")
  
  setSaving(true)
  // 📂 ROUTE TO TRADE FOLDER: project/trades/trade_id/submittals/filename
  const path = `${id}/trades/${contactId}/submittals/${Date.now()}-${file.name}`
  
  const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
  
  if (!sErr) {
    const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
    
    const { error: dbErr } = await supabase.from('project_submittals').insert([{
      project_id: id, 
      contact_id: contactId, 
      title, 
      category, 
      assigned_to: assignedTo, 
      url: u.publicUrl,
      status: 'Pending Review'
    }])

    if (!dbErr) {
      router.push(`/projects/${id}/submittals`)
      router.refresh()
    } else {
      alert(`Database Error: ${dbErr.message}`)
    }
  } else {
    alert(`Storage Error: ${sErr.message}`)
  }
  setSaving(false)
}

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Ledger...</div>

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-950 min-h-screen text-slate-100 pb-32">
      <div className="mb-8 border-b-4 border-blue-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Cancel</button>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">New <span className="text-blue-500">Submittal</span></h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Submittal Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. 09 30 00 - Tile Shop Drawings" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500 transition-all" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block italic"><HardHat size={12} className="inline mr-1 text-blue-500" /> Originating Trade</label>
            <select value={contactId} onChange={e => setContactId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none">
              <option value="">Select Company...</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block italic"><User size={12} className="inline mr-1 text-amber-500" /> Forward To (Consultant)</label>
            <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="e.g. Studio Architect / Structural Eng." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-amber-500" />
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Attachment (PDF Only)</label>
          <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500 file:bg-blue-600 file:text-white file:px-6 file:py-3 file:rounded-xl file:border-none file:font-black file:uppercase file:mr-4 cursor-pointer" />
        </div>

        <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
          <div className="max-w-4xl mx-auto">
            <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-500 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="animate-spin" /> : <Send size={16} />} 
              Issue for Review
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}