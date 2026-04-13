'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [stats, setStats] = useState({ openTickets: 0, urgentTickets: 0, totalAudits: 0 })
  const [recentTickets, setRecentTickets] = useState<any[]>([])
  const [recentAudits, setRecentAudits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      // 1. Fetch Top-Level Stats
      const { count: openCount } = await supabase.from('punch_list').select('*', { count: 'exact', head: true }).neq('status', 'Resolved')
      const { count: urgentCount } = await supabase.from('punch_list').select('*', { count: 'exact', head: true }).eq('priority', 'Urgent').neq('status', 'Resolved')
      const { count: auditCount } = await supabase.from('site_inspections').select('*', { count: 'exact', head: true })

      setStats({ 
        openTickets: openCount || 0, 
        urgentTickets: urgentCount || 0, 
        totalAudits: auditCount || 0 
      })

      // 2. Fetch 5 Most Recent Open Tickets
      const { data: tickets } = await supabase
        .from('punch_list')
        .select('*')
        .neq('status', 'Resolved')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (tickets) setRecentTickets(tickets)

      // 3. Fetch 5 Most Recent Audits
      const { data: audits } = await supabase
        .from('site_inspections')
        .select('*, projects(name), inspection_templates(name)')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (audits) setRecentAudits(audits)

      setLoading(false)
    }
    
    fetchDashboard()
  }, [])

  if (loading) return <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse bg-slate-950 min-h-screen">Compiling Site Data...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans pb-20 text-slate-100">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pt-4 border-b-4 border-blue-600 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Command <span className="text-blue-500">Center</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3">Live Project Overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inspections/new" className="bg-blue-600 hover:bg-blue-500 transition-all text-white text-[9px] font-black px-6 py-3 rounded-xl uppercase tracking-widest shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            + New Audit
          </Link>
          <Link href="/punchlist" className="bg-slate-800 hover:bg-slate-700 transition-all text-white border border-slate-700 text-[9px] font-black px-6 py-3 rounded-xl uppercase tracking-widest shadow-sm">
            View All Tickets
          </Link>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 p-6 rounded-[32px] border-2 border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Open Deficiencies</p>
            <p className="text-4xl font-black text-white tracking-tighter">{stats.openTickets}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-950/50 border border-blue-900/50 flex items-center justify-center text-blue-500 font-black">
            !
          </div>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-[32px] border-2 border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Urgent / High Priority</p>
            <p className="text-4xl font-black text-red-400 tracking-tighter">{stats.urgentTickets}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center text-red-500 font-black animate-pulse">
            #
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[32px] border-2 border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Phase Audits</p>
            <p className="text-4xl font-black text-emerald-400 tracking-tighter">{stats.totalAudits}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center text-emerald-500 font-black">
            ✓
          </div>
        </div>
      </div>

      {/* SPLIT VIEW: RECENT AUDITS & OPEN TICKETS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: RECENT PUNCH TICKETS */}
        <div className="space-y-4">
          <div className="flex justify-between items-end border-b border-slate-800 pb-2 mb-4">
            <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Latest Action Items</h2>
            <Link href="/punchlist" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-all">View All →</Link>
          </div>
          
          {recentTickets.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-[24px] text-slate-600 font-bold uppercase text-[10px] tracking-widest">
              No active tickets. Site is clean.
            </div>
          ) : (
            recentTickets.map(ticket => (
              <Link href={`/punchlist/${ticket.id}`} key={ticket.id} className="block group">
                <div className="bg-slate-900 p-5 rounded-[24px] border border-slate-800 group-hover:border-slate-600 transition-all shadow-lg flex justify-between items-center">
                  <div>
                    <div className="flex gap-2 items-center mb-1">
                      <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${ticket.priority === 'Urgent' ? 'bg-red-900/40 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                        {ticket.priority || 'Med'}
                      </span>
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">{ticket.location}</span>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight truncate max-w-sm">{ticket.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{ticket.assigned_to || 'General'}</p>
                    <p className="text-[8px] font-mono text-slate-600 uppercase">{new Date(ticket.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: RECENT AUDITS */}
        <div className="space-y-4">
          <div className="flex justify-between items-end border-b border-slate-800 pb-2 mb-4">
            <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Recent Phase Audits</h2>
            <Link href="/inspections" className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-all">View Log →</Link>
          </div>

          {recentAudits.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-[24px] text-slate-600 font-bold uppercase text-[10px] tracking-widest">
              No audits recorded yet.
            </div>
          ) : (
            recentAudits.map(audit => (
              <Link href={`/inspections/${audit.id}`} key={audit.id} className="block group">
                <div className="bg-slate-900 p-5 rounded-[24px] border border-slate-800 group-hover:border-slate-600 transition-all shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-sm font-black text-white uppercase italic tracking-tight">{audit.inspection_templates?.name || 'Phase Audit'}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-950/30 px-2 py-0.5 rounded">
                        Unit {audit.unit_number}
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">{audit.projects?.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-slate-800 text-slate-400">
                      {audit.status}
                    </span>
                    <p className="text-[8px] font-mono text-slate-600 uppercase mt-2">{new Date(audit.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

      </div>
    </div>
  )
}