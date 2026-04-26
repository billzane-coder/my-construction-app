'use client'

// 1. CRITICAL: This must be at the top level to prevent Vercel build crashes
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  AlertCircle, 
  CheckCircle2, 
  ClipboardCheck, 
  Plus, 
  ArrowRight, 
  Clock, 
  Activity,
  ShieldAlert 
} from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ openTickets: 0, urgentTickets: 0, totalAudits: 0 })
  const [recentTickets, setRecentTickets] = useState<any[]>([])
  const [recentAudits, setRecentAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      
      // 1. Fetch Top-Level Stats simultaneously for speed
      const [open, urgent, audits] = await Promise.all([
        supabase.from('punch_list').select('*', { count: 'exact', head: true }).neq('status', 'Resolved'),
        supabase.from('punch_list').select('*', { count: 'exact', head: true }).eq('priority', 'Urgent').neq('status', 'Resolved'),
        supabase.from('site_inspections').select('*', { count: 'exact', head: true })
      ])

      setStats({ 
        openTickets: open.count || 0, 
        urgentTickets: urgent.count || 0, 
        totalAudits: audits.count || 0 
      })

      // 2. Fetch 5 Most Recent Open Tickets
      const { data: tickets } = await supabase
        .from('punch_list')
        .select('*')
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (tickets) setRecentTickets(tickets)

      // 3. Fetch 5 Most Recent Audits (linked to projects)
      const { data: recentAuditsData } = await supabase
        .from('site_inspections')
        .select('*, projects(name), inspection_templates(name)')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (recentAuditsData) setRecentAudits(recentAuditsData)

      setLoading(false)
    }
    
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px]">Compiling Site Data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen font-sans pb-20 text-slate-100">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 pt-4 border-b-4 border-blue-600 pb-8 gap-6">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Command <span className="text-blue-500">Center</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
            <Activity size={12} className="text-blue-500" /> Site Intelligence Hub
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/inspections/new" className="bg-blue-600 hover:bg-blue-500 transition-all text-white text-[9px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-blue-900/20 flex items-center gap-2">
            <Plus size={14} /> New Audit
          </Link>
          <Link href="/projects" className="bg-slate-900 hover:bg-slate-800 transition-all text-white border border-slate-800 text-[9px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest shadow-sm">
            Project List
          </Link>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Open Deficiencies</p>
            <p className="text-5xl font-black text-white tracking-tighter">{stats.openTickets}</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-blue-950/30 border border-blue-900/50 flex items-center justify-center text-blue-500">
            <AlertCircle size={28} />
          </div>
        </div>
        
        <div className="bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex items-center justify-between group hover:border-red-500/30 transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Urgent Items</p>
            <p className="text-5xl font-black text-red-500 tracking-tighter">{stats.urgentTickets}</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-red-950/30 border border-red-900/50 flex items-center justify-center text-red-500 animate-pulse">
            <ShieldAlert size={28} />
          </div>
        </div>

        <div className="bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phase Audits</p>
            <p className="text-5xl font-black text-emerald-500 tracking-tighter">{stats.totalAudits}</p>
          </div>
          <div className="h-14 w-14 rounded-2xl bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-center text-emerald-500">
            <ClipboardCheck size={28} />
          </div>
        </div>
      </div>

      {/* SPLIT VIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        
        {/* LEFT: RECENT PUNCH TICKETS */}
        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-slate-800 pb-4">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <Clock size={14} className="text-blue-500" /> Active Site Issues
            </h2>
            <Link href="/punchlist" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-all">View All →</Link>
          </div>
          
          {recentTickets.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-900 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
              Site is clean. No open deficiencies.
            </div>
          ) : (
            <div className="space-y-4">
              {recentTickets.map(ticket => (
                <Link href={`/punchlist/${ticket.id}`} key={ticket.id} className="block group">
                  <div className="bg-slate-900/40 hover:bg-slate-900 p-6 rounded-[32px] border border-slate-800 group-hover:border-blue-500/50 transition-all shadow-xl flex justify-between items-center gap-4">
                    {/* ADDED: min-w-0 forces the container to respect truncate */}
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-3 items-center mb-2">
                        {/* ADDED: shrink-0 stops the priority pill from compressing */}
                        <span className={`shrink-0 text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${ticket.priority === 'Urgent' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {ticket.priority || 'Med'}
                        </span>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter truncate">{ticket.location}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-200 leading-tight truncate">{ticket.description}</p>
                    </div>
                    {/* ADDED: shrink-0 stops the arrow from compressing */}
                    <ArrowRight size={18} className="text-slate-800 group-hover:text-blue-500 transition-all shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: RECENT AUDITS */}
        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-slate-800 pb-4">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" /> Quality Control Log
            </h2>
            <Link href="/inspections" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-all">Full Log →</Link>
          </div>

          {recentAudits.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-900 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
              No inspections recorded.
            </div>
          ) : (
            <div className="space-y-4">
              {recentAudits.map(audit => (
                <Link href={`/inspections/${audit.id}`} key={audit.id} className="block group">
                  <div className="bg-slate-900/40 hover:bg-slate-900 p-6 rounded-[32px] border border-slate-800 group-hover:border-emerald-500/50 transition-all shadow-xl flex justify-between items-center gap-4">
                    {/* ADDED: min-w-0 forces the container to respect truncate */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white uppercase italic tracking-tight mb-1 truncate">{audit.inspection_templates?.name || 'Phase Audit'}</p>
                      <div className="flex gap-3 items-center">
                        {/* ADDED: shrink-0 stops the unit pill from compressing */}
                        <span className="shrink-0 text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
                          Unit {audit.unit_number}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate">{audit.projects?.name}</span>
                      </div>
                    </div>
                    {/* ADDED: shrink-0 stops the status text from compressing */}
                    <div className="text-right shrink-0">
                      <span className="text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-slate-800 text-slate-500">
                        {audit.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}