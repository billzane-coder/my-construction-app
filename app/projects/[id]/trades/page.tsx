'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, Settings2, Save, X, ExternalLink, 
  FileCheck, ShieldCheck, FileText, Inbox, UserCog 
} from 'lucide-react'

export default function TradeHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [submittals, setSubmittals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  
  const [editingContact, setEditingContact] = useState<any>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showSubmittalModal, setShowSubmittalModal] = useState<{show: boolean, contactId: string | null, category: string}>({
    show: false, contactId: null, category: 'Submittal'
  })

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [p, cts, subs] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('project_contacts').select('*').eq('project_id', id).order('company'),
      supabase.from('project_submittals').select('*').eq('project_id', id)
    ])
    setProject(p.data)
    setContacts(cts.data || [])
    setSubmittals(subs.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    // Ensure the 'name' column stays synced with the company name if edited
    const updatedPayload = { ...editingContact, name: editingContact.company }
    
    const { error } = await supabase.from('project_contacts').update(updatedPayload).eq('id', editingContact.id)
    if (!error) { setEditingContact(null); fetchData(); }
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Loading Trades...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Trade <span className="text-emerald-500">Hub</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <UserCog size={14} className="text-emerald-500" /> {project?.name || 'Compliance Directory'}
          </p>
        </div>
        <button onClick={() => setShowContactModal(true)} className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">
          + Register Trade
        </button>
      </div>

      {/* TRADE LIST */}
      <div className="grid grid-cols-1 gap-12 animate-in fade-in duration-500">
        {contacts.map(trade => (
          <div key={trade.id} className="bg-slate-900 rounded-[48px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            
            {/* TRADE INFO HEADER */}
            <div className="p-8 md:p-10 border-b border-slate-800 bg-slate-900/50">
              {editingContact?.id === trade.id ? (
                <form onSubmit={handleUpdateContact} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="bg-slate-950 p-4 rounded-xl border border-blue-500/50 text-white font-bold outline-none focus:border-blue-500" value={editingContact.company} onChange={e => setEditingContact({...editingContact, company: e.target.value})} placeholder="Company Name" />
                    <input className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-emerald-500 font-bold uppercase outline-none focus:border-blue-500" value={editingContact.trade_role} onChange={e => setEditingContact({...editingContact, trade_role: e.target.value})} placeholder="Trade Role" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Foreman Contact</p>
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.foreman_name || ''} onChange={e => setEditingContact({...editingContact, foreman_name: e.target.value})} placeholder="Foreman Name" />
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.foreman_phone || ''} onChange={e => setEditingContact({...editingContact, foreman_phone: e.target.value})} placeholder="Foreman Phone" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Office Contact</p>
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.office_name || ''} onChange={e => setEditingContact({...editingContact, office_name: e.target.value})} placeholder="PM Name" />
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.office_phone || ''} onChange={e => setEditingContact({...editingContact, office_phone: e.target.value})} placeholder="Office Phone" />
                    </div>
                  </div>
                  <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.email || ''} onChange={e => setEditingContact({...editingContact, email: e.target.value})} placeholder="Company Email" />
                  
                  <div className="flex gap-4">
                    <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2 transition-all"><Save size={16}/> Save Updates</button>
                    <button type="button" onClick={() => setEditingContact(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2 transition-all"><X size={16}/> Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="flex-1">
                    <h4 className="text-4xl font-black text-white uppercase italic leading-none">{trade.company}</h4>
                    <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-3">{trade.trade_role}</p>
                    
                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-black/20 p-6 rounded-3xl border border-slate-800/50">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-2">Site Foreman</p>
                        <p className="text-lg font-black text-white uppercase truncate mb-4">{trade.foreman_name || 'Unassigned'}</p>
                        <div className="flex gap-2">
                          {trade.foreman_phone && <a href={`tel:${trade.foreman_phone}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-600 transition-all text-white">Call</a>}
                          {trade.foreman_phone && <a href={`sms:${trade.foreman_phone}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-emerald-600 transition-all text-white">Text</a>}
                        </div>
                      </div>
                      <div className="bg-black/20 p-6 rounded-3xl border border-slate-800/50">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-2">Office / PM</p>
                        <p className="text-lg font-black text-white uppercase truncate mb-4">{trade.office_name || 'Unassigned'}</p>
                        <div className="flex gap-2">
                          {trade.office_phone && <a href={`tel:${trade.office_phone}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-blue-600 transition-all text-white">Call</a>}
                          {trade.email && <a href={`mailto:${trade.email}`} className="flex-1 bg-slate-800 py-3 rounded-xl text-[9px] font-black uppercase text-center hover:bg-amber-600 transition-all text-white">Email</a>}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button type="button" onClick={() => setEditingContact(trade)} className="p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl active:scale-95 self-start">
                    <Settings2 size={24} />
                  </button>
                </div>
              )}
            </div>

            {/* COMPLIANCE DOCUMENTS GRID */}
            <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 bg-slate-950/30">
              <DocBox title="Submittals" icon={<FileCheck size={18} className="text-blue-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Submittal')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Submittal' })} />
              <DocBox title="Safety Docs" icon={<ShieldCheck size={18} className="text-emerald-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Safety')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Safety' })} />
              <DocBox title="Contracts" icon={<FileText size={18} className="text-amber-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Contract')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Contract' })} />
              <DocBox title="Site Instructions" icon={<Inbox size={18} className="text-purple-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'SI')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'SI' })} />
            </div>

          </div>
        ))}
      </div>

      {/* --- MODALS --- */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); 
            
            try {
              const fd = new FormData(e.currentTarget);
              
              // 1. Build the payload WITH the required 'name' field
              const payload = { 
                project_id: id, 
                name: fd.get('company'), // <-- FIXED: Satisfies Supabase NOT NULL constraint
                company: fd.get('company'), 
                trade_role: fd.get('trade_role'), 
                foreman_name: fd.get('foreman_name'), 
                foreman_phone: fd.get('foreman_phone'),
                office_name: fd.get('office_name'), 
                office_phone: fd.get('office_phone'), 
                email: fd.get('email')
              };

              console.log("Attempting to save payload:", payload);

              // 2. Fire the insert
              const { data, error } = await supabase
                .from('project_contacts')
                .insert([payload])
                .select(); 

              // 3. Handle the response
              if (error) {
                console.error("SUPABASE ERROR:", error.message, error.details, error.hint);
                alert(`Save failed: ${error.message}`); 
                return; 
              }

              // Success
              console.log("Save successful!", data);
              setShowContactModal(false); 
              fetchData();

            } catch (err) {
              console.error("Total crash during save:", err);
              alert("Something broke before reaching Supabase. Check console.");
            }
          }} className="bg-slate-900 border-2 border-emerald-600 p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">New Trade Registration</h2>
            <div className="grid grid-cols-2 gap-4">
              <input name="company" required placeholder="Company Name" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-blue-500" />
              <input name="trade_role" required placeholder="Trade (e.g. Drywall)" className="p-5 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-emerald-500 outline-none focus:border-blue-500 uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Site Foreman</p>
                <input name="foreman_name" placeholder="Foreman Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" />
                <input name="foreman_phone" placeholder="Phone Number" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Office / PM</p>
                <input name="office_name" placeholder="Contact Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" />
                <input name="office_phone" placeholder="Office Phone" className="w-full p-4 bg-slate-950 rounded-xl border border