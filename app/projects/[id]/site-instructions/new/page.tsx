'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Send, Loader2, Camera, Plus, X } from 'lucide-react'

export default function NewSiteInstruction() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [trades, setTrades] = useState<any[]>([])
  
  // Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tradeId, setTradeId] = useState('')
  const [reason, setReason] = useState('Site Condition')
  const [files, setFiles] = useState<File[]>([])

  // Signature Pad
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  useEffect(() => {
    async function getTrades() {
      const { data } = await supabase.from('project_contacts').select('id, company').eq('project_id', id)
      if (data) setTrades(data)
    }
    getTrades()
  }, [id])

  // --- Signature Logic (Simplified) ---
  const startDrawing = (e: any) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true); canvas.setPointerCapture(e.pointerId);
  }
  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2; ctx.strokeStyle = '#10b981';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke();
    setHasSigned(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSigned) return alert("Signature required to issue directive.")
    setLoading(true)

    // 1. Upload Signature & Photos
    const sigDataUrl = canvasRef.current?.toDataURL('image/png')
    const res = await fetch(sigDataUrl!)
    const blob = await res.blob()
    const sigPath = `${id}/signatures/si-${Date.now()}.png`
    await supabase.storage.from('project-files').upload(sigPath, blob)
    const { data: sUrl } = supabase.storage.from('project-files').getPublicUrl(sigPath)

    // 2. Save DB Record
    const { error } = await supabase.from('site_instructions').insert([{
      project_id: id, trade_id: tradeId || null, title, description, reason,
      signature_url: sUrl.publicUrl, status: 'Issued'
    }])

    if (!error) router.push(`/projects/${id}/site-instructions`)
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32">
      <div className="mb-8 border-b-4 border-emerald-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Discard</button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">New <span className="text-emerald-500">Instruction</span></h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Target Trade</label>
            <select value={tradeId} onChange={e => setTradeId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-emerald-500">
              <option value="">Select Trade...</option>
              {trades.map(t => <option key={t.id} value={t.id}>{t.company}</option>)}
            </select>
          </div>
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Reason for Instruction</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black text-emerald-500 outline-none uppercase">
              <option value="Site Condition">Site Condition</option>
              <option value="Detail Clarification">Detail Clarification</option>
              <option value="Coordination">Coordination</option>
              <option value="Safety Correction">Safety Correction</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Subject</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Relocation of LV Panel in Room 102" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-emerald-500 transition-all" />
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Instruction Details</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} required placeholder="Be specific. Specify what to do, where, and when..." className="w-full h-48 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-emerald-500 leading-relaxed" />
        </div>

        {/* SIGNATURE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-emerald-900/30">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Authorized Signature</label>
          <div className="border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-black/40">
            <canvas ref={canvasRef} width={500} height={150} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={() => setIsDrawing(false)} className="w-full h-[150px] cursor-crosshair touch-none" />
          </div>
          {hasSigned && <button type="button" onClick={() => {const c=canvasRef.current?.getContext('2d'); c?.clearRect(0,0,500,150); setHasSigned(false)}} className="text-[9px] font-black text-red-500 uppercase mt-2">Clear</button>}
        </div>

        <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-500 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
          Issue Official Directive
        </button>
      </form>
    </div>
  )
}