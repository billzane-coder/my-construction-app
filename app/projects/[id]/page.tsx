'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Share2, Printer, HardHat, Building2, FileCheck, 
  Phone, Mail, FileText, ClipboardList, LayoutDashboard,
  Images, Plus, Loader2, ChevronLeft
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  // States
  const [project, setProject] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('photos') 
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showOpenOnly, setShowOpenOnly] = useState(false)
  
  // Data Lists
  const [docs, setDocs] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [submittals, setSubmittals] = useState<any[]>([])
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  const [punchCount, setPunchCount] = useState(0)
  const [logCount, setLogCount] = useState(0)

  // Modals
  const [showContactModal, setShowContactModal] = useState(false)
  const [showDocModal, setShowDocModal] = useState(false) 
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showSubmittalModal, setShowSubmittalModal] = useState<{show: boolean, contactId: string | null}>({show: false, contactId: null})

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    
    const [p, manual, logs, punch, audits, cts, dcs, markups, subs] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id),
      supabase.from('punch_list').select('*').eq('project_id', id),
      supabase.from('site_inspections').select('*').eq('project_id', id),
      supabase.from('project_contacts').select('*').eq('project_id', id),
      supabase.from('project_documents').select('*').eq('project_id', id),
      supabase.from('photo_markups').select('photo_id, status').eq('project_id', id),
      supabase.from('project_submittals').select('*').eq('project_id', id)
    ])

    setProject(p.data)
    setPunchCount(punch.data?.length || 0)
    setLogCount(logs.data?.length || 0)
    setContacts(cts.data || [])
    setDocs(dcs.data || [])
    setSubmittals(subs.data || [])

    const markupMap = (markups.data || []).reduce((acc: any, m) => {
      if (!acc[m.photo_id]) acc[m.photo_id] = { total: 0, open: 0 }
      acc[m.photo_id].total++; if (m.status === 'Open') acc[m.photo_id].open++
      return acc
    }, {})

    // Combine all sources into one Photo Stream
    const photoStream = [
      ...(manual.data || []).map(i => ({ id: i.id, url: i.url || i.photo_url, label: i.caption, src: 'Manual', date: i.created_at, markupStatus: markupMap[i.id] || null })),
      ...(logs.data || []).flatMap(i => {
        const urls = Array.isArray(i.photo_urls) ? i.photo_urls : (i.photo_url ? [i.photo_url] : []);
        return urls.map((url: string) => ({ url, label: i.work_performed, src: 'Log', date: i.created_at }));
      }),
      ...(punch.data || []).filter(i => i.photo_url).map(i => ({ url: i.photo_url, label: i.task, src: 'Punch', date: i.created_at })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setAllPhotos(photoStream)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleUpload = async (file: File, path: string, table: string, record: any) => {
    setUploading(true)
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    if (sErr) { alert(sErr.message); setUploading(false); return }
    
    const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
    const urlColumn = (table === 'project_photos' || table === 'project_submittals') ? 'url' : 'file_url'
    
    const { error: dErr } = await supabase.from(table).insert([{ ...record, [urlColumn]: u.publicUrl }])
    if (!dErr) fetchData()
    setUploading(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing War Room...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-20">
      
      {/* HEADER */}
      <div className="mb-12 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 italic hover:text-white transition-all flex items-center gap-1">
            <ChevronLeft size={12}/> Portfolio
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <Link href={`/projects/${id}/logs`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-3xl hover:border-blue-500 transition-all shadow-xl group">
            <FileText size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-500 uppercase">Daily Reports</p>
              <p className="text-xs font-black uppercase text-white">{logCount} Logs</p>
            </div>
          </Link>

          <Link href={`/projects/${id}/punchlist`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-3xl hover:border-red-500 transition-all shadow-xl group">
            <ClipboardList size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-500 uppercase">Deficiencies</p>
              <p className="text-xs font-black uppercase text-white">{punchCount} Items</p>
            </div>
          </Link>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-slate-800 mb-10 overflow-x-auto no-scrollbar">
        {['photos', 'plans', 'compliance', 'contacts'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* 1. PHOTO STREAM (ANDROID OPTIMIZED) */}
      {activeTab === 'photos' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 gap-4">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Site <span className="text-blue-500">Stream</span></h3>
            <label className="bg-blue-600 text-white text-[10px] font-black px-10 py-4 rounded-2xl uppercase cursor-pointer hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
              {uploading ? <Loader2 className="animate-spin" size={14}/> : <Plus size={14}/>}
              {uploading ? 'Processing...' : 'Add Visual'}
              <input 
                type="file" 
                // ANDROID GALLERY FIX: Explicit extensions
                accept="image/jpeg,image/png,image/jpg,image/heic" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0]; 
                  if(f) handleUpload(f, `${id}/gallery/${Date.now()}-${f.name}`, 'project_photos', { project_id: id, caption: f.name, source: 'Manual' })
                }} 
              />
            </label>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {allPhotos.map((p, i) => (
              <div key={i} className="relative aspect-square bg-slate-900 rounded-[32px] overflow-hidden border border-slate-800 group shadow-xl">
                <img src={p.url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all">
                  <span className="text-[8px] font-black px-2 py-1 rounded mb-2 self-start uppercase bg-blue-600">{p.src}</span>
                  <p className="text-[11px] font-black truncate uppercase text-white">{p.label || 'Site Visual'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. PLANS VAULT */}
      {activeTab === 'plans' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-xl">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Blueprint <span className="text-blue-500">Vault</span></h3>
            <button onClick={() => setShowPlanModal(true)} className="bg-blue-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all">+ Upload Set</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {docs.filter(d => d.doc_type === 'Plan').map(plan => (
              <div key={plan.id} className="bg-slate-900 p-8 rounded-[48px] border border-slate-800 shadow-2xl relative">
                <span className="bg-blue-950 text-blue-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase mb-4 inline-block">{plan.revision_number}</span>
                <h4 className="text-2xl font-black text-white uppercase italic truncate mb-8">{plan.title}</h4>
                <a href={plan.file_url} target="_blank" className="block w-full text-center bg-slate-800 hover:bg-blue-600 py-6 rounded-3xl text-[11px] font-black uppercase text-white transition-all">View Drawing →</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. TRADE DIRECTORY */}
      {activeTab === 'contacts' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-xl">
            <h3 className="text-2xl font-black uppercase italic text-white">Trade <span className="text-blue-500">Directory</span></h3>
            <button onClick={() => setShowContactModal(true)} className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">+ Register Trade</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {contacts.map(c => (
              <div key={c.id} className="bg-slate-900 p-10 rounded-[56px] border border-slate-800 shadow-2xl flex flex-col group hover:border-emerald-500/30 transition-all">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h4 className="text-3xl font-black text-white uppercase italic leading-none">{c.company}</h4>
                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-2">{c.trade_role}</p>
                  </div>
                  <button onClick={() => setShowSubmittalModal({show: true, contactId: c.id})} className="bg-blue-600/10 text-blue-400 border border-blue-600/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                    <FileCheck size={14} /> Submittal
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                  <div className="bg-black/20 p-6 rounded-[32px] border border-slate-800/50">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-3 flex items-center gap-2"><HardHat size={12} className="text-emerald-500" /> Site Foreman</p>
                    <p className="text-sm font-black uppercase text-white truncate">{c.foreman_name || 'N/A'}</p>
                    <a href={`tel:${c.foreman_phone}`} className="text-xs font-bold text-blue-500 mt-2 block hover:underline">{c.foreman_phone || 'Add Phone'}</a>
                  </div>
                  <div className="bg-black/20 p-6 rounded-[32px] border border-slate-800/50">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-3 flex items-center gap-2"><Building2 size={12} className="text-blue-500" /> Office / PM</p>
                    <p className="text-sm font-black uppercase text-white truncate">{c.office_name || 'N/A'}</p>
                    <a href={`tel:${c.office_phone}`} className="text-xs font-bold text-blue-500 mt-2 block hover:underline">{c.office_phone || 'Add Phone'}</a>
                  </div>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-4 pt-8 border-t border-slate-800">
                   <a href={`tel:${c.foreman_phone || c.phone}`} className="bg-slate-800 hover:bg-blue-600 text-white text-center py-5 rounded-[24px] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-3"><Phone size={16}/> Site Line</a>
                   <a href={`mailto:${c.email}`} className="bg-slate-800 hover:bg-blue-600 text-white text-center py-5 rounded-[24px] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-3"><Mail size={16}/> Email PM</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. COMPLIANCE VAULT */}
      {activeTab === 'compliance' && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-xl">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Compliance <span className="text-blue-500">Vault</span></h3>
            <button onClick={() => setShowDocModal(true)} className="bg-blue-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all">+ Add Trade Doc</button>
          </div>
          {/* Grouped by Trade */}
          {Object.entries(docs.filter(d => d.doc_type === 'Contract').reduce((acc: any, d) => {
            const t = d.trade || 'General'; if (!acc[t]) acc[t] = []; acc[t].push(d); return acc;
          }, {})).map(([trade, files]: [string, any]) => (
            <div key={trade} className="ml-2">
              <h4 className="text-[12px] font-black text-blue-500 uppercase tracking-widest mb-4 border-l-4 border-blue-600 pl-4 italic">{trade}</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {files.map((f: any) => (
                  <div key={f.id} className="bg-slate-900 p-6 rounded-[24px] border border-slate-800 shadow-md group hover:border-blue-500 transition-all">
                    <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">{f.category}</span>
                    <h5 className="text-[11px] font-black text-white uppercase truncate mb-6">{f.title}</h5>
                    <a href={f.file_url} target="_blank" className="block text-center bg-slate-800 hover:bg-blue-600 py-4 rounded-xl text-[10px] font-black uppercase text-white transition-all">View File</a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS (DEDUPLICATED) */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            const { error } = await supabase.from('project_contacts').insert([{ 
              project_id: id, company: fd.get('company'), trade_role: fd.get('trade_role'), 
              foreman_name: fd.get('foreman_name'), foreman_phone: fd.get('foreman_phone'),
              office_name: fd.get('office_name'), office_phone: fd.get('office_phone'), email: fd.get('email')
            }]);
            if (!error) { setShowContactModal(false); fetchData(); } else { alert(error.message); }
          }} className="bg-slate-900 border-2 border-emerald-600 p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">New Site Trade Registration</h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="company" required placeholder="Company Name" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold" />
              <input name="trade_role" required placeholder="Trade (e.g. Interior Systems)" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-blue-500" />
            </div>
            <input name="email" placeholder="Primary Email" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold" />
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowContactModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-xs">Discard</button>
              <button type="submit" className="flex-1 bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl shadow-emerald-900/30">Register Trade</button>
            </div>
          </form>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
            if(!file) return;
            const path = `${id}/plans/${Date.now()}-${file.name}`;
            await handleUpload(file, path, 'project_documents', { 
              project_id: id, title: fd.get('title'), doc_type: 'Plan', revision_number: fd.get('revision') || 'IFC' 
            });
            setShowPlanModal(false);
          }} className="bg-slate-900 border-2 border-blue-600 p-10 rounded-[56px] max-w-lg w-full space-y-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault New Drawing</h2>
            <input name="file" type="file" required accept=".pdf" className="w-full text-xs text-slate-500 file:py-4 file:px-6 file:rounded-xl file:bg-slate-800 file:text-white" />
            <input name="title" required placeholder="Drawing Title" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white" />
            <input name="revision" placeholder="Revision (e.g. Rev 3)" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-blue-500 uppercase" />
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-xs">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">{uploading ? 'Processing...' : 'Upload Plan'}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}