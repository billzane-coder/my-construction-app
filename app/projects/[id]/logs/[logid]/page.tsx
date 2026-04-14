'use client'
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, HardHat, CloudRain, Clock, Loader2, FileCheck, Images, Plus, Minus, Trash2, Printer, Share2, Lock } from 'lucide-react'

export default function EditDailyLog() {
  const { id, logid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [project, setProject] = useState<any>(null) // Added to pull project name for PDF header
  
  const [date, setDate] = useState('')
  const [weather, setWeather] = useState('')
  const [workPerformed, setWorkPerformed] = useState('')
  const [signature, setSignature] = useState('')
  const [status, setStatus] = useState<'Draft'|'Final'>('Draft')
  const [photos, setPhotos] = useState<string[]>([])
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function initEditor() {
      if (!id || !logid) return
      
      const [cts, log, proj] = await Promise.all([
        supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id),
        supabase.from('daily_logs').select('*').eq('id', logid).single(),
        supabase.from('projects').select('*').eq('id', id).single() // Fetch project data
      ])

      if (proj.data) setProject(proj.data)

      if (cts.data && log.data) {
        setContacts(cts.data)
        setDate(log.data.log_date)
        setWeather(log.data.weather || '')
        setWorkPerformed(log.data.work_performed || '')
        setSignature(log.data.signature || '')
        setStatus(log.data.status || 'Draft')
        setPhotos(log.data.photo_urls || [])
        
        // PARSE SAVED MANPOWER STRING BACK INTO THE COUNTER BUTTONS
        const initial: Record<string, number> = {}
        const savedManpower = log.data.manpower || ''
        cts.data.forEach(c => {
          // Look for number before the company name in the string
          const safeCompany = c.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const match = savedManpower.match(new RegExp(`(\\d+)\\s+${safeCompany}`))
          initial[c.id] = match ? parseInt(match[1], 10) : 0
        })
        setTradeCounts(initial)
      }
      setLoading(false)
    }
    initEditor()
  }, [id, logid])

  const adjustCount = (contactId: string, amount: number) => {
    setTradeCounts(prev => ({ ...prev, [contactId]: Math.max(0, (prev[contactId] || 0) + amount) }))
  }

  const getManpowerString = () => {
    return contacts.filter(c => tradeCounts[c.id] > 0).map(c => `${tradeCounts[c.id]} ${c.company} (${c.trade_role})`).join(', ')
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    const path = `${id}/logs/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('project-files').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('project-files').getPublicUrl(path)
      setPhotos(prev => [...prev, data.publicUrl])
    }
    setUploading(false)
  }

  const saveUpdate = async (isFinal: boolean) => {
    setSaving(true)
    const payload = {
      log_date: date, weather, work_performed: workPerformed,
      manpower: getManpowerString(), status: isFinal ? 'Final' : 'Draft',
      signature: isFinal ? signature : signature, photo_urls: photos
    }
    const { error } = await supabase.from('daily_logs').update(payload).eq('id', logid)
    if (!error) {
      if (isFinal) { router.push(`/projects/${id}/logs`); router.refresh(); } 
      else { setStatus('Draft'); alert("Draft saved."); }
    }
    setSaving(false)
  }

  const deleteDraft = async () => {
    if(confirm("Are you sure you want to permanently delete this draft?")) {
      await supabase.from('daily_logs').delete().eq('id', logid)
      router.push(`/projects/${id}/logs`)
      router.refresh()
    }
  }

  const handleShare = async () => {
    const text = `Daily Log: ${date}\nWeather: ${weather}\nCrew: ${getManpowerString()}\nWork: ${workPerformed}`
    if (navigator.share) await navigator.share({ title: 'Daily Report', text })
    else { navigator.clipboard.writeText(text); alert('Copied to clipboard'); }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Record...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40 print:bg-white print:text-black print:pb-0" id="print-area">
      
     {/* 🖨️ PDF PRINT STYLES - Forces white background, clean margins, and disables scroll clipping */}
<style dangerouslySetInnerHTML={{__html: `
  @media print {
    @page { margin: 0.75in; size: portrait; }
    
    /* 1. Force the body and html to expand infinitely */
    html, body { 
      background: white !important; 
      height: auto !important; 
      min-height: 100% !important;
      overflow: visible !important; 
      position: static !important;
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
    }
    
    /* 2. Break out of the Next.js / React root container constraints */
    #__next, [data-reactroot], body > div {
      height: auto !important;
      overflow: visible !important;
      position: static !important;
      display: block !important;
    }

    /* 3. Hide scrollbars on the print output */
    ::-webkit-scrollbar { display: none; }
    
    /* 4. Ensure the print area breaks pages naturally */
    #print-area {
      height: auto !important;
      overflow: visible !important;
      page-break-inside: auto;
    }
  }
`}} />

      {/* 🖨️ FORMAL PDF HEADER (Hidden on Screen, Shows on Print) */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-8 mt-2">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Daily Site Report</h1>
            <p className="text-xs font-bold text-slate-500 uppercase mt-2 tracking-widest">{project?.name || 'Project Record'}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date of Record</p>
            <p className="text-lg font-black text-black">
              {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'No Date'}
            </p>
          </div>
        </div>
      </div>

      {/* 💻 APP UI HEADER (Shows on Screen, Hidden on Print) */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1"><ChevronLeft size={12}/> Back to Archive</button>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Edit <span className="text-blue-500">Log</span></h1>
            {status === 'Final' && <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><Lock size={10}/> Signed</span>}
          </div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={status === 'Final'} className="bg-slate-900 border border-slate-800 text-blue-400 font-black p-3 rounded-2xl outline-none disabled:opacity-50" />
      </div>

      <div className="space-y-6 print:space-y-6">
        
        {/* WEATHER */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5 print:break-inside-avoid">
          <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 gap-2"><CloudRain size={14} className="text-blue-500 print:text-slate-600"/> Site Weather</label>
          <input value={weather} onChange={(e) => setWeather(e.target.value)} disabled={status === 'Final'} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none disabled:opacity-50 print:hidden" />
          {/* 🖨️ PDF Output for Weather */}
          <div className="hidden print:block text-black font-semibold text-sm">{weather || 'No weather recorded.'}</div>
        </div>

        {/* MANPOWER */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5 print:break-inside-avoid">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4"><HardHat size={14} className="text-blue-500 print:text-slate-600"/> Manpower Headcount</label>
          
          <div className="print:hidden">
            {status === 'Draft' ? (
              <div className="space-y-3">
                {contacts.map(trade => (
                  <div key={trade.id} className="bg-slate-950 border border-slate-800/50 p-4 rounded-2xl flex items-center justify-between">
                    <div><p className="text-xs font-black text-white uppercase italic">{trade.company}</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{trade.trade_role}</p></div>
                    <div className="flex items-center gap-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => adjustCount(trade.id, -1)} className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:text-red-500"><Minus size={16} /></button>
                      <span className="text-xl font-black text-blue-400 w-6 text-center">{tradeCounts[trade.id] || 0}</span>
                      <button onClick={() => adjustCount(trade.id, 1)} className="w-10 h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-lg"><Plus size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white">
                {getManpowerString() || "No workers reported."}
              </div>
            )}
          </div>
          
          {/* 🖨️ PDF Output for Manpower (Always shows the compiled string) */}
          <div className="hidden print:block text-black font-semibold text-sm leading-relaxed">
            {getManpowerString() || "No workers reported on site today."}
          </div>
        </div>

        {/* WORK PERFORMED */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5 print:break-inside-avoid">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3"><Clock size={14} className="text-blue-500 print:text-slate-600"/> Work Performed</label>
          <textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} disabled={status === 'Final'} className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none disabled:opacity-50 print:hidden" />
          
          {/* 🖨️ PDF Output for Work (Expands automatically to fit all text without cutting off) */}
          <div className="hidden print:block text-black font-medium text-sm whitespace-pre-wrap leading-relaxed">
            {workPerformed || 'No work recorded.'}
          </div>
        </div>

        {/* SITE VISUALS */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-none print:p-0">
          <div className="flex justify-between items-center mb-4 print:border-b print:border-slate-300 print:pb-2 print:mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Images size={14} className="text-blue-500 print:text-slate-600"/> Site Visuals</label>
            {status === 'Draft' && (
              <label className="bg-blue-600/10 text-blue-400 border border-blue-600/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase cursor-pointer flex items-center gap-2 print:hidden">
                {uploading ? <Loader2 className="animate-spin" size={12}/> : <Plus size={12}/>} Add Photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handlePhotoUpload(f) }} />
              </label>
            )}
          </div>
          
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-3 gap-4">
              {photos.map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-800 print:border-slate-300 relative print:break-inside-avoid">
                  <img src={url} className="w-full h-full object-cover" />
                  {status === 'Draft' && <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg print:hidden"><Trash2 size={14}/></button>}
                </div>
              ))}
            </div>
          ) : (
            <div className="hidden print:block text-slate-400 text-xs font-bold uppercase tracking-widest italic">No photos attached to this report.</div>
          )}
        </div>

        {/* SIGNATURE */}
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-none print:p-0 print:mt-12 print:break-inside-avoid">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 print:hidden"><FileCheck size={14} className="text-blue-500"/> Superintendent Signature</label>
          <input value={signature} onChange={(e) => setSignature(e.target.value)} disabled={status === 'Final'} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black italic text-white outline-none disabled:opacity-50 print:hidden" />
          
          {/* 🖨️ PDF Output for Signature Line */}
          <div className="hidden print:flex flex-col w-72 mt-8">
             <div className="border-b border-black pb-2 px-2 min-h-[2rem]">
               <span className="font-black italic text-xl text-black">{signature}</span>
             </div>
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Authorized Site Superintendent</span>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS (Hidden during print) */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/90 border-t border-slate-800 p-4 backdrop-blur-md z-50 print:hidden">
        <div className="max-w-4xl mx-auto flex gap-4">
          {status === 'Draft' ? (
            <>
              <button onClick={deleteDraft} className="bg-red-950/50 text-red-500 border border-red-900/50 w-14 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
              <button onClick={() => saveUpdate(false)} disabled={saving || uploading} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all hover:bg-slate-700">{saving ? <Loader2 size={16} className="animate-spin mx-auto"/> : 'Save Draft'}</button>
              <button onClick={() => { if(!signature) return alert("Sign before finalizing."); saveUpdate(true); }} disabled={saving || uploading} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/20 transition-all hover:bg-emerald-500">Finalize</button>
            </>
          ) : (
            <>
              <button onClick={handleShare} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg hover:bg-blue-500"><Share2 size={16}/> Share</button>
              <button onClick={() => window.print()} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg hover:bg-slate-700"><Printer size={16}/> Export PDF</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}