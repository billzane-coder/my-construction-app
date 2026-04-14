'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  CheckCircle2, AlertCircle, Clock, 
  Search, Filter, Plus, ChevronRight, 
  HardHat, MapPin, Loader2, ArrowLeft
} from 'lucide-react'

export default function GlobalPunchManager() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')

  // Fetch ALL tickets across ALL projects
  const fetchTickets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('punch_list')
      .select(`
        *,
        projects (name)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTickets(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  // Filtering Logic
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.task || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.location || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.projects?.name || '').toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter
    const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Quick stats for the top bar
  const openCount = tickets.filter(t => t.status !== 'Resolved').length
  const urgentCount = tickets.filter(t => t.priority === 'Urgent' && t.status !== 'Resolved').length

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ArrowLeft size={14} /> Back to Command Center
          </Link>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Master <span className="text-blue-500">Punch</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-blue-500" /> Global Portfolio Deficiencies
          </p>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-slate-900/50 p-6 md:p-8 rounded-[32px] border border-slate-800 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Open Issues</p>
            <p className="text-5xl font-black text-white tracking-tighter">{openCount}</p>
          </div>
          <AlertCircle size={40} className="text-blue-500/50 hidden md:block" />
        </div>
        <div className="bg-slate-900/50 p-6 md:p-8 rounded-[32px] border border-red-900/30 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-[9px] font-black text-red-500/70 uppercase tracking-widest mb-1">Urgent Action</p>
            <p className="text-5xl font-black text-red-500 tracking-tighter">{urgentCount}</p>
          </div>
          <Clock size={40} className="text-red-500/50 hidden md:block animate-pulse" />
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="flex-1 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input 
            type="text"
            placeholder="Search by site, unit, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 p-6 pl-14 rounded-[28px] text-sm font-bold focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-lg"
          />
        </div>
        <div className="flex gap-4">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-blue-500 transition-all appearance-none text-center min-w-[140px] shadow-lg"
          >
            <option value="All">All Status</option>
            <option value="Open">Open</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select 
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] text-[10px] font-black text-blue-400 outline-none uppercase tracking-widest cursor-pointer hover:border-blue-500 transition-all appearance-none text-center min-w-[140px] shadow-lg"
          >
            <option value="All">All Priority</option>
            <option value="Urgent">Urgent</option>
            <option value="Med">Medium</option>
          </select>
        </div>
      </div>

      {/* TICKET LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Syncing Global Data...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
              No tickets match your filters.
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <Link href={`/punchlist/${ticket.id}`} key={ticket.id} className="block group">
                <div className={`bg-slate-900 p-6 md:p-8 rounded-[32px] border transition-all shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:scale-[1.01] ${
                  ticket.status === 'Resolved' ? 'border-emerald-900/30 opacity-60' : 
                  ticket.priority === 'Urgent' ? 'border-red-900/50 hover:border-red-500' : 
                  'border-slate-800 hover:border-blue-500'
                }`}>
                  
                  {/* Left Block: Core Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                        ticket.status === 'Resolved' ? 'bg-emerald-950 text-emerald-500' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {ticket.status}
                      </span>
                      {ticket.priority === 'Urgent' && (
                        <span className="text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest bg-red-950/30 text-red-500 border border-red-900/50">
                          Urgent
                        </span>
                      )}
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1 bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-900/30">
                        {ticket.projects?.name || 'Unknown Site'}
                      </span>
                    </div>
                    
                    <h3 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-tight ${ticket.status === 'Resolved' ? 'line-through text-slate-500' : 'text-white'}`}>
                      {ticket.task || ticket.description}
                    </h3>
                  </div>

                  {/* Middle Block: Details */}
                  <div className="flex flex-col gap-3 md:w-64 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <MapPin size={14} className="text-blue-500" /> {ticket.unit_number ? `Unit ${ticket.unit_number}` : (ticket.location || 'Site Wide')}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <HardHat size={14} className="text-blue-500" /> {ticket.trade_assigned || 'Unassigned'}
                    </div>
                  </div>

                  {/* Right Block: Action */}
                  <div className="hidden md:flex items-center justify-end w-12">
                    <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-all">
                      <ChevronRight size={18} className="text-slate-500 group-hover:text-white" />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

    </div>
  )
}