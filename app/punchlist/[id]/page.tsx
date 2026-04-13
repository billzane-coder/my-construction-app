'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Share2, Printer, CheckCircle2, Circle, Plus, Trash2, MapPin, HardHat } from 'lucide-react'

export default function PunchManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = async () => {
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
      unit_number: fd.get('unit_number')?.toString().toUpperCase(), // Forced Caps
      trade_assigned: fd.get('trade_assigned'),
      status: 'Open'
    }

    const { error } = await supabase.from('punch_list').insert([newItem])
    if (!error) {
      (e.target as HTMLFormElement).reset()
      fetchData()
    }
    setIsSaving(false)
  }

  const toggleStatus = async (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Open' ? 'Resolved' : 'Open'
    await supabase.from('punch_list').update({ status: newStatus }).eq('id', itemId)
    setItems(items.map(i => i.id === itemId ? { ...i, status: newStatus } : i))
  }

  const handleShare = async () => {
    const shareText = items.map(i => `[${i.status}] ${i.unit_number || 'N/A'} - ${i.task} (${i.trade_assigned})`).join('\n')
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${project?.name} - Punch List`,
          text: shareText,
          url: window.location.href
        })
      } catch (e) { window.print() }
    } else { window.print() }
  }

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Punch List...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-slate-800 pb-8">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white transition-all">← Back to Site</button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Punch <span className="text-blue-500">Manager</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Active Deficiencies: {items.filter(i => i.status === 'Open').length}</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleShare} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">
            <Share2 size={16} /> Share List
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">
            <Printer size={16} /> Print PDF
          </button>
        </div>
      </div>

      {/* NEW ITEM ENTRY */}
      <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mb-12 shadow-2xl">
        <form onSubmit={handleAddPunch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 space-y-4">
            <input name="task" required placeholder="Description of Issue (e.g. Broken Corner Bead)" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold outline-none focus:border-blue-500 transition-all text-sm" />
            <div className="grid grid-cols-2 gap-4">
               <input 
                  name="unit_number" 
                  placeholder="UNIT #" 
                  onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-xl font-black uppercase outline-none focus:border-blue-500 text-sm placeholder:italic" 
               />
               <input name="location" placeholder="Room / Area" className="bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold outline-none focus:border-blue-500 text-sm" />
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-4">
            <select name="trade_assigned" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black uppercase text-xs outline-none focus:border-blue-500 h-[54px]">
              <option value="">Assign to Trade...</option>
              {trades.map(t => (
                <option key={t.id} value={t.company}>{t.company} ({t.trade_role})</option>
              ))}
              <option value="General">General/Site Crew</option>
            </select>
            <button disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl uppercase text-xs transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
              <Plus size={16} /> {isSaving ? 'Filing...' : 'Deploy Task'}
            </button>
          </div>
        </form>
      </div>

      {/* PUNCH LIST DATA */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-6 p-6 rounded-[28px] border transition-all ${item.status === 'Resolved' ? 'bg-slate-950 border-slate-900 opacity-60' : 'bg-slate-900 border-slate-800 shadow-xl'}`}>
            <button onClick={() => toggleStatus(item.id, item.status)} className={`transition-transform active:scale-90 ${item.status === 'Resolved' ? 'text-emerald-500' : 'text-slate-600 hover:text-blue-500'}`}>
              {item.status === 'Resolved' ? <CheckCircle2 size={32} /> : <Circle size={32} />}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="bg-blue-950 text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter italic">
                  {item.unit_number || 'GEN'}
                </span>
                <h3 className={`text-sm font-black uppercase italic ${item.status === 'Resolved' ? 'line-through text-slate-600' : 'text-white'}`}>{item.task}</h3>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-bold uppercase text-slate-500 tracking-widest">
                <span className="flex items-center gap-1"><HardHat size={10}/> {item.trade_assigned}</span>
                {item.location && <span className="flex items-center gap-1"><MapPin size={10}/> {item.location}</span>}
              </div>
            </div>

            <button 
              onClick={async () => { if(confirm('Delete task?')) { await supabase.from('punch_list').delete().eq('id', item.id); fetchData(); } }}
              className="text-slate-800 hover:text-red-500 transition-colors p-2"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-slate-900 rounded-[40px]">
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] italic">No active punch items</p>
          </div>
        )}
      </div>
      
      {/* PRINT-ONLY HEADER (Hidden in Browser) */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-slate-950, .bg-slate-900, .bg-slate-900\\/50 { background: white !important; color: black !important; border-color: #eee !important; }
          .text-slate-100, .text-white, .text-blue-400 { color: black !important; }
          button, .md\\:flex-none, form { display: none !important; }
          .rounded-\\[28px\\] { border-radius: 0 !important; border-bottom: 1px solid #ddd !important; }
        }
      `}</style>

    </div>
  )
}