'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewInspection() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [results, setResults] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  useEffect(() => {
    async function getData() {
      const { data: p } = await supabase.from('projects').select('*').order('name')
      const { data: t } = await supabase.from('inspection_templates').select('*').order('name')
      if (p) setProjects(p)
      if (t) setTemplates(t)
    }
    getData()
  }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    if (!selectedProjectId) return setStatus('⚠️ SELECT A PROJECT')
    if (!selectedTemplate) return setStatus('⚠️ SELECT A PHASE')
    if (!hasSigned) return setStatus('⚠️ SIGNATURE REQUIRED')
    
    setLoading(true)
    setStatus('TRANSMITTING AUDIT...')

    try {
      // 1. Upload Photos
      const uploadedUrls: string[] = []
      for (const file of photos) {
        const fileName = `inspections/${Date.now()}-${file.name.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('site-photos').upload(fileName, file)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(fileName)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      // 2. Upload Signature
      let sigUrl = null
      if (canvasRef.current && hasSigned) {
        const sigDataUrl = canvasRef.current.toDataURL('image/png')
        const blob = await (await fetch(sigDataUrl)).blob()
        const sigPath = `signatures/ins-${Date.now()}.png`
        const { error: sigError } = await supabase.storage.from('site-photos').upload(sigPath, blob)
        if (!sigError) {
          sigUrl = supabase.storage.from('site-photos').getPublicUrl(sigPath).data.publicUrl
        }
      }

      // 3. Save Inspection Record
      const { error: dbError } = await supabase.from('site_inspections').insert([{
        project_id: selectedProjectId,
        template_id: selectedTemplate.id,
        unit_number: formData.get('unit_number'),
        status: 'Completed',
        results,
        notes: formData.get('notes'),
        photo_urls: uploadedUrls,
        signature_url: sigUrl
      }])

      if (dbError) throw new Error(`Database Error: ${dbError.message}`)

      // === 4. AUTO-PUNCH LOGIC ===
      const failedItems = Object.entries(results).filter(([_, score]) => score === 'Fail')
      
      if (failedItems.length > 0) {
        setStatus('GENERATING DEFICIENCY TICKETS...')
        
        const unitNumStr = String(formData.get('unit_number') || 'General')
        const projectIdStr = String(selectedProjectId || '')
        const templateNameStr = String(selectedTemplate?.name || 'Unknown Phase')
        const tradeTypeStr = String(selectedTemplate?.trade_type || 'General')
        
        const punchItems = failedItems.map(([itemText]) => ({
          project_id: projectIdStr, 
          location: `Unit ${unitNumStr} - ${templateNameStr}`, 
          description: `FAILED AUDIT ITEM: ${String(itemText)}`,
          assigned_to: tradeTypeStr, 
          priority: 'High', 
          status: 'Open',
          notes: 'Auto-generated from Phase Audit.' 
        }))

        const { error: punchError } = await supabase.from('punch_list').insert(punchItems)
        
        if (punchError) {
           throw new Error(`Punch List Failed: ${punchError.message}`) 
        }
      }

      setStatus('✅ SUCCESS! REDIRECTING...')
      router.refresh() 
      setTimeout(() => {
         router.push('/inspections') 
      }, 500)
      
    } catch (err: any) {
      console.error("Critical Failure:", err)
      setStatus(`❌ ${err.message || 'Submission Failed'}`)
      setLoading(false)
    }
  }

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0) }
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-950 min-h-screen pb-20 font-sans text-slate-100">
      <div className="mb-6 pt-4 border-b border-slate-800 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-black text-white uppercase italic">Phase <span className="text-blue-500">Audit</span></h1>
        <Link href="/inspections" className="text-[10px] font-black text-slate-500 uppercase bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">← Exit</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl space-y-3">
          
          {/* FIX: text-base prevents iOS zoom bug on mobile */}
          <select required value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base md:text-sm font-bold text-white outline-none">
            <option value="">Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          
          <input name="unit_number" required placeholder="Unit # (e.g. 204)" className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base md:text-sm font-bold text-white outline-none" />
        </div>

        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
          <select required onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value))} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-base md:text-sm font-bold text-white outline-none">
            <option value="">Choose Phase...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {selectedTemplate && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {selectedTemplate.items.map((item: string) => (
              <div key={item} className="bg-slate-900 p-5 rounded-[32px] border border-slate-800">
                <p className="text-sm font-bold text-slate-200 mb-4 leading-relaxed">{item}</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Pass', 'Fail', 'NA'].map((score) => (
                    <button key={score} type="button" onClick={() => setResults(prev => ({ ...prev, [item]: score }))}
                      className={`py-4 rounded-2xl text-[10px] font-black uppercase transition-all ${
                        results[item] === score ? (score === 'Pass' ? 'bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : score === 'Fail' ? 'bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-600') : 'bg-slate-850 text-slate-600 border border-slate-800'
                      }`}>{score}</button>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Photo Evidence</label>
              <div className="flex flex-wrap gap-2">
                <label className="w-20 h-20 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 bg-slate-950">
                  <span className="text-2xl text-slate-700">+</span>
                  <input type="file" multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
                </label>
                {photos.map((p, i) => (
                  <img key={i} src={URL.createObjectURL(p)} className="w-20 h-20 object-cover rounded-2xl border-2 border-blue-900" alt="Preview" />
                ))}
              </div>
            </div>

            {/* FIX: text-base prevents iOS zoom bug */}
            <textarea name="notes" placeholder="General notes..." className="w-full p-6 bg-slate-900 border border-slate-800 rounded-[32px] text-base md:text-sm text-white min-h-[140px] outline-none" />
            
            <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Lead Builder Sign-Off</p>
              <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden">
                <canvas 
                  ref={canvasRef} 
                  width={350} height={150} 
                  onPointerDown={(e) => {
                    const ctx = canvasRef.current?.getContext('2d')
                    const pos = getPos(e)
                    ctx?.beginPath(); ctx?.moveTo(pos.x, pos.y)
                    setIsDrawing(true)
                  }} 
                  onPointerMove={(e) => {
                    if (!isDrawing) return
                    const ctx = canvasRef.current?.getContext('2d')
                    const pos = getPos(e)
                    if (ctx) {
                      ctx.lineWidth = 3; ctx.strokeStyle = '#3b82f6'; ctx.lineCap = 'round'
                      ctx.lineTo(pos.x, pos.y); ctx.stroke()
                      setHasSigned(true)
                    }
                  }} 
                  onPointerUp={() => setIsDrawing(false)} 
                  className="w-full h-[150px] touch-none" 
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-6 rounded-[32px] shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px] border border-blue-400/30">
              {loading ? 'TRANSMITTING...' : 'COMMIT PHASE AUDIT'}
            </button>
          </div>
        )}
        {status && <p className="text-center text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-4 px-4">{status}</p>}
      </form>
    </div>
  )
}