'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, Trophy, FileText, 
  CheckCircle2, XCircle, UserPlus, ExternalLink,
  DollarSign, Calendar, X, Loader2, Info, Gavel,
  Edit3, Search, Globe, UploadCloud, FileCheck, RefreshCw,
  Maximize2, Clock, FileStack, Undo2, Link as LinkIcon, Mail, Trash2
} from 'lucide-react'

export default function BidMatrix() {
  const { id, pkgId } = useParams()
  const router = useRouter()
  
  // --- UI & UX STATES ---
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [uploadingBid, setUploadingBid] = useState<string | null>(null)
  const [activeProposal, setActiveProposal] = useState<{url: string, company: string, version: number} | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // --- DATA STATES ---
  const [pkg, setPkg] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  const [bidders, setBidders] = useState<any[]>([])
  const [globalTrades, setGlobalTrades] = useState<any[]>([])
  const [attachedPlans, setAttachedPlans] = useState<any[]>([])
  const [newTrade, setNewTrade] = useState({ company: '', contact: '', email: '', phone: '' })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pkgRes, invRes, globalRes, projRes] = await Promise.all([
        supabase.from('bid_packages').select('*').eq('id', pkgId).single(),
        supabase.from('bid_invitations').select('*, subcontractor:subcontractors(*)').eq('bid_package_id', pkgId),
        supabase.from('subcontractors').select('*').order('company_name', { ascending: true }),
        supabase.from('projects').select('name').eq('id', id).single()
      ])

      if (projRes.data) setProject(projRes.data)

      if (pkgRes.data) {
        setPkg(pkgRes.data)
        let planIds = []
        try {
            planIds = Array.isArray(pkgRes.data.linked_plans) 
              ? pkgRes.data.linked_plans 
              : JSON.parse(pkgRes.data.linked_plans || '[]')
        } catch(e) { planIds = [] }
          
        if (planIds?.length > 0) {
          const { data: plans } = await supabase.from('project_documents').select('*').in('id', planIds)
          setAttachedPlans(plans || [])
        }
      }

      setBidders(invRes.data || [])
      setGlobalTrades(globalRes.data || [])
    } catch (err) {
      console.error("Critical Matrix Fetch Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id && pkgId) fetchData() }, [id, pkgId])

  // --- HELPERS ---
  const copyMagicLink = (token: string) => {
    if (!token) return alert("No secure token found. Try re-inviting this trade.")
    const url = `${window.location.origin}/portal/tender/${token}`
    navigator.clipboard.writeText(url)
    alert("Trade Portal Link Copied!")
  }

  const generateMailto = (bidder: any) => {
    const url = `${window.location.origin}/portal/tender/${bidder.token}`
    const subject = encodeURIComponent(`Tender Invitation: ${pkg?.title} - ${project?.name || 'Project'}`)
    const body = encodeURIComponent(`Hi ${bidder.subcontractor?.primary_contact || 'Team'},\n\nPlease review drawings and submit your quote at this secure link:\n\n${url}`)
    return `mailto:${bidder.subcontractor?.email}?subject=${subject}&body=${body}`
  }

  const handleUpdateBid = async (inviteId: string, field: string, value: any) => {
    const updates: any = { [field]: value }
    
    // Auto-flip to Submitted ONLY if they are entering price, days, or notes manually
    if (['submitted_amount', 'schedule_impact_days', 'trade_notes'].includes(field) && value !== '') {
      updates.status = 'Submitted'
    }

    setBidders(prev => prev.map(b => b.id === inviteId ? { ...b, ...updates } : b))
    await supabase.from('bid_invitations').update(updates).eq('id', inviteId)
  }

  const handleUploadProposal = async (inviteId: string, file: File, currentHistory: any[]) => {
    setUploadingBid(inviteId)
    try {
      const path = `${id}/bids/${inviteId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path)
      
      const updatedHistory = [...(currentHistory || []), {
        url: publicUrl,
        uploaded_at: new Date().toISOString(),
        version: (currentHistory?.length || 0) + 1,
        filename: file.name
      }]

      await supabase.from('bid_invitations').update({ 
        proposal_history: updatedHistory,
        proposal_link: publicUrl,
        status: 'Submitted'
      }).eq('id', inviteId)

      fetchData()
    } catch (err: any) { alert("Upload failed: " + err.message) }
    setUploadingBid(null)
  }

  const handleInviteTrade = async (subId: string) => {
    const secureToken = `bid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    const { error } = await supabase.from('bid_invitations').insert([{ 
      bid_package_id: pkgId, 
      subcontractor_id: subId, 
      status: 'Invited',
      token: secureToken 
    }])
    if (error) alert(`Invite Failed: ${error.message}`)
    else { setShowInviteModal(false); fetchData(); }
  }

  const handleQuickAddGlobal = async () => {
    if (!newTrade.company) return
    const { data: sub, error: sErr } = await supabase.from('subcontractors').insert([{ 
      company_name: newTrade.company, 
      primary_contact: newTrade.contact, 
      email: newTrade.email, 
      phone: newTrade.phone, 
      trade_type: pkg?.title || 'General' 
    }]).select().single()
    if (sErr) return alert("Failed to register trade.");
    await handleInviteTrade(sub.id)
    setNewTrade({ company: '', contact: '', email: '', phone: '' }); setIsCreatingNew(false);
  }

  const handleAwardContract = async (bidder: any) => {
    if (!confirm(`Award contract to ${bidder.subcontractor?.company_name}?`)) return
    setProcessing(bidder.id)
    try {
      const awardAmount = Number(bidder.submitted_amount || 0)
      await Promise.all([
        supabase.from('bid_invitations').update({ status: 'Awarded' }).eq('id', bidder.id),
        supabase.from('bid_packages').update({ status: 'Awarded' }).eq('id', pkgId),
        supabase.from('project_contracts').insert([{ 
            project_id: id, subcontractor_id: bidder.subcontractor?.id, 
            package_id: pkgId, status: 'Draft', total_value: awardAmount, 
            scope_of_work: pkg.base_scope 
        }])
      ])
      fetchData()
    } catch (err) { alert("Award failed") }
    setProcessing(null)
  }

  const handleUndoAward = async (bidder: any) => {
    if (!confirm(`Undo award for ${bidder.subcontractor?.company_name}?`)) return
    setProcessing(bidder.id)
    try {
      await Promise.all([
        supabase.from('project_contracts').delete().eq('package_id', pkgId).eq('subcontractor_id', bidder.subcontractor?.id),
        supabase.from('bid_invitations').update({ status: 'Submitted' }).eq('id', bidder.id),
        supabase.from('bid_packages').update({ status: 'In Progress' }).eq('id', pkgId)
      ])
      fetchData()
    } catch (err) { alert("Undo failed.") }
    setProcessing(null)
  }

  const handleRemoveBidder = async (bidderId: string) => {
    if (!confirm("Remove this bidder from the matrix?")) return
    await supabase.from('bid_invitations').delete().eq('id', bidderId)
    fetchData()
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-500 gap-4">
      <RefreshCw className="animate-spin" size={32} />
      <span className="font-black animate-pulse uppercase tracking-[0.3em] text-xs italic">Constructing Bid Matrix...</span>
    </div>
  )

  const filteredGlobalTrades = globalTrades.filter(t => t.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) && !bidders.find(b => b.subcontractor_id === t.id))

  return (
    <div className="max-w-full mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-emerald-600 pb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}/bidding`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> All Scopes</button>
          <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-900/20"><Gavel size={24} className="text-white"/></div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">{pkg?.title || 'Scope Matrix'}</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">{project?.name}</p>
              </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push(`/projects/${id}/bidding`)} className="bg-slate-900 border border-slate-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"><Edit3 size={14} className="text-emerald-500"/> Edit Scope</button>
          {!pkg?.status?.includes('Awarded') && (
            <button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20 flex items-center gap-2">
              <UserPlus size={16}/> Invite Trade
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* LEFT COLUMN: Recap & Plans */}
        <div className={`w-full xl:w-80 flex-shrink-0 space-y-6 ${activeProposal ? 'hidden xl:block' : 'block'}`}>
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl">
              <h3 className="text-[10px] font-black uppercase text-emerald-500 mb-4 flex items-center gap-2"><FileText size={14}/> Scope Recap</h3>
              <p className="text-sm font-medium text-slate-200 leading-relaxed mb-4">{pkg?.base_scope}</p>
              <div className="space-y-1">
                {pkg?.inclusions?.map((inc: string, i: number) => (
                  <div key={i} className="text-xs text-slate-300 flex gap-2 font-semibold"><span className="text-emerald-500">•</span> {inc}</div>
                ))}
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl">
            <h3 className="text-[10px] font-black uppercase text-blue-500 mb-4 flex items-center gap-2"><Info size={14}/> Latest Plans</h3>
            <div className="space-y-2">
              {attachedPlans.map(plan => (
                <div key={plan.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center group hover:border-blue-500 transition-all">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-black text-white truncate leading-tight uppercase tracking-tight">{plan.sheet_number || 'Doc'}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase mt-0.5 truncate">{plan.title || plan.name}</p>
                  </div>
                  {plan.url && <a href={plan.url} target="_blank" rel="noreferrer" className="bg-slate-900 p-2 rounded-lg text-slate-600 hover:text-blue-500 transition-all"><ExternalLink size={14}/></a>}
                </div>
              ))}
              {attachedPlans.length === 0 && <p className="text-center text-[10px] font-bold text-slate-600 uppercase py-4">No Plans Linked</p>}
            </div>
          </div>
        </div>

        {/* MIDDLE: PDF Viewer */}
        {activeProposal && (
          <div className="flex-[2] min-w-[500px] bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl flex flex-col overflow-hidden h-[800px] animate-in slide-in-from-right-8 duration-500">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <div className="flex items-center gap-3">
                   <div className="bg-blue-600/20 p-2 rounded-xl text-blue-500"><FileCheck size={20}/></div>
                   <div>
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Proposal v{activeProposal.version}</p>
                     <h3 className="font-black text-white uppercase tracking-tighter text-lg">{activeProposal.company}</h3>
                   </div>
                </div>
                <button onClick={() => setActiveProposal(null)} className="p-3 text-slate-500 hover:text-white bg-slate-950 border border-slate-800 rounded-xl"><X size={16}/></button>
              </div>
              <iframe src={`${activeProposal.url}#view=FitH&toolbar=0`} className="w-full flex-1 bg-slate-950" title="PDF Viewer"/>
          </div>
        )}

        {/* RIGHT: Matrix Grid */}
        <div className={`${activeProposal ? 'w-[400px] flex-shrink-0' : 'flex-1'} bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden min-h-[700px]`}>
          <div className="flex overflow-x-auto custom-scrollbar h-full">
            {bidders.length === 0 ? (
               <div className="w-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-40">
                  <UserPlus size={64} className="stroke-1"/>
                  <p className="text-xs font-black uppercase tracking-widest italic">Matrix is empty. Invite trades to begin leveling.</p>
               </div>
            ) : bidders.map(bidder => {
                const history = Array.isArray(bidder.proposal_history) ? bidder.proposal_history : [];
                const latest = history[history.length - 1];
                const isWinner = bidder.status === 'Awarded';

                return (
                <div key={bidder.id} className={`w-96 flex-shrink-0 border-r border-slate-800 flex flex-col relative ${isWinner ? 'bg-emerald-950/10' : ''}`}>
                  <div className="p-6 h-28 border-b border-slate-800 flex flex-col justify-center bg-slate-900 relative">
                    {isWinner && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-white text-lg truncate uppercase leading-tight">{bidder.subcontractor?.company_name || 'Trade'}</h4>
                        
                        {/* MANUAL STATUS DROPDOWN (Always Visible) */}
                        <select
                          value={bidder.status || 'Invited'}
                          disabled={isWinner}
                          onChange={(e) => handleUpdateBid(bidder.id, 'status', e.target.value)}
                          className={`mt-1 text-[9px] font-black uppercase tracking-widest bg-transparent border-b border-dashed outline-none cursor-pointer pb-0.5
                            ${bidder.status === 'Awarded' || bidder.status === 'Submitted' ? 'text-emerald-500 border-emerald-900/50' :
                              bidder.status === 'Bidding' ? 'text-blue-500 border-blue-900/50' :
                              bidder.status === 'Declined' ? 'text-red-500 border-red-900/50' :
                              'text-slate-500 border-slate-700'
                            }
                          `}
                        >
                          <option value="Invited" className="bg-slate-900 text-slate-500">Invited</option>
                          <option value="Bidding" className="bg-slate-900 text-blue-500">Bidding</option>
                          <option value="Submitted" className="bg-slate-900 text-emerald-500">Submitted</option>
                          <option value="Declined" className="bg-slate-900 text-red-500">Declined</option>
                          <option value="Awarded" className="bg-slate-900 text-emerald-400" disabled>Awarded</option>
                        </select>
                      </div>
                      
                      <div className="flex gap-1">
                        <button onClick={() => copyMagicLink(bidder.token)} className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white" title="Copy Magic Link"><LinkIcon size={12}/></button>
                        <a href={generateMailto(bidder)} className="p-2 bg-blue-950/30 border border-blue-900/50 rounded-lg text-blue-400 hover:text-white" title="Draft Email"><Mail size={12}/></a>
                        <button onClick={() => handleRemoveBidder(bidder.id)} className="p-2 text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-6 bg-slate-950/30 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-2 block flex items-center gap-1"><FileStack size={10}/> Quote History</label>
                      {history.length > 0 ? (
                        <div className="space-y-2">
                           <button onClick={() => setActiveProposal({ url: latest.url, company: bidder.subcontractor?.company_name, version: latest.version })} className="w-full bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-all">
                             <FileCheck size={14}/> {activeProposal?.url === latest.url ? 'Viewing' : `Read Latest (v${history.length})`}
                           </button>
                           <div className="flex gap-2">
                             <select onChange={(e) => { const h = history.find((x:any) => x.version === parseInt(e.target.value)); if(h) setActiveProposal({url: h.url, company: bidder.subcontractor?.company_name, version: h.version})}} className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-xl text-[10px] text-slate-400 font-bold outline-none">
                               <option value="">History...</option>
                               {history.slice(0, -1).reverse().map((h:any) => <option key={h.version} value={h.version}>Version {h.version}</option>)}
                             </select>
                             <label className="bg-slate-900 border border-slate-700 p-2 px-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                               {uploadingBid === bidder.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14}/>}
                               <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUploadProposal(bidder.id, f, history) }} />
                             </label>
                           </div>
                        </div>
                      ) : (
                        <label className="w-full h-24 bg-slate-950 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 cursor-pointer hover:border-emerald-500/50 transition-all group">
                          <UploadCloud size={24} className="group-hover:text-emerald-500 transition-colors"/>
                          <span className="text-[8px] font-black uppercase group-hover:text-white">Upload Quote</span>
                          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUploadProposal(bidder.id, f, []) }} />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Contract Price ($)</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                        <input type="number" value={bidder.submitted_amount || ''} onChange={(e) => handleUpdateBid(bidder.id, 'submitted_amount', e.target.value)} className="w-full bg-slate-950 border border-slate-800 pl-8 p-3 rounded-xl font-black text-emerald-400 outline-none focus:border-emerald-500 transition-all shadow-inner" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Lead Time (Days)</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                        <input type="number" value={bidder.schedule_impact_days || ''} onChange={(e) => handleUpdateBid(bidder.id, 'schedule_impact_days', e.target.value)} className="w-full bg-slate-950 border border-slate-800 pl-8 p-3 rounded-xl font-bold text-white outline-none focus:border-emerald-500 transition-all shadow-inner" />
                      </div>
                    </div>
                    <textarea value={bidder.trade_notes || ''} onChange={(e) => handleUpdateBid(bidder.id, 'trade_notes', e.target.value)} placeholder="Leveling notes..." className="w-full h-40 bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 font-medium resize-none outline-none focus:border-slate-700 transition-all shadow-inner" />
                  </div>

                  <div className="p-6 border-t border-slate-800 bg-slate-900 mt-auto">
                    {isWinner ? (
                      <button onClick={() => handleUndoAward(bidder)} disabled={processing === bidder.id} className="w-full bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-500 font-black text-[10px] uppercase py-4 rounded-xl tracking-widest border border-slate-700 transition-all flex items-center justify-center gap-2">
                        {processing === bidder.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14}/>} Undo Award
                      </button>
                    ) : (
                      <button onClick={() => handleAwardContract(bidder)} disabled={processing !== null || !bidder.submitted_amount || pkg?.status === 'Awarded'} className="w-full bg-emerald-600 text-white font-black text-[10px] uppercase py-4 rounded-xl tracking-widest shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all disabled:opacity-50">
                        {processing === bidder.id ? <Loader2 size={14} className="animate-spin" /> : 'Award Contract'}
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            }
          </div>
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500 p-10 rounded-[48px] max-w-md w-full shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white uppercase italic">{isCreatingNew ? 'Add Trade' : 'Invite Trade'}</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            {!isCreatingNew ? (
              <div className="space-y-4">
                <input type="text" placeholder="Search Master List..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-emerald-500" />
                <div className="overflow-y-auto max-h-[40vh] space-y-2 pr-2 custom-scrollbar">
                  {filteredGlobalTrades.map(trade => (
                    <button key={trade.id} onClick={() => handleInviteTrade(trade.id)} className="w-full flex justify-between items-center bg-slate-950 border border-slate-800 p-5 rounded-2xl group hover:border-emerald-500 transition-all text-left">
                      <div>
                        <p className="font-black text-white uppercase text-sm">{trade.company_name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{trade.primary_contact}</p>
                      </div>
                      <Plus size={18} className="text-emerald-500" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsCreatingNew(true)} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 transition-all">+ Register New Trade Global</button>
              </div>
            ) : (
              <div className="space-y-4">
                <input type="text" value={newTrade.company} onChange={e => setNewTrade({...newTrade, company: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-emerald-500" placeholder="Company Name" />
                <input type="text" value={newTrade.contact} onChange={e => setNewTrade({...newTrade, contact: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-emerald-500" placeholder="Contact Name" />
                <input type="email" value={newTrade.email} onChange={e => setNewTrade({...newTrade, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none focus:border-emerald-500" placeholder="Email" />
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsCreatingNew(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-500">Back</button>
                  <button onClick={handleQuickAddGlobal} disabled={!newTrade.company} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-500">Add & Invite</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}