'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Printer, Trash2, Save, 
  Loader2, ShieldAlert, Calendar, User, 
  FileText, MessageSquare, AlertCircle, CheckCircle2 
} from 'lucide-react'

export default function IncidentDetail() {
  const { id, incidentid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<any>(null)
  
  // Incident Data
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classification, setClassification] = useState('')
  const [severity, setSeverity] = useState('')
  const [involved, setInvolved] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [signatureUrl, setSignatureUrl] = useState('')
  const [status, setStatus] = useState('Reported')
  const [createdAt, setCreatedAt] = useState('')

  useEffect(() => {
    async function fetchIncident() {
      if (!id || !incidentid) return
      
      const [proj, inc] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('incidents').select('*').eq('id', incidentid).single()
      ])

      if (proj.data) setProject(proj.data)
      if (inc.data) {
        setTitle(inc.data.title)
        setDescription(inc.data.description)
        setClassification(inc.data.classification)
        setSeverity(inc.data.severity)
        setInvolved(inc.data.involved_parties)
        setPhotos(inc.data.photo_urls || [])
        setSignatureUrl(inc.data.signature_url)
        setStatus(inc.data.status || 'Reported')
        setCreatedAt(inc.data.incident_date || inc.data.created_at)
      }
      setLoading(false)
    }
    fetchIncident()
  }, [id, incidentid])

  const handleUpdate = async () => {
    setSaving(true)
    const { error } = await supabase.from('incidents').update({
      title, description, severity, status, involved_parties: involved
    }).eq('id', incidentid)
    
    if (!error) alert("Record Updated Successfully")
    setSaving(false)
  }

  const handleDelete = async () => {
    if (confirm("Permanently delete this safety record? This cannot be undone.")) {
      await supabase.from('incidents').delete().eq('id', incidentid)
      router.push(`/projects/${id}/incidents`)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-orange-500 font-black animate-pulse uppercase tracking-widest">Opening Safety Vault...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40 print:bg-white print:text-black print:pb-0" id="print-area">
      
      {/* 🖨️ NUCLEAR PRINT STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.75in; size: portrait; }
          html, body, #__next, [data-reactroot], body > div { 
            height: auto !important; overflow: visible !important; 
            position: static !important; display: block !important; background: white !important; 
          }
          .print\\:hidden { display: none !important; }
          .print\\:text-black { color: black !important; }
          .print\\:border-black { border-color: black !important; }
          .print\\:bg-slate-50 { background-color: #f8fafc !important; }
        }
      `}} />

      {/* 🖨️ PROFESSIONAL REPORT HEADER (Print Only) */}
      <div className="hidden print:block border-b-4 border-red-600 pb-6 mb-8 mt-2">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Safety Incident Report</h1>
            <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">{project?.name} | {classification}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date of Incident</p>
            <p className="text-lg font-black text-black">
              {new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* 💻 APP UI HEADER (Screen Only) */}
      <div className="mb-8 border-b-4 border-orange-600 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
            <ChevronLeft size={12}/> Back to Log
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Report <span className="text-orange-500">Detail</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handleDelete} className="p-4 bg-red-950/20 text-red-500 border border-red-900/50 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
            <Trash2 size={20} />
          </button>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-orange-500 font-black p-4 rounded-2xl outline-none uppercase text-xs"
          >
            <option value="Reported">Reported</option>
            <option value="Investigating">Investigating</option>
            <option value="Resolved">Resolved / Closed</option>
          </select>
        </div>
      </div>

      <div className="space-y-6 print:space-y-8">
        
        {/* SUMMARY BLOCK */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-2 print:border-slate-300 print:rounded-2xl print:p-6">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
            <ShieldAlert size={14} className="text-orange-500 print:text-black"/> Classification & Severity
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Classification</p>
              <p className="text-sm font-black text-white uppercase italic print:text-black">{classification}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Severity</p>
              <p className={`text-sm font-black uppercase ${severity === 'Critical' ? 'text-red-500' : 'text-orange-400 print:text-black'}`}>{severity}</p>
            </div>
          </div>
        </div>

        {/* DESCRIPTION BLOCK */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-2 print:border-slate-300 print:rounded-2xl print:p-6">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <FileText size={14} className="text-orange-500 print:text-black"/> Narrative Description
          </label>
          <input 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-t-2xl font-black text-white text-lg outline-none print:hidden mb-1" 
          />
          <div className="hidden print:block text-xl font-black text-black mb-3 uppercase italic">{title}</div>
          
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)}
            className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-b-2xl font-bold text-slate-300 outline-none resize-none print:hidden leading-relaxed" 
          />
          <div className="hidden print:block text-black font-medium text-sm whitespace-pre-wrap leading-relaxed">
            {description}
          </div>
        </div>

        {/* PARTIES BLOCK */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-2 print:border-slate-300 print:rounded-2xl print:p-6">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <User size={14} className="text-orange-500 print:text-black"/> Parties Involved
          </label>
          <input 
            value={involved} 
            onChange={e => setInvolved(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none print:hidden" 
          />
          <div className="hidden print:block text-black font-semibold text-sm">{involved || 'No parties listed.'}</div>
        </div>

        {/* VISUAL EVIDENCE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:border-none print:p-0">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
            <AlertCircle size={14} className="text-orange-500 print:text-black"/> Evidence Gallery
          </label>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-2 gap-4">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-800 print:border-slate-300">
                  <img src={url} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[9px] font-black text-slate-700 uppercase italic">No photos attached to this record.</p>
          )}
        </div>

        {/* 🖨️ OFFICIAL SIGNATURE (Most important for safety) */}
        <div className="mt-12 pt-8 border-t border-slate-800 print:border-black print:border-t-2 print:flex print:justify-between print:items-start">
          <div className="w-64">
             <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 block print:text-slate-400">Superintendent Verification</label>
             {signatureUrl ? (
               <div className="bg-slate-900/50 p-4 rounded-2xl print:bg-transparent print:p-0">
                 <img src={signatureUrl} className="h-24 object-contain invert print:invert-0" alt="Super Signature" />
               </div>
             ) : (
               <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-700 text-[10px] font-black uppercase">No Signature Found</div>
             )}
             <p className="text-[10px] font-black text-white mt-4 uppercase tracking-tighter print:text-black">Bill — Site Superintendent</p>
          </div>
          
          <div className="hidden print:block text-right">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Record Status</p>
             <p className="text-sm font-black text-black uppercase italic">{status}</p>
          </div>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50 print:hidden">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button 
            onClick={() => window.print()} 
            className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
          >
            <Printer size={16}/> Export Report
          </button>
          
          <button 
            onClick={handleUpdate} 
            disabled={saving} 
            className="flex-1 bg-orange-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-orange-900/20 hover:bg-orange-500 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
            Save Modifications
          </button>
        </div>
      </div>
    </div>
  )
}