'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, ClipboardList, Camera, 
  MapPin, HardHat, Send, Loader2, Trash2, Plus 
} from 'lucide-react'

export default function NewPunchItem() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Data for trade dropdown
  const [trades, setTrades] = useState<any[]>([])
  
  // Form State
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    async function fetchTrades() {
      if (!id) return
      const { data } = await supabase
        .from('project_contacts')
        .select('company, trade_role')
        .eq('project_id', id)
      
      if (data) setTrades(data)
      setLoading(false)
    }
    fetchTrades()
  }, [id])

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${id}/punch-list/${Date.now()}-${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file)

    if (!uploadError) {
      const { data } = supabase.storage.from('project-files').getPublicUrl(filePath)
      setPhotos(prev => [...prev, data.publicUrl])
    } else {
      alert(`Upload failed: ${uploadError.message}`)
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description) return alert("Please describe the deficiency.")
    
    setSaving(true)
    
    const { error } = await supabase
      .from('punch_list')
      .insert([{
        project_id: id,
        description,
        location,
        assigned_to: assignedTo || 'Unassigned',
        status: 'Open',
        photo_urls: photos // Assuming column type is text[] or jsonb
      }])

    if (!error) {
      router.push(`/projects/${id}/punchlist`)
      router.refresh()
    } else {
      alert(`Error logging item: ${error.message}`)
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Initialising Field Audit...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
          <ChevronLeft size={12}/> Discard
        </button>
        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
          Log <span className="text-blue-500">Deficiency</span>
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* DESCRIPTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <ClipboardList size={14} className="text-blue-500"/> The Issue
          </label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="e.g. Drywall damage behind door, missing transition strip..." 
            className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none focus:border-blue-500 transition-all resize-none" 
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LOCATION */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <MapPin size={14} className="text-emerald-500"/> Location
            </label>
            <input 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Unit 402, Master Bath"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* ASSIGNED TRADE */}
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <HardHat size={14} className="text-amber-500"/> Assigned Trade
            </label>
            <select 
              value={assignedTo} 
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-amber-500 cursor-pointer appearance-none"
            >
              <option value="">Select Trade</option>
              {trades.map((t, idx) => (
                <option key={idx} value={t.company}>{t.company} ({t.trade_role})</option>
              ))}
              <option value="General">General / Site Super</option>
            </select>
          </div>
        </div>

        {/* VISUAL EVIDENCE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <Camera size={14} className="text-blue-500"/> Visual Evidence
            </label>
            <label className="bg-blue-600 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-blue-500 transition-all flex items-center gap-2">
              {uploading ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>}
              Add Photo
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handlePhotoUpload(f)
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((url, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-800 relative group">
                <img src={url} className="w-full h-full object-cover" alt="Deficiency" />
                <button 
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
            {photos.length === 0 && !uploading && (
              <div className="col-span-full py-8 border-2 border-dashed border-slate-800 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">No photos attached</p>
              </div>
            )}
          </div>
        </div>

      </form>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button 
            type="button" 
            onClick={() => router.back()} 
            disabled={saving} 
            className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={saving || uploading} 
            className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-500 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
            Create Punch Item
          </button>
        </div>
      </div>

    </div>
  )
}