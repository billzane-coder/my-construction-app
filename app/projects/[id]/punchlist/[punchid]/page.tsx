'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, ClipboardList, CheckCircle2, 
  Trash2, Save, Loader2, MapPin, HardHat, Camera, X, Plus 
} from 'lucide-react'

export default function PunchItemDetail() {
  const { id, punchid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Data States
  const [item, setItem] = useState<any>(null)
  const [trades, setTrades] = useState<any[]>([])
  
  // Form States (Editable)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [status, setStatus] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    async function init() {
      if (!id || !punchid) return
      
      const [punch, cts] = await Promise.all([
        supabase.from('punch_list').select('*').eq('id', punchid).single(),
        supabase.from('project_contacts').select('company, trade_role').eq('project_id', id)
      ])

      if (punch.data) {
        const d = punch.data
        setItem(d)
        setDescription(d.description || '')
        setLocation(d.location || '')
        setAssignedTo(d.assigned_to || '')
        setStatus(d.status || 'Open')
        setPhotos(d.photo_urls || [])
      }
      if (cts.data) setTrades(cts.data)
      
      setLoading(false)
    }
    init()
  }, [id, punchid])

  const handleUpdate = async (newStatus?: string) => {
    setSaving(true)
    const finalStatus = newStatus || status
    const resolvedAt = finalStatus === 'Resolved' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('punch_list')
      .update({
        description,
        location,
        assigned_to: assignedTo,
        status: finalStatus,
        photo_urls: photos,
        resolved_at: resolvedAt
      })
      .eq('id', punchid)

    if (!error) {
      if (newStatus === 'Resolved') {
        router.push(`/projects/${id}/punchlist`)
        router.refresh()
      } else {
        alert("Record Updated")
      }
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (confirm("Permanently remove this deficiency from the record?")) {
      await supabase.from('punch_list').delete().eq('id', punchid)
      router.push(`/projects/${id}/punchlist`)
      router.refresh()
    }
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const path = `${id}/punch-list/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('project-files').upload(path, file)
    
    if (!error) {
      const { data } = supabase.storage.from('project-files').getPublicUrl(path)
      setPhotos(prev => [...prev, data.publicUrl])
    }
    setUploading(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Retrieving File...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1">
            <ChevronLeft size={12}/> Back to Punch List
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Item <span className="text-blue-500">Detail</span>
          </h1>
        </div>
        <button onClick={handleDelete} className="p-4 bg-red-950/20 text-red-500 border border-red-900/50 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="space-y-6">
        
        {/* DESCRIPTION & STATUS */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <ClipboardList size={14} className="text-blue-500"/> Deficiency Description
            </label>
            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase border ${
              status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'
            }`}>
              {status}
            </span>
          </div>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none focus:border-blue-500 transition-all resize-none leading-relaxed"
          />
        </div>

        {/* ASSIGNMENT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <MapPin size={14} className="text-emerald-500"/> Location
            </label>
            <input 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <HardHat size={14} className="text-amber-500"/> Responsible Trade
            </label>
            <select 
              value={assignedTo} 
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none appearance-none cursor-pointer"
            >
              {trades.map((t, i) => <option key={i} value={t.company}>{t.company}</option>)}
              <option value="General">General / Site Super</option>
              <option value="Unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* PHOTO GALLERY */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <Camera size={14} className="text-blue-500"/> Photo Evidence
            </label>
            <label className="bg-slate-800 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-slate-700 transition-all flex items-center gap-2">
              {uploading ? <Loader2 size={12} className="animate-spin"/> : <Plus size={12}/>} Add Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
            </label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((url, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-800 relative group">
                <img src={url} className="w-full h-full object-cover" alt="Deficiency" />
                <button 
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button 
            onClick={() => handleUpdate()} 
            disabled={saving} 
            className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Edits
          </button>
          
          <button 
            onClick={() => handleUpdate('Resolved')} 
            disabled={saving || status === 'Resolved'} 
            className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-800"
          >
            <CheckCircle2 size={18}/> 
            {status === 'Resolved' ? 'Item Resolved' : 'Mark as Resolved'}
          </button>
        </div>
      </div>

    </div>
  )
}