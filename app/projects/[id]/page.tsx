'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, Users, HardHat, Building2, FileCheck, ShieldCheck, 
  FileText, ChevronLeft, Loader2, ClipboardList, FileQuestion, 
  Images, ClipboardCheck, Calendar, Activity, BookOpen, UserCog,
  Landmark, TrendingUp, TrendingDown, AlertCircle, FileSignature
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  
  // Data for the top status bar
  const [stats, setStats] = useState({ punch: 0, rfi: 0, logs: 0 })
  const [budgetVariance, setBudgetVariance] = useState({ value: 0, isOver: false })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)

    const [p, manual, logs, punch, rfis, costCodesRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
      supabase.from('punch_list').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('rfis').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('project_cost_codes').select('original_budget').eq('project_id', id)
    ])

    const budget = costCodesRes.data?.reduce((sum, code) => sum + Number(code.original_budget || 0), 0) || 0
    setBudgetVariance({ value: budget, isOver: false })
    
    setProject(p.data)
    setStats({ punch: punch.data?.length || 0, rfi: rfis.data?.length || 0, logs: logs.data?.length || 0 })

    const photoStream = [
      ...(manual.data || []).map(i => ({ url: i.url || i.photo_url, label: i.caption, src: 'Manual', date: i.created_at })),
      ...(logs.data || []).flatMap(i => {
        const urls = Array.isArray(i.photo_urls) ? i.photo_urls : (i.photo_url ? [i.photo_url] : []);
        return urls.map((url: string) => ({ url, label: i.work_performed, src: 'Log', date: i.created_at }));
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setAllPhotos(photoStream)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleUploadPhoto = async (file: File) => {
    setUploading(true)
    const path = `${id}/gallery/${Date.now()}-${file.name}`
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    if (!sErr) {
      const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
      await supabase.from('project_photos').insert([{ project_id: id, caption: file.name, source: 'Manual', url: u.publicUrl }])
      fetchData()
    }
    setUploading(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Structuring Project Hubs...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-12 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Portfolio</button>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto">
          <StatCard label="Live Budget" value={`$${budgetVariance.value.toLocaleString()}`} icon={<Landmark size={16}/>} color="text-emerald-500" />
          <StatCard label="Tickets" value={stats.punch} icon={<ClipboardList size={16}/>} color="text-red-500" />
          <StatCard label="Active RFIs" value={stats.rfi} icon={<FileQuestion size={16}/>} color="text-amber-500" />
          <StatCard label="Daily Logs" value={stats.logs} icon={<FileText size={16}/>} color="text-slate-400" />
        </div>
      </div>

      {/* --- CONSOLIDATED HUB GRID (3 MAIN FOLDERS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <HubLink 
          title="Financial Hub" 
          desc="Budget, Contracts & Monthly Draws"
          href={`/projects/${id}/financials`} 
          icon={<Landmark size={32}/>} 
          color="bg-amber-600" 
        />

        <HubLink 
          title="Field Records" 
          desc="Logs, Punch, RFIs & Submittals"
          href={`/projects/${id}/records`} 
          icon={<ClipboardList size={32}/>} 
          color="bg-blue-600" 
        />

        <HubLink 
          title="Safety Hub" 
          desc="Walks, Incidents & Trade Compliance"
          href={`/projects/${id}/safety`} 
          icon={<ShieldCheck size={32}/>} 
          color="bg-orange-600" 
        />
      </div>

      {/* --- STANDALONE TOOLS (QUICK ACCESS ROW) --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-16">
          <ToolLink title="Bidding" href={`/projects/${id}/bidding`} icon={<FileSignature size={20}/>} color="bg-emerald-600" />
          <ToolLink title="Schedule" href={`/projects/${id}/schedule`} icon={<Calendar size={20}/>} color="bg-fuchsia-600" />
          <ToolLink title="Blueprint Vault" href={`/projects/${id}/plans`} icon={<BookOpen size={20}/>} color="bg-slate-700" />
          <ToolLink title="Inspection Matrix" href={`/projects/${id}/matrix`} icon={<Activity size={20}/>} color="bg-indigo-600" />
          <ToolLink title="Site Directory" href={`/projects/${id}/trades`} icon={<UserCog size={20}/>} color="bg-teal-600" />
      </div>

      {/* SITE STREAM */}
      <div className="space-y-8">
        <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl">
          <h3 className="text-2xl font-black uppercase italic tracking-tighter">Site <span className="text-blue-500">Stream</span></h3>
          <label className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase cursor-pointer hover:bg-blue-500 transition-all shadow-lg flex items-center gap-2">
            {uploading ? <Loader2 className="animate-spin" size={14}/> : <Images size={14}/>} Add Photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUploadPhoto(f) }} />
          </label>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {allPhotos.map((p, i) => (
            <div key={i} className="relative aspect-square bg-slate-900 rounded-[32px] overflow-hidden border border-slate-800 group shadow-xl">
              <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt="Site" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all">
                <span className="text-[8px] font-black px-2 py-1 rounded mb-2 self-start uppercase bg-blue-600">{p.src}</span>
                <p className="text-[11px] font-black truncate uppercase text-white">{p.label || 'Site Visual'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, href }: any) {
  const Card = (
    <div className={`flex items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl hover:bg-slate-800 transition-all shadow-xl h-full`}>
      <div className={`${color}`}>{icon}</div>
      <div>
        <p className="text-[8px] font-black text-slate-500 uppercase">{label}</p>
        <p className="text-xs font-black uppercase text-white">{value}</p>
      </div>
    </div>
  )
  return href ? <Link href={href}>{Card}</Link> : Card
}

function HubLink({ title, desc, href, icon, color }: any) {
  return (
    <Link href={href} className="group">
      <div className={`p-8 rounded-[40px] ${color} h-64 flex flex-col justify-between shadow-2xl hover:scale-[1.01] hover:translate-y-[-2px] transition-all text-white border-b-[12px] border-black/20`}>
        <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner">{icon}</div>
        <div>
          <h3 className="text-2xl font-black uppercase italic tracking-tighter leading-none">{title}</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-80">{desc}</p>
        </div>
      </div>
    </Link>
  )
}

function ToolLink({ title, href, icon, color }: any) {
  return (
    <Link href={href} className="group h-full block">
      <div className={`p-5 rounded-3xl ${color} flex items-center gap-4 shadow-xl hover:scale-105 transition-all text-white border-b-4 border-black/20 h-full`}>
        <div className="bg-white/10 p-2 rounded-lg">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
    </Link>
  )
}