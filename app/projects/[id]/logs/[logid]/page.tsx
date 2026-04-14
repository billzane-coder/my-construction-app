'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Save, PenTool, Share2, ChevronLeft, 
  HardHat, CloudRain, Clock, Loader2, FileCheck, 
  Images, Plus, Trash2
} from 'lucide-react'

export default function DailyLogEditor() {
  const { id, logid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Form Data
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [weather, setWeather] = useState('')
  const [workPerformed, setWorkPerformed] = useState('')
  const [manpower, setManpower] = useState('')
  const [status, setStatus] = useState<'Draft' | 'Final'>('Draft')
  const [signature, setSignature] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    async function fetchLog() {
      if (!id) return
      
      // If we are creating a new log, stop loading and present the blank form
      if (logid === 'new') {
        setLoading(false)
        return
      }

      // Otherwise, fetch the existing log
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('id', logid)
        .single()

      if (data) {
        setDate(data.log_date || new Date().toISOString().split('T')[0])
        setWeather(data.weather || '')
        setWorkPerformed(data.work_performed || '')
        setManpower(data.manpower || '')
        setStatus(data.status || 'Draft')
        setSignature(data.signature || '')
        setPhotos(data.photo_urls || (data.photo_url ? [data.photo_url] : []))
      }
      setLoading(false)
    }
    fetchLog()
  }, [id, logid])

  // Photo Upload Logic
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
    setSaving(true)
    const newStatus = isFinal ? 'Final' : 'Draft'
    
    const payload = {
      project_id: id,
      log_date: date,
      weather,
      work_performed: workPerformed,
      manpower,
      status: newStatus,
      signature: isFinal ? signature : null,
      photo_urls: photos
    }

    if (logid === 'new') {
      const { data, error } = await supabase.from('daily_logs').insert([payload]).select().single()
      if (data) {
        router.push(`/projects/${id}/logs/${data.id}`) // Redirect to the newly created log ID
      } else if (error) {
        alert(error.message)
      }
    } else {
      await supabase.from('daily_logs').update(payload).eq('id', logid)
      setStatus(newStatus)
    }
    setSaving(false)
  }

  const handleShare = async () => {
    const photoText = photos.length > 0 ? `\nPhotos Attached: ${photos.length}` : ''
    const shareText = `Daily Log - ${date}\nWeather: ${weather}\nCrew: ${manpower}\nWork: ${workPerformed}${photoText}`
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Daily Site Log', text: shareText })
      } catch (err) { console.log('User canceled share', err) }
    } else {
      navigator.clipboard.writeText(shareText)
      alert('Log copied to clipboard!')
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Loading Form...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6">
        <button onClick={() => router.push(`/projects/${id}/logs`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all flex items-center gap-1">
          <ChevronLeft size={12}/> Back to Archive
        </button>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Daily <span className="text-blue-500">Log</span></h1>
            <div className="flex items-center gap-3 mt-4">
              <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${status === 'Draft' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {status} Record
              </span>
            </div>
          </div>
          
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={status === 'Final'}
            className="bg-slate-900 border border-slate-800 text-blue-400 font-black p-3 rounded-2xl outline-none disabled:opacity-50"
          />
        </div>
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
              disabled={status === 'Final'}
              placeholder="e.g. 15C, Sunny, Dry"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
              <HardHat size={14} className="text-blue-500"/> Manpower / Trades
            </label>
            <input 
              value={manpower}
              onChange={(e) => setManpower(e.target.value)}
              disabled={status === 'Final'}
              placeholder="e.g. 4 Tapers, 2 Framers"
              className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <Clock size={14} className="text-blue-500"/> Work Performed
          </label>
          <textarea 
            value={workPerformed}
            onChange={(e) => setWorkPerformed(e.target.value)}
            disabled={status === 'Final'}
            placeholder="Document daily progress, delays, or deliveries here..."
            className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-[24px] font-bold text-white outline-none focus:border-blue-500 resize-none disabled:opacity-50"
          />
        </div>

        {/* PROGRESS PHOTOS BLOCK */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <Images size={14} className="text-blue-500"/> Progress Photos
            </label>
            
            {status !== 'Final' && (
              <label className="bg-blue-600/10 text-blue-400 border border-blue-600/30 text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                {uploading ? <Loader2 className="animate-spin" size={12}/> : <Plus size={12}/>}
                {uploading ? 'Uploading...' : 'Add Photo'}
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/jpg,image/heic" 
                  className="hidden" 
                  onChange={(e) => {
                    const f = e.target.files?.[0]; 
                    if(f) handlePhotoUpload(f)
                  }} 
                />
              </label>
            )}
          </div>

          {photos.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest">
              No photos attached to this log.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square group rounded-2xl overflow-hidden border border-slate-800">
                  <img src={url} className="w-full h-full object-cover" />
                  {status !== 'Final' && (
                    <button 
                      onClick={() => removePhoto(i)}
                      className="absolute top-2 right-2 bg-red-600/90 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIGNATURE BLOCK */}
        <div className={`p-6 rounded-[32px] border transition-all ${status === 'Final' ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-slate-900/50 border-slate-800'}`}>
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            <PenTool size={14} className={status === 'Final' ? 'text-emerald-500' : 'text-blue-500'}/> Superintendent Signature
          </label>
          <input 
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            disabled={status === 'Final'}
            placeholder="Type name to sign..."
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black italic text-white outline-none focus:border-blue-500 disabled:opacity-50 disabled:text-emerald-400"
          />
        </div>

      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          
          {status === 'Draft' ? (
            <>
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
                  if(!signature) return alert("You must sign the log before finalizing.");
                  saveLog(true);
                }}
                disabled={saving || uploading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
              >
                <FileCheck size={16} /> Finalize & Sign
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setStatus('Draft')}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 hover:text-white transition-all"
              >
                Unlock Log
              </button>

              <button 
                onClick={handleShare}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
              >
                <Share2 size={16} /> Share Log
              </button>
            </>
          )}

        </div>
      </div>

    </div>
  )
}