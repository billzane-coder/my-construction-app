'use client'

// 1. This MUST be here once at the top level for Vercel
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Search, MapPin, Activity, ShieldAlert, ChevronRight, Loader2 } from 'lucide-react'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // 1. IMPROVED FETCH LOGIC
  const fetchProjects = async () => {
    setLoading(true)
    
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
      const { data: simpleData } = await supabase.from('projects').select('*').order('name', { ascending: true })
      setProjects(simpleData || [])
    } else {
      const processed = data.map(p => {
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
          ticketCount: p.punch_list?.length || 0,
          auditCount: p.site_inspections?.length || 0
        }
      })
      setProjects(processed)
    }
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  // 2. SAVE LOGIC
  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    
    const newProject = {
      name: formData.get('name') as string,
      location: formData.get('location') as string,
      address: formData.get('address') as string,
      status: formData.get('status') as string,
      description: formData.get('description') as string
    }

    const { error } = await supabase.from('projects').insert([newProject])

    if (!error) {
      setIsAdding(false)
      fetchProjects() 
    } else {
      alert(`DATABASE REJECTED: ${error.message}\nCheck your RLS Policies.`)
    }
    setSaving(false)
  }

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.location || '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen font-sans pb-32 text-slate-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b-4 border-blue-600 pb-10 gap-8">
        <div>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
            Build <span className="text-blue-500 underline decoration-8 underline-offset-8">Portfolio</span>
          </h1>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mt-6 flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> SiteMaster HQ • Barrie Operations
          </p>
        </div>
        
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`group flex items-center gap-3 text-[10px] font-black px-10 py-5 rounded-3xl uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${
            isAdding ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
          }`}
        >
          {isAdding ? <Plus className="rotate-45 transition-transform" /> : <Plus />}
          {isAdding ? 'Cancel Entry' : 'Register New Site'}
        </button>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Search by project name, city, or foreman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 p-6 pl-16 rounded-[28px] text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 backdrop-blur-sm"
          />
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-900/50 border border-slate-800 p-6 rounded-[28px] text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-blue-500 transition-all appearance-none text-center"
        >
          <option value="All">All Projects</option>
          <option value="Active">Active Build</option>
          <option value="Pre-Con">Pre-Con</option>
          <option value="Occupancy">Occupancy</option>
          <option value="Closed">Archive</option>
        </select>
      </div>

      {/* ADD FORM */}
      {isAdding && (
        <div className="bg-slate-900/80 p-10 rounded-[56px] border-2 border-blue-600/30 shadow-2xl mb-16 backdrop-blur-md animate-in slide-in-from-top duration-300">
          <form onSubmit={handleAddProject} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Project / Contract Name</label>
                <input name="name" required className="w-full p-5 bg-slate-950 border border-slate-800 rounded-3xl font-black uppercase text-white outline-none focus:border-blue-500" placeholder="e.g. The Wellington Phase II" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Job Status</label>
                <select name="status" className="w-full p-5 bg-slate-950 border border-slate-800 rounded-3xl font-black text-blue-500 uppercase outline-none h-[66px]">
                  <option value="Active">Active Build</option>
                  <option value="Pre-Con">Pre-Construction</option>
                  <option value="Occupancy">Occupancy / PDI</option>
                  <option value="Closed">Closed Out</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">City</label>
                <input name="location" required className="w-full p-5 bg-slate-950 border border-slate-800 rounded-3xl font-bold" placeholder="Barrie" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Full Site Address (For Reports)</label>
                <input name="address" required className="w-full p-5 bg-slate-950 border border-slate-800 rounded-3xl font-bold" placeholder="123 Construction Way, L4M..." />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-4 tracking-widest">Scope / Description</label>
              <input name="description" className="w-full p-5 bg-slate-950 border border-slate-800 rounded-3xl font-bold" placeholder="Brief scope of interior systems..." />
            </div>

            <div className="flex justify-end pt-4">
               <button type="submit" disabled={saving} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 px-16 rounded-3xl uppercase tracking-widest text-[10px] shadow-2xl transition-all flex items-center justify-center gap-3">
                 {saving ? <Loader2 className="animate-spin" size={18} /> : null}
                 {saving ? 'Initializing Cloud Data...' : 'Confirm Registration'}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* PROJECT GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-32 gap-6">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-black uppercase tracking-[0.5em] text-[9px] italic">Syncing Portfolio Assets...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredProjects.map((p) => (
            <Link 
              href={`/projects/${p.id}`} 
              key={p.id} 
              className="bg-slate-900/40 rounded-[48px] border border-slate-800/50 hover:border-blue-500 transition-all p-10 flex flex-col group relative shadow-2xl backdrop-blur-sm overflow-hidden block cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all" />
              
              <div className="flex justify-between items-start mb-10">
                <span className={`text-[8px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border ${
                  p.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  p.status === 'Closed' ? 'bg-slate-800 text-slate-500 border-slate-700' : 
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {p.status}
                </span>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Last Update</p>
                  <p className="text-[10px] font-black text-blue-500">
                    {p.lastActive ? new Date(p.lastActive).toLocaleDateString() : 'New Job'}
                  </p>
                </div>
              </div>

              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2 leading-[0.9] group-hover:text-blue-500 transition-colors">
                {p.name}
              </h3>
              <p className="text-[10px] font-black text-slate-500 mb-10 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={12} className="text-blue-500" /> {p.location}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-slate-950/50 p-5 rounded-[28px] border border-slate-800/50 text-center group-hover:border-slate-700 transition-colors">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Tickets</p>
                  <p className="text-2xl font-black text-white">{p.ticketCount || 0}</p>
                </div>
                <div className="bg-slate-950/50 p-5 rounded-[28px] border border-slate-800/50 text-center group-hover:border-slate-700 transition-colors">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Logs</p>
                  <p className="text-2xl font-black text-white">{p.auditCount || 0}</p>
                </div>
              </div>

              {/* Converted to a div since the whole card is now a Link */}
              <div className="mt-auto bg-slate-800 group-hover:bg-blue-600 text-white font-black py-6 rounded-[28px] text-[10px] uppercase tracking-[0.3em] text-center transition-all shadow-xl flex items-center justify-center gap-2 group-hover:gap-4">
                Enter War Room <ChevronRight size={14} />
              </div>
            </Link>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="col-span-full py-32 text-center border-4 border-dashed border-slate-900 rounded-[64px]">
              <ShieldAlert size={48} className="mx-auto text-slate-800 mb-4" />
              <p className="text-slate-600 font-black uppercase tracking-[0.4em] italic text-xs">No Matching Sites in Inventory</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}