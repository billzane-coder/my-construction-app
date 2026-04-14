'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Share2, Printer, CheckCircle2, Circle, 
  Plus, Trash2, MapPin, HardHat, ChevronLeft,
  Camera, Loader2, AlertTriangle
} from 'lucide-react'

export default function ProjectPunchList() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [proj, punch, contacts] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('punch_list').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id)
    ])
    setProject(proj.data)
    setItems(punch.data || [])
    setTrades(contacts.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAddPunch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    
    // 1. Handle Photo Upload First (if attached)
    let photoUrl = null
    const file = (e.currentTarget.elements.namedItem('photo') as HTMLInputElement).files?.[0]
    
    if (file) {
      setUploading(true)
      const path = `${id}/punch/${Date.now()}-${file.name}`
      const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
      if (!sErr) {
        const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
        photoUrl = u.publicUrl
      }
      setUploading(false)
    }

    // 2. Build and Save the Ticket
    const newItem = {
      project_id: id,
      task: fd.get('task'),
      location: fd.get('location'),
      unit_number: fd.get('unit_number')?.toString().toUpperCase(), 
      trade_assigned: fd.get('trade_assigned'),
      priority: fd.get('priority'),
      photo_url: photoUrl, // Attach photo URL
      status: 'Open'
    }

    const { error } = await supabase.from('punch_list').insert([newItem])
    if (!error) {
      (e.target as HTMLFormElement).reset()
      fetchData()
    } else {
      alert(error.message)
    }
    setIsSaving(false)
  }

  const toggleStatus = async (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Open' ? 'Resolved' : 'Open'
    await supabase.from('punch_list').update({ status: newStatus }).eq('id', itemId)
    setItems(items.map(i => i.id === itemId ? { ...i, status: newStatus } : i))
  }

  const handleShare = async () => {
    const openItems = items.filter(i => i.status === 'Open')
    if (openItems.length === 0) return alert("No open items to share.")

    const shareText = `🏗️ PUNCH LIST: ${project?.name}\n` + 
      openItems.map(i => `• [${i.unit_number || 'GEN'}] ${i.task} (${i.trade_assigned})`).join('\n')

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${project?.name} - Punch List`,
          text: shareText,
        })
      } catch (e) { console.log('Share aborted') }
    } else {
      navigator.clipboard.writeText(shareText)
      alert("List copied to clipboard!")
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Punch List...</div>

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b-4 border-blue-600 pb-8 print:hidden">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Punch <span className="text-blue-500">Manager</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-3">Active Deficiencies: {items.filter(i => i.status === 'Open').length}</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleShare} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20">
            <Share2 size={16} /> Share List
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* NEW ITEM ENTRY FORM */}
      <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mb-10 shadow-2xl print:hidden">
        <form onSubmit={handleAddPunch} className="space-y-4">
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Deficiency Description</label>
            <input name="task" required placeholder="e.g. Damage to corner bead at bulk head" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500 transition-all" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Unit / Grid #</label>
              <input name="unit_number" placeholder="204B" onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black uppercase text-white outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Area / Room</label>
              <input name="location" placeholder="Master Ensuite" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-bold text-white outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Priority</label>
              <select name="priority" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black text-xs outline-none focus:border-blue-500 appearance-none text-white h-[58px]">
                <option value="Med" className="text-slate-400">Medium</option>
                <option value="Urgent" className="text-red-500">Urgent</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Assign Trade</label>
              <select name="trade_assigned" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl font-black uppercase text-[10px] outline-none focus:border-blue-500 h-[58px] appearance-none text-white cursor-pointer">
                <option value="">Select Subcontractor...</option>
                {trades.map(t => (
                  <option key={t.id} value={t.company}>{t.company} — {t.trade_role}</option>
                ))}
                <option value="General">General / PM</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <label className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black h-[58px] rounded-2xl uppercase text-[10px] tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {uploading ? 'Processing...' : 'Add Photo'}
                <input type="file" name="photo" accept="image/jpeg,image/png,image/jpg" className="hidden" />
              </label>
            </div>

            <button disabled={isSaving || uploading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-[58px] rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
              <Plus size={16} /> {isSaving ? 'Logging...' : 'Drop Ticket'}
            </button>
          </div>
        </form>
      </div>

      {/* THE PUNCH LIST */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className={`flex flex-col sm:flex-row gap-4 p-6 rounded-[24px] border transition-all ${item.status === 'Resolved' ? 'bg-slate-950/50 border-slate-900 opacity-50' : item.priority === 'Urgent' ? 'bg-slate-900 border-red-900/50 shadow-xl' : 'bg-slate-900 border-slate-800 shadow-xl'}`}>
            
            <div className="flex justify-between sm:justify-start items-start gap-4">
              <button onClick={() => toggleStatus(item.id, item.status)} className={`mt-1 transition-transform active:scale-90 ${item.status === 'Resolved' ? 'text-emerald-500' : 'text-slate-600 hover:text-blue-500'}`}>
                {item.status === 'Resolved' ? <CheckCircle2 size={32} /> : <Circle size={32} />}
              </button>
              
              {/* Photo Thumbnail */}
              {item.photo_url && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-800 flex-shrink-0 hidden sm:block">
                  <img src={item.photo_url} alt="Deficiency" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-blue-950/50 text-blue-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-900/30">
                  {item.unit_number || 'GEN'}
                </span>
                {item.priority === 'Urgent' && (
                  <span className="flex items-center gap-1 bg-red-950/30 text-red-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-900/30">
                    <AlertTriangle size={10} /> Urgent
                  </span>
                )}
              </div>
              
              <h3 className={`text-lg font-black uppercase italic leading-tight mb-2 ${item.status === 'Resolved' ? 'line-through text-slate-600' : 'text-white'}`}>
                {item.task}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">
                <span className="flex items-center gap-1.5"><HardHat size={12} className="text-blue-500"/> {item.trade_assigned}</span>
                {item.location && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-600"/> {item.location}</span>}
              </div>
            </div>

            <div className="flex sm:flex-col items-center justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 sm:pl-4 mt-2 sm:mt-0">
               {/* Show photo thumbnail on mobile bottom row if it exists */}
               {item.photo_url && (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-800 block sm:hidden">
                  <img src={item.photo_url} alt="Deficiency" className="w-full h-full object-cover" />
                </div>
              )}
              <button 
                onClick={async () => { if(confirm('Permanently delete this ticket?')) { await supabase.from('punch_list').delete().eq('id', item.id); fetchData(); } }}
                className="text-slate-700 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-800 ml-auto"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px]">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] italic">No Deficiencies Logged</p>
          </div>
        )}
      </div>

    </div>
  )
}