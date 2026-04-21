'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  FileText, CheckCircle2, Globe, Clock, 
  Download, Loader2, HardHat, ShieldCheck, 
  AlertCircle, Info, DollarSign, Calendar, Send,
  UploadCloud, FileCheck, X
} from 'lucide-react'

export default function TenderPortal() {
  const { token } = useParams()
  
  // UI States
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  
  // Data States
  const [invite, setInvite] = useState<any>(null)
  const [pkg, setPkg] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [bidData, setBidData] = useState({ 
    amount: '', 
    days: '', 
    notes: '',
    proposal_link: '' 
  })

  useEffect(() => { if (token) fetchPortalData() }, [token])

  const fetchPortalData = async () => {
    setLoading(true)
    try {
      const { data: invData, error: invErr } = await supabase
        .from('bid_invitations')
        .select('*, subcontractor:subcontractors(*)')
        .eq('token', token)
        .single()

      if (invErr || !invData) throw new Error("Invalid Token")

      setInvite(invData)
      setBidData({
          amount: invData.submitted_amount || '',
          days: invData.schedule_impact_days || '',
          notes: invData.trade_notes || '',
          proposal_link: invData.proposal_link || ''
      })
      
      const { data: pkgData } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('id', invData.bid_package_id)
        .single()
      
      if (pkgData) {
        setPkg(pkgData)
        let planIds = []
        try {
          planIds = Array.isArray(pkgData.linked_plans) ? pkgData.linked_plans : JSON.parse(pkgData.linked_plans || '[]')
        } catch (e) { planIds = [] }

        if (planIds.length > 0) {
          const { data: docs } = await supabase.from('project_documents').select('*').in('id', planIds)
          setPlans(docs || [])
        }
      }
    } catch (err) { console.error("Portal Error:", err) }
    setLoading(false)
  }

  // --- DOWNLOAD FIX ---
  // If files were downloading at 23kb, it was likely a CORS error on a fetch blob.
  // We'll use a direct window open for maximum reliability across browsers.
  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  }

  // --- REVISION TRACKING UPLOAD ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !invite) return
    setUploadingFile(true)
    
    try {
      const fileName = `${invite.id}-${Date.now()}.pdf`
      const filePath = `tender-quotes/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file)

      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath)

      // Get existing history and append
      const currentHistory = Array.isArray(invite.proposal_history) ? invite.proposal_history : []
      const newVersion = {
        url: publicUrl,
        uploaded_at: new Date().toISOString(),
        version: currentHistory.length + 1,
        filename: file.name
      }
      const updatedHistory = [...currentHistory, newVersion]

      // Update Local and Database immediately
      setBidData(prev => ({ ...prev, proposal_link: publicUrl }))
      
      const { error: dbErr } = await supabase
        .from('bid_invitations')
        .update({ 
            proposal_history: updatedHistory,
            proposal_link: publicUrl 
        })
        .eq('id', invite.id)

      if (dbErr) throw dbErr
      setInvite({ ...invite, proposal_history: updatedHistory })

    } catch (error: any) { 
      alert("Upload failed: " + error.message) 
    } finally {
      setUploadingFile(false)
    }
  }

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    const { error } = await supabase
      .from('bid_invitations')
      .update({
        submitted_amount: parseFloat(bidData.amount) || 0,
        schedule_impact_days: parseInt(bidData.days) || 0,
        trade_notes: bidData.notes,
        status: 'Submitted',
        submitted_at: new Date().toISOString()
      })
      .eq('id', invite.id)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      alert("SUCCESS: Your tender has been submitted.")
      fetchPortalData()
    }
    setSubmitting(false)
  }

  if (loading) return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-emerald-500 font-black z-[9999] tracking-widest animate-pulse uppercase">Authorized Access Only...</div>

  if (!invite) return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-[9999]">
      <AlertCircle size={64} className="text-red-500 mb-6"/>
      <h1 className="text-2xl font-black text-white uppercase italic">Link Expired</h1>
      <p className="text-slate-500 mt-2">This tender link is no longer valid.</p>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-y-auto z-[9999] text-slate-100 font-sans">
      
      {/* LOCKED HEADER */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-6 md:px-12 h-20 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-900/20"><HardHat size={22} className="text-white"/></div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tighter text-white leading-none">Construction<span className="text-emerald-500">Portal</span></h1>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Authorized Tender Access</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
            <ShieldCheck size={12} className="text-emerald-500"/> Secure Encrypted Session
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-12">
        
        {/* PACKAGE HEADER */}
        <div className="bg-slate-900 border border-slate-800 p-10 rounded-[48px] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none"><FileText size={200} /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <span className="bg-emerald-950/50 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-emerald-900/30">Division {pkg?.division_code}</span>
                  <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white mt-4 mb-2 leading-none">{pkg?.title}</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-2"><Clock size={14} className="text-blue-500"/> Bids Due: {pkg?.due_date ? new Date(pkg.due_date).toLocaleDateString() : 'TBD'}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trade Entity</p>
                  <p className="text-xl font-black text-emerald-500 uppercase italic tracking-tight">{invite.subcontractor?.company_name}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* SCOPE & DRAWINGS */}
            <div className="lg:col-span-7 space-y-12">
                <section>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6 border-l-4 border-emerald-500 pl-4">Scope of Work</h3>
                    <div className="bg-slate-900/30 border border-slate-800 p-8 rounded-[32px] space-y-8">
                      <p className="text-slate-200 leading-relaxed font-medium text-lg italic">{pkg?.base_scope}</p>
                      <div className="grid grid-cols-1 gap-3">
                          {pkg?.inclusions?.map((inc: string, i: number) => (
                              <div key={i} className="flex gap-4 text-xs text-slate-400 font-bold bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> {inc}
                              </div>
                          ))}
                      </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-6 border-l-4 border-blue-500 pl-4">Contract Documents</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {plans.map(plan => (
                            <button 
                              key={plan.id} 
                              onClick={() => handleDownload(plan.url)}
                              className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-[32px] group hover:border-blue-500 transition-all text-left"
                            >
                                <div className="min-w-0 pr-4">
                                    <p className="text-xs font-black text-white truncate uppercase">{plan.sheet_number || 'DOC'}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase truncate mt-1">{plan.title || plan.name}</p>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-2xl group-hover:text-blue-400 transition-colors shadow-inner"><Download size={18} /></div>
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* DARK MODE SUBMISSION FORM */}
            <div className="lg:col-span-5">
                <div className="bg-slate-900 border-2 border-slate-800 rounded-[48px] p-8 md:p-10 shadow-2xl sticky top-28 border-b-[12px] border-emerald-600">
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-1 text-white leading-none">Bid Submission</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-10 mt-2">Unique ID: {invite.id.slice(0,8)}</p>

                    {invite.status === 'Awarded' ? (
                        <div className="bg-emerald-500/10 border-2 border-emerald-500/20 p-10 rounded-[32px] text-center">
                            <ShieldCheck size={56} className="text-emerald-500 mx-auto mb-4"/>
                            <p className="font-black uppercase tracking-tighter text-2xl text-emerald-400 leading-none">Awarded</p>
                            <p className="text-slate-400 text-[10px] font-bold uppercase mt-4 tracking-widest leading-relaxed">You have been selected for this project.<br/>Check your contract portal for next steps.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitBid} className="space-y-8">
                            
                            {/* QUOTE UPLOAD WITH REVISION TRACKING */}
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">1. Proposal Document (PDF)</label>
                              {bidData.proposal_link ? (
                                <div className="w-full bg-emerald-950/20 border-2 border-emerald-500/30 p-5 rounded-3xl flex items-center justify-between animate-in slide-in-from-top-2">
                                  <div className="flex items-center gap-3">
                                    <FileCheck className="text-emerald-500" size={24}/>
                                    <div>
                                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Quote Stored (v{invite.proposal_history?.length || 1})</p>
                                      <p className="text-[8px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{bidData.proposal_link.split('/').pop()?.slice(0,20)}...</p>
                                    </div>
                                  </div>
                                  <button type="button" onClick={() => setBidData({...bidData, proposal_link: ''})} className="bg-slate-950 p-2 rounded-lg text-slate-500 hover:text-white"><X size={14}/></button>
                                </div>
                              ) : (
                                <div className="relative h-32 w-full bg-slate-950 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group">
                                  {uploadingFile ? <Loader2 className="animate-spin text-emerald-500" size={28} /> : (
                                    <>
                                      <UploadCloud className="text-slate-700 group-hover:text-emerald-500 transition-colors" size={40}/>
                                      <div className="text-center">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">Click to upload official quote</p>
                                        <p className="text-[8px] font-black text-slate-700 uppercase mt-1">PDF Format Only • Max 10MB</p>
                                      </div>
                                    </>
                                  )}
                                  <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">2. Total Lump Sum ($)</label>
                                <div className="relative">
                                    <DollarSign size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600"/>
                                    <input 
                                        required type="number" step="0.01"
                                        value={bidData.amount} onChange={e => setBidData({...bidData, amount: e.target.value})}
                                        placeholder="0.00" 
                                        className="w-full bg-slate-950 border-2 border-slate-800 p-6 pl-14 rounded-3xl font-black text-4xl text-emerald-400 outline-none focus:border-emerald-500 shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">3. Duration (Work Days)</label>
                                <div className="relative">
                                    <Calendar size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600"/>
                                    <input 
                                        required type="number"
                                        value={bidData.days} onChange={e => setBidData({...bidData, days: e.target.value})}
                                        placeholder="Est. total days" 
                                        className="w-full bg-slate-950 border-2 border-slate-800 p-6 pl-14 rounded-3xl font-black text-xl text-white outline-none focus:border-emerald-500 shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-[0.2em]">4. Clarifications / Notes</label>
                                <textarea 
                                    rows={4}
                                    value={bidData.notes} onChange={e => setBidData({...bidData, notes: e.target.value})}
                                    placeholder="List exclusions or specific assumptions..." 
                                    className="w-full bg-slate-950 border-2 border-slate-800 p-6 rounded-3xl font-bold text-sm text-slate-300 outline-none focus:border-emerald-500 resize-none shadow-inner" 
                                />
                            </div>

                            <button 
                                disabled={submitting || uploadingFile}
                                className="w-full bg-emerald-600 text-white py-8 rounded-[32px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={28}/> : <><Send size={20}/> Submit Tender</>}
                            </button>
                            <p className="text-center text-[8px] font-black uppercase text-slate-700 tracking-widest mt-4">Encrypted Channel: ConstructWarRoom AES-256</p>
                        </form>
                    )}
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}