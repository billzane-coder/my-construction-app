'use client'
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, HardHat, CloudRain, Clock, Loader2, 
  FileCheck, Images, Plus, Minus, Trash2 
} from 'lucide-react'

export default function NewDailyLog() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  
  // ✅ FIX: Local Timezone Safe Date Initialization
  const getLocalToday = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const [date, setDate] = useState(getLocalToday())
  const [weather, setWeather] = useState('Fetching local weather...')
  const [workPerformed, setWorkPerformed] = useState('')
  const [signature, setSignature] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function initForm() {
      if (!id) return
      const { data } = await supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id)
      if (data) {
        setContacts(data)
        const initial: Record<string, number> = {}
        data.forEach(c => initial[c.id] = 0)
        setTradeCounts(initial)
      }
      
      // AUTO-WEATHER FETCH
      try {
        const res = await fetch('https://wttr.in/?format="%C, %t, Wind %w"')
        const text = await res.text()
        setWeather(text.replace(/"/g, '').trim())
      } catch (err) {
        setWeather('') 
      }
      
      setLoading(false)
    }
    initForm()
  }, [id])

  const adjustCount = (contactId: string, amount: number) => {
    setTradeCounts(prev => ({ ...prev, [contactId]: Math.max(0, (prev[contactId] || 0) + amount) }))
  }

  const getManpowerString = () => {
    return contacts.filter(c => tradeCounts[c.id] > 0).map(c => `${tradeCounts[c.id]} ${c.company} (${c.trade_role})`).join(', ')
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const path = `${id}/logs/${Date.now()}-${file.name}`
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    if (!sErr) {
      const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
      setPhotos(prev => [...prev, u.publicUrl])
    }
    setUploading(false)
  }

  const saveLog = async (isFinal: boolean) => {
    setSaving(true)
    const payload = {
      project_id: id, 
      log_date: date, 
      weather, 
      work_performed: workPerformed,
      manpower: getManpowerString(), 
      status: isFinal ? 'Final' : 'Draft',
      signature: isFinal ? signature : null, 
      photo_urls: photos
    }
    const { error } = await supabase.from('daily_logs').insert([payload])
    if (!error) { 
      router.push(`/projects/${id}/logs`)
      router.refresh()
    } else { 
      alert(error.message)
      setSaving(false) 
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Form...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Discard</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">New <span className="text-blue-500">Log</span></h1>
        </div>
        <div className="flex flex-col items-end gap-2">
           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Report Date</label>
           <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-900 border border-slate-800 text-blue-400 font-black p-3 rounded-2xl outline-none [color-scheme:dark]" />
        </div>
      </div>

      <div className="space-y-6">
        {/* WEATHER SECTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 gap-2">
            <CloudRain size={14} className="text-blue-500"/> Site Weather
          </label>
          <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. 12C, Rain" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500" />
        </div>

        {/* MANPOWER SECTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4"><HardHat size={14} className="text-blue-500"/> Tap-to-Count Manpower</label>
          <div className="space-y-3">
            {contacts.map(trade => (
              <div key={trade.id} className="bg-slate-950 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                <div>
                   <p className="text-xs font-black text-white uppercase italic">{trade.company}</p>
                   <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{trade.trade_role}</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => adjustCount(trade.id, -1)} className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"><Minus size={16} /></button>
                  <span className="text-xl font-black text-blue-400 w-6 text-center">{tradeCounts[trade.id] || 0}</span>
                  <button onClick={() => adjustCount(trade.id, 1)} className="w-10 h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all"><Plus size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WORK PERFORMED */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3"><Clock size={14} className="text-blue-500"/> Work Performed</label>
          <textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} placeholder="Daily progress notes..." className="w-full h-32 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none focus:border-blue-500" />
        </div>

        {/* PHOTO SECTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Images size={14} className="text-blue-500"/> Site Visuals</label>
            <label className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase cursor-pointer flex items-center gap-2 hover:bg-blue-500 transition-all">
              {uploading ? <Loader2 className="animate-spin" size={12}/> : <Plus size={12}/>} 
              Add Photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handlePhotoUpload(f) }} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-800 relative group">
                <img src={url} className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* SIGNATURE SECTION */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><FileCheck size={14} className="text-blue-500"/> Superintendent Signature</label>
          <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type name to sign..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black italic text-white outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50">
        <div className="max-w-4xl mx-auto flex gap-4">
          <button onClick={() => saveLog(false)} disabled={saving || uploading} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-700 border border-slate-700">
            {saving ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Save Draft'}
          </button>
          <button onClick={() => { if(!signature) return alert("Sign before finalizing."); saveLog(true); }} disabled={saving || uploading} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 transition-all hover:bg-emerald-500">
            Finalize & Sign
          </button>
        </div>
      </div>
    </div>
  )
}