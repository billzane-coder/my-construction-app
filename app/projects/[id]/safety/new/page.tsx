'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ShieldCheck, Send, Loader2, Camera, User, Check, X, Minus } from 'lucide-react'

export default function NewInspection() {
  const { id } = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  
  // Checklist States
  const [ppe, setPpe] = useState('Pass')
  const [housekeeping, setHousekeeping] = useState('Pass')
  const [fallProt, setFallProt] = useState('Pass')
  const [fire, setFire] = useState('Pass')
  const [equip, setEquip] = useState('Pass')
  
  const [inspector, setInspector] = useState('Bill')
  const [notes, setNotes] = useState('')

  // Signature Pad
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSigned) return alert("Inspector signature required.")
    setSaving(true)

    // 1. Upload Signature
    const sigDataUrl = canvasRef.current?.toDataURL('image/png')
    const res = await fetch(sigDataUrl!)
    const blob = await res.blob()
    const sigPath = `${id}/signatures/insp-${Date.now()}.png`
    await supabase.storage.from('project-files').upload(sigPath, blob)
    const { data: sUrl } = supabase.storage.from('project-files').getPublicUrl(sigPath)

    // 2. Save DB Record
    const { error } = await supabase.from('safety_inspections').insert([{
      project_id: id, inspector_name: inspector, ppe_compliance: ppe,
      housekeeping, fall_protection: fallProt, fire_safety: fire,
      equipment_condition: equip, summary_notes: notes,
      signature_url: sUrl.publicUrl
    }])

    if (!error) router.push(`/projects/${id}/safety`)
    setSaving(false)
  }

  const ChecklistItem = ({ label, value, onChange }: any) => (
    <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
      <span className="text-xs font-black uppercase tracking-widest text-white">{label}</span>
      <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 w-full md:w-auto">
        {['Pass', 'Fail', 'N/A'].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              value === opt 
                ? opt === 'Pass' ? 'bg-emerald-600 text-white' : opt === 'Fail' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
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
      <div className="mb-8 border-b-4 border-red-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Discard</button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">Safety <span className="text-red-600">Inspection</span></h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mb-6">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Inspector Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={16}/>
            <input value={inspector} onChange={e => setInspector(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-2xl font-bold text-white outline-none focus:border-red-600" />
          </div>
        </div>

        <ChecklistItem label="PPE Compliance" value={ppe} onChange={setPpe} />
        <ChecklistItem label="Site Housekeeping" value={housekeeping} onChange={setHousekeeping} />
        <ChecklistItem label="Fall Protection / Guardrails" value={fallProt} onChange={setFallProt} />
        <ChecklistItem label="Fire Extinguisher / Safety" value={fire} onChange={setFire} />
        <ChecklistItem label="Tools & Equipment Condition" value={equip} onChange={setEquip} />

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mt-6">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Notes & Observations</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="General site conditions..." className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-red-600 leading-relaxed" />
        </div>

        {/* SIGNATURE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-red-900/30">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Inspector Signature</label>
          <div className="border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-black/40">
            <canvas ref={canvasRef} width={500} height={150} onPointerDown={() => setIsDrawing(true)} onPointerMove={(e) => {
              if(!isDrawing) return;
              const ctx = canvasRef.current?.getContext('2d');
              const rect = canvasRef.current?.getBoundingClientRect();
              if(ctx && rect){
                ctx.lineWidth = 2; ctx.strokeStyle = '#ef4444';
                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke();
                setHasSigned(true);
              }
            }} onPointerUp={() => setIsDrawing(false)} className="w-full h-[150px] cursor-crosshair touch-none" />
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-red-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-500 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
          File Proactive Record
        </button>
      </form>
    </div>
  )
}