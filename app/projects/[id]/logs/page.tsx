'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
// Added Images, X, and Loader icons
import { Share2, Printer, CloudSun, HardHat, Plus, History, MapPin, Send, CheckCircle, PenLine, Images, X, Loader2 } from 'lucide-react'

export default function DailyLogManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // --- FORM STATE (Now includes photo_urls) ---
  const [formData, setFormData] = useState({
    work_performed: '',
    weather: '',
    crew_size: '',
    notes: '',
    status: 'Draft',
    photo_urls: [] as string[]
  })
  const [currentLogId, setCurrentLogId] = useState<string | null>(null)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [proj, logData] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('created_at', { ascending: false })
    ])
    
    setProject(proj.data)
    const allLogs = logData.data || []
    setLogs(allLogs)

    // Draft Loading Logic
    const today = new Date().toLocaleDateString()
    const latest = allLogs[0]
    if (latest && latest.status === 'Draft' && new Date(latest.created_at).toLocaleDateString() === today) {
      setCurrentLogId(latest.id)
      setFormData({
        work_performed: latest.work_performed || '',
        weather: latest.weather || '',
        crew_size: latest.crew_size || '',
        notes: latest.notes || '',
        status: 'Draft',
        photo_urls: latest.photo_urls || []
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  // --- PHOTO UPLOAD LOGIC ---
  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${id}/logs/${fileName}`

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, file)
    if (uploadError) { alert("Upload error: " + uploadError.message); setUploadingPhoto(false); return }

    // 2. Get Public URL
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath)
    
    // 3. Update Form State (Add new URL to array)
    setFormData(prev => ({...prev, photo_urls: [...prev.photo_urls, urlData.publicUrl]}))
    setUploadingPhoto(false)
  }

  const removePhoto = (urlToRemove: string) => {
    setFormData(prev => ({...prev, photo_urls: prev.photo_urls.filter(url => url !== urlToRemove)}))
    // Note: In production, you'd also want to delete the file from Supabase storage here.
  }

  // --- SAVE DRAFT OR FINALIZE ---
  const handleSave = async (finalize = false) => {
    if (!formData.work_performed) { alert("Describe work performed."); return }
    setIsSaving(true)
    
    const payload = {
      project_id: id,
      ...formData,
      crew_size: formData.crew_size || 0,
      status: finalize ? 'Finalized' : 'Draft',
      signed_by: finalize ? 'Bill Z.' : null,
      location_name: project?.address || project?.location
    }

    let error;
    if (currentLogId) {
      const { error: updateErr } = await supabase.from('daily_logs').update(payload).eq('id', currentLogId)
      error = updateErr
    } else {
      const { data, error: insertErr } = await supabase.from('daily_logs').insert([payload]).select()
      error = insertErr
      if (data) setCurrentLogId(data[0].id)
    }

    if (!error) {
      if (finalize) {
        setFormData({ work_performed: '', weather: '', crew_size: '', notes: '', status: 'Draft', photo_urls: [] })
        setCurrentLogId(null)
      }
      fetchData()
    } else {
      alert("Error saving: " + error.message)
    }
    setIsSaving(false)
  }

  const handleShare = async (log: any) => {
    const shareBody = `
🏗️ DAILY REPORT: ${project?.name}
📅 Date: ${new Date(log.created_at).toLocaleDateString()}
👷 Crew: ${log.crew_size} | 🌦️ Weather: ${log.weather}
✍️ Signed by ${log.signed_by || 'Unsigned'}

WORK PERFORMED:
${log.work_performed}

NOTES:
${log.notes || 'No notes.'}
📸 Attached: ${log.photo_urls?.length || 0} Photos
    `.trim()

    if (navigator.share) {
      try {
        await navigator.share({ title: `Report - ${project?.name}`, text: shareBody, url: window.location.href })
      } catch (e) { window.print() }
    } else {
      navigator.clipboard.writeText(shareBody); alert("Copied to clipboard!")
    }
  }

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Syncing Field Logs...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-slate-800 pb-8 print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white transition-all">← War Room</button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Daily <span className="text-blue-500">Logs</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">Project: {project?.name}</p>
        </div>
        <button onClick={() => window.print()} className="bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all"><Printer size={16} /> Print</button>
      </div>

      {/* ACTIVE LOG FORM (THE "WORKBENCH") */}
      <div className="bg-slate-900/50 p-8 rounded-[40px] border-2 border-blue-600/20 mb-12 shadow-2xl print:hidden relative overflow-hidden">
        {formData.status === 'Draft' && (
          <div className="absolute top-4 right-8 flex items-center gap-2 bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20 animate-pulse">
            <PenLine size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Active Draft</span>
          </div>
        )}

        <div className="space-y-6">
          {/* WEATHER & CREW */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Weather Condition</label>
               <input value={formData.weather} onChange={(e) => setFormData({...formData, weather: e.target.value})} placeholder="Sunny / 18°C" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-sm" />
             </div>
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Crew Size</label>
               <input type="number" value={formData.crew_size} onChange={(e) => setFormData({...formData, crew_size: e.target.value})} placeholder="0" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-sm" />
             </div>
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Location Context</label>
               <input disabled value={project?.address || project?.location} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl font-bold text-sm opacity-50 cursor-not-allowed" />
             </div>
          </div>

          {/* WORK PERFORMED */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Work Performed Today</label>
            <textarea value={formData.work_performed} onChange={(e) => setFormData({...formData, work_performed: e.target.value})} required rows={3} placeholder="List today's installs..." className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-sm" />
          </div>

          {/* NOTES */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Site Notes / Delays</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={2} placeholder="Any delays or issues?" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-sm" />
          </div>

          {/* --- PHOTO UPLOAD ZONE (NEW) --- */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Progress Photos (Gallery or Camera)</label>
            
            {/* PHOTO PREVIEWS */}
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {formData.photo_urls.map(url => (
                <div key={url} className="relative aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                  <img src={url} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(url)} className="absolute top-1 right-1 bg-red-600/80 p-1.5 rounded-full text-white"><X size={12}/></button>
                </div>
              ))}
              {/* UPLOAD BUTTON */}
              <label className="relative aspect-square bg-slate-950 rounded-xl overflow-hidden border-2 border-dashed border-slate-800 hover:border-blue-500 transition-all cursor-pointer flex flex-col items-center justify-center text-slate-600 hover:text-blue-500">
                {uploadingPhoto ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <> <Images size={20}/> <span className="text-[8px] font-black uppercase mt-1">Add Photo</span> </>
                )}
                {/* GALLERY ACCESS ENABLED (removed capture="environment") */}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handlePhotoUpload(f) }} />
              </label>
            </div>
          </div>

          {/* SAVE ACTIONS */}
          <div className="flex gap-4 pt-6 border-t border-slate-800">
            <button onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest">
              {isSaving ? 'Syncing...' : 'Save Draft'}
            </button>
            <button onClick={() => handleSave(true)} disabled={isSaving} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Finalize & Sign
            </button>
          </div>
        </div>
      </div>

      {/* LOG HISTORY */}
      <div className="space-y-6">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-6">Verified History</h2>
        {logs.map((log) => (
          <div key={log.id} className={`bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-xl relative ${log.status === 'Draft' ? 'opacity-70 grayscale' : ''}`}>
            {log.status === 'Finalized' && (
              <button onClick={() => handleShare(log)} className="absolute top-8 right-8 p-3 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"><Share2 size={18} /></button>
            )}
            
            {/* Header info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg">
                  {new Date(log.created_at).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-2">📍 {log.location_name}</p>
              </div>
              <div className="text-right mr-12">
                <p className="text-[10px] font-black text-white uppercase italic">{log.weather}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Crew: {log.crew_size}</p>
              </div>
            </div>

            {/* Work Performed & Notes */}
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-200 leading-relaxed">{log.work_performed}</p>
              {log.notes && <p className="text-xs font-medium text-slate-500 italic border-t border-slate-800 pt-4">{log.notes}</p>}
              
              {/* --- PHOTO GALLERY IN HISTORY (NEW) --- */}
              {log.photo_urls && log.photo_urls.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3 pt-6 border-t border-slate-800">
                  {log.photo_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" className="relative aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-inner group">
                      <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </a>
                  ))}
                </div>
              )}

              {log.signed_by && (
                <div className="flex items-center gap-2 text-[8px] font-black uppercase text-emerald-500 tracking-widest mt-6">
                  <CheckCircle size={10} /> Digitally Signed: {log.signed_by}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}