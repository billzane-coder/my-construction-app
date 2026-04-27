'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Loader2, ClipboardList, FileQuestion, 
  Images, ClipboardCheck, Calendar, Activity, BookOpen, UserCog,
  Landmark, TrendingUp, TrendingDown, FileSignature, Users, FileText,
  ShieldCheck, X
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  
  // Photo Zoom State
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null)
  
  // Data for the top status bar
  const [stats, setStats] = useState({ punch: 0, rfi: 0, logs: 0 })
  const [manpowerTotal, setManpowerTotal] = useState(0)
  const [inspectionProgress, setInspectionProgress] = useState(0)
  const [budgetVariance, setBudgetVariance] = useState({ value: 0, isOver: false })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)

    const [p, manual, logs, punch, rfis, inspections, costCodesRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
      supabase.from('punch_list').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('rfis').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('project_inspections').select('status, unit_name').eq('project_id', id),
      supabase.from('project_cost_codes').select('original_budget').eq('project_id', id)
    ])

    const budget = costCodesRes.data?.reduce((sum, code) => sum + Number(code.original_budget || 0), 0) || 0
    setBudgetVariance({ value: budget, isOver: false })
    
    setProject(p.data)
    setStats({ punch: punch.data?.length || 0, rfi: rfis.data?.length || 0, logs: logs.data?.length || 0 })

    if (logs.data?.[0]) {
      const log = logs.data[0]
      const counts = (log.manpower || "").match(/\d+/g)
      setManpowerTotal(counts ? counts.reduce((acc: number, cur: string) => acc + parseInt(cur), 0) : 0)
    }

    if (inspections.data && inspections.data.length > 0) {
      const passed = inspections.data.filter((i: any) => i.status === 'Pass').length
      setInspectionProgress(Math.round((passed / inspections.data.length) * 100))
    }

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
      
      {/* PHOTO ZOOM MODAL */}
      {zoomedPhoto && (
        <div 
          className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomedPhoto(null)}
        >
          <button className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-full p-3 transition-colors shadow-2xl">
            <X size={24}/>
          </button>
          <img 
            src={zoomedPhoto} 
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-slate-800" 
            alt="Full size site visual" 
          />
        </div>
      )}

      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Portfolio</button>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 w-full xl:w-auto">
          <StatCard label="Live Budget" value={`$${budgetVariance.value.toLocaleString()}`} icon={<Landmark size={16}/>} color="text-emerald-500" />
          <StatCard label="Manpower" value={`${manpowerTotal} Active`} icon={<Users size={16}/>} color="text-blue-500" />
          <StatCard label="Inspections" value={`${inspectionProgress}%`} icon={<ClipboardCheck size={16}/>} color="text-emerald-500" />
          <StatCard label="Tickets" value={stats.punch} icon={<ClipboardList size={16}/>} color="text-red-500" />
          <StatCard label="Active RFIs" value={stats.rfi} icon={<FileQuestion size={16}/>} color="text-amber-500" />
          <StatCard label="Daily Logs" value={stats.logs} icon={<FileText size={16}/>} color="text-slate-400" />
        </div>
      </div>

      {/* --- UNIFIED MODULE GRID (COMPACT BUTTONS) --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-16">
          <ModuleCard title="Financial Hub" href={`/projects/${id}/financials`} icon={<Landmark size={24}/>} color="bg-amber-600" />
          <ModuleCard title="Field Records" href={`/projects/${id}/records`} icon={<ClipboardList size={24}/>} color="bg-blue-600" />
          <ModuleCard title="Safety Hub" href={`/projects/${id}/safety`} icon={<ShieldCheck size={24}/>} color="bg-orange-600" />
          <ModuleCard title="Bidding" href={`/projects/${id}/bidding`} icon={<FileSignature size={24}/>} color="bg-emerald-600" />
          <ModuleCard title="Schedule" href={`/projects/${id}/schedule`} icon={<Calendar size={24}/>} color="bg-fuchsia-600" />
          <ModuleCard title="Blueprint Vault" href={`/projects/${id}/plans`} icon={<BookOpen size={24}/>} color="bg-slate-700" />
          <ModuleCard title="Inspection Matrix" href={`/projects/${id}/matrix`} icon={<Activity size={24}/>} color="bg-indigo-600" />
          <ModuleCard title="Site Directory" href={`/projects/${id}/trades`} icon={<UserCog size={24}/>} color="bg-teal-600" />
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
            <div 
              key={i} 
              onClick={() => setZoomedPhoto(p.url)}
              className="relative aspect-square bg-slate-900 rounded-[32px] overflow-hidden border border-slate-800 group shadow-xl cursor-zoom-in"
            >
              <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt="Site visual" />
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

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl hover:bg-slate-800 transition-all shadow-xl h-full">
      <div className={`${color}`}>{icon}</div>
      <div>
        <p className="text-[8px] font-black text-slate-500 uppercase">{label}</p>
        <p className="text-xs font-black uppercase text-white">{value}</p>
      </div>
    </div>
  )
}

function ModuleCard({ title, href, icon, color }: any) {
  return (
    <Link href={href} className="group h-full block">
      <div className={`p-6 rounded-3xl ${color} flex items-center gap-4 shadow-xl hover:scale-105 hover:-translate-y-1 transition-all text-white border-b-[6px] border-black/20 h-full`}>
        <div className="bg-white/20 p-3 rounded-xl shadow-inner">{icon}</div>
        <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest">{title}</span>
      </div>
    </Link>
  )
}