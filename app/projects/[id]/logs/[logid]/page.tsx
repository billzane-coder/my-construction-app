'use client'
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, HardHat, CloudRain, Clock, Loader2, FileCheck, Images, Plus, Minus, Trash2, Printer, Share2, Lock, Unlock } from 'lucide-react'

// --- 🛠️ BULLETPROOF MOBILE COMPRESSION ENGINE (FOR DB UPLOAD) ---
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200 
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
        }

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Canvas compression failed'))
          },
          'image/jpeg',
          0.7 
        )
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

// --- 📉 OFFLINE PDF IMAGE COMPRESSOR (RESOLUTION INCREASED) ---
const getCompressedImageForPDF = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Bumped from 600 to 1000 for sharper PDF photos without ballooning file size
      const MAX_WIDTH = 1000 
      let width = img.width
      let height = img.height

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width
        width = MAX_WIDTH
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        // Bumped quality to 75% for cleaner visuals
        resolve(canvas.toDataURL('image/jpeg', 0.75)) 
      } else {
        resolve(null)
      }
    }
    
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export default function EditDailyLog() {
  const { id, logid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [project, setProject] = useState<any>(null)
  
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
        supabase.from('projects').select('*').eq('id', id).single()
      ])

      if (proj.data) setProject(proj.data)

      if (cts.data && log.data) {
        setContacts(cts.data)
        setDate(log.data.log_date)
        setWorkPerformed(log.data.work_performed || '')
        setSignature(log.data.signature || '')
        setStatus(log.data.status || 'Draft')
        setPhotos(log.data.photo_urls || [])
        
        let loadedWeather = log.data.weather || ''
        if (!loadedWeather && log.data.log_date) {
          try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=44.3894&longitude=-79.6903&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=America%2FToronto&start_date=${log.data.log_date}&end_date=${log.data.log_date}`)
            const wData = await res.json()
            if (wData?.daily) {
              const max = wData.daily.temperature_2m_max[0]
              const min = wData.daily.temperature_2m_min[0]
              const code = wData.daily.weathercode[0]
              
              const conditions: Record<number, string> = { 
                0:'Clear', 1:'Mainly Clear', 2:'Partly Cloudy', 3:'Overcast', 45:'Fog', 
                51:'Light Drizzle', 61:'Light Rain', 63:'Rain', 71:'Light Snow', 73:'Snow', 95:'Thunderstorm' 
              }
              const condDesc = conditions[code] || 'Mixed Conditions'
              loadedWeather = `${condDesc}, High ${Math.round(max)}°C / Low ${Math.round(min)}°C`
            }
          } catch (e) {
            console.error("Weather fetch failed:", e)
          }
        }
        setWeather(loadedWeather)
        
        const initial: Record<string, number> = {}
        const savedManpower = log.data.manpower || ''
        cts.data.forEach(c => {
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

  const handleMultiPhotoUpload = async (files: File[]) => {
    setUploading(true)
    try {
      const newUrls: string[] = []
      
      for (const file of files) {
        const compressedBlob = await compressImage(file)
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9]/g, '_') : 'photo'
        const path = `${id}/logs/${Date.now()}-${safeName}.jpg`
        
        const { error } = await supabase.storage.from('project-files').upload(path, compressedBlob, {
          contentType: 'image/jpeg'
        })
        
        if (!error) {
          const { data } = supabase.storage.from('project-files').getPublicUrl(path)
          newUrls.push(data.publicUrl)
        }
      }
      
      if (newUrls.length > 0) setPhotos(prev => [...prev, ...newUrls])
    } catch (err) {
      alert("Failed to compress and upload image(s).")
    }
    setUploading(false)
  }

  const saveUpdate = async (isFinal: boolean) => {
    setSaving(true)
    const payload = {
      log_date: date, weather, work_performed: workPerformed,
      manpower: getManpowerString(), status: isFinal ? 'Final' : 'Draft',
      signature: signature, photo_urls: photos
    }
    const { error } = await supabase.from('daily_logs').update(payload).eq('id', logid)
    if (!error) {
      if (isFinal) { router.push(`/projects/${id}/logs`); router.refresh(); } 
      else { setStatus('Draft'); alert("Draft saved."); }
    }
    setSaving(false)
  }

  const handleUnlock = async () => {
    if (!confirm("Are you sure you want to unlock this log for editing?")) return
    setSaving(true)
    const { error } = await supabase.from('daily_logs').update({ status: 'Draft' }).eq('id', logid)
    if (!error) setStatus('Draft')
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

  // --- 🖨️ STYLIZED NATIVE PDF EXPORT ENGINE ---
  const handleExportPDF = async () => {
    setExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      
      // Top Accent Banner (Blue-600)
      doc.setFillColor(37, 99, 235) 
      doc.rect(0, 0, 216, 6, 'F') 

      // Header Title
      doc.setFontSize(24)
      doc.setTextColor(15, 23, 42) // Slate-900
      doc.setFont('helvetica', 'bold')
      doc.text('DAILY SITE REPORT', 15, 22)
      
      // Project Subtitle
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139) // Slate-500
      doc.text(project?.name?.toUpperCase() || 'PROJECT RECORD', 15, 28)
      
      // Right-Aligned Metadata Box
      const displayDate = date ? new Date(date + 'T12:00:00').toLocaleDateString() : 'N/A'
      
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text('Date:', 130, 22)
      doc.setFont('helvetica', 'normal')
      doc.text(displayDate, 145, 22)

      doc.setFont('helvetica', 'bold')
      doc.text('Weather:', 130, 28)
      doc.setFont('helvetica', 'normal')
      
      const weatherText = doc.splitTextToSize(weather || 'N/A', 50)
      doc.text(weatherText, 148, 28)

      // Divider Line
      doc.setDrawColor(226, 232, 240) // Slate-200
      doc.setLineWidth(0.5)
      doc.line(15, 36, 200, 36)

      // Manpower Section
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text('Manpower on Site', 15, 46)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105) // Slate-600
      const manpowerText = doc.splitTextToSize(getManpowerString() || 'None reported.', 180)
      doc.text(manpowerText, 15, 52)

      let yOffset = 58 + (manpowerText.length * 5)

      // Work Performed Section
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.text('Work Performed', 15, yOffset)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      const workText = doc.splitTextToSize(workPerformed || 'None reported.', 180)
      yOffset += 6
      doc.text(workText, 15, yOffset)

      yOffset += (workText.length * 5) + 10

      // Photos (Compressed & Stitched 2-up)
      if (photos && photos.length > 0) {
        doc.setFontSize(12)
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.text('Site Visuals', 15, yOffset)
        yOffset += 8
        
        let col = 0
        for (let i = 0; i < photos.length; i++) {
          if (yOffset > 200 && col === 0) { 
            doc.addPage()
            yOffset = 20 
          }

          const base64Img = await getCompressedImageForPDF(photos[i])
          if (base64Img) {
            const xPos = col === 0 ? 15 : 110
            // Draw a subtle border around the image
            doc.setDrawColor(203, 213, 225)
            doc.rect(xPos, yOffset, 90, 90)
            doc.addImage(base64Img, 'JPEG', xPos, yOffset, 90, 90, undefined, 'FAST')
            
            if (col === 1) {
              yOffset += 95
              col = 0
            } else {
              col = 1
            }
          }
        }
        if (col === 1) yOffset += 95 // bump down if row was unfinished
      }

      // Signature Block
      if (yOffset > 240) { doc.addPage(); yOffset = 20; }
      
      doc.setDrawColor(15, 23, 42)
      doc.setLineWidth(0.5)
      doc.line(15, yOffset + 15, 100, yOffset + 15)
      
      doc.setFontSize(16)
      doc.setTextColor(37, 99, 235) // Blue signature
      doc.setFont('helvetica', 'italic')
      doc.text(signature || 'Unsigned', 15, yOffset + 12)
      
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'bold')
      doc.text('AUTHORIZED SITE SUPERINTENDENT', 15, yOffset + 20)

      doc.save(`Daily_Log_${date}_${project?.name?.slice(0,6) || 'Export'}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Failed to generate PDF report.")
    }
    setExportingPdf(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Record...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-40 print:bg-white print:text-black print:pb-0" id="print-area">
      
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex justify-between items-end print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1"><ChevronLeft size={12}/> Back to Archive</button>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Edit <span className="text-blue-500">Log</span></h1>
            {status === 'Final' && (
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1"><Lock size={10}/> Signed</span>
                <button onClick={handleUnlock} disabled={saving} className="bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"><Unlock size={10}/> Unlock</button>
              </div>
            )}
          </div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={status === 'Final'} className="bg-slate-900 border border-slate-800 text-blue-400 font-black p-3 rounded-2xl outline-none disabled:opacity-50" />
      </div>

      <div className="space-y-6 print:space-y-6">
        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5">
          <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 gap-2 print:text-black print:mb-1"><CloudRain size={14} className="text-blue-500 print:hidden"/> Site Weather</label>
          <input value={weather} onChange={(e) => setWeather(e.target.value)} disabled={status === 'Final'} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none disabled:opacity-50 print:hidden" />
          <div className="hidden print:block text-black font-semibold text-sm">{weather || 'No weather recorded.'}</div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 print:text-black print:mb-1"><HardHat size={14} className="text-blue-500 print:hidden"/> Manpower Headcount</label>
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
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white">{getManpowerString() || "No workers reported."}</div>
            )}
          </div>
          <div className="hidden print:block text-black font-semibold text-sm leading-relaxed">{getManpowerString() || "No workers reported on site today."}</div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-slate-300 print:rounded-2xl print:p-5">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 print:text-black print:mb-1"><Clock size={14} className="text-blue-500 print:hidden"/> Work Performed</label>
          <textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} disabled={status === 'Final'} className="w-full h-40 bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold text-white outline-none resize-none disabled:opacity-50 print:hidden" />
          <div className="hidden print:block text-black font-medium text-sm whitespace-pre-wrap leading-relaxed">{workPerformed || 'No work recorded.'}</div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-none print:p-0">
          <div className="flex justify-between items-center mb-4 print:border-b print:border-slate-300 print:pb-2 print:mb-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 print:text-black"><Images size={14} className="text-blue-500 print:hidden"/> Site Visuals</label>
            {status === 'Draft' && (
              <label className="bg-blue-600/10 text-blue-400 border border-blue-600/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase cursor-pointer flex items-center gap-2 print:hidden">
                {uploading ? <Loader2 className="animate-spin" size={12}/> : <Plus size={12}/>} Add Photos
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => { 
                    if (e.target.files && e.target.files.length > 0) {
                      handleMultiPhotoUpload(Array.from(e.target.files))
                    }
                  }} 
                />
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
            <div className="hidden print:block text-slate-400 text-xs font-bold uppercase tracking-widest italic">No photos attached.</div>
          )}
        </div>

        <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 print:bg-white print:border-none print:p-0 print:mt-12">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 print:hidden"><FileCheck size={14} className="text-blue-500"/> Superintendent Signature</label>
          <input value={signature} onChange={(e) => setSignature(e.target.value)} disabled={status === 'Final'} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black italic text-white outline-none disabled:opacity-50 print:hidden" />
          <div className="hidden print:flex flex-col w-72 mt-8">
             <div className="border-b border-black pb-2 px-2 min-h-[2rem]"><span className="font-black italic text-xl text-black">{signature}</span></div>
             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 print:text-black">Authorized Site Superintendent</span>
          </div>
        </div>
      </div>

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
              <button 
                onClick={handleExportPDF} 
                disabled={exportingPdf}
                className="flex-1 bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {exportingPdf ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}