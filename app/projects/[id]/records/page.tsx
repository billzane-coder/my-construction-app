'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, FileText, ClipboardList, FileQuestion, 
  FileCheck, Calendar, Activity, Clock, ArrowRight 
} from 'lucide-react'

export default function FieldRecordsHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    logs: 0,
    punchOpen: 0,
    rfisOpen: 0,
    submittalsPending: 0
  })

  // Merged Timeline Feed
  const [activityFeed, setActivityFeed] = useState<any[]>([])

  useEffect(() => {
    async function fetchRecordsData() {
      setLoading(true)
      
      const [projRes, logsRes, punchRes, rfisRes, subsRes] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('daily_logs').select('id, log_date, work_performed').eq('project_id', id).order('log_date', { ascending: false }).limit(5),
        supabase.from('punch_list').select('id, description, status, created_at, priority').eq('project_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('rfis').select('id, title, status, created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(5),
        supabase.from('project_submittals').select('id, title, status, created_at').eq('project_id', id).order('created_at', { ascending: false }).limit(5)
      ])

      setProject(projRes.data)

      // Calculate totals for active/pending items
      const openPunch = punchRes.data?.filter(p => p.status !== 'Resolved').length || 0
      const openRfis = rfisRes.data?.filter(r => r.status === 'Open').length || 0
      const pendingSubs = subsRes.data?.filter(s => s.status === 'Pending').length || 0

      setStats({
        logs: logsRes.data?.length || 0, // Just showing recent count for context
        punchOpen: openPunch,
        rfisOpen: openRfis,
        submittalsPending: pendingSubs
      })

      // Normalize and merge data into a single timeline feed
      const mergedFeed: any[] = []

      logsRes.data?.forEach(log => {
        mergedFeed.push({
          id: log.id,
          type: 'Log',
          title: 'Daily Site Log',
          desc: log.work_performed || 'No work description provided.',
          date: log.log_date,
          status: 'Final',
          icon: <FileText size={16} />,
          color: 'text-teal-500',
          bg: 'bg-teal-500/10',
          link: `/projects/${id}/logs/${log.id}`
        })
      })

      punchRes.data?.forEach(punch => {
        mergedFeed.push({
          id: punch.id,
          type: 'Punch',
          title: 'Deficiency Ticket',
          desc: punch.description,
          date: punch.created_at,
          status: punch.status,
          icon: <ClipboardList size={16} />,
          color: punch.priority === 'Urgent' ? 'text-red-500' : 'text-rose-500',
          bg: punch.priority === 'Urgent' ? 'bg-red-500/10' : 'bg-rose-500/10',
          link: `/punchlist/${punch.id}`
        })
      })

      rfisRes.data?.forEach(rfi => {
        mergedFeed.push({
          id: rfi.id,
          type: 'RFI',
          title: `RFI: ${rfi.title}`,
          desc: `Status: ${rfi.status}`,
          date: rfi.created_at,
          status: rfi.status,
          icon: <FileQuestion size={16} />,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          link: `/projects/${id}/rfis/${rfi.id}`
        })
      })

      subsRes.data?.forEach(sub => {
        mergedFeed.push({
          id: sub.id,
          type: 'Submittal',
          title: `Submittal: ${sub.title}`,
          desc: `Status: ${sub.status}`,
          date: sub.created_at,
          status: sub.status,
          icon: <FileCheck size={16} />,
          color: 'text-pink-500',
          bg: 'bg-pink-500/10',
          link: `/projects/${id}/submittals` // Assuming submittals don't have individual pages yet
        })
      })

      // Sort by date (newest first) and keep top 10
      mergedFeed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setActivityFeed(mergedFeed.slice(0, 10))

      setLoading(false)
    }

    fetchRecordsData()
  }, [id])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Records Hub...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Field <span className="text-blue-500">Records</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <Activity size={14} className="text-blue-500" /> {project?.name}
          </p>
        </div>
      </div>

      {/* --- QUICK ACCESS HUB GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        <RecordCard title="Daily Logs" count={stats.logs} subtitle="Recent" icon={<FileText size={24}/>} color="bg-teal-600" href={`/projects/${id}/logs`} />
        <RecordCard title="Punch List" count={stats.punchOpen} subtitle="Open" icon={<ClipboardList size={24}/>} color="bg-red-600" href={`/projects/${id}/punchlist`} />
        <RecordCard title="Active RFIs" count={stats.rfisOpen} subtitle="Open" icon={<FileQuestion size={24}/>} color="bg-amber-500" href={`/projects/${id}/rfis`} />
        <RecordCard title="Submittals" count={stats.submittalsPending} subtitle="Pending" icon={<FileCheck size={24}/>} color="bg-pink-600" href={`/projects/${id}/submittals`} />
        <RecordCard title="Schedule" count={"Live"} subtitle="Gantt" icon={<Calendar size={24}/>} color="bg-fuchsia-600" href={`/projects/${id}/schedule`} />
      </div>

      {/* --- RECENT ACTIVITY TIMELINE --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl p-6 md:p-10">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-6">
          <Clock size={20} className="text-blue-500" />
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Activity Stream</h2>
        </div>

        {activityFeed.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
            No recent field records found.
          </div>
        ) : (
          <div className="space-y-4">
            {activityFeed.map((item, idx) => (
              <Link href={item.link} key={`${item.type}-${item.id}-${idx}`} className="block group">
                <div className="flex items-center gap-6 bg-slate-950 p-5 rounded-[28px] border border-slate-800 group-hover:border-blue-500/50 transition-all shadow-lg">
                  
                  {/* Icon Indicator */}
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                    {item.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.title}</span>
                      <span className="hidden sm:inline text-slate-700">•</span>
                      <span className="text-[9px] font-bold text-slate-500">{new Date(item.date).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-200 truncate">{item.desc}</p>
                  </div>

                  {/* Status & Action */}
                  <div className="text-right shrink-0 flex items-center gap-4">
                    <span className={`hidden md:inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                      item.status === 'Open' || item.status === 'Pending' ? 'bg-amber-950/30 text-amber-500 border-amber-900/50' :
                      item.status === 'Resolved' || item.status === 'Approved' ? 'bg-emerald-950/30 text-emerald-500 border-emerald-900/50' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {item.status}
                    </span>
                    <ArrowRight size={18} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RecordCard({ title, count, subtitle, icon, color, href }: any) {
  return (
    <Link href={href} className="group">
      <div className={`p-6 rounded-[32px] ${color} h-40 flex flex-col justify-between shadow-xl hover:scale-[1.03] transition-all text-white border-b-[8px] border-black/20 relative overflow-hidden`}>
        
        {/* Background Graphic */}
        <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
          {React.cloneElement(icon, { size: 100 })}
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm shadow-inner">
            {React.cloneElement(icon, { size: 20 })}
          </div>
          <div className="text-right">
            <p className="text-3xl font-black tracking-tighter leading-none">{count}</p>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mt-1">{subtitle}</p>
          </div>
        </div>
        
        <div className="relative z-10">
          <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
        </div>
      </div>
    </Link>
  )
}