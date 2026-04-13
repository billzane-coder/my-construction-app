'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Share2, Printer, CheckCircle2, Circle, 
  Plus, Trash2, MapPin, HardHat, ChevronLeft 
} from 'lucide-react'

export default function PunchManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
    
    const newItem = {
      project_id: id,
      task: fd.get('task'),
      location: fd.get('location'),
      // FORCED CAPS LOGIC
      unit_number: fd.get('unit_number')?.toString().toUpperCase(), 
      trade_assigned: fd.get('trade_assigned'),
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
          url: window.location.href
        })
      } catch (e) { window.print() }
    } else {
      navigator.clipboard.writeText(shareText)
      alert("List copied to clipboard!")
    }
  }

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Punch List...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-slate-800 pb-8 print:hidden">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Punch <span className="text-blue-500">Manager</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-3">Active Deficiencies: {items.filter(i => i.status === 'Open').length}</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleShare} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-blue-600 px-8 py-5 rounded-3xl text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20">
            <Share2 size={18} /> Share List
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-slate-900 border border-slate-800 px-8 py-5 rounded-3xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">
            <Printer size={18} /> Print
          </button>
        </div>
      </div>

      {/* NEW ITEM ENTRY FORM */}
      <div className="bg-slate-900/40 p-8 rounded-[40px] border border-slate-800/50 mb-12 shadow-2xl print:hidden backdrop-blur-sm">
        <form onSubmit={handleAddPunch} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Description of Deficiency</label>
              <input name="task" required placeholder="e.g. Damage to corner bead at bulk head" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Unit #</label>
                 <input 
                    name="unit_number" 
                    placeholder="204B" 
                    onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-black uppercase outline-none focus:border-blue-500" 
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Room / Area</label>
                 <input name="location" placeholder="Master Ensuite" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold outline-none focus:border-blue-500" />
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="md:col-span-3 space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">Assign to Registered Trade</label>
              <select name="trade_assigned" required className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-black uppercase text-xs outline-none focus:border-blue-500 h-[62px] appearance-none cursor-pointer">
                <option value="">Select Company...</option>
                {trades.map(t => (
                  <option key={t.id} value={t.company}>{t.company} — {t.trade_role}</option>
                ))}
                <option value="General">General / Site Crew</option>
              </select>
            </div>
            <button disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-[62px] rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center justify-center gap-3">
              <Plus size={18} /> {isSaving ? 'Filing...' : 'Deploy Item'}
            </button>
          </div>
        </form>
      </div>

      {/* THE PUNCH LIST */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-6 p-8 rounded-[32px] border transition-all ${item.status === 'Resolved' ? 'bg-slate-950 border-slate-900 opacity-40' : 'bg-slate-900 border-slate-800 shadow-xl'}`}>
            <button onClick={() => toggleStatus(item.id, item.status)} className={`transition-transform active:scale-90 ${item.status === 'Resolved' ? 'text-emerald-500' : 'text-slate-700 hover:text-blue-500'}`}>
              {item.status === 'Resolved' ? <CheckCircle2 size={36} /> : <Circle size={36} />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="bg-blue-950 text-blue-400 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter italic border border-blue-900/30">
                  {item.unit_number || 'GEN'}
                </span>
                <h3 className={`text-lg font-black uppercase italic truncate ${item.status === 'Resolved' ? 'line-through text-slate-600' : 'text-white'}`}>{item.task}</h3>
              </div>
              <div className="flex items-center gap-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <span className="flex items-center gap-2"><HardHat size={14} className="text-blue-500"/> {item.trade_assigned}</span>
                {item.location && <span className="flex items-center gap-2"><MapPin size={14} className="text-slate-700"/> {item.location}</span>}
              </div>
            </div>

            <button 
              onClick={async () => { if(confirm('Delete item?')) { await supabase.from('punch_list').delete().eq('id', item.id); fetchData(); } }}
              className="text-slate-800 hover:text-red-600 transition-colors p-3"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-32 border-4 border-dashed border-slate-900 rounded-[60px]">
            <p className="text-xs font-black text-slate-700 uppercase tracking-[0.5em] italic">No Active Deficiencies</p>
          </div>
        )}
      </div>
      
      {/* PDF PRINT LOGIC */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-slate-950, .bg-slate-900 { background: white !important; color: black !important; border-color: #eee !important; }
          .text-slate-100, .text-white, .text-blue-400 { color: black !important; }
          button, .print\\:hidden, form { display: none !important; }
          .rounded-\\[32px\\] { border-radius: 0 !important; border-bottom: 1px solid #ddd !important; padding: 20px 0 !important; }
        }
      `}</style>

    </div>
  )
}