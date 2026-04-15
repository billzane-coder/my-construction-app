'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  ClipboardList, Search, CheckCircle2, 
  Download, Filter, Building2
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
      // Fetch all punch items and join the project name
      const { data } = await supabase
        .from('punch_list')
        .select('*, projects(name)')
        .order('created_at', { ascending: false })

      if (data) {
        setPunchItems(data)
        
        // Extract unique project names and trades for the dropdowns
        const projects = Array.from(new Set(data.map(item => item.projects?.name).filter(Boolean))) as string[]
        const trades = Array.from(new Set(data.map(item => item.assigned_to).filter(Boolean))) as string[]
        
        setUniqueProjects(projects)
        setUniqueTrades(trades)
      }
      setLoading(false)
    }
    fetchGlobalData()
  }, [])

  // --- FILTERING LOGIC ---
  const filteredItems = punchItems.filter(item => {
    const matchesSearch = 
      (item.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.location || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    const matchesProject = projectFilter === 'All' || item.projects?.name === projectFilter
    const matchesTrade = tradeFilter === 'All' || item.assigned_to === tradeFilter
    
    return matchesSearch && matchesStatus && matchesProject && matchesTrade
  })

  // --- CSV EXPORT LOGIC (Cross-Project) ---
  const exportToCSV = () => {
    const headers = ['Project', 'Status', 'Trade', 'Location', 'Description', 'Date Identified', 'Resolved Date']
    
    const csvRows = filteredItems.map(item => [
      `"${item.projects?.name || 'Unknown Project'}"`,
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

  // --- QUICK TOGGLE STATUS ---
  const toggleStatus = async (e: React.MouseEvent, item: any) => {
    e.preventDefault() 
    const newStatus = item.status === 'Open' ? 'Resolved' : 'Open'
    const resolvedAt = newStatus === 'Resolved' ? new Date().toISOString() : null
    
    // Optimistic UI update
    setPunchItems(prev => prev.map(p => p.id === item.id ? { ...p, status: newStatus, resolved_at: resolvedAt } : p))
    
    // Database update
    await supabase.from('punch_list').update({ status: newStatus, resolved_at: resolvedAt }).eq('id', item.id)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Compiling Global Records...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mt-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Global <span className="text-blue-500">Punch</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ClipboardList size={14} className="text-blue-500" /> Executive Overview
          </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={exportToCSV} className="flex-1 md:flex-none bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
            <Download size={14} /> Export Master CSV
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8 bg-slate-900/50 p-4 rounded-[32px] border border-slate-800">
        
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
          
          <div className="relative flex-1 md:w-48">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select 
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-5 pl-10 rounded-2xl text-[10px] font-black text-white outline-none uppercase tracking-widest appearance-none cursor-pointer"
            >
              <option value="All">All Projects</option>
              {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="relative flex-1 md:w-40">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select 
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-5 pl-10 rounded-2xl text-[10px] font-black text-amber-500 outline-none uppercase tracking-widest appearance-none cursor-pointer"
            >
              <option value="All">All Trades</option>
              {uniqueTrades.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:w-36 bg-slate-950 border border-slate-800 p-5 rounded-2xl text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest appearance-none cursor-pointer text-center"
          >
            <option value="Open">🔴 Open</option>
            <option value="Resolved">🟢 Resolved</option>
            <option value="All">Show All</option>
          </select>
        </div>
      </div>

      {/* PUNCH LIST DATA */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
            No punch items match your filters.
          </div>
        ) : (
          filteredItems.map(item => (
            <Link href={`/projects/${item.project_id}/punchlist/${item.id}`} key={item.id} className="block group">
              <div className={`bg-slate-900 p-5 rounded-[24px] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 hover:scale-[1.01] ${
                item.status === 'Resolved' ? 'border-emerald-900/30 opacity-75 hover:opacity-100' : 'border-slate-800 hover:border-blue-500'
              }`}>
                
                {/* QUICK TOGGLE BUTTON */}
                <button 
                  onClick={(e) => toggleStatus(e, item)}
                  className={`hidden md:flex flex-shrink-0 w-12 h-12 rounded-full border-2 items-center justify-center transition-all ${
                    item.status === 'Resolved' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-slate-950 border-slate-700 text-slate-700 hover:border-blue-500 hover:text-blue-500'
                  }`}
                >
                  {item.status === 'Resolved' ? <CheckCircle2 size={24} /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                </button>

                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span className="text-[9px] font-black px-2 py-1 rounded bg-blue-950 text-blue-400 uppercase tracking-widest border border-blue-900/50">
                      {item.projects?.name || 'Unknown Project'}
                    </span>
                    <span className="text-[9px] font-black px-2 py-1 rounded bg-slate-950 text-amber-500 uppercase tracking-widest border border-slate-800">
                      {item.assigned_to || 'Unassigned'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 italic ml-1">📍 {item.location || 'General Site'}</span>
                  </div>
                  <h3 className={`text-lg font-black uppercase tracking-tight ${item.status === 'Resolved' ? 'text-slate-400 line-through' : 'text-white'}`}>
                    {item.description}
                  </h3>
                </div>

                <div className="flex md:flex-col justify-between items-center md:items-end text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <span>Found: {new Date(item.created_at).toLocaleDateString()}</span>
                  {item.status === 'Resolved' && <span className="text-emerald-500">Fixed: {new Date(item.resolved_at).toLocaleDateString()}</span>}
                </div>

              </div>
            </Link>
          ))
        )}
      </div>

    </div>
  )
}