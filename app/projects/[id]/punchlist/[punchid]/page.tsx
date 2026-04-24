'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, ClipboardList, CheckCircle2, 
  Trash2, Save, Loader2, MapPin, HardHat, Camera, X, Plus, Download 
} from 'lucide-react'

// --- 1. OFFSCREEN CANVAS COMPRESSOR ---
const getCompressedImage = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous' // Crucial for fetching Supabase URLs without CORS blocking
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const MAX_WIDTH = 800 // Crushes 4K/iPhone images down to email-friendly sizes
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
        // Draw white background to prevent transparent PNG black-box issues
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        // Compress to 60% quality JPEG
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      } else {
        resolve(null)
      }
    }
    
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export default function PunchItemDetail() {
  const { id, punchid } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  
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

  // --- 2. THE PDF GENERATOR ---
  const handleExportPDF = async () => {
    setExportingPdf(true)
    try {
      // Dynamically import jsPDF to avoid Next.js Server-Side Rendering errors
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      
      // Header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('PUNCH LIST ITEM', 15, 20)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Item ID: ${(punchid as string).slice(0,8)}`, 15, 28)
      doc.text(`Location: ${location || 'N/A'}`, 15, 33)
      doc.text(`Assigned To: ${assignedTo || 'TBD'}`, 15, 38)
      doc.text(`Status: ${status}`, 15, 43)
      
      doc.setLineWidth(0.5)
      doc.line(15, 48, 200, 48)

      // Description
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Description:', 15, 56)
      doc.setFont('helvetica', 'normal')
      const splitText = doc.splitTextToSize(description || 'No description provided.', 180)
      doc.text(splitText, 15, 62)

      // Photos (Compressed & Stitched)
      if (photos && photos.length > 0) {
        let yOffset = 70 + (splitText.length * 5)
        
        for (let i = 0; i < photos.length; i++) {
          const base64Img = await getCompressedImage(photos[i])
          
          if (base64Img) {
            // Page break if we run out of room
            if (yOffset > 200) { 
              doc.addPage()
              yOffset = 20 
            }
            
            // Print image (Centered, approx 120x120mm)
            doc.addImage(base64Img, 'JPEG', 48, yOffset, 120, 120, undefined, 'FAST')
            yOffset += 130
          }
        }
      }
      
      doc.save(`Deficiency_Report_${(punchid as string).slice(0,6)}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Failed to generate PDF report.")
    }
    setExportingPdf(false)
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
        <div className="flex gap-3">
          <button 
            onClick={handleExportPDF} 
            disabled={exportingPdf} 
            className="p-4 bg-slate-900 text-blue-500 border border-slate-800 rounded-2xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
            title="Export to PDF"
          >
            {exportingPdf ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
          </button>
          <button onClick={handleDelete} className="p-4 bg-red-950/20 text-red-500 border border-red-900/50 rounded-2xl hover:bg-red-600 hover:text-white transition-all" title="Delete Item">
            <Trash2 size={20} />
          </button>
        </div>
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