'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // 1. FETCH LOGIC WITH AUTOMATIC FALLBACK
  const fetchProjects = async () => {
    setLoading(true)
    console.log("📡 Initiating Project Sync...")

    // FIXED: Fetching the created_at column to calculate BOTH count and activity date
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        punch_list(created_at),
        site_inspections(created_at)
      `)
      .order('name', { ascending: true })

    if (error) {
      console.warn("⚠️ Smart Fetch blocked. Falling back to Simple Fetch.")
      
      const { data: simpleData, error: simpleError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true })

      if (simpleError) {
        console.error("❌ Simple Fetch Failed:", simpleError)
        alert(`DATABASE ERROR: ${simpleError.message}`)
      } else {
        setProjects(simpleData || [])
      }
    } else {
      // Process the Smart Data for the UI
      const processed = data.map(p => {
        // Calculate Last Activity Date
        const allDates = [
          p.created_at,
          ...(p.punch_list?.map((pl: any) => pl.created_at) || []),
          ...(p.site_inspections?.map((si: any) => si.created_at) || [])
        ].filter(Boolean)
        
        const lastActive = allDates.length > 0 
          ? new Date(Math.max(...allDates.map(d => new Date(d).getTime())))
          : null

        return { 
          ...p, 
          lastActive,
          // FIXED: Using the length of the returned arrays for accurate counts
          ticketCount: p.punch_list?.length || 0,
          auditCount: p.site_inspections?.length || 0
        }
      })
      setProjects(processed)
    }
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  // 2. SAVE NEW PROJECT LOGIC
  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const newProject = {
      name: formData.get('name') as string,
      location: formData.get('location') as string,
      status: formData.get('status') as string,
      description: formData.get('description') as string
    }

    const { error } = await supabase.from('projects').insert([newProject])

    if (!error) {
      setIsAdding(false)
      fetchProjects() 
    } else {
      alert(`SAVE ERROR: ${error.message}`)
    }
    setSaving(false)
  }

  // 3. FILTERING LOGIC
  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.location || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans pb-20 text-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pt-4 border-b-4 border-blue-600 pb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Project <span className="text-blue-500 underline decoration-4 underline-offset-8">Directory</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-4">
            SiteMaster Intelligence • Ontario Portfolio
          </p>
        </div>
        
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`text-[10px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
            isAdding ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
          }`}
        >
          {isAdding ? 'Cancel Initialization' : '+ New Job Site'}
        </button>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2 relative group">
          <input 
            type="text"
            placeholder="Search by project name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all pl-12 group-hover:border-slate-700"
          />
          <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-sm font-bold text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-slate-700 transition-all"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active Build</option>
          <option value="Pre-Con">Pre-Construction</option>
          <option value="Occupancy">Occupancy / PDI</option>
          <option value="Closed">Closed Out</option>
        </select>
      </div>

      {/* ADD FORM */}
      {isAdding && (
        <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-blue-600/30 shadow-2xl mb-12 animate-in fade-in zoom-in duration-200">
          <h2 className="text-[12px] font-black text-blue-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">Site Registration</h2>
          <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input name="name" required className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none" placeholder="Project Name" />
              <input name="location" required className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none" placeholder="City" />
            </div>
            <div className="space-y-4">
              <select name="status" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-bold text-blue-400 outline-none">
                <option value="Active">Active Build</option>
                <option value="Pre-Con">Pre-Construction</option>
                <option value="Occupancy">Occupancy / PDI</option>
                <option value="Closed">Closed Out</option>
              </select>
              <input name="description" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-bold focus:border-blue-500 outline-none" placeholder="Brief Description" />
            </div>
            <div className="md:col-span-2 flex justify-end pt-4">
               <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-12 rounded-2xl uppercase tracking-widest text-xs shadow-lg transition-all disabled:opacity-50">
                 {saving ? 'Initializing...' : 'Confirm Registration'}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* PROJECT GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Syncing Portfolio...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((p) => (
            <div key={p.id} className="bg-slate-900 rounded-[40px] border border-slate-800 hover:border-blue-500/50 transition-all p-8 flex flex-col group relative shadow-2xl hover:shadow-blue-900/10">
              
              <div className="flex justify-between items-start mb-6">
                <span className={`text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-[0.2em] border ${
                  p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  p.status === 'Closed' ? 'bg-slate-800 text-slate-500 border-slate-700' : 
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {p.status}
                </span>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Last Activity</p>
                  <p className="text-[10px] font-bold text-blue-400">
                    {p.lastActive ? new Date(p.lastActive).toLocaleDateString() : 'No Records'}
                  </p>
                </div>
              </div>

              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1 leading-none group-hover:text-blue-400 transition-colors">
                {p.name}
              </h3>
              <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest flex items-center gap-2">
                <span className="opacity-50">📍</span> {p.location}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-slate-950 p-4 rounded-[24px] border border-slate-800 text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Punch Items</p>
                  <p className="text-xl font-black text-white">{p.ticketCount || 0}</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-[24px] border border-slate-800 text-center">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Inspections</p>
                  <p className="text-xl font-black text-white">{p.auditCount || 0}</p>
                </div>
              </div>

              <Link 
                href={`/projects/${p.id}`}
                className="mt-auto bg-slate-800 hover:bg-blue-600 text-white font-black py-5 rounded-[24px] text-[10px] uppercase tracking-[0.3em] text-center transition-all shadow-xl group-hover:shadow-blue-500/40"
              >
                Enter War Room →
              </Link>
            </div>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[40px]">
              <p className="text-slate-500 font-black uppercase tracking-[0.4em]">No Sites Located</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}