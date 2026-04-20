'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Phone, Mail, ShieldAlert, ShieldCheck, 
  FileText, ExternalLink, CheckCircle2, XCircle, 
  DollarSign, Calculator, Search, AlertTriangle, UserCog,
  Plus, Settings2, Save, X, Inbox, Landmark, ArrowRight,
  FileCheck, Loader2, Globe
} from 'lucide-react'

export default function UnifiedTradesHub() {
  const { id } = useParams()
  const router = useRouter()
  
  // --- STATE ---
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  
  const [project, setProject] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [submittals, setSubmittals] = useState<any[]>([])
  const [globalSubs, setGlobalSubs] = useState<any[]>([]) // Holds Master Directory
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modals & Active States
  const [editingContact, setEditingContact] = useState<any>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [showSubmittalModal, setShowSubmittalModal] = useState<{show: boolean, contactId: string | null, category: string}>({
    show: false, contactId: null, category: 'Submittal'
  })

  // Add Trade Modal State
  const [masterSearch, setMasterSearch] = useState('')
  const [newTrade, setNewTrade] = useState({
    company: '', trade_role: '', foreman_name: '', foreman_phone: '', office_name: '', office_phone: '', email: ''
  })

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true)
    const [pRes, ctsRes, ctrsRes, subsRes, globalRes] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('project_contacts').select('*').eq('project_id', id).order('company'),
      supabase.from('project_contracts').select('*, contract_url, sov:sov_line_items(id, item_number, description, scheduled_value)').eq('project_id', id),
      supabase.from('project_submittals').select('*').eq('project_id', id),
      supabase.from('subcontractors').select('*').order('company_name') // Fetch Master List
    ])

    setProject(pRes.data)
    setSubmittals(subsRes.data || [])
    setGlobalSubs(globalRes.data || [])

    if (ctsRes.data) {
      const mergedContacts = ctsRes.data.map(contact => {
        const contract = ctrsRes.data?.find(c => c.contact_id === contact.id || c.subcontractor_id === contact.subcontractor_id)
        return { 
          ...contact, 
          contract: contract ? { ...contract, sov: contract.sov || [] } : null 
        }
      })
      setContacts(mergedContacts)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  // --- ACTIONS ---

  // Update existing project trade AND push updates globally
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // 1. Strip out the attached 'contract' object so Supabase doesn't reject the save
      const cleanPayload = {
        company: editingContact.company,
        name: editingContact.company, // Fallback for legacy name column
        trade_role: editingContact.trade_role,
        foreman_name: editingContact.foreman_name,
        foreman_phone: editingContact.foreman_phone,
        office_name: editingContact.office_name,
        office_phone: editingContact.office_phone,
        email: editingContact.email
      };
      
      // 2. Save to Project Cabinet
      const { error: projectError } = await supabase.from('project_contacts').update(cleanPayload).eq('id', editingContact.id);
      if (projectError) throw new Error("Project Save Error: " + projectError.message);
      
      // 3. Sync to Master Directory Cabinet
      const { error: globalError } = await supabase.from('subcontractors').update({
        trade_type: cleanPayload.trade_role,
        primary_contact: cleanPayload.office_name, 
        office_phone: cleanPayload.office_phone,
        email: cleanPayload.email,
        phone: cleanPayload.foreman_phone 
      }).eq('company_name', cleanPayload.company);

      if (globalError) throw new Error("Global Sync Error: " + globalError.message);

      setEditingContact(null); 
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  // Register brand new trade to project (and auto-push to master if new)
  const handleRegisterTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const payload = { 
        project_id: id, 
        name: newTrade.company, 
        company: newTrade.company, 
        trade_role: newTrade.trade_role, 
        foreman_name: newTrade.foreman_name, 
        foreman_phone: newTrade.foreman_phone,
        office_name: newTrade.office_name, 
        office_phone: newTrade.office_phone, 
        email: newTrade.email
      };
      
      // 1. Save to Current Project
      const { error } = await supabase.from('project_contacts').insert([payload]);
      if (error) throw error;

      // 2. Check if they exist in the Master Directory
      const existing = globalSubs.find(s => s.company_name.toLowerCase() === payload.company.toLowerCase());
      
      // 3. If brand new, push to Global Rolodex
      if (!existing) {
        await supabase.from('subcontractors').insert([{
          company_name: payload.company,
          trade_type: payload.trade_role,
          primary_contact: payload.office_name,
          office_phone: payload.office_phone,
          email: payload.email,
          phone: payload.foreman_phone
        }]);
      }

      setShowContactModal(false);
      setNewTrade({ company: '', trade_role: '', foreman_name: '', foreman_phone: '', office_name: '', office_phone: '', email: '' });
      setMasterSearch('');
      fetchData();
    } catch (err: any) {
      alert("Save failed: " + err.message);
    }
    setProcessing(false);
  }

  const handleAutoFill = (sub: any) => {
    setNewTrade({
      ...newTrade,
      company: sub.company_name || '',
      trade_role: sub.trade_type || '',
      office_name: sub.primary_contact || '',
      office_phone: sub.office_phone || '',
      email: sub.email || '',
      foreman_phone: sub.phone || '' // Pulls global direct phone down to foreman slot to start
    });
    setMasterSearch(''); // Closes dropdown
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

  const handleApproveContract = async () => {
    if (!confirm(`Activate contract for ${selectedContract.trade.company}?`)) return
    setProcessing(true)
    const { error } = await supabase.from('project_contracts').update({ status: 'Active' }).eq('id', selectedContract.id)
    if (error) alert("Approval failed: " + error.message)
    else { setSelectedContract(null); fetchData() }
    setProcessing(false)
  }

  const handleRejectContract = async () => {
    const reason = prompt("Enter reason for rejection (flips back to Draft):")
    if (!reason) return
    setProcessing(true)
    const { error } = await supabase.from('project_contracts').update({ status: 'Draft' }).eq('id', selectedContract.id)
    if (error) alert("Rejection failed")
    else { setSelectedContract(null); fetchData() }
    setProcessing(false)
  }

  const filteredContacts = contacts.filter(c => 
    c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.trade_role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredMaster = masterSearch 
    ? globalSubs.filter(s => s.company_name?.toLowerCase().includes(masterSearch.toLowerCase()))
    : []

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Directory...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32">
      
      {/* HEADER & SEARCH */}
      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Project War Room</button>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none mb-4">Site <span className="text-blue-500">Directory</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <UserCog size={14} className="text-blue-500" /> {project?.name || 'Trades & Contracts'}
          </p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col gap-4">
          <button 
            onClick={() => {
              setNewTrade({ company: '', trade_role: '', foreman_name: '', foreman_phone: '', office_name: '', office_phone: '', email: '' });
              setMasterSearch('');
              setShowContactModal(true);
            }} 
            className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16}/> Register Trade
          </button>
          <div className="relative w-full md:w-72">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search trades..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 pl-12 p-3 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-500">
        
        {/* FINANCIAL COMMAND CENTER CARD */}
        <div 
          onClick={() => router.push(`/projects/${id}/financials`)}
          className="bg-slate-900 border-2 border-emerald-500/20 p-8 md:p-10 rounded-[40px] hover:border-emerald-500 hover:bg-emerald-950/10 transition-all cursor-pointer group relative overflow-hidden shadow-2xl"
        >
          <div className="absolute right-[-20px] top-[-20px] text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors">
            <DollarSign size={200} />
          </div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
            <div className="flex items-center gap-6">
              <div className="bg-emerald-600 w-16 h-16 md:w-20 md:h-20 rounded-[24px] flex items-center justify-center text-white shadow-xl shrink-0">
                <Landmark size={32} />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">Project Financials</h3>
                <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mt-1 group-hover:text-emerald-400 transition-colors">Budget • Contracts • Monthly Draws</p>
              </div>
            </div>
            <div className="bg-slate-950 w-full md:w-auto px-8 py-4 rounded-2xl border border-slate-800 flex items-center justify-center gap-4 text-emerald-500 font-black text-xs uppercase tracking-widest group-hover:bg-emerald-600 group-hover:text-white transition-all">
              Manage Money <ArrowRight size={18} />
            </div>
          </div>
        </div>

        {/* TRADE LIST / ROLODEX */}
        {filteredContacts.map(trade => (
          <div key={trade.id} className="bg-slate-900 rounded-[32px] md:rounded-[48px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
            <button type="button" onClick={() => setEditingContact(trade)} className="absolute top-6 right-6 p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-xl z-10">
              <Settings2 size={20} />
            </button>

            <div className="p-6 md:p-10 border-b border-slate-800 bg-slate-900/50">
              {editingContact?.id === trade.id ? (
                <form onSubmit={handleUpdateContact} className="space-y-6 mt-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="bg-slate-950 p-4 rounded-xl border border-blue-500/50 text-white font-bold outline-none focus:border-blue-500" value={editingContact.company} onChange={e => setEditingContact({...editingContact, company: e.target.value})} placeholder="Company Name" />
                    <input className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-blue-500 font-bold uppercase outline-none focus:border-blue-500" value={editingContact.trade_role || ''} onChange={e => setEditingContact({...editingContact, trade_role: e.target.value})} placeholder="Trade Role" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Site Foreman Contact</p>
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.foreman_name || ''} onChange={e => setEditingContact({...editingContact, foreman_name: e.target.value})} placeholder="Foreman Name" />
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.foreman_phone || ''} onChange={e => setEditingContact({...editingContact, foreman_phone: e.target.value})} placeholder="Foreman Phone" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase pl-2">Office / PM Contact</p>
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.office_name || ''} onChange={e => setEditingContact({...editingContact, office_name: e.target.value})} placeholder="PM Name" />
                      <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.office_phone || ''} onChange={e => setEditingContact({...editingContact, office_phone: e.target.value})} placeholder="Office Phone" />
                    </div>
                  </div>
                  <input className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-white text-sm outline-none focus:border-blue-500" value={editingContact.email || ''} onChange={e => setEditingContact({...editingContact, email: e.target.value})} placeholder="Company Email" />
                  <div className="flex gap-4">
                    <button type="submit" disabled={processing} className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2 transition-all shadow-lg">
                      {processing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} 
                      Save & Sync Globally
                    </button>
                    <button type="button" onClick={() => setEditingContact(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black text-white uppercase text-[10px] flex items-center justify-center gap-2 transition-all"><X size={16}/> Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-6 pr-12">
                  <div>
                    {trade.contract && (
                      <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border mb-3 ${
                        trade.contract.status === 'Active' ? 'bg-emerald-950/30 text-emerald-500 border-emerald-900/50' : 
                        trade.contract.status === 'Pending Review' ? 'bg-amber-500 text-black border-amber-500 animate-pulse' : 
                        'bg-slate-950 text-slate-500 border-slate-800'
                      }`}>
                        {trade.contract.status} Contract
                      </span>
                    )}
                    <h4 className="text-3xl md:text-4xl font-black text-white uppercase italic leading-none">{trade.company}</h4>
                    <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2">{trade.trade_role || 'Uncategorized'}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/20 p-5 rounded-2xl border border-slate-800/50">
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-2">Site Foreman</p>
                      <p className="text-base font-black text-white uppercase truncate mb-4">{trade.foreman_name || 'Unassigned'}</p>
                      <div className="flex gap-2">
                        <a href={`tel:${trade.foreman_phone}`} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase text-center transition-all text-white ${trade.foreman_phone ? 'bg-slate-800 hover:bg-blue-600' : 'bg-slate-900 opacity-50 pointer-events-none'}`}>Call</a>
                        <a href={`sms:${trade.foreman_phone}`} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase text-center transition-all text-white ${trade.foreman_phone ? 'bg-slate-800 hover:bg-emerald-600' : 'bg-slate-900 opacity-50 pointer-events-none'}`}>Text</a>
                      </div>
                    </div>
                    <div className="bg-black/20 p-5 rounded-2xl border border-slate-800/50">
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-2">Office / PM</p>
                      <p className="text-base font-black text-white uppercase truncate mb-4">{trade.office_name || 'Unassigned'}</p>
                      <div className="flex gap-2">
                        <a href={`tel:${trade.office_phone}`} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase text-center transition-all text-white ${trade.office_phone ? 'bg-slate-800 hover:bg-blue-600' : 'bg-slate-900 opacity-50 pointer-events-none'}`}>Call</a>
                        <a href={`mailto:${trade.email}`} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase text-center transition-all text-white ${trade.email ? 'bg-slate-800 hover:bg-amber-600' : 'bg-slate-900 opacity-50 pointer-events-none'}`}>Email</a>
                      </div>
                    </div>
                  </div>

                  {trade.contract && (
                    <button 
                      onClick={() => setSelectedContract({ ...trade.contract, trade: trade })}
                      className={`w-full py-4 mt-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        trade.contract.status === 'Pending Review' 
                          ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/20 animate-pulse' 
                          : 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-500 hover:bg-emerald-900/50'
                      }`}
                    >
                      <UserCog size={16}/> 
                      {trade.contract.status === 'Pending Review' ? 'Action Required: Review & Approve Contract' : 'Manage Active Contract'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* COMPLIANCE DOCUMENTS GRID */}
            <div className="p-6 md:p-10 grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/30">
              <DocBox title="Submittals" icon={<FileCheck size={16} className="text-blue-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Submittal')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Submittal' })} />
              <DocBox title="Safety Docs" icon={<ShieldCheck size={16} className="text-emerald-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Safety')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Safety' })} />
              <DocBox 
                title="Contracts" 
                icon={<FileText size={16} className="text-amber-500" />} 
                docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'Contract')} 
                awardedQuote={trade.contract?.contract_url}
                onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'Contract' })} 
              />
              <DocBox title="Site Info" icon={<Inbox size={16} className="text-purple-500" />} docs={submittals.filter(s => s.contact_id === trade.id && s.category === 'SI')} onAdd={() => setShowSubmittalModal({ show: true, contactId: trade.id, category: 'SI' })} />
            </div>
          </div>
        ))}
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. Register Trade Modal (WITH MASTER DIRECTORY PULL) */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-blue-600 p-6 md:p-10 rounded-[32px] md:rounded-[56px] max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black text-white uppercase italic text-center">Add Trade to Site</h2>
              <button onClick={() => setShowContactModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={16}/></button>
            </div>

            {/* MASTER DIRECTORY SEARCH AUTO-FILL */}
            <div className="relative mb-8 z-50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                  <Globe size={14}/> Pull from Master Directory
                </label>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search existing trades to auto-fill..."
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-blue-500/30 pl-12 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500"
                />
                
                {masterSearch && filteredMaster.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                    {filteredMaster.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleAutoFill(sub)}
                        className="w-full text-left p-4 hover:bg-blue-900/30 border-b border-slate-800 transition-colors flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-black text-white text-sm">{sub.company_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{sub.trade_type}</p>
                        </div>
                        <Plus size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* NEW TRADE FORM */}
            <form onSubmit={handleRegisterTrade} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required placeholder="Company Name" className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-blue-500" value={newTrade.company} onChange={e => setNewTrade({...newTrade, company: e.target.value})} />
                <input required placeholder="Trade (e.g. Drywall)" className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-blue-500 outline-none focus:border-blue-500 uppercase" value={newTrade.trade_role} onChange={e => setNewTrade({...newTrade, trade_role: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-800/50 pt-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Site Foreman</p>
                  <input placeholder="Foreman Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" value={newTrade.foreman_name} onChange={e => setNewTrade({...newTrade, foreman_name: e.target.value})} />
                  <input placeholder="Cell Number" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" value={newTrade.foreman_phone} onChange={e => setNewTrade({...newTrade, foreman_phone: e.target.value})} />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Office / PM</p>
                  <input placeholder="PM/Office Name" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" value={newTrade.office_name} onChange={e => setNewTrade({...newTrade, office_name: e.target.value})} />
                  <input placeholder="Office Phone" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-800 font-bold text-white text-sm outline-none focus:border-blue-500" value={newTrade.office_phone} onChange={e => setNewTrade({...newTrade, office_phone: e.target.value})} />
                </div>
              </div>
              <input placeholder="Company Email" className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-blue-500" value={newTrade.email} onChange={e => setNewTrade({...newTrade, email: e.target.value})} />
              
              <div className="flex gap-4 pt-4">
                <button type="submit" disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/30 transition-all flex justify-center items-center gap-2">
                  {processing ? <Loader2 className="animate-spin" size={16}/> : 'Register to Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Upload Document Modal */}
      {showSubmittalModal.show && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0];
            const title = fd.get('title') as string;
            if (file && title && showSubmittalModal.contactId) {
              handleUploadDoc(file, showSubmittalModal.contactId, showSubmittalModal.category, title);
            }
          }} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-md w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault New {showSubmittalModal.category}</h2>
            <input name="title" required placeholder="Document Name" className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
            <input name="file" type="file" required className="w-full text-xs text-slate-500 file:bg-slate-800 file:text-white file:px-4 file:py-2 file:rounded-xl file:border-0 cursor-pointer" />
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowSubmittalModal({show: false, contactId: null, category: 'Submittal'})} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px] hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={uploading} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50 hover:bg-blue-500">{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 3. REVIEW & APPROVAL MODAL */}
      {selectedContract && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-slate-900 border-t md:border border-slate-800 rounded-t-[32px] md:rounded-[32px] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                  {selectedContract.trade?.company}
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Contract Total: ${Number(selectedContract.total_value).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedContract(null)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 custom-scrollbar">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <FileText size={14}/> Pre-Con Compliance Docs
                </h3>
                {!selectedContract.documents ? (
                  <div className="p-4 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs font-bold uppercase">No documents uploaded yet.</div>
                ) : (
                  <div className="space-y-3">
                    <DocViewer label="WSIB Clearance" url={selectedContract.documents.wsib} />
                    <DocViewer label="Liability Insurance" url={selectedContract.documents.insurance} />
                    <DocViewer label="Form 1000" url={selectedContract.documents.form1000} />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                    <Calculator size={14}/> Schedule of Values
                  </h3>
                  <span className="text-[10px] font-black text-blue-500">
                    Sum: ${selectedContract.sov?.reduce((acc: number, cur: any) => acc + Number(cur.scheduled_value), 0).toLocaleString() || 0}
                  </span>
                </div>
                {!selectedContract.sov || selectedContract.sov.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500 text-xs font-bold uppercase">SOV Not Submitted.</div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedContract.sov.map((line: any) => (
                      <div key={line.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase">Item {line.item_number}</p>
                          <p className="text-xs font-bold text-white">{line.description}</p>
                        </div>
                        <p className="text-sm font-black text-blue-400">${Number(line.scheduled_value).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-between items-center pb-8 md:pb-6">
              {selectedContract.status === 'Pending Review' ? (
                <>
                  <button onClick={handleRejectContract} disabled={processing} className="text-amber-500 hover:text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-4 py-2">
                    <AlertTriangle size={14}/> Reject
                  </button>
                  <button onClick={handleApproveContract} disabled={processing} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2">
                    {processing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16}/>} 
                    Approve
                  </button>
                </>
              ) : (
                <div className="w-full text-center">
                  <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 size={14}/> Contract is {selectedContract.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- HELPER COMPONENTS ---

function DocBox({ title, icon, docs, onAdd, awardedQuote }: any) {
  return (
    <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800 flex flex-col h-full shadow-inner">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
        <h5 className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-400">
          {icon} {title}
        </h5>
        <button onClick={onAdd} className="bg-slate-800 text-white p-1.5 rounded-lg hover:bg-blue-600 transition-all shadow-lg"><Plus size={12} /></button>
      </div>
      <div className="space-y-2 flex-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
        
        {/* AUTO-INJECT AWARDED QUOTE */}
        {awardedQuote && (
          <a href={awardedQuote} target="_blank" rel="noreferrer" className="block bg-blue-900/20 p-2.5 rounded-xl border border-blue-500/30 flex justify-between items-center hover:bg-blue-600 transition-all group">
            <span className="text-[10px] font-black text-blue-400 uppercase truncate pr-2 group-hover:text-white">Awarded Quote.pdf</span>
            <ExternalLink size={12} className="text-blue-500 group-hover:text-white shrink-0" />
          </a>
        )}

        {docs.length === 0 && !awardedQuote ? <p className="text-[8px] font-black text-slate-700 uppercase italic text-center py-4">Awaiting Files</p> :
          docs.map((doc: any) => (
            <a href={doc.url} target="_blank" key={doc.id} rel="noreferrer" className="block bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center hover:border-blue-500 transition-all group">
              <span className="text-[10px] font-bold text-white uppercase truncate pr-2 group-hover:text-blue-400">{doc.title}</span>
              <ExternalLink size={12} className="text-slate-500 group-hover:text-blue-400 shrink-0" />
            </a>
          ))
        }
      </div>
    </div>
  )
}

function DocViewer({ label, url }: { label: string, url: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex justify-between items-center bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-blue-500 group transition-colors">
      <span className="text-xs font-bold text-slate-300 group-hover:text-blue-400">{label}</span>
      <ExternalLink size={14} className="text-slate-600 group-hover:text-blue-500" />
    </a>
  )
}