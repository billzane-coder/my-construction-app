'use client'
import { useState, useEffect, useRef } from 'react' // Added useRef
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation' // Added for redirect

const CLASSIFICATIONS = [
  { id: 'Accident', label: 'Accident', desc: 'Work-related event resulting in injury, illness, or property damage. Investigate immediately.' },
  { id: 'Near Miss', label: 'Near Miss', desc: 'No injury/damage occurred, but could have. Key learning opportunity.' },
  { id: 'Observation', label: 'Observation', desc: 'Proactive note of a potential hazard before an incident occurs.' },
  { id: 'Fatality', label: 'Death (Fatality)', desc: 'CRITICAL: Must be reported to MOL/WSIB immediately. Secure site.' }
]

export default function NewIncident() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [classification, setClassification] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  // --- SIGNATURE PAD STATE ---
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  useEffect(() => {
    async function getProjects() {
      const { data } = await supabase.from('projects').select('*').order('name')
      if (data) setProjects(data)
    }
    getProjects()
  }, [])

  // --- SIGNATURE PAD LOGIC ---
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId); // Stops the phone from scrolling
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b91c1c'; // Red ink for Safety
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

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!classification) return setStatus('⚠️ Select Classification')
    if (!hasSigned) return setStatus('⚠️ Signature Required')
    
    setLoading(true)
    setStatus('Uploading Record...')
    
    try {
      // 1. Upload Photos & PDF Evidence
      const uploadedUrls: string[] = []
      for (const file of files) {
        const fileName = `${Date.now()}-${file.name}`
        const { data } = await supabase.storage.from('site-photos').upload(`incidents/${fileName}`, file)
        if (data) {
          const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(`incidents/${fileName}`)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      // 2. Upload Signature Pad Image
      let finalSignatureUrl = null
      if (canvasRef.current && hasSigned) {
        const sigDataUrl = canvasRef.current.toDataURL('image/png')
        const res = await fetch(sigDataUrl)
        const blob = await res.blob()
        const sigFileName = `signatures/inc-${Date.now()}.png`
        const { data: sigData } = await supabase.storage.from('site-photos').upload(sigFileName, blob)
        if (sigData) {
          finalSignatureUrl = supabase.storage.from('site-photos').getPublicUrl(sigFileName).data.publicUrl
        }
      }

      // 3. Save Record to Database
      const { error } = await supabase.from('site_incidents').insert([{
        project_id: new FormData(e.target).get('project_id'),
        classification: classification,
        description: new FormData(e.target).get('description'),
        involved_parties: new FormData(e.target).get('parties'),
        evidence_urls: uploadedUrls,
        signature_url: finalSignatureUrl // Added!
      }])

      if (error) throw error

      setStatus('✅ Logged Successfully!')
      setTimeout(() => router.push('/incidents'), 1000)

    } catch (err: any) {
      setStatus('❌ Error: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-100 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="mb-6 pt-6 border-b-4 border-red-600 pb-4">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Incident Report</h1>
        <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Confidential Legal Record</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* EMERGENCY STEPS */}
        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-lg mb-8">
          <h2 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4">Immediate Actions</h2>
          <ol className="space-y-2 text-xs font-medium text-slate-300">
            <li>1. Stop & Secure Site</li>
            <li>2. Provide Medical Attention / Call 911</li>
            <li>3. Notify PM & Safety Officer</li>
          </ol>
        </div>

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Project Site</label>
          <select name="project_id" required className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none">
            <option value="">Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* CLASSIFICATION CARDS */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2">Classification</label>
          <div className="grid grid-cols-1 gap-2">
            {CLASSIFICATIONS.map(c => (
              <button key={c.id} type="button" onClick={() => setClassification(c.id)}
                className={`p-4 rounded-2xl text-left border-2 transition-all ${classification === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                <div className="font-black text-xs uppercase mb-1">{c.label}</div>
                <div className="text-[10px] opacity-70 leading-tight">{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* NARRATIVE */}
        <textarea name="description" required placeholder="Narrative of what happened..." className="w-full p-6 bg-white border border-slate-200 rounded-[32px] min-h-[140px] text-sm font-medium outline-none" />

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Parties Involved</label>
          <input name="parties" required placeholder="Names & Witness info" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none" />
        </div>

        {/* EVIDENCE ATTACHMENTS */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-4">Evidence (Photos & PDF)</label>
          <div className="flex flex-wrap gap-3">
            <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-50">
              <span className="text-xl text-slate-400">+</span>
              <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
            </label>
            {files.map((f, i) => (
              <div key={i} className="w-20 h-20 rounded-2xl border-2 border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                {f.type.includes('image') ? <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" /> : <span className="text-xl">📄</span>}
              </div>
            ))}
          </div>
        </div>

        {/* --- SIGNATURE SECTION --- */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border-2 border-red-100">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</label>
            {hasSigned && <button type="button" onClick={clearSignature} className="text-[9px] font-black text-red-500 uppercase">Clear</button>}
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <canvas 
              ref={canvasRef}
              width={350} 
              height={150}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerOut={stopDrawing}
              className="w-full h-[150px] cursor-crosshair touch-none" 
            />
          </div>
          {!hasSigned && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 text-center animate-pulse">Sign above to verify record</p>}
        </div>

        {/* SUBMIT BUTTON */}
        <button type="submit" disabled={loading} className="w-full bg-red-600 text-white font-black py-6 rounded-[32px] shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] text-xs">
          {loading ? 'Transmitting...' : 'File Official Record'}
        </button>
        
        {status && <div className="text-center p-4 text-[10px] font-black text-red-600 tracking-widest uppercase animate-pulse">{status}</div>}
        
      </form>
    </div>
  )
}