'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const CLASSIFICATIONS = [
  { id: 'Accident', label: 'Accident', desc: 'Work-related event resulting in injury, illness, or property damage (e.g. slips, falls, damaged equipment). Investigate immediately.' },
  { id: 'Near Miss', label: 'Near Miss', desc: 'No injury/damage occurred, but could have under different circumstances. Key learning opportunity.' },
  { id: 'Observation', label: 'Observation', desc: 'Proactive note of a potential hazard before an incident occurs (e.g. missing guardrails, bad PPE).' },
  { id: 'Fatality', label: 'Death (Fatality)', desc: 'CRITICAL: Work-related fatal incident. Must be reported to MOL/WSIB immediately. Secure site.' }
]

export default function NewIncident() {
  const [projects, setProjects] = useState<any[]>([])
  const [classification, setClassification] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function getProjects() {
      const { data } = await supabase.from('projects').select('*').order('name')
      if (data) setProjects(data)
    }
    getProjects()
  }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!classification) return setStatus('⚠️ Please select an Incident Classification.')
    
    setLoading(true)
    setStatus('Uploading Evidence & Securing Record...')
    
    const uploadedUrls: string[] = []
    
    // Upload Photos & Forms
    for (const file of files) {
      const fileName = `${Date.now()}-${file.name}`
      const { data } = await supabase.storage.from('site-photos').upload(`incidents/${fileName}`, file)
      if (data) {
        const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(`incidents/${fileName}`)
        uploadedUrls.push(urlData.publicUrl)
      }
    }

    const { error } = await supabase.from('site_incidents').insert([{
      project_id: new FormData(e.target).get('project_id'),
      classification: classification,
      description: new FormData(e.target).get('description'),
      involved_parties: new FormData(e.target).get('parties'),
      evidence_urls: uploadedUrls
    }])

    setLoading(false)
    if (error) setStatus('❌ Error: ' + error.message)
    else {
      setStatus('🚨 Incident Officially Logged.')
      setFiles([]); setClassification(''); e.target.reset()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-100 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="mb-6 pt-6 border-b-4 border-red-600 pb-4">
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Incident Report</h1>
        <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Confidential Legal Record</p>
      </div>

      {/* 🚨 EMERGENCY PROTOCOL (Always visible at the top) */}
      <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-lg mb-8">
        <h2 className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-4">Steps to Follow Immediately</h2>
        <ol className="space-y-3 text-sm font-medium text-slate-300">
          <li><strong className="text-white">1. Stop & Secure:</strong> Ensure no one else is exposed to the hazard.</li>
          <li><strong className="text-white">2. Medical Attention:</strong> Call 911 or provide first aid immediately.</li>
          <li><strong className="text-white">3. Report:</strong> Notify project manager & safety officer.</li>
          <li><strong className="text-white">4. Document:</strong> Record time, location, and people involved.</li>
          <li><strong className="text-white">5. Evidence:</strong> Attach photos/forms below. Do not move equipment.</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Project Site</label>
          <select name="project_id" required className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 📋 CLASSIFICATION CARDS */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2">Incident Classification</label>
          <div className="grid grid-cols-1 gap-3">
            {CLASSIFICATIONS.map(c => (
              <button 
                key={c.id} 
                type="button"
                onClick={() => setClassification(c.id)}
                className={`p-4 rounded-2xl text-left border-2 transition-all ${
                  classification === c.id 
                  ? c.id === 'Fatality' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="font-black text-sm uppercase tracking-wider mb-1">{c.label}</div>
                <div className={`text-xs ${classification === c.id ? 'text-slate-300' : 'text-slate-500'}`}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* NARRATIVE */}
        <textarea 
          name="description" 
          required 
          placeholder="Detailed narrative of what happened, root causes, and corrective actions taken..." 
          className="w-full p-6 bg-white border border-slate-200 rounded-[32px] min-h-[160px] text-sm font-medium outline-none focus:ring-2 focus:ring-red-500 shadow-sm" 
        />

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Parties Involved</label>
          <input name="parties" required placeholder="e.g. John Doe (Subcontractor), Jane Smith (Witness)" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        {/* 📎 EVIDENCE: FORMS & PHOTOS */}
        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-4">Evidence (Photos & PDF Forms)</label>
          <div className="flex flex-wrap gap-3">
            
            <label className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-red-400 bg-slate-50">
              <span className="text-2xl text-slate-400 mb-1">+</span>
              <span className="text-[9px] font-black text-slate-400 uppercase">Attach</span>
              {/* Note: accept includes images AND pdfs for forms */}
              <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
            </label>
            
            {files.map((f, i) => (
              <div key={i} className="w-24 h-24 relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-white flex items-center justify-center">
                {f.type.includes('image') ? (
                  <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <div className="text-2xl mb-1">📄</div>
                    <div className="text-[8px] font-bold text-slate-500 truncate w-20">{f.name}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button type="submit" disabled={loading} className="w-full bg-red-600 text-white font-black py-6 rounded-[32px] shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] text-xs">
          {loading ? 'Transmitting...' : 'File Official Record'}
        </button>
        
        {status && <div className="text-center p-4 text-xs font-black text-red-600 tracking-widest uppercase bg-red-50 rounded-2xl animate-pulse">{status}</div>}
        
      </form>
    </div>
  )
}