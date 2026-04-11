'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AdvancedPunchlist() {
  const [projects, setProjects] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All Trades')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchData = async () => {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    if (projData) setProjects(projData)
    
    if (selectedProjectId) {
      const { data: itemData } = await supabase.from('site_punchlist')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: false })
      if (itemData) setItems(itemData)
    }
  }

  useEffect(() => { fetchData() }, [selectedProjectId])

  // EXPORT LOGIC: Generates a CSV for the current view
  const exportToCSV = () => {
    const filteredItems = tradeFilter === 'All Trades' 
      ? items 
      : items.filter(i => i.trade_type === tradeFilter)

    const headers = ['Location,Trade,Description,Assigned To,Status,Priority,Created\n']
    const rows = filteredItems.map(i => 
      `"${i.location}","${i.trade_type}","${i.task_description}","${i.assigned_to}","${i.status}","${i.priority}","${new Date(i.created_at).toLocaleDateString()}"`
    ).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Punchlist_${tradeFilter}_${new Date().toLocaleDateString()}.csv`
    a.click()
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    const photoFile = formData.get('photo') as File
    let photoUrl = ''

    if (photoFile && photoFile.size > 0) {
      setUploading(true)
      const fileName = `${Date.now()}-${photoFile.name}`
      const { data } = await supabase.storage.from('site-photos').upload(fileName, photoFile)
      if (data) {
        const { data: publicUrl } = supabase.storage.from('site-photos').getPublicUrl(fileName)
        photoUrl = publicUrl.publicUrl
      }
      setUploading(false)
    }

    await supabase.from('site_punchlist').insert([{
      project_id: selectedProjectId,
      trade_type: formData.get('trade_type'),
      task_description: formData.get('description'),
      location: formData.get('location'),
      assigned_to: formData.get('assigned_to'),
      priority: formData.get('priority'),
      photo_url: photoUrl
    }])

    e.target.reset()
    setLoading(false)
    fetchData()
  }

  const trades = ['All Trades', ...new Set(items.map(i => i.trade_type).filter(Boolean))]

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 pt-6 border-b-4 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Punch Manager</h1>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Trade-Based Accountability</p>
        </div>
        <div className="flex gap-2">
          {selectedProjectId && (
            <button onClick={exportToCSV} className="bg-green-600 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-md">Export CSV</button>
          )}
          <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase p-2">← Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* ADD DEFICIENCY FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-[32px] shadow-xl space-y-4 sticky top-6">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">New Entry</h2>
            
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required className="w-full p-4 bg-white/10 text-white border border-white/10 rounded-2xl text-sm font-bold outline-none">
              <option value="" className="text-slate-900">Select Project...</option>
              {projects.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}
            </select>

            <input name="trade_type" required placeholder="Trade (e.g. Drywall)" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none" />
            <input name="location" required placeholder="Location (Room/Floor)" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none" />
            <textarea name="description" required placeholder="The Deficiency..." className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none h-20" />
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Attach Photo</p>
              <input name="photo" type="file" accept="image/*" capture="environment" className="text-[10px] text-slate-300" />
            </div>

            <button type="submit" disabled={loading || uploading || !selectedProjectId} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-[10px]">
              {loading || uploading ? 'Syncing...' : 'Add to List'}
            </button>
          </form>
        </div>

        {/* LIST & FILTERING */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* TRADE FILTER TABS */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {trades.map(t => (
              <button 
                key={t} 
                onClick={() => setTradeFilter(t)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  tradeFilter === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {items.filter(i => tradeFilter === 'All Trades' || i.trade_type === tradeFilter).map(item => (
              <div key={item.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                {item.photo_url && (
                  <img src={item.photo_url} className="w-full md:w-32 h-32 rounded-2xl object-cover border border-slate-100" />
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg uppercase mr-2">{item.trade_type}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">{item.location}</span>
                    </div>
                    <p className="text-[9px] font-black text-slate-300 uppercase">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 leading-tight mb-4">{item.task_description}</h4>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Status: <span className="text-amber-600">{item.status}</span></p>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Ref: #{item.id.slice(0,5)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}