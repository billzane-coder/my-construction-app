'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  ClipboardList, Search, CheckCircle2, 
  Download, Filter, Building2, Plus, Printer, ArrowRight
} from 'lucide-react'

export default function GlobalPunchList() {
  const [punchItems, setPunchItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Derived filter options
  const [uniqueProjects, setUniqueProjects] = useState<string[]>([])
  const [uniqueTrades, setUniqueTrades] = useState<string[]>([])
  
  // Active Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Open')
  const [projectFilter, setProjectFilter] = useState('All')
  const [tradeFilter, setTradeFilter] = useState('All')

  useEffect(() => {
    async function fetchGlobalData() {
      const { data } = await supabase
        .from('punch_list')
        .select('*, projects(name)')
        .order('created_at', { ascending: false })

      if (data) {
        setPunchItems(data)
        const projects = Array.from(new Set(data.map(item => item.projects?.name).filter(Boolean))) as string[]
        const trades = Array.from(new Set(data.map(item => item.assigned_to).filter(Boolean))) as string[]
        setUniqueProjects(projects)
        setUniqueTrades(trades)
      }
      setLoading(false)
    }
    fetchGlobalData()
  }, [])

  const filteredItems = punchItems.filter(item => {
    const matchesSearch = 
      (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.location || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    const matchesProject = projectFilter === 'All' || item.projects?.name === projectFilter
    const matchesTrade = tradeFilter === 'All' || item.assigned_to === tradeFilter
    
    return matchesSearch && matchesStatus && matchesProject && matchesTrade
  })

  const exportToCSV = () => {
    const headers = ['Project', 'Status', 'Trade', 'Location', 'Description', 'Date Identified', 'Resolved Date']
    const csvRows = filteredItems.map(item => [
      `"${item.projects?.name || 'Unknown'}"`,
      item.status,
      `"${item.assigned_to || 'Unassigned'}"`,
      `"${item.location || 'General'}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
      new Date(item.created_at).toLocaleDateString(),
      item.resolved_at ? new Date(item.resolved_at).toLocaleDateString() : 'Pending'
    ])
    const csvContent = [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Global_Punch_List_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleStatus = async (e: React.MouseEvent, item: any) => {
    e.preventDefault() 
    const newStatus = item.status === 'Open' ? 'Resolved' : 'Open'
    const resolvedAt = newStatus === 'Resolved' ? new Date().toISOString() : null
    setPunchItems(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus, resolved_at: resolvedAt } : p))
    await supabase.from('punch_list').update({ status: newStatus, resolved_at: resolvedAt }).eq('id', item.id)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Compiling Global Records...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32 print:bg-white print:p-0" id="print-area">
      
      {/* 🖨️ NUCLEAR PRINT STYLES - Fixes Widths & Colors for PDF */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.5in; size: landscape; }
          html, body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .report-header { background: #000 !important; color: white !important; padding: 20px !important; border-radius: 8px !important; margin-bottom: 20px !important; -webkit-print-color-adjust: exact; }
          .punch-row { border-bottom: 1px solid #ddd !important; page-break-inside: avoid !important; }
          .status-open { color: #dc2626 !important; font-weight: 900 !important; }
          .status-resolved { color: #16a34a !important; font-weight: 900 !important; }
          .desc-cell { width: 40% !important; }
          .date-cell { width: 15% !important; }
        }
      `}} />

      {/* 🖨️ STYLED PDF HEADER (Print Only) */}
      <div className="hidden print:block report-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Master Deficiency Report</h1>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Filtered Global Overview • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{filteredItems.length}</p>
            <p className="text-[8px] font-black uppercase">Total Items</p>
          </div>
        </div>
      </div>

      {/* 💻 APP UI HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mt-4 print:hidden">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Global <span className="text-blue-500">Punch</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ClipboardList size={14} className="text-blue-500" /> Executive Command Center
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <button onClick={() => window.print()} className="flex-1 md:flex-none bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
            <Printer size={14} /> Print Report
          </button>
          <button onClick={exportToCSV} className="flex-1 md:flex-none bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase border border-slate-700 hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          <Link href="/punchlist/new" className="flex-1 md:flex-none bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
            <Plus size={14} /> Quick Log (Odd Ball)
          </Link>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8 bg-slate-900/50 p-4 rounded-[32px] border border-slate-800 print:hidden">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text"
            placeholder="Search items or locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 p-5 pl-14 rounded-2xl text-sm font-bold focus:border-blue-500 outline-none text-white placeholder:text-slate-600"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-4">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="flex-1 md:w-48 bg-slate-950 border border-slate-800 p-5 rounded-2xl text-[10px] font-black text-white outline-none uppercase tracking-widest appearance-none cursor-pointer">
            <option value="All">All Projects</option>
            {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} className="flex-1 md:w-40 bg-slate-950 border border-slate-800 p-5 rounded-2xl text-[10px] font-black text-amber-500 outline-none uppercase tracking-widest appearance-none cursor-pointer">
            <option value="All">All Trades</option>
            {uniqueTrades.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 md:w-36 bg-slate-950 border border-slate-800 p-5 rounded-2xl text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest appearance-none cursor-pointer text-center">
            <option value="Open">🔴 Open</option>
            <option value="Resolved">🟢 Resolved</option>
            <option value="All">Show All</option>
          </select>
        </div>
      </div>

      {/* PUNCH LIST DATA */}
      <div className="space-y-4">
        {/* Table Header (Visible on Print and Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-8 mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 print:text-black print:border-b-2 print:border-black print:pb-2">
          <div className="col-span-2">Project/Trade</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-5 desc-cell">Description / Location</div>
          <div className="col-span-2 date-cell">Logged</div>
          <div className="col-span-2 text-right print:hidden">Action</div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
            No punch items match your filters.
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="punch-row group">
              <div className={`bg-slate-900 md:bg-transparent p-6 md:p-2 rounded-[24px] md:rounded-none border md:border-0 md:border-b border-slate-800 md:border-slate-800/30 transition-all grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-blue-600/5 ${item.status === 'Resolved' ? 'opacity-60' : ''}`}>
                
                {/* 1. Project & Trade */}
                <div className="col-span-2">
                  <p className="text-[10px] font-black text-blue-500 uppercase truncate">{item.projects?.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{item.assigned_to || 'Unassigned'}</p>
                </div>

                {/* 2. Status Badge */}
                <div className="col-span-1 text-center">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${
                    item.status === 'Resolved' 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 status-resolved' 
                      : 'bg-red-500/10 text-red-500 border-red-500/30 status-open'
                  }`}>
                    {item.status}
                  </span>
                </div>

                {/* 3. Description (WIDER CELL) */}
                <div className="col-span-5 desc-cell">
                  <h3 className={`text-sm font-bold text-white print:text-black ${item.status === 'Resolved' ? 'line-through text-slate-500' : ''}`}>
                    {item.description}
                  </h3>
                  <p className="text-[10px] text-slate-500 italic">📍 {item.location || 'Site'}</p>
                </div>

                {/* 4. Dates (WIDER CELL) */}
                <div className="col-span-2 date-cell text-[10px] font-black uppercase text-slate-500 print:text-black">
                  <div className="flex items-center gap-2"><span className="opacity-50">In:</span> {new Date(item.created_at).toLocaleDateString()}</div>
                  {item.resolved_at && <div className="text-emerald-500 flex items-center gap-2"><span className="opacity-50 text-slate-500">Fix:</span> {new Date(item.resolved_at).toLocaleDateString()}</div>}
                </div>

                {/* 5. Actions */}
                <div className="col-span-2 flex justify-end gap-2 print:hidden">
                  <button 
                    onClick={(e) => toggleStatus(e, item)}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                      item.status === 'Resolved' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-blue-500 hover:text-blue-500'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <Link href={`/projects/${item.project_id}/punchlist/${item.id}`} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700">
                    <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}