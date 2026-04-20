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
  Maximize2, Clock, FileStack, Undo2
} from 'lucide-react'

export default function BidMatrix() {
  const { id, pkgId } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [uploadingBid, setUploadingBid] = useState<string | null>(null)
  const [activeProposal, setActiveProposal] = useState<{url: string, company: string, version: number} | null>(null)
  
  const [pkg, setPkg] = useState<any>(null)
  const [bidders, setBidders] = useState<any[]>([])
  const [globalTrades, setGlobalTrades] = useState<any[]>([])
  const [attachedPlans, setAttachedPlans] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newTrade, setNewTrade] = useState({ company: '', contact: '', email: '', phone: '' })

  const fetchData = async () => {
    setLoading(true)
    const [pkgRes, invRes, globalRes] = await Promise.all([
      supabase.from('bid_packages').select('*').eq('id', pkgId).single(),
      supabase.from('bid_invitations').select('*, subcontractor:subcontractors(*)').eq('bid_package_id', pkgId),
      supabase.from('subcontractors').select('*').order('company_name', { ascending: true })
    ])

    if (pkgRes.data) {
      setPkg(pkgRes.data)
      let planIds: string[] = []
      const rawData = pkgRes.data.linked_plans
      if (Array.isArray(rawData)) planIds = rawData
      else if (typeof rawData === 'string') {
        try { planIds = JSON.parse(rawData) } catch (e) {}
      }
      if (planIds?.length > 0) {
        const { data: plans } = await supabase.from('project_documents').select('*').in('id', planIds)
        setAttachedPlans(plans || [])
      }
    }

    setBidders(invRes.data || [])
    setGlobalTrades(globalRes.data || [])
    setLoading(false)
  }

  useEffect(() => { if (id && pkgId) fetchData() }, [id, pkgId])

  const handleUpdateBid = async (inviteId: string, field: string, value: any) => {
    setBidders(prev => prev.map(b => b.id === inviteId ? { ...b, [field]: value } : b))
    await supabase.from('bid_invitations').update({ [field]: value, status: 'Submitted' }).eq('id', inviteId)
  }

  const handleUploadProposal = async (inviteId: string, file: File, currentHistory: any[]) => {
    setUploadingBid(inviteId)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
      const path = `${id}/bids/${inviteId}/${Date.now()}-${safeName}`
      const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path)
      
      const nextVersionNumber = currentHistory.length + 1
      const newProposalEntry = {
        url: publicUrl,
        uploaded_at: new Date().toISOString(),
        version: nextVersionNumber
      }
      const updatedHistory = [...currentHistory, newProposalEntry]

      await supabase.from('bid_invitations').update({ 
        proposal_history: updatedHistory,
        status: 'Submitted'
      }).eq('id', inviteId)

      setBidders(prev => prev.map(b => b.id === inviteId ? { ...b, proposal_history: updatedHistory, status: 'Submitted' } : b))
      setActiveProposal({ url: publicUrl, company: bidders.find(b => b.id === inviteId)?.subcontractor?.company_name || 'Trade', version: nextVersionNumber })

    } catch (err: any) { alert("Upload failed: " + err.message) }
    setUploadingBid(null)
  }

  const handleInviteTrade = async (subId: string) => {
    const { error } = await supabase.from('bid_invitations').insert([{ bid_package_id: pkgId, subcontractor_id: subId, status: 'Invited' }])
    if (error) alert("Error inviting trade.")
    else { setShowInviteModal(false); fetchData(); }
  }

  const handleQuickAddGlobal = async () => {
    if (!newTrade.company) return
    const { data: sub, error: sErr } = await supabase.from('subcontractors').insert([{ company_name: newTrade.company, primary_contact: newTrade.contact, email: newTrade.email, phone: newTrade.phone, trade_type: pkg?.title || 'General' }]).select().single()
    if (sErr) { alert("Failed to save global trade."); return; }
    await handleInviteTrade(sub.id)
    setNewTrade({ company: '', contact: '', email: '', phone: '' }); setIsCreatingNew(false);
  }

  const handleAwardContract = async (bidder: any) => {
    if (!confirm(`Award contract to ${bidder.subcontractor?.company_name}?`)) return
    setProcessing(bidder.id)
    
    try {
      const history = bidder.proposal_history || []
      const latestProposal = history.length > 0 ? history[history.length - 1] : null
      const awardAmount = Number(bidder.submitted_amount || 0)

      // 1. Update Statuses
      await supabase.from('bid_invitations').update({ status: 'Awarded' }).eq('id', bidder.id)
      await supabase.from('bid_packages').update({ status: 'Awarded' }).eq('id', pkgId)

      // 2. Create Draft Contract
      await supabase.from('project_contracts').insert([{ 
        project_id: id, 
        subcontractor_id: bidder.subcontractor?.id, 
        package_id: pkgId, 
        status: 'Draft', 
        total_value: awardAmount, 
        scope_of_work: pkg.base_scope,
        contract_url: latestProposal?.url 
      }])

      // 3. Sync Proposal to Project Documents
      if (latestProposal?.url) {
        await supabase.from('project_documents').insert([{
          project_id: id,
          name: `Awarded Proposal - ${bidder.subcontractor?.company_name}`,
          url: latestProposal.url,
          category: 'Contracts',
          source: 'Bidding Module',
          tags: [pkg.title, 'Awarded']
        }])
      }

      // 4. PUSH TO BUDGET (project_cost_codes)
      if (pkg.cost_code_id) {
        const { data: currentCode } = await supabase.from('project_cost_codes').select('committed_cost').eq('id', pkg.cost_code_id).single()
        const newCommitted = Number(currentCode?.committed_cost || 0) + awardAmount
        await supabase.from('project_cost_codes').update({ committed_cost: newCommitted }).eq('id', pkg.cost_code_id)
      }

      fetchData()
    } catch (err: any) { alert("Award failed"); }
    setProcessing(null)
  }

  const handleUndoAward = async (bidder: any) => {
    if (!confirm(`Undo award for ${bidder.subcontractor?.company_name}? This will remove the contract and un-commit budget.`)) return
    setProcessing(bidder.id)
    try {
      const awardAmount = Number(bidder.submitted_amount || 0)

      // 1. Revert Budget
      if (pkg.cost_code_id) {
        const { data: currentCode } = await supabase.from('project_cost_codes').select('committed_cost').eq('id', pkg.cost_code_id).single()
        const revertedCommitted = Math.max(0, Number(currentCode?.committed_cost || 0) - awardAmount)
        await supabase.from('project_cost_codes').update({ committed_cost: revertedCommitted }).eq('id', pkg.cost_code_id)
      }

      // 2. Cleanup Paperwork
      await supabase.from('project_contracts').delete().eq('package_id', pkgId).eq('subcontractor_id', bidder.subcontractor?.id)
      await supabase.from('project_documents').delete().eq('project_id', id).ilike('name', `%Awarded Proposal - ${bidder.subcontractor?.company_name}%`)
      
      // 3. Revert Status
      await supabase.from('bid_invitations').update({ status: 'Submitted' }).eq('id', bidder.id)
      await supabase.from('bid_packages').update({ status: 'In Progress' }).eq('id', pkgId)
      
      fetchData()
    } catch (err: any) { alert("Undo failed"); }
    setProcessing(null)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Globalizing Matrix...</div>

  const filteredGlobalTrades = globalTrades.filter(t => t.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) && !bidders.find(b => b.subcontractor_id === t.id))

  return (
    <div className="max-w-full mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32 overflow-x-hidden">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-emerald-600 pb-6 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}/bidding`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Building Scopes</button>
          <div className="flex items-center gap-4">
             <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-900/20"><Gavel size={24} className="text-white"/></div>
             <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">{pkg?.title || 'Bid Matrix'}</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push(`/projects/${id}/bidding`)} className="bg-slate-900 border border-slate-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"><Edit3 size={14} className="text-emerald-500"/> Edit Scope</button>
          {!pkg?.status.includes('Awarded') && <button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">Invite Trade</button>}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* LEFT COLUMN: Scope & Plans (Locked w-80) */}
        <div className={`w-full xl:w-80 flex-shrink-0 space-y-6 ${activeProposal ? 'hidden xl:block' : 'block'}`}>
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl">
             <h3 className="text-[10px] font-black uppercase text-emerald-500 mb-4 flex items-center gap-2"><FileText size={14}/> Scope Recap</h3>
             <p className="text-sm md:text-base font-medium text-slate-200 leading-relaxed mb-4">{pkg?.base_scope}</p>
             <div className="space-y-1">
                {pkg?.inclusions?.map((inc: string, i: number) => (
                  <div key={i} className="text-xs text-slate-300 flex gap-2 font-semibold"><span className="text-emerald-500">•</span> {inc}</div>
                ))}
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl">
            <h3 className="text-[10px] font-black uppercase text-blue-500 mb-4 flex items-center gap-2"><Info size={14}/> Attached Plans</h3>
            <div className="space-y-2">
              {attachedPlans.map(plan => (
                <div key={plan.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center group hover:border-blue-500 transition-all">
                  <div className="min-w-0 pr-2">
                    <p className="text-[10px] font-black text-white truncate leading-tight uppercase tracking-tight">{plan.title || plan.name || 'Original File'}</p>
                    <p className="text-[8px] font-black text-slate-500 uppercase mt-0.5">{plan.sheet_number ? `Sheet: ${plan.sheet_number}` : (plan.category || 'Document')}</p>
                  </div>
                  {plan.url && <a href={plan.url} target="_blank" rel="noreferrer" className="bg-slate-900 p-2 rounded-lg text-slate-600 hover:text-blue-500 hover:bg-blue-950/30 transition-all flex-shrink-0"><ExternalLink size={14}/></a>}
                </div>
              ))}
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
        <div className={`${activeProposal ? 'w-[400px] flex-shrink-0' : 'flex-1'} bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden`}>
          <div className="flex overflow-x-auto custom-scrollbar h-[800px]">
            {bidders.map(bidder => {
                const history = Array.isArray(bidder.proposal_history) ? bidder.proposal_history : [];
                const latest = history[history.length - 1];
                const isWinner = bidder.status === 'Awarded';

                return (
                <div key={bidder.id} className={`w-96 flex-shrink-0 border-r border-slate-800 flex flex-col relative ${isWinner ? 'bg-emerald-950/10' : ''}`}>
                  <div className="p-6 h-28 border-b border-slate-800 flex flex-col justify-center bg-slate-900 relative">
                    {isWinner && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />}
                    <h4 className="font-black text-white text-lg truncate uppercase">{bidder.subcontractor?.company_name}</h4>
                    <span className={`text-[8px] font-black uppercase ${isWinner ? 'text-emerald-500' : 'text-slate-500'}`}>{bidder.status}</span>
                  </div>

                  <div className="p-4 space-y-6 bg-slate-950/30 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="shrink-0">
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block flex items-center gap-1"><FileStack size={10}/> Proposal History</label>
                      {history.length > 0 ? (
                        <div className="space-y-2">
                           <div className="flex gap-2">
                             <button onClick={() => setActiveProposal({ url: latest.url, company: bidder.subcontractor?.company_name, version: latest.version })} className="flex-1 bg-blue-900/30 border border-blue-500/50 text-blue-400 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                               <FileCheck size={14}/> {activeProposal?.url === latest.url ? 'Viewing' : 'Read Latest'}
                             </button>
                             <label className="bg-slate-900 border border-slate-700 p-3 rounded-xl cursor-pointer">
                               {uploadingBid === bidder.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14}/>}
                               <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUploadProposal(bidder.id, f, history) }} />
                             </label>
                           </div>
                           {history.length > 1 && (
                             <select onChange={(e) => { const h = history.find((x:any) => x.version === parseInt(e.target.value)); if(h) setActiveProposal({url: h.url, company: bidder.subcontractor?.company_name, version: h.version})}} className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-[10px] text-slate-400 font-bold">
                               <option value="">View previous versions...</option>
                               {history.map((h:any) => <option key={h.version} value={h.version}>Version {h.version}</option>)}
                             </select>
                           )}
                        </div>
                      ) : (
                        <label className="w-full h-24 bg-slate-950 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 cursor-pointer">
                          <UploadCloud size={20}/>
                          <span className="text-[8px] font-black uppercase">Upload Quote</span>
                          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleUploadProposal(bidder.id, f, []) }} />
                        </label>
                      )}
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Submitted Price</label>
                      <div className="relative"><DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input type="number" value={bidder.submitted_amount || ''} onChange={(e) => handleUpdateBid(bidder.id, 'submitted_amount', e.target.value)} className="w-full bg-slate-950 border border-slate-700 pl-8 p-3 rounded-xl font-black text-emerald-400 outline-none" /></div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Days to Complete</label>
                      <div className="relative"><Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input type="number" value={bidder.schedule_impact_days || ''} onChange={(e) => handleUpdateBid(bidder.id, 'schedule_impact_days', e.target.value)} className="w-full bg-slate-950 border border-slate-700 pl-8 p-3 rounded-xl font-bold text-white outline-none" /></div>
                    </div>
                    <textarea value={bidder.trade_notes || ''} onChange={(e) => handleUpdateBid(bidder.id, 'trade_notes', e.target.value)} placeholder="Leveling notes..." className="w-full flex-1 bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 min-h-[150px] resize-none" />
                  </div>

                  <div className="p-6 border-t border-slate-800 bg-slate-900 mt-auto">
                    {isWinner ? (
                      <button onClick={() => handleUndoAward(bidder)} disabled={processing === bidder.id} className="w-full bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-500 font-black text-[10px] uppercase py-4 rounded-xl tracking-widest border border-slate-700 transition-all flex items-center justify-center gap-2">
                        {processing === bidder.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14}/>} Undo Award
                      </button>
                    ) : (
                      <button onClick={() => handleAwardContract(bidder)} disabled={processing !== null || !bidder.submitted_amount || pkg?.status === 'Awarded'} className="w-full bg-emerald-600 text-white font-black text-[10px] uppercase py-4 rounded-xl tracking-widest disabled:opacity-50">
                        {processing === bidder.id ? <Loader2 size={14} className="animate-spin" /> : 'Award Contract'}
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500 p-10 rounded-[48px] max-w-md w-full shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white uppercase italic">{isCreatingNew ? 'Register Trade' : 'Master List'}</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>
            {!isCreatingNew ? (
              <div className="space-y-4">
                <input type="text" placeholder="Search Master List..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none" />
                <div className="overflow-y-auto max-h-[40vh] space-y-2 pr-2 custom-scrollbar">
                  {filteredGlobalTrades.map(trade => (
                    <button key={trade.id} onClick={() => handleInviteTrade(trade.id)} className="w-full flex justify-between items-center bg-slate-950 border border-slate-800 p-5 rounded-2xl group hover:border-emerald-500 transition-all text-left">
                      <p className="font-black text-white uppercase text-sm">{trade.company_name}</p><Plus size={18} className="text-emerald-500" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsCreatingNew(true)} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-emerald-500 transition-all">+ Register New Trade System-Wide</button>
              </div>
            ) : (
              <div className="space-y-4">
                <input type="text" value={newTrade.company} onChange={e => setNewTrade({...newTrade, company: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none" placeholder="Company Name" />
                <input type="text" value={newTrade.contact} onChange={e => setNewTrade({...newTrade, contact: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white font-bold outline-none" placeholder="Contact Name" />
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsCreatingNew(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-500 border border-slate-800 rounded-2xl">Back</button>
                  <button onClick={handleQuickAddGlobal} disabled={!newTrade.company} className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg">Register & Invite</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}