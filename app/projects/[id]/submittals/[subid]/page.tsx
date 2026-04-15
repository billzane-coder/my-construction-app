'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, FileText, Save, Loader2, 
  ExternalLink, HardHat, User, CheckCircle2, AlertCircle, Map 
} from 'lucide-react'
import Link from 'next/link'

export default function SubmittalDetail() {
  const { id, subid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data
  const [submittal, setSubmittal] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [revision, setRevision] = useState('')

  useEffect(() => {
    async function fetchSub() {
      if (!id || !subid) return
      const { data } = await supabase
        .from('project_submittals')
        .select('*, project_documents(id, title), project_contacts(company)')
        .eq('id', subid)
        .single()
      
      if (data) {
        setSubmittal(data)
        setStatus(data.status)
        setAssignedTo(data.assigned_to || '')
        setRevision(data.revision_number || '00')
      }
      setLoading(false)
    }
    fetchSub()
  }, [id, subid])

  const handleUpdate = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('project_submittals')
      .update({ status, assigned_to: assignedTo, revision_number: revision })
      .eq('id', subid)
    
    if (!error) alert("Submittal Updated")
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Submittal...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Back to Log</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">{submittal?.title}</h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <HardHat size={14} /> {submittal?.project_contacts?.company || 'Originating Trade'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* ATTACHED MARKUP LINK (The part you asked for) */}
        {submittal?.linked_document_id && (
          <div className="bg-blue-600/10 border-2 border-blue-600/30 p-6 rounded-[32px] flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Map size={14} /> Linked Site Drawing
              </p>
              <h4 className="text-xl font-black text-white uppercase italic">{submittal.project_documents?.title}</h4>
            </div>
            <Link 
              href={`/projects/${id}/viewer/${submittal.linked_document_id}`}
              className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg"
            >
              Open Drawing <ExternalLink size={14}/>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* STATUS SELECT */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Approval Status</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none"
            >
              <option value="Pending Review">🟡 Pending Review</option>
              <option value="Under Review">🔵 Under Review</option>
              <option value="Approved">🟢 Approved</option>
              <option value="Approved as Noted">🟢 Approved as Noted</option>
              <option value="Revise & Resubmit">🔴 Revise & Resubmit</option>
            </select>
          </div>

          {/* REVISION */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Revision #</label>
            <input value={revision} onChange={e => setRevision(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
          </div>
        </div>

        {/* ASSIGNED TO */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Current Holder (Consultant)</label>
          <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="e.g. John Doe (Architect)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
        </div>

        {/* ORIGINAL FILE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Original Document Attachment</label>
          <a href={submittal?.url} target="_blank" rel="noreferrer" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-black text-blue-400 flex items-center justify-between hover:bg-slate-800 transition-all">
            <span className="flex items-center gap-3"><FileText size={20} /> View PDF Document</span>
            <ExternalLink size={18} />
          </a>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={handleUpdate} 
            disabled={saving} 
            className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-500 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={16} />} 
            Save Submittal Updates
          </button>
        </div>
      </div>

    </div>
  )
}