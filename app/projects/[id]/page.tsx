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
  Images, Inbox, ClipboardCheck, Calendar, Activity
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('photos') 
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  const [project, setProject] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [submittals, setSubmittals] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  
  const [punchCount, setPunchCount] = useState(0)
  const [logCount, setLogCount] = useState(0)
  const [rfiCount, setRfiCount] = useState(0)
  const [manpowerTotal, setManpowerTotal] = useState(0)
  const [inspectionProgress, setInspectionProgress] = useState(0)

  const [editingContact, setEditingContact] = useState<any>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showSubmittalModal, setShowSubmittalModal] = useState<{show: boolean, contactId: string | null, category: string}>({
    show: false, contactId: null, category: 'Submittal'
  })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [p, manual, logs, punch, cts, dcs, rfis, subs, inspections] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
      supabase.from('punch_list').select('id, status').eq('project_id', id),
      supabase.from('project_contacts').select('*').eq('project_id', id),
      supabase.from('project_documents').select('*').eq('project_id', id),
      supabase.from('rfis').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('project_submittals').select('*').eq('project_id', id),
      supabase.from('project_inspections').select('status, unit_name').eq('project_id', id)
    ])

    setProject(p.data)
    setContacts(cts.data || [])
    setDocs(dcs.data || [])
    setSubmittals(subs.data || [])
    setPunchCount(punch.data?.filter(i => i.status === 'Open').length || 0)
    setLogCount(logs.data?.length || 0)
    setRfiCount(rfis.data?.length || 0) 
    
    if (logs.data && logs.data[0]) {
      const log = logs.data[0]
      const counts = (log.manpower || "").match(/\d+/g)
      setManpowerTotal(counts ? counts.reduce((acc: number, cur: string) => acc + parseInt(cur), 0) : 0)
    }

    if (inspections.data && inspections.data.length > 0) {
      const passed = inspections.data.filter(i => i.status === 'Pass').length
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

  const handleUploadDoc = async (file: File, contactId: string, category: string, title: string) => {
    setUploading(true)
    const path = `${id}/trades/${contactId}/${category}/${Date.now()}-${file.name}`
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    if (!sErr) {
      const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
      await supabase.from('project_submittals').insert([{
        project_id: id, contact_id: contactId, title, category, url: u.publicUrl, status: 'Pending Review'
      }])
      fetchData()
      setShowSubmittalModal({ show: false, contactId: null, category: 'Submittal' })
    }
    setUploading(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Master...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER SECTION */}
      <div className="mb-8 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Portfolio</button>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full xl:w-auto">
          <StatCard label="Manpower" value={`${manpowerTotal} Active`} icon={<Users size={16}/>} color="text-blue-500" />
          <StatCard label="Inspections" value={`${inspectionProgress}%`} icon={<ClipboardCheck size={16}/>} color="text-emerald-500" href={`/projects/${id}/matrix`} />
          <StatCard label="Punch" value={punchCount} icon={<ClipboardList size={16}/>} color="text-red-500" href={`/projects/${id}/punchlist`} />
          <StatCard label="RFIs" value={rfiCount} icon={<FileQuestion size={16}/>} color="text-amber-500" href={`/projects/${id}/rfis`} />
          <StatCard label="Daily Logs" value={logCount} icon={<FileText size={16}/>} color="text-slate-400" href={`/projects/${id}/logs`} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
        <ModuleLink title="Matrix" href={`/projects/${id}/matrix`} icon={<Activity size={20}/>} color="bg-blue-600" />
        <ModuleLink title="Logs" href={`/projects/${id}/logs`} icon={<FileText size={20}/>} color="bg-emerald-600" />
        <ModuleLink title="Punch" href={`/projects/${id}/punchlist`} icon={<ClipboardList size={20}/>} color="bg-red-600" />
        <ModuleLink title="Schedule" href={`/projects/${id}/schedule`} icon={<Calendar size={20}/>} color="bg-purple-600" />
        <ModuleLink title="Submittals" href={`/projects/${id}/submittals`} icon={<FileCheck size={20}/>} color="bg-pink-600" />
        <ModuleLink title="Safety Hub" href={`/projects/${id}/safety`} icon={<ShieldCheck size={20}/>} color="bg-orange-600" />
      </div>

      <div className="flex gap-2 border-b border-slate-800 mb-10 overflow-x-auto no-scrollbar">
        {['photos', 'plans', 'contacts'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab === 'contacts' ? 'Trade Hub' : tab === 'plans' ? 'Blueprint Vault' : 'Site Visual Stream'}
          </button>
        ))}
      </div>

      {activeTab === 'photos' && (
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
      )}

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button onClick={() => setShowPlanModal(true)} className="aspect-[4/3] border-4 border-dashed border-slate-800 rounded-[48px] flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500/50 transition-all">
            <Plus size={48} className="mb-4" />
            <span className="text-xs font-black uppercase tracking-widest">Vault New Drawing</span>
          </button>
          {docs.filter(d => d.doc_type === 'Plan').map(plan => (
            <div key={plan.id} className="bg-slate-900 p-8 rounded-[48px] border border-slate-800 shadow-2xl relative flex flex-col justify-between h-full">
              <div>
                <span className="bg-blue-950 text-blue-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase mb-4 inline-block italic">Rev: {plan.revision_number}</span>
                <h4 className="text-2xl font-black text-white uppercase italic truncate mb-8">{plan.title}</h4>
              </div>
              <Link href={`/projects/${id}/viewer/${plan.id}`} className="block w-full text-center bg-slate-800 hover:bg-blue-600 py-6 rounded-3xl text-[11px] font-black uppercase text-white transition-all shadow-lg">Open Viewer →</Link>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-12">
          <div className="flex justify-between items-center bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-xl">
             <h3 className="text-2xl font-black uppercase italic">Trade <span className="text-blue-500">Hub</span></h3>
             <button onClick={() => setShowContactModal(true)} className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg hover:bg-emerald-500 transition-all">+ Register Trade</button>
          </div>
          <div className="grid grid-cols-1 gap-12">
            {contacts.map(trade => (
              <div key={trade.id} className="bg-slate-900 rounded-[48px] border border-slate-800 shadow-2xl overflow-hidden">
                <div className="p-8 md:p-10 border-b border-slate-800 bg-slate-900/50 flex justify-between gap-6">
                  <div className="flex-1">
                    <h4 className="text-4xl font-black text-white uppercase italic leading-none">{trade.company}</h4>
                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mt-3">{trade.trade_role}</p>
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ContactBox label="Site Foreman" name={trade.foreman_name} phone={trade.foreman_phone} />
                      <ContactBox label="Office / PM" name={trade.office_name} phone={trade.office_phone} email={trade.email} />
                    </div>
                  </div>
                  <button onClick={() => setEditingContact(trade)} className="p-4 bg-slate-800 rounded-2xl h-fit text-slate-400 hover:text-white transition-all"><Settings2 size={24} /></button>
                </div>
                <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 bg-slate-950/30">
                  <DocBox title="Submittals" icon={<FileCheck size={18} className="text-blue-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Submittal')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Submittal' })} />
                  <DocBox title="Safety Docs" icon={<ShieldCheck size={18} className="text-emerald-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Safety')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Safety' })} />
                  <DocBox title="Contracts" icon={<FileText size={18} className="text-amber-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Contract')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Contract' })} />
                  <DocBox title="Site Instructions" icon={<Inbox size={18} className="text-purple-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'SI')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'SI' })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {showPlanModal && (
        <PlanModal onClose={() => setShowPlanModal(false)} onUpload={async (fd: FormData) => {
          const file = fd.get('file') as File;
          const path = `${id}/plans/${Date.now()}-${file.name}`;
          setUploading(true);
          const { error: sErr } = await supabase.storage.from('project-files').upload(path, file);
          if(!sErr) {
            const { data: u } = supabase.storage.from('project-files').getPublicUrl(path);
            await supabase.from('project_documents').insert([{ 
              project_id: id, title: fd.get('title'), doc_type: 'Plan', revision_number: fd.get('revision') || 'IFC', file_url: u.publicUrl 
            }]);
            fetchData(); setShowPlanModal(false);
          }
          setUploading(false);
        }} uploading={uploading} />
      )}

      {showSubmittalModal.show && <SubmittalModal onClose={() => setShowSubmittalModal({show: false, contactId: null, category: 'Submittal'})} onUpload={handleUploadDoc} category={showSubmittalModal.category} uploading={uploading} />}

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} onSave={async (fd: FormData) => {
          const { error } = await supabase.from('project_contacts').insert([{ 
            project_id: id, company: fd.get('company'), trade_role: fd.get('trade_role'), 
            foreman_name: fd.get('foreman_name'), foreman_phone: fd.get('foreman_phone'),
            office_name: fd.get('office_name'), office_phone: fd.get('office_phone'), email: fd.get('email')
          }]);
          if (!error) { setShowContactModal(false); fetchData(); }
        }} />
      )}

    </div>
  )
}

// --- HELPER COMPONENTS ---

function PlanModal({ onClose, onUpload, uploading }: any) {
  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <form onSubmit={(e) => { e.preventDefault(); onUpload(new FormData(e.currentTarget)); }} className="bg-slate-900 border-2 border-blue-600 p-10 rounded-[56px] max-w-lg w-full space-y-8 shadow-2xl">
        <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault Drawing</h2>
        <input name="file" type="file" required accept=".pdf" className="w-full text-xs text-slate-500" />
        <input name="title" required placeholder="Drawing Title" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-white" />
        <input name="revision" placeholder="Revision (e.g. Rev 3)" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-blue-500 uppercase" />
        <div className="flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-xs">Cancel</button>
          <button type="submit" className="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">{uploading ? 'Processing...' : 'Upload Plan'}</button>
        </div>
      </form>
    </div>
  )
}

function ContactModal({ onClose, onSave }: any) {
  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <form onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }} className="bg-slate-900 border-2 border-emerald-600 p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-black text-white uppercase italic text-center">New Site Trade Registration</h2>
        <div className="grid grid-cols-2 gap-4">
          <input name="company" required placeholder="Company Name" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-blue-500" />
          <input name="trade_role" required placeholder="Trade (e.g. Drywall)" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-blue-500 outline-none focus:border-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Site Foreman</p>
            <input name="foreman_name" placeholder="Foreman Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm" />
            <input name="foreman_phone" placeholder="Phone Number" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm" />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Office / PM</p>
            <input name="office_name" placeholder="Contact Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm" />
            <input name="office_phone" placeholder="Office Phone" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm" />
          </div>
        </div>
        <input name="email" placeholder="Primary Email Address" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white" />
        <div className="flex gap-4 pt-6">
          <button type="button" onClick={onClose} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest">Discard</button>
          <button type="submit" className="flex-1 bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/30">Register Trade</button>
        </div>
      </form>
    </div>
  )
}

function StatCard({ label, value, icon, color, href }: any) {
  const Card = (
    <div className={`flex items-center gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl hover:bg-slate-800 transition-all shadow-xl cursor-pointer`}>
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
    <Link href={href} className="group">
      <div className={`p-4 rounded-3xl ${color} flex flex-col items-center justify-center gap-2 shadow-xl hover:scale-105 transition-all text-white border-b-4 border-black/20`}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
    </Link>
  )
}

function ContactBox({ label, name, phone, email }: any) {
  return (
    <div className="bg-black/20 p-5 rounded-3xl border border-slate-800/50">
      <p className="text-[9px] font-black text-slate-600 uppercase mb-2">{label}</p>
      <p className="text-lg font-black text-white uppercase truncate mb-4">{name || 'Unassigned'}</p>
      <div className="flex gap-2">
        {phone && <a href={`tel:${phone}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-600">Call</a>}
        {email && <a href={`mailto:${email}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-amber-600">Email</a>}
      </div>
    </div>
  )
}

function DocBox({ title, icon, docs, onAdd }: any) {
  return (
    <div className="bg-slate-950/50 p-6 rounded-[32px] border border-slate-800 flex flex-col h-full shadow-lg">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
        <h5 className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400">
          {icon} {title}
        </h5>
        <button onClick={onAdd} className="bg-blue-600 text-white p-1.5 rounded-lg hover:scale-110 transition-all"><Plus size={12} /></button>
      </div>
      <div className="space-y-2 flex-1">
        {docs.length === 0 ? <p className="text-[8px] font-black text-slate-700 uppercase italic text-center py-4">Awaiting Files</p> :
          docs.map((doc: any) => (
            <a href={doc.url} target="_blank" key={doc.id} className="block bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center hover:border-blue-500 transition-all">
              <span className="text-[10px] font-bold text-white uppercase truncate pr-2">{doc.title}</span>
              <ExternalLink size={12} className="text-slate-500" />
            </a>
          ))
        }
      </div>
    </div>
  )
}

function SubmittalModal({ onClose, onUpload, category, uploading }: any) {
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-md w-full space-y-6 shadow-2xl">
        <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault New {category}</h2>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document Name" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-xs text-slate-500" />
        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
          <button onClick={() => onUpload(file, title)} disabled={uploading} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px]">{uploading ? 'Uploading...' : 'Upload'}</button>
        </div>
      </div>
    </div>
  )
}