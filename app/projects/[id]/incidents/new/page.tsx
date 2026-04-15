'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, AlertTriangle, Send, Loader2, 
  Camera, ShieldAlert, X, Info, Plus 
} from 'lucide-react'

const CLASSIFICATIONS = [
  { id: 'Accident', label: 'Accident', desc: 'Work-related event resulting in injury or property damage.' },
  { id: 'Near Miss', label: 'Near Miss', desc: 'No injury occurred, but could have. Key learning opportunity.' },
  { id: 'Observation', label: 'Observation', desc: 'Proactive note of a potential hazard before an incident occurs.' },
  { id: 'Fatality', label: 'Fatality', desc: 'CRITICAL: Report to MOL immediately. Secure the site.' }
]

export default function NewIncident() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  
  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classification, setClassification] = useState('')
  const [severity, setSeverity] = useState('Medium')
  const [involved, setInvolved] = useState('')
  const [files, setFiles] = useState<File[]>([])

  // --- SIGNATURE PAD STATE ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  // --- SIGNATURE PAD LOGIC ---
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId); 
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ef4444'; // Red for safety
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSigned(true);
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId);
  }

  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  }

  // --- SUBMIT LOGIC ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classification) return alert('Please select a classification.')
    if (!hasSigned) return alert('Signature is required for safety records.')
    
    setLoading(true)
    setStatus('Transmitting Legal Record...')
    
    try {
      // 1. Upload Evidence
      const uploadedUrls: string[] = []
      for (const file of files) {
        const path = `${id}/incidents/${Date.now()}-${file.name}`
        const { data } = await supabase.storage.from('project-files').upload(path, file)
        if (data) {
          const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      // 2. Upload Signature
      let finalSignatureUrl = null
      if (canvasRef.current && hasSigned) {
        const sigDataUrl = canvasRef.current.toDataURL('image/png')
        const res = await fetch(sigDataUrl)
        const blob = await res.blob()
        const sigPath = `${id}/signatures/inc-${Date.now()}.png`
        const { data: sigData } = await supabase.storage.from('project-files').upload(sigPath, blob)
        if (sigData) {
          finalSignatureUrl = supabase.storage.from('project-files').getPublicUrl(sigPath).data.publicUrl
        }
      }

      // 3. Save to DB
      const { error } = await supabase.from('incidents').insert([{
        project_id: id,
        title,
        description,
        classification,
        severity,
        involved_parties: involved,
        photo_urls: uploadedUrls,
        signature_url: finalSignatureUrl,
        status: 'Reported'
      }])

      if (error) throw error
      router.push(`/projects/${id}/incidents`)

    } catch (err: any) {
      alert(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-red-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
          <ChevronLeft size={12}/> Cancel
        </button>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
          Incident <span className="text-red-600">Report</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* EMERGENCY STEPS */}
        <div className="bg-red-950/20 border-2 border-red-900/50 p-6 rounded-[32px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600" />
          <h2 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShieldAlert size={14}/> Immediate Protocol
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-[10px] font-bold text-slate-300 uppercase leading-relaxed bg-black/20 p-3 rounded-xl border border-red-900/20">1. Stop & Secure Site</div>
            <div className="text-[10px] font-bold text-slate-300 uppercase leading-relaxed bg-black/20 p-3 rounded-xl border border-red-900/20">2. Medical / Call 911</div>
            <div className="text-[10px] font-bold text-slate-300 uppercase leading-relaxed bg-black/20 p-3 rounded-xl border border-red-900/20">3. Notify PM & MOL</div>
          </div>
        </div>

        {/* CLASSIFICATION CARDS */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Classification</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CLASSIFICATIONS.map(c => (
              <button key={c.id} type="button" onClick={() => setClassification(c.id)}
                className={`p-5 rounded-3xl text-left border-2 transition-all flex flex-col gap-1 ${
                  classification === c.id ? 'bg-red-600 border-red-500 text-white shadow-xl shadow-red-900/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                <span className="font-black text-xs uppercase italic">{c.label}</span>
                <span className="text-[9px] font-medium opacity-70 leading-tight">{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Subject</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Scaffolding Failure" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-red-600" />
          </div>
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black text-red-500 outline-none uppercase">
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Description of Event</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} required placeholder="Document the narrative..." className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-red-600 leading-relaxed" />
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Parties Involved</label>
          <input value={involved} onChange={e => setInvolved(e.target.value)} placeholder="Names, Trades, Witnesses" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-red-600" />
        </div>

        {/* EVIDENCE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Evidence (Photos / PDFs)</label>
          <div className="flex flex-wrap gap-3">
            <label className="w-20 h-20 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center cursor-pointer bg-slate-950 text-slate-500 hover:text-white hover:border-slate-600 transition-all">
              <Plus size={24}/>
              <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
            </label>
            {files.map((f, i) => (
              <div key={i} className="w-20 h-20 rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-center overflow-hidden relative group">
                {f.type.includes('image') ? <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" /> : <div className="text-[8px] font-black uppercase p-2 text-center">PDF</div>}
                <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"><X size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNATURE PAD */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-red-900/30">
          <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Authorized Site Superintendent Signature</label>
            {hasSigned && <button type="button" onClick={clearSignature} className="text-[9px] font-black text-red-500 uppercase">Clear</button>}
          </div>
          <div className="border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-black/40">
            <canvas 
              ref={canvasRef}
              width={500} 
              height={150}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerOut={stopDrawing}
              className="w-full h-[150px] cursor-crosshair touch-none" 
            />
          </div>
          {!hasSigned && <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-4 text-center animate-pulse flex items-center justify-center gap-2"><Info size={12}/> Sign above to verify this record</p>}
        </div>

      </form>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto">
          <button onClick={handleSubmit} disabled={loading} className="w-full bg-red-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-red-900/20 hover:bg-red-500 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <Send size={16} />} 
            {loading ? 'Filing Record...' : 'File Official Safety Record'}
          </button>
        </div>
      </div>
    </div>
  )
}