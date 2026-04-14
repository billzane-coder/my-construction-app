'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic' 

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Save, PenTool, ChevronLeft, 
  HardHat, CloudRain, Clock, Loader2, FileCheck, 
  Images, Plus, Trash2
} from 'lucide-react'

export default function NewDailyLog() {
  const { id } = useParams()
  const router = useRouter()
  
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Form Data
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [weather, setWeather] = useState('')
  const [workPerformed, setWorkPerformed] = useState('')
  const [manpower, setManpower] = useState('')
  const [signature, setSignature] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  // Photo Upload Logic (Android Optimized)
  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const path = `${id}/logs/${Date.now()}-${file.name}`
    
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    if (sErr) { 
      alert(`Upload failed: ${sErr.message}`)
      setUploading(false)
      return 
    }
    
    const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
    setPhotos(prev => [...prev, u.publicUrl])
    setUploading(false)
  }

  const removePhoto = (indexToRemove: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== indexToRemove))
  }

  const saveLog = async (isFinal: boolean) => {
    if (!id) return
    setSaving(true)
    
    const payload = {
      project_id: id,
      log_date: date,
      weather,
      work_performed: workPerformed,
      manpower,
      status: isFinal ? 'Final' : 'Draft',
      signature: isFinal ? signature : null,
      photo_urls: photos
    }

    const { data, error } = await supabase.from('daily_logs').insert([payload]).select().single()
    
    if (!error && data) {
      // Once saved, send them back to the Archive list
      router.push(`/projects/${id}/logs`)
      router.refresh()
    } else {
      alert(error?.message || "Failed to save log")
    }
    setSaving(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all flex items-center gap-1">
            <ChevronLeft size={12}/> Discard & Exit
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">New <span className="text-blue-500">Log</span></h1>
        </div>
        
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-blue-400 font-black p-3 rounded-2xl outline-none"
        />
      </div>

      {/* FORM AREA */}
      <div className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <CloudRain size={14} className="text-blue-500"/> Site Weather
            </label>
            <input 
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="e.g. 15C, Sunny"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <HardHat size={14} className="text-blue-500"/> Manpower Headcount
            </label>
            <input 
              value={manpower}
              onChange={(e) => setManpower(e.target.value)}
              placeholder="e.g. 12 Total (4 Tapers, 8 Painters)"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <Clock size={14} className="text-blue-500"/> Progress & Work Performed
          </label>
          <textarea 
            value={workPerformed}
            onChange={(e) => setWorkPerformed(e.target.value)}
            placeholder="What was completed today? Any delays?"
            className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-[24px] font-bold text-white outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* PROGRESS PHOTOS */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <Images size={14} className="text-blue-500"/> Site Photos
            </label>
            
            <label className="bg-blue-600/10 text-blue-400 border border-blue-600/30 text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
              {uploading ? <Loader2 className="animate-spin" size={12}/> : <Plus size={12}/>}
              {uploading ? 'Uploading...' : 'Add Visual'}
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/jpg" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0]; 
                  if(f) handlePhotoUpload(f)
                }} 
              />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((url, i) => (
              <div key={i} className="relative aspect-square group rounded-2xl overflow-hidden border border-slate-800">
                <img src={url} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removePhoto(i)}
                  className="absolute top-2 right-2 bg-red-600/90 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <PenTool size={14} className="text-blue-500"/> Superintendent Authorization
          </label>
          <input 
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type full name to sign off..."
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black italic text-white outline-none focus:border-blue-500"
          />
        </div>

      </div>

      {/* FIXED ACTION BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button 
            onClick={() => saveLog(false)}
            disabled={saving || uploading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>

          <button 
            onClick={() => {
              if(!signature) return alert("Please sign the report before finalizing.");
              saveLog(true);
            }}
            disabled={saving || uploading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
          >
            <FileCheck size={16} /> Finalize & Sign
          </button>
        </div>
      </div>

    </div>
  )
}