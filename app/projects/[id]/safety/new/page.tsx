'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, ShieldCheck, Send, Loader2, 
  Camera, User, Check, X, Plus, HardHat 
} from 'lucide-react'

export default function NewInspection() {
  const { id } = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Data State
  const [trades, setTrades] = useState<any[]>([])
  
  // Checklist States
  const [ppe, setPpe] = useState('Pass')
  const [housekeeping, setHousekeeping] = useState('Pass')
  const [fallProt, setFallProt] = useState('Pass')
  const [fire, setFire] = useState('Pass')
  const [equip, setEquip] = useState('Pass')
  
  // Form States
  const [inspector, setInspector] = useState('Bill')
  const [flaggedTrade, setFlaggedTrade] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  // Signature Pad Logic
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  useEffect(() => {
    async function getTrades() {
      const { data } = await supabase.from('project_contacts').select('company').eq('project_id', id)
      if (data) setTrades(data)
    }
    getTrades()
  }, [id])

  const startDrawing = (e: React.PointerEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  }

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ef4444';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSigned(true);
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const path = `${id}/safety/inspections/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('project-files').upload(path, file)
    
    if (!error) {
      const { data } = supabase.storage.from('project-files').getPublicUrl(path)
      setPhotos(prev => [...prev, data.publicUrl])
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSigned) return alert("Inspector signature required.")
    setSaving(true)

    try {
      // 1. Upload Signature
      const sigDataUrl = canvasRef.current?.toDataURL('image/png')
      const res = await fetch(sigDataUrl!)
      const blob = await res.blob()
      const sigPath = `${id}/signatures/insp-${Date.now()}.png`
      await supabase.storage.from('project-files').upload(sigPath, blob)
      const { data: sUrl } = supabase.storage.from('project-files').getPublicUrl(sigPath)

      // 2. Save DB Record
      const { error } = await supabase.from('safety_inspections').insert([{
        project_id: id,
        inspector_name: inspector,
        ppe_compliance: ppe,
        housekeeping,
        fall_protection: fallProt,
        fire_safety: fire,
        equipment_condition: equip,
        summary_notes: notes,
        photo_urls: photos,
        signature_url: sUrl.publicUrl
      }])

      if (error) throw error
      router.push(`/projects/${id}/safety`)
      router.refresh()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
    setSaving(false)
  }

  const ChecklistItem = ({ label, value, onChange }: any) => (
    <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 w-full md:w-auto">
        {['Pass', 'Fail', 'N/A'].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
              value === opt 
                ? opt === 'Pass' ? 'bg-emerald-600 text-white shadow-lg' : opt === 'Fail' ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-700 text-white'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-red-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 flex items-center gap-1 transition-all">
          <ChevronLeft size={12}/> Discard
        </button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white leading-none">
          Safety <span className="text-red-600">Inspection</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* INSPECTOR & TRADE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Inspector</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={16}/>
              <input value={inspector} onChange={e => setInspector(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl font-bold text-white outline-none focus:border-red-600" />
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic">Flagged Trade (Optional)</label>
            <div className="relative">
              <HardHat className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16}/>
              <select value={flaggedTrade} onChange={e => setFlaggedTrade(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl font-bold text-white outline-none appearance-none">
                <option value="">General Site Walk</option>
                {trades.map((t, i) => <option key={i} value={t.company}>{t.company}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* CHECKLIST */}
        <div className="space-y-3">
          <ChecklistItem label="PPE Compliance" value={ppe} onChange={setPpe} />
          <ChecklistItem label="Site Housekeeping" value={housekeeping} onChange={setHousekeeping} />
          <ChecklistItem label="Fall Protection / Guardrails" value={fallProt} onChange={setFallProt} />
          <ChecklistItem label="Fire Extinguisher / Safety" value={fire} onChange={setFire} />
          <ChecklistItem label="Tools & Equipment Condition" value={equip} onChange={setEquip} />
        </div>

        {/* PHOTO EVIDENCE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mt-6">
          <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Camera size={14} className="text-red-500" /> Photo Observations
            </label>
            <label className="bg-slate-800 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-slate-700 transition-all flex items-center gap-2">
              {uploading ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>} Add Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
            </label>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {photos.map((url, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-800 relative group">
                <img src={url} className="w-full h-full object-cover" alt="Evidence" />
                <button type="button" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                  <X size={10}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mt-6">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">General Narrative</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note any specific deficiencies or positive observations..." className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-red-600 leading-relaxed" />
        </div>

        {/* SIGNATURE PAD */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-red-900/30">
          <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Authorized Inspector Signature</label>
            {hasSigned && <button type="button" onClick={() => {
              const ctx = canvasRef.current?.getContext('2d');
              ctx?.clearRect(0, 0, 500, 150);
              setHasSigned(false);
            }} className="text-[9px] font-black text-red-500 uppercase">Clear</button>}
          </div>
          <div className="border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-black/40">
            <canvas 
              ref={canvasRef} 
              width={500} 
              height={150} 
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={() => setIsDrawing(false)}
              className="w-full h-[150px] cursor-crosshair touch-none" 
            />
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
          <div className="max-w-4xl mx-auto">
            <button type="submit" disabled={saving} className="w-full bg-red-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-500 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
              {saving ? 'Transmitting Record...' : 'File Proactive Safety Record'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}