'use client'

// 1. VERCEL BUILD FIX
export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, Users, HardHat, Building2, FileCheck, ShieldCheck, 
  FileText, Phone, Mail, ChevronLeft, Loader2, MessageSquare,
  Settings2, Save, X, ExternalLink, ClipboardList, FileQuestion, Images
} from 'lucide-react'

export default function ProjectWarRoom() {
  const { id } = useParams()
  const router = useRouter()
  
  // Layout & UI State
  const [activeTab, setActiveTab] = useState('photos') 
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  // Data States
  const [project, setProject] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [submittals, setSubmittals] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [allPhotos, setAllPhotos] = useState<any[]>([])
  
  // KPI Counts
  const [punchCount, setPunchCount] = useState(0)
  const [logCount, setLogCount] = useState(0)
  const [rfiCount, setRfiCount] = useState(0)
  const [manpowerTotal, setManpowerTotal] = useState(0)

  // Modals & Editing State
  const [editingContact, setEditingContact] = useState<any>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showSubmittalModal, setShowSubmittalModal] = useState<{show: boolean, contactId: string | null, category: string}>({
    show: false, contactId: null, category: 'Submittal'
  })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    
    const [p, manual, logs, punch, cts, dcs, rfis, subs] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_photos').select('*').eq('project_id', id),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }),
      supabase.from('punch_list').select('id, status').eq('project_id', id),
      supabase.from('project_contacts').select('*').eq('project_id', id),
      supabase.from('project_documents').select('*').eq('project_id', id),
      supabase.from('rfis').select('id, status').eq('project_id', id).eq('status', 'Open'),
      supabase.from('project_submittals').select('*').eq('project_id', id)
    ])

    setProject(p.data)
    setContacts(cts.data || [])
    setDocs(dcs.data || [])
    setSubmittals(subs.data || [])
    
    // KPI Processing
    setPunchCount(punch.data?.filter(i => i.status === 'Open').length || 0)
    setLogCount(logs.data?.length || 0)
    setRfiCount(rfis.data?.length || 0) 
    
    // Pull most recent manpower total from the latest log
    if (logs.data && logs.data[0]) {
      const latest = logs.data[0].manpower || ""
      const match = latest.match(/(\d+)/)
      setManpowerTotal(match ? parseInt(match[0]) : 0)
    }

    // Photo Stream Consolidation
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

  // --- HANDLERS ---
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('project_contacts').update(editingContact).eq('id', editingContact.id)
    if (!error) { setEditingContact(null); fetchData(); }
  }

  const handleUploadPhoto = async (file: File) => {
    setUploading(true)
    const path = `${id}/gallery/${Date.now()}-${file.name}`
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    
    if (!sErr) {
      const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
      await supabase.from('project_photos').insert([{ project_id: id, caption: file.name, source: 'Manual', url: u.publicUrl }])
      fetchData()
    } else {
      alert(`Photo upload failed: ${sErr.message}`)
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
    } else {
      alert(`Document upload failed: ${sErr.message}`)
    }
    setUploading(false)
    setShowSubmittalModal({ show: false, contactId: null, category: 'Submittal' })
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-[0.5em]">Syncing Master...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER ACTION BAR */}
      <div className="mb-12 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
        <div className="space-y-1">
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white flex items-center gap-1 transition-all">
            <ChevronLeft size={12}/> Portfolio
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">{project?.name}</h1>
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-3 flex items-center gap-2">📍 {project?.address || project?.location}</p>
        </div>
        
        {/* KPI MODULES */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 px-6 py-4 rounded-3xl">
            <Users size={18} className="text-blue-500" />
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-500 uppercase italic">Headcount</p>
              <p className="text-xs font-black uppercase text-blue-400">{manpowerTotal} Workers</p>
            </div>
          </div>
          <Link href={`/projects/${id}/logs`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-3xl hover:border-blue-500 transition-all shadow-xl">
            <FileText size={18} className="text-blue-500" />
            <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">Logs</p><p className="text-xs font-black uppercase text-white">{logCount}</p></div>
          </Link>
          <Link href={`/projects/${id}/punchlist`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-3xl hover:border-red-500 transition-all shadow-xl">
            <ClipboardList size={18} className="text-red-500" />
            <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">Punch</p><p className="text-xs font-black uppercase text-white">{punchCount}</p></div>
          </Link>
          <Link href={`/projects/${id}/rfis`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-4 rounded-3xl hover:border-amber-500 transition-all shadow-xl">
            <FileQuestion size={18} className="text-amber-500" />
            <div className="text-left"><p className="text-[8px] font-black text-slate-500 uppercase">RFIs</p><p className="text-xs font-black uppercase text-white">{rfiCount}</p></div>
          </Link>
        </div>
      </div>

      {/* PRIMARY TAB SYSTEM */}
      <div className="flex gap-2 border-b border-slate-800 mb-10 overflow-x-auto no-scrollbar">
        {['photos', 'plans', 'contacts'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-10 py-5 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab === 'contacts' ? 'Directory & Compliance' : tab === 'plans' ? 'Blueprint Vault' : 'Site Stream'}
          </button>
        ))}
      </div>

      {/* TAB 1: SITE PHOTO STREAM */}
      {activeTab === 'photos' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 shadow-xl gap-4">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Site <span className="text-blue-500">Stream</span></h3>
            <label className="bg-blue-600 text-white text-[10px] font-black px-10 py-4 rounded-2xl uppercase cursor-pointer hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2">
              {uploading ? <Loader2 className="animate-spin" size={14}/> : <Images size={14}/>}
              {uploading ? 'Processing...' : 'Add Visual'}
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/jpg,image/heic" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0]; 
                  if(f) handleUploadPhoto(f)
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
            {allPhotos.length === 0 && (
              <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-800 rounded-[32px] text-slate-600 font-black uppercase text-[10px] tracking-widest">
                No visual data recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BLUEPRINT VAULT */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <button onClick={() => setShowPlanModal(true)} className="aspect-[4/3] border-4 border-dashed border-slate-800 rounded-[48px] flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500/50 transition-all">
            <Plus size={48} className="mb-4" />
            <span className="text-xs font-black uppercase tracking-widest">Vault New Drawing</span>
          </button>
          {docs.filter(d => d.doc_type === 'Plan').map(plan => (
            <div key={plan.id} className="bg-slate-900 p-8 rounded-[48px] border border-slate-800 shadow-2xl relative">
              <span className="bg-blue-950 text-blue-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase mb-4 inline-block italic">
                Rev: {plan.revision_number}
              </span>
              <h4 className="text-2xl font-black text-white uppercase italic truncate mb-8">{plan.title}</h4>
              <Link href={`/projects/${id}/viewer/${plan.id}`} className="block w-full text-center bg-slate-800 hover:bg-blue-600 py-6 rounded-3xl text-[11px] font-black uppercase text-white transition-all shadow-lg">
                Open Internal Viewer →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: TRADE COMPLIANCE VAULT */}
      {activeTab === 'contacts' && (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-slate-900/50 p-8 rounded-[40px] border border-slate-800 shadow-xl">
             <h3 className="text-2xl font-black uppercase italic">Trade <span className="text-blue-500">Directory</span></h3>
             <button onClick={() => setShowContactModal(true)} className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">+ Register Trade</button>
          </div>

          <div className="grid grid-cols-1 gap-12">
            {contacts.map(trade => (
              <div key={trade.id} className="bg-slate-900 rounded-[48px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                
                {/* TRADE HEADER & INLINE EDITING */}
                <div className="p-8 md:p-10 border-b border-slate-800 bg-slate-900/50">
                  {editingContact?.id === trade.id ? (
                    <form onSubmit={handleUpdateContact} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input className="bg-slate-950 p-4 rounded-xl border border-blue-500/50 text-white font-bold" value={editingContact.company} onChange={e => setEditingContact({...editingContact, company: e.target.value})} placeholder="Company Name" />
                        <input className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-white font-bold" value={editingContact.trade_role} onChange={e => setEditingContact({...editingContact, trade_role: e.target.value})} placeholder="Trade Role" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Foreman Contact</p>
                          <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm" value={editingContact.foreman_name || ''} onChange={e => setEditingContact({...editingContact, foreman_name: e.target.value})} placeholder="Foreman Name" />
                          <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm" value={editingContact.foreman_phone || ''} onChange={e => setEditingContact({...editingContact, foreman_phone: e.target.value})} placeholder="Foreman Phone" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Office Contact</p>
                          <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm" value={editingContact.office_name || ''} onChange={e => setEditingContact({...editingContact, office_name: e.target.value})} placeholder="PM Name" />
                          <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm" value={editingContact.office_phone || ''} onChange={e => setEditingContact({...editingContact, office_phone: e.target.value})} placeholder="Office Phone" />
                        </div>
                      </div>
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm" value={editingContact.email || ''} onChange={e => setEditingContact({...editingContact, email: e.target.value})} placeholder="Company Email" />
                      
                      <div className="flex gap-4">
                        <button type="submit" className="flex-1 bg-blue-600 p-4 rounded-xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2"><Save size={16}/> Save Updates</button>
                        <button onClick={() => setEditingContact(null)} className="flex-1 bg-slate-800 p-4 rounded-xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2"><X size={16}/> Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col lg:flex-row justify-between gap-8">
                      <div className="flex-1">
                        <h4 className="text-4xl font-black text-white uppercase italic leading-none">{trade.company}</h4>
                        <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mt-3">{trade.trade_role}</p>
                        
                        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* FOREMAN CARD WITH CALL/TEXT */}
                          <div className="bg-black/20 p-6 rounded-3xl border border-slate-800/50 flex flex-col justify-between">
                            <div>
                              <p className="text-[9px] font-black text-slate-600 uppercase mb-2 flex items-center gap-2">
                                <HardHat size={14} className="text-emerald-500" /> Site Foreman
                              </p>
                              <p className="text-lg font-black text-white uppercase truncate">{trade.foreman_name || 'Unassigned'}</p>
                            </div>
                            
                            <div className="mt-6 grid grid-cols-2 gap-3">
                              <a href={`tel:${trade.foreman_phone}`} className="bg-slate-800 hover:bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all shadow-lg">
                                <Phone size={14}/> Call
                              </a>
                              <a href={`sms:${trade.foreman_phone}`} className="bg-slate-800 hover:bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all shadow-lg">
                                <MessageSquare size={14}/> Text
                              </a>
                            </div>
                          </div>

                          {/* OFFICE CARD WITH CALL/EMAIL */}
                          <div className="bg-black/20 p-6 rounded-3xl border border-slate-800/50 flex flex-col justify-between">
                            <div>
                              <p className="text-[9px] font-black text-slate-600 uppercase mb-2 flex items-center gap-2">
                                <Building2 size={14} className="text-blue-500" /> Office / PM
                              </p>
                              <p className="text-lg font-black text-white uppercase truncate">{trade.office_name || 'Unassigned'}</p>
                            </div>
                            
                            <div className="mt-6 grid grid-cols-2 gap-3">
                              <a href={`tel:${trade.office_phone}`} className="bg-slate-800 hover:bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all shadow-lg">
                                <Phone size={14}/> Call
                              </a>
                              <a href={`mailto:${trade.email}`} className="bg-slate-800 hover:bg-amber-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex justify-center items-center gap-2 transition-all shadow-lg">
                                <Mail size={14}/> Email
                              </a>
                            </div>
                          </div>

                        </div>
                      </div>
                      <button onClick={() => setEditingContact(trade)} className="self-start p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl">
                        <Settings2 size={24} />
                      </button>
                    </div>
                  )}
                </div>

                {/* THE THREE COMPLIANCE BOXES */}
                <div className="p-8 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-slate-950/30">
                  <DocBox title="Submittals" icon={<FileCheck size={18} className="text-blue-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Submittal')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Submittal' })} />
                  <DocBox title="Safety Docs" icon={<ShieldCheck size={18} className="text-emerald-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Safety')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Safety' })} />
                  <DocBox title="Contracts" icon={<FileText size={18} className="text-amber-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Contract')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Contract' })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Document Upload Modal */}
      {showSubmittalModal.show && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); 
            const fd = new FormData(e.currentTarget);
            const title = fd.get('title') as string;
            const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
            
            if (!file || !title) return alert('Please provide both a title and a file.');
            await handleUploadDoc(file, showSubmittalModal.contactId!, showSubmittalModal.category, title);
          }} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault New {showSubmittalModal.category}</h2>
            <input name="title" required placeholder={`Document Name (e.g. ${showSubmittalModal.category === 'Safety' ? 'WSIB' : 'PO'})`} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
            <input name="file" type="file" required accept=".pdf" className="w-full text-xs text-slate-500 file:bg-slate-800 file:text-white file:px-4 file:py-2 file:rounded-lg cursor-pointer" />
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowSubmittalModal({show: false, contactId: null, category: 'Submittal'})} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button type="submit" disabled={uploading} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blueprint Upload Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); const fd = new FormData(e.currentTarget);
            const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
            if(!file) return;
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
          }} className="bg-slate-900 border-2 border-blue-600 p-10 rounded-[56px] max-w-lg w-full space-y-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault Drawing</h2>
            <input name="file" type="file" required accept=".pdf" className="w-full text-xs text-slate-500" />
            <input name="title" required placeholder="Drawing Title" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-white" />
            <input name="revision" placeholder="Revision (e.g. Rev 3)" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-blue-500 uppercase" />
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-xs">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl">{uploading ? 'Processing...' : 'Upload Plan'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Register Trade Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
         <form onSubmit={async (e) => {
  e.preventDefault(); 
  const fd = new FormData(e.currentTarget);
  const { error } = await supabase.from('project_contacts').insert([{ 
    project_id: id, 
    name: fd.get('company'), // <--- THIS FIXES THE CRASH
    company: fd.get('company'), 
    trade_role: fd.get('trade_role'), 
    foreman_name: fd.get('foreman_name'), 
    foreman_phone: fd.get('foreman_phone'),
    office_name: fd.get('office_name'), 
    office_phone: fd.get('office_phone'), 
    email: fd.get('email')
  }]);
  if (!error) { setShowContactModal(false); fetchData(); } else { alert(error.message); }
}} className="bg-slate-900 border-2 border-emerald-600 p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
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

            <input name="email" placeholder="Primary Email Address" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-blue-500" />
            
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowContactModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest">Discard</button>
              <button type="submit" className="flex-1 bg-emerald-600 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/30">Register Trade</button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}

function DocBox({ title, icon, docs, onAdd }: { title: string, icon: any, docs: any[], onAdd: () => void }) {
  return (
    <div className="flex flex-col h-full bg-slate-900/50 border border-slate-800 rounded-[32px] p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <h5 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400">
          {icon} {title}
        </h5>
        <button onClick={onAdd} className="bg-blue-600/10 text-blue-400 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 space-y-3">
        {docs.length === 0 ? (
          <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl">
            <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">Awaiting Docs</p>
          </div>
        ) : (
          docs.map(doc => (
            <div key={doc.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
              <p className="text-[10px] font-bold text-white truncate pr-2 uppercase italic">{doc.title}</p>
              <a href={doc.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-500"><ExternalLink size={14} /></a>
            </div>
          ))
        )}
      </div>
    </div>
  )
}