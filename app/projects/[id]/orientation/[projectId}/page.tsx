'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { ShieldCheck, HardHat, AlertTriangle, CheckCircle2, PenTool, Loader2, Info, Flame, Camera, X } from 'lucide-react'

const PPE_REQUIREMENTS = [
  "CSA Approved Grade 1 Safety Footwear (Green Patch) must be worn at all times.",
  "CSA Approved Hard Hats (Type 1 or 2, Class E or G) must be worn at all times.",
  "CSA Approved Safety Glasses must be worn when performing tasks with flying debris risks.",
  "High-Visibility Clothing (Class 2 minimum) is mandatory on all active sites."
]

const SITE_HAZARDS = [
  "Working at Heights: 100% tie-off required when working above 3 meters (10 feet) or near unprotected edges.",
  "Heavy Machinery: Maintain a safe distance and establish eye contact with operators before approaching.",
  "Slips, Trips, and Falls: Housekeeping is everyone's responsibility. Keep walkways clear of cords, debris, and materials.",
  "Electrical: Only qualified personnel may modify or repair temporary power panels. Ensure all tools use GFCI protection.",
  "Silica/Dust: Wet-cut methods or HEPA-filtered vacuums must be used during concrete/masonry cutting."
]

const EMERGENCY_PROCEDURES = [
  "Muster Point: In the event of an evacuation, proceed immediately to the designated Muster Point located near the site trailer/entrance.",
  "Reporting: All incidents, near-misses, and observed hazards must be reported to the Site Supervisor immediately.",
  "First Aid: The primary First Aid kit is located in the Site Trailer.",
  "Fire Extinguishers: 4A:40BC extinguishers are located throughout the site and at all hot work stations."
]

const GENERAL_RULES = [
  "Zero Tolerance: Absolutely no alcohol or illicit drugs are permitted on site.",
  "Smoking/Vaping: Permitted only in designated outdoor areas, minimum 9 meters from entrances.",
  "Respectful Workplace: Harassment, violence, or discrimination of any kind will result in immediate removal.",
  "Hot Work: A Hot Work Permit must be issued by the Site Super before any welding, brazing, or cutting operations begin.",
  "Lockout/Tagout (LOTO): All hazardous energy sources must be locked and tagged out before maintenance or repair."
]

export default function WorkerOrientation() {
  const { projectId } = useParams()
  
  const [project, setProject] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({ name: '', tradeId: '', phone: '', emergencyContact: '' })
  const [trainingCards, setTrainingCards] = useState<File[]>([])
  
  // Checkbox States
  const [ackPPE, setAckPPE] = useState(false)
  const [ackHazards, setAckHazards] = useState(false)
  const [ackEmergency, setAckEmergency] = useState(false)
  const [ackGeneral, setAckGeneral] = useState(false)
  
  const [signatureData, setSignatureData] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const [projRes, tradesRes] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('project_contacts').select('id, company').eq('project_id', projectId).order('company')
      ])
      
      setProject(projRes.data)
      if (tradesRes.data) setTrades(tradesRes.data)
      setLoading(false)
    }
    fetchData()
  }, [projectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ackPPE || !ackHazards || !ackEmergency || !ackGeneral) {
      return alert("You must acknowledge all sections of the orientation before submitting.")
    }
    if (!signatureData) {
      return alert("Your digital signature is required.")
    }
    if (!formData.tradeId) {
      return alert("Please select your company/trade from the list.")
    }
    
    setSubmitting(true)

    try {
      const safeName = formData.name.replace(/[^a-zA-Z0-9]/g, '_')
      
      // 1. Upload Training Cards directly to the Trade's Safety Folder
      for (const file of trainingCards) {
        const fileExt = file.name.split('.').pop()
        const path = `${projectId}/trades/${formData.tradeId}/Safety/Orientation_${safeName}_Card_${Date.now()}.${fileExt}`
        await supabase.storage.from('project-files').upload(path, file)
      }

      // 2. Upload Signature Image
      const blob = await (await fetch(signatureData)).blob()
      const sigPath = `${projectId}/signatures/orientation_${safeName}_${Date.now()}.png`
      await supabase.storage.from('project-files').upload(sigPath, blob)
      const { data: sigUrlData } = supabase.storage.from('project-files').getPublicUrl(sigPath)

      // 3. Save Orientation Record
      const selectedTrade = trades.find(t => t.id === formData.tradeId)
      
      const { error: dbError } = await supabase.from('site_orientations').insert([{
        project_id: projectId,
        worker_name: formData.name,
        company: selectedTrade?.company || 'Unknown',
        phone: formData.phone,
        emergency_contact: formData.emergencyContact,
        signature_url: sigUrlData.publicUrl
      }])

      if (dbError) throw dbError
      setSuccess(true)

    } catch (err: any) {
      alert("Submission failed. Please try again.")
      console.error("Orientation Submit Error:", err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black uppercase tracking-widest">Loading Orientation...</div>

  if (success) return (
    <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-6 text-center">
      <CheckCircle2 size={80} className="text-emerald-500 mb-6" />
      <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">Orientation Complete</h1>
      <p className="text-sm font-bold text-emerald-200 uppercase tracking-widest max-w-sm">
        You are now cleared to work on {project?.name}. Please see the Site Supervisor before starting your tasks. Work safe today.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-8 pt-8 border-b-2 border-blue-900/50 pb-8">
          <ShieldCheck size={56} className="text-blue-500 mx-auto mb-4" />
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">Site Orientation</h1>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{project?.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* WORKER DETAILS & UPLOADS */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <HardHat size={16}/> Worker Details & Certifications
            </h2>
            
            <div className="space-y-4">
              <input required placeholder="Full Legal Name" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500 text-base placeholder:text-slate-600" 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              
              <select required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500 text-base"
                value={formData.tradeId} onChange={e => setFormData({...formData, tradeId: e.target.value})}
              >
                <option value="" disabled>Select your Company / Trade</option>
                {trades.map(t => (
                  <option key={t.id} value={t.id}>{t.company}</option>
                ))}
              </select>
              
              <input required type="tel" placeholder="Cell Phone Number" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500 text-base placeholder:text-slate-600" 
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />

              <input required placeholder="Emergency Contact (Name & Number)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500 text-base placeholder:text-slate-600" 
                value={formData.emergencyContact} onChange={e => setFormData({...formData, emergencyContact: e.target.value})} />
            </div>

            {/* TRAINING CARD UPLOAD AREA */}
            <div className="mt-6 pt-6 border-t border-slate-800">
               <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                 <div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Training Certifications</span>
                   <span className="text-[9px] font-bold text-slate-500">Upload photos of your WHMIS, Working at Heights, etc.</span>
                 </div>
                 <label className="cursor-pointer bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shrink-0">
                    <Camera size={14} /> Add Photo
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => setTrainingCards([...trainingCards, ...Array.from(e.target.files!)])} />
                 </label>
               </label>
               
               {trainingCards.length > 0 && (
                 <div className="flex flex-wrap gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                   {trainingCards.map((file, i) => (
                     <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setTrainingCards(trainingCards.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 p-1 rounded-md text-white shadow-lg"><X size={10}/></button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          {/* PPE REQUIREMENTS */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <ShieldCheck size={16}/> Mandatory PPE
            </h2>
            <ul className="space-y-3 mb-6">
              {PPE_REQUIREMENTS.map((rule, idx) => (
                <li key={idx} className="flex gap-3 text-sm font-bold text-slate-300 leading-snug">
                  <span className="text-amber-500 font-black">•</span> {rule}
                </li>
              ))}
            </ul>
            <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${ackPPE ? 'bg-amber-950/20 border-amber-900/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="checkbox" required checked={ackPPE} onChange={e => setAckPPE(e.target.checked)} className="mt-1 w-5 h-5 accent-amber-500 shrink-0" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">I understand the PPE requirements.</span>
            </label>
          </div>

          {/* SITE HAZARDS */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <AlertTriangle size={16}/> Known Site Hazards
            </h2>
            <ul className="space-y-3 mb-6">
              {SITE_HAZARDS.map((rule, idx) => (
                <li key={idx} className="flex gap-3 text-sm font-bold text-slate-300 leading-snug">
                  <span className="text-red-500 font-black">•</span> {rule}
                </li>
              ))}
            </ul>
            <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${ackHazards ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="checkbox" required checked={ackHazards} onChange={e => setAckHazards(e.target.checked)} className="mt-1 w-5 h-5 accent-red-500 shrink-0" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">I acknowledge the site hazards.</span>
            </label>
          </div>

          {/* EMERGENCY PROCEDURES */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-orange-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <Flame size={16}/> Emergency Procedures
            </h2>
            <ul className="space-y-3 mb-6">
              {EMERGENCY_PROCEDURES.map((rule, idx) => (
                <li key={idx} className="flex gap-3 text-sm font-bold text-slate-300 leading-snug">
                  <span className="text-orange-500 font-black">•</span> {rule}
                </li>
              ))}
            </ul>
            <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${ackEmergency ? 'bg-orange-950/20 border-orange-900/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="checkbox" required checked={ackEmergency} onChange={e => setAckEmergency(e.target.checked)} className="mt-1 w-5 h-5 accent-orange-500 shrink-0" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">I understand the emergency protocols.</span>
            </label>
          </div>

          {/* GENERAL RULES */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
              <Info size={16}/> General Site Rules
            </h2>
            <ul className="space-y-3 mb-6">
              {GENERAL_RULES.map((rule, idx) => (
                <li key={idx} className="flex gap-3 text-sm font-bold text-slate-300 leading-snug">
                  <span className="text-blue-500 font-black">•</span> {rule}
                </li>
              ))}
            </ul>
            <label className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-colors ${ackGeneral ? 'bg-blue-950/20 border-blue-900/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
              <input type="checkbox" required checked={ackGeneral} onChange={e => setAckGeneral(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-500 shrink-0" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">I agree to follow the general site rules.</span>
            </label>
          </div>

          {/* FINAL ACKNOWLEDGEMENT & SIGNATURE */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] border border-slate-800 space-y-4 shadow-xl">
            <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 mb-2">
              <PenTool size={16}/> Digital Signature
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              By signing below, I certify that I have read, understood, and agree to abide by all the rules and procedures outlined in this orientation.
            </p>
            <SignaturePad onChange={(dataUrl) => setSignatureData(dataUrl)} />
          </div>

          {/* SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-900/20 flex justify-center items-center gap-2 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />} Complete Orientation
          </button>
          
        </form>
      </div>
    </div>
  )
}

// --- MOBILE OPTIMIZED SIGNATURE PAD ---
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FFFFFF'; 
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    document.body.style.overflow = 'hidden'; 
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault(); 
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    document.body.style.overflow = 'auto'; 
    if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-700">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[150px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={clearCanvas} className="text-[10px] font-black uppercase text-slate-500 hover:text-red-500 tracking-widest transition-all">
          Clear Signature
        </button>
      </div>
    </div>
  );
}