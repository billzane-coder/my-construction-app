'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export default function AdvancedPunchlist() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All Trades')
  const [viewFilter, setViewFilter] = useState('Active')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchData = async () => {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    if (projData) setProjects(projData)
    
    if (selectedProjectId) {
      const { data: itemData } = await supabase.from('site_punchlist')
        .select('*')
        .eq('project_id', selectedProjectId)
      
      if (itemData) {
        const priorityRank: any = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 }
        const sortedData = itemData.sort((a, b) => priorityRank[b.priority || 'Medium'] - priorityRank[a.priority || 'Medium'])
        setItems(sortedData)
      }
    }
  }

  useEffect(() => { fetchData() }, [selectedProjectId])

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Punch List')
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Trade', key: 'trade', width: 15 },
      { header: 'Description', key: 'desc', width: 65 },
      { header: 'Assigned To', key: 'assigned', width: 20 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ]
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } }

    items.forEach(item => {
      const row = worksheet.addRow({
        date: new Date(item.created_at).toLocaleDateString(),
        location: item.location,
        trade: item.trade_type,
        desc: item.task_description,
        assigned: item.assigned_to || 'Unassigned',
        priority: item.priority || 'Medium',
        status: item.status || 'Open'
      })
      const pCell = row.getCell(6); if (item.priority === 'Urgent') { pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000' } }; pCell.font = { color: { argb: 'FFFFFF' }, bold: true } }
      const sCell = row.getCell(7); if (item.status === 'Verified') { sCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '22C55E' } }; sCell.font = { color: { argb: 'FFFFFF' }, bold: true } }
    })
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `PunchList_Dark_${new Date().toLocaleDateString()}.xlsx`)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    const photoFile = formData.get('photo') as File
    let photoUrl = ''
    if (photoFile && photoFile.size > 0) {
      setUploading(true)
      const fileName = `punch/${Date.now()}-${photoFile.name}`
      const { data } = await supabase.storage.from('site-photos').upload(fileName, photoFile)
      if (data) photoUrl = supabase.storage.from('site-photos').getPublicUrl(fileName).data.publicUrl
      setUploading(false)
    }
    await supabase.from('site_punchlist').insert([{
      project_id: selectedProjectId,
      trade_type: formData.get('trade_type'),
      task_description: formData.get('description'),
      location: formData.get('location'),
      assigned_to: formData.get('assigned_to'),
      priority: formData.get('priority'),
      status: 'Open',
      photo_url: photoUrl
    }])
    e.target.reset(); setLoading(false); fetchData()
  }

  const updateStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Open' ? 'Fixed' : currentStatus === 'Fixed' ? 'Verified' : 'Open'
    await supabase.from('site_punchlist').update({ status: nextStatus }).eq('id', id)
    fetchData()
  }

  const filteredItems = items.filter(i => {
    const matchesTrade = tradeFilter === 'All Trades' || i.trade_type === tradeFilter
    const matchesView = viewFilter === 'Active' ? i.status !== 'Verified' : i.status === 'Verified'
    return matchesTrade && matchesView
  })

  const tradesList = ['All Trades', ...new Set(items.map(i => i.trade_type).filter(Boolean))]

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans pb-20 text-slate-100">
      
      {/* DARK HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pt-4 border-b-4 border-blue-600 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Punch Manager <span className="text-blue-500">PRO</span></h1>
          <div className="flex gap-4 mt-3">
            <button onClick={() => setViewFilter('Active')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${viewFilter === 'Active' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>Active Items</button>
            <button onClick={() => setViewFilter('Archived')} className={`text-[10px] font-black uppercase tracking-widest transition-all ${viewFilter === 'Archived' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-500'}`}>Archived (Closed)</button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedProjectId && (
            <>
              <button onClick={exportToExcel} className="bg-emerald-600 text-white text-[9px] font-black px-4 py-3 rounded-xl uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)]">Excel Export</button>
              <button onClick={() => router.push(`/punchlist/report?project=${selectedProjectId}`)} className="bg-blue-600 text-white text-[9px] font-black px-4 py-3 rounded-xl uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.2)]">PDF Report</button>
            </>
          )}
          <Link href="/dashboard" className="bg-slate-800 text-white border border-slate-700 text-[9px] font-black px-4 py-3 rounded-xl uppercase shadow-sm">← Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* SIDEBAR FORM (HIGH CONTRAST) */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-2xl space-y-4 sticky top-6">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Create New Entry</h2>
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} required className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              <option value="" className="text-white">Select Project...</option>
              {projects.map(p => <option key={p.id} value={p.id} className="text-white">{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="trade_type" required placeholder="Trade" className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-[11px] font-bold outline-none" />
              <input name="location" required placeholder="Location" className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-[11px] font-bold outline-none" />
            </div>
            <input name="assigned_to" placeholder="Assigned To" className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-sm font-bold outline-none" />
            <select name="priority" className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-sm font-bold outline-none">
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <textarea name="description" required placeholder="Description..." className="w-full p-4 bg-slate-800 text-white border border-slate-700 rounded-2xl text-sm font-bold outline-none h-24" />
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-center"><input name="photo" type="file" accept="image/*" capture="environment" className="text-[10px] text-slate-400 w-full" /></div>
            <button type="submit" disabled={loading || uploading || !selectedProjectId} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">Submit Entry</button>
          </form>
        </div>

        {/* LIST SECTION (DARK CARDS) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {tradesList.map(t => (
              <button key={t} onClick={() => setTradeFilter(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${tradeFilter === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}>{t}</button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredItems.map(item => (
              <div key={item.id} className={`bg-slate-900 p-6 rounded-[32px] border-2 shadow-xl flex flex-col md:flex-row gap-6 transition-all ${item.priority === 'Urgent' ? 'border-red-500/50 bg-red-950/10' : 'border-slate-800'}`}>
                {item.photo_url && <img src={item.photo_url} className="w-full md:w-44 h-44 rounded-2xl object-cover border border-slate-800" />}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2">
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${item.priority === 'Urgent' ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>{item.priority || 'Medium'}</span>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">{item.location}</span>
                      </div>
                      <p className="text-[9px] font-black text-slate-500 uppercase">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                    <h4 className="text-xl font-black text-white leading-tight mb-2 uppercase italic">{item.trade_type}: {item.task_description}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Lead: <span className="text-blue-400">{item.assigned_to || 'Pending'}</span></p>
                  </div>
                  
                  <div className="flex justify-between items-center pt-6 mt-4 border-t border-slate-800">
                    <button onClick={() => updateStatus(item.id, item.status)} className={`text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest transition-all shadow-lg ${
                      item.status === 'Verified' ? 'bg-emerald-600 text-white' : 
                      item.status === 'Fixed' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      Status: {item.status}
                    </button>
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">REF#{item.id.slice(0,8)}</p>
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