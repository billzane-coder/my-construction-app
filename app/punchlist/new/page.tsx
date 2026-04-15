'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, Camera, Send, Loader2, 
  Building2, HardHat, MapPin, ClipboardList, X 
} from 'lucide-react'

export default function NewOddBallPunch() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Selection Data
  const [projects, setProjects] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])

  // Form State
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('projects').select('id, name').order('name')
      if (data) setProjects(data)
      setLoading(false)
    }
    init()
  }, [])

  // When project changes, fetch the trades for THAT specific project
  useEffect(() => {
    async function fetchTrades() {
      if (!selectedProjectId) return
      const { data } = await supabase.from('project_contacts').select('company').eq('project_id', selectedProjectId)
      if (data) setTrades(data)
    }
    fetchTrades()
  }, [selectedProjectId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId || !description) return alert("Project and Description are required.")
    
    setSaving(true)
    let photoUrl = null

    // 1. Upload Photo if exists
    if (file) {
      const path = `${selectedProjectId}/punch-list/${Date.now()}-${file.name}`
      const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
      if (!sErr) {
        const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
        photoUrl = u.publicUrl
      }
    }

    // 2. Insert into Punch List
    const { error } = await supabase.from('punch_list').insert([{
      project_id: selectedProjectId,
      description,
      location,
      assigned_to: assignedTo,
      status: 'Open',
      photo_urls: photoUrl ? [photoUrl] : []
    }])

    if (!error) {
      router.push('/punchlist') // Go back to Global List
      router.refresh()
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Project Data...</div>

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-950 min-h-screen text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Cancel</button>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter">Log <span className="text-blue-500">Odd Ball</span></h1>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Global Deficiency Entry</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PROJECT SELECTOR (Crucial for Global Entry) */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border-2 border-blue-600/20 shadow-xl">
          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 block">1. Select Project Site</label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <select 
              value={selectedProjectId} 
              onChange={e => setSelectedProjectId(e.target.value)} 
              required 
              className="w-full bg-slate-950 border border-slate-800 p-5 pl-14 rounded-2xl font-black text-white outline-none focus:border-blue-500 appearance-none"
            >
              <option value="">Select Project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">2. Deficiency Description</label>
          <textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            required 
            placeholder="What needs to be fixed?" 
            className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none focus:border-blue-500 resize-none" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LOCATION */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic"><MapPin size={12} className="inline mr-1"/> Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Unit 304 - Master Bath" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
          </div>

          {/* TRADE */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block italic"><HardHat size={12} className="inline mr-1"/> Assigned Trade</label>
            <select 
              value={assignedTo} 
              onChange={e => setAssignedTo(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none"
              disabled={!selectedProjectId}
            >
              <option value="">Select Trade...</option>
              {trades.map((t, i) => <option key={i} value={t.company}>{t.company}</option>)}
              <option value="General">General / Site Super</option>
            </select>
          </div>
        </div>

        {/* PHOTO ATTACHMENT */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block italic">Attachment (Proof)</label>
          <div className="flex items-center gap-4">
            <label className="flex-1 bg-slate-950 border-2 border-dashed border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all">
              <Camera size={32} className="text-slate-700 mb-2" />
              <span className="text-[9px] font-black uppercase text-slate-500">Tap to snap or upload</span>
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
            {file && (
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-blue-500 relative">
                 <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                 <button onClick={() => setFile(null)} className="absolute top-1 right-1 bg-red-600 rounded-full p-1"><X size={10}/></button>
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT */}
        <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
          <div className="max-w-3xl mx-auto">
            <button 
              type="submit" 
              disabled={saving || !selectedProjectId} 
              className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Send size={16} />} 
              {saving ? 'Logging...' : 'File Deficiency'}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}