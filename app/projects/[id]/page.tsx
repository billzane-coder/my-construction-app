'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, Users, HardHat, Building2, FileCheck, ShieldCheck, 
  FileText, Phone, Mail, ChevronLeft, Loader2, MessageSquare,
  Settings2, Save, X, ExternalLink, ClipboardList, FileQuestion, 
  Images, Inbox, ClipboardCheck, Calendar, Activity, BookOpen, UserCog,
  Landmark, DollarSign, TrendingUp, TrendingDown, FileSignature, AlertCircle
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  const [project, setProject] = useState<any>(null)
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  
  const [punchCount, setPunchCount] = useState(0)
  const [logCount, setLogCount] = useState(0)
  const [rfiCount, setRfiCount] = useState(0)
  const [manpowerTotal, setManpowerTotal] = useState(0)
  const [inspectionProgress, setInspectionProgress] = useState(0)
  
  const [budgetVariance, setBudgetVariance] = useState({ value: 0, isOver: false })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)

    const [p, manual, logs, punch, rfis, inspections, costCodesRes, contractsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
      supabase.from('punch_list').select('id, status').eq('project_id', id),
      supabase.from('rfis').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('project_inspections').select('status, unit_name').eq('project_id', id),
      supabase.from('project_cost_codes').select('original_budget').eq('project_id', id),
      supabase.from('project_contracts').select('id, status').eq('project_id', id)
    ])

    const originalBudget = costCodesRes.data?.reduce((sum, code) => sum + Number(code.original_budget || 0), 0) || 0
    const activeContracts = contractsRes.data?.filter(c => c.status === 'Active' || c.status === 'Completed') || []
    const activeContractIds = activeContracts.map(c => c.id)
    const queryIds = activeContractIds.length > 0 ? activeContractIds : ['00000000-0000-0000-0000-000000000000']

    const { data: sovLines } = await supabase
      .from('sov_line_items')
      .select('scheduled_value, change_order_id, change_orders(status)')
      .in('contract_id', queryIds)

    let committed = 0
    let approvedChanges = 0

    sovLines?.forEach(line => {
      committed += Number(line.scheduled_value || 0)
      const changeOrder = Array.isArray(line.change_orders) ? line.change_orders[0] : line.change_orders;
      if (line.change_order_id && changeOrder?.status === 'Approved') {
        approvedChanges += Number(line.scheduled_value || 0)
      }
    })

    const revisedBudget = originalBudget + approvedChanges
    const variance = revisedBudget - committed

    setBudgetVariance({ value: Math.abs(variance), isOver: variance < 0 })
    setProject(p.data)
    setPunchCount(punch.data?.filter(i => i.status === 'Open').length || 0)
    setLogCount(logs.data?.length || 0)
    setRfiCount(rfis.data?.length || 0) 

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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Master...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      <div className="mb-8 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Portfolio</button>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full xl:w-auto">
          <StatCard label="Budget" value={budgetVariance.isOver ? `-$${budgetVariance.value.toLocaleString()}` : `+$${budgetVariance.value.toLocaleString()}`} icon={budgetVariance.isOver ? <TrendingDown size={16}/> : <TrendingUp size={16}/>} color={budgetVariance.isOver ? "text-red-500" : "text-emerald-500"} href={`/projects/${id}/financials`} />
          <StatCard label="Manpower" value={`${manpowerTotal} Active`} icon={<Users size={16}/>} color="text-blue-500" />
          <StatCard label="Inspections" value={`${inspectionProgress}%`} icon={<ClipboardCheck size={16}/>} color="text-emerald-500" href={`/projects/${id}/matrix`} />
          <StatCard label="Punch" value={punchCount} icon={<ClipboardList size={16}/>} color="text-red-500" href={`/projects/${id}/punchlist`} />
          <StatCard label="RFIs" value={rfiCount} icon={<FileQuestion size={16}/>} color="text-amber-500" href={`/projects/${id}/rfis`} />
          <StatCard label="Daily Logs" value={logCount} icon={<FileText size={16}/>} color="text-slate-400" href={`/projects/${id}/logs`} />
        </div>
      </div>

      {/* --- MODULE GRID (Added Incidents) --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4 mb-12">
        <ModuleLink title="Financials" href={`/projects/${id}/financials`} icon={<Landmark size={20}/>} color="bg-amber-600" />
        <ModuleLink title="Bidding" href={`/projects/${id}/bidding`} icon={<FileSignature size={20}/>} color="bg-emerald-600" />
        <ModuleLink title="Trades" href={`/projects/${id}/trades`} icon={<UserCog size={20}/>} color="bg-blue-600" />
        <ModuleLink title="Plans" href={`/projects/${id}/plans`} icon={<BookOpen size={20}/>} color="bg-slate-700" />
        <ModuleLink title="Matrix" href={`/projects/${id}/matrix`} icon={<Activity size={20}/>} color="bg-indigo-600" />
        <ModuleLink title="Logs" href={`/projects/${id}/logs`} icon={<FileText size={20}/>} color="bg-teal-600" />
        <ModuleLink title="Punch" href={`/projects/${id}/punchlist`} icon={<ClipboardList size={20}/>} color="bg-red-600" />
        <ModuleLink title="Schedule" href={`/projects/${id}/schedule`} icon={<Calendar size={20}/>} color="bg-fuchsia-600" />
        <ModuleLink title="Submittals" href={`/projects/${id}/submittals`} icon={<FileCheck size={20}/>} color="bg-pink-600" />
        <ModuleLink title="Safety Hub" href={`/projects/${id}/safety`} icon={<ShieldCheck size={20}/>} color="bg-orange-600" />
        <ModuleLink title="RFIs" href={`/projects/${id}/rfis`} icon={<FileQuestion size={20}/>} color="bg-yellow-600" />
        <ModuleLink title="Incidents" href={`/projects/${id}/incidents`} icon={<AlertCircle size={20}/>} color="bg-rose-700" />
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

function ModuleLink({ title, href, icon, color }: any) {
  return (
    <Link href={href} className="group h-full block">
      <div className={`p-4 rounded-3xl ${color} flex flex-col items-center justify-center gap-2 shadow-xl hover:scale-105 transition-all text-white border-b-4 border-black/20 h-full`}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
    </Link>
  )
}