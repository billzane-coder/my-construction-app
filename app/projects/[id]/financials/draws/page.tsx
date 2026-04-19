'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import { CheckCircle2, Clock, Loader2, ExternalLink, FileText, UploadCloud, Save, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

export default function DrawsManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allDraws, setAllDraws] = useState<any[]>([])
  const [activeDraw, setActiveDraw] = useState<any>(null)
  
  const [contracts, setContracts] = useState<any[]>([])
  const [sovLines, setSovLines] = useState<any[]>([])
  const [drawLines, setDrawLines] = useState<any[]>([])
  const [reviewingContractId, setReviewingContractId] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async (targetDrawId?: string) => {
    setLoading(true)
    try {
      let { data: draws } = await supabase.from('project_draws').select('*').eq('project_id', id).order('draw_number', { ascending: true })
      
      if (!draws || draws.length === 0) {
        const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const { data: n } = await supabase.from('project_draws').insert([{ project_id: id, draw_number: 1, period: currentPeriod, status: 'Draft' }]).select()
        draws = n || []
      }
      setAllDraws(draws || [])
      
      const currentDraw = targetDrawId ? draws.find(d => d.id === targetDrawId) : draws[draws.length - 1]
      setActiveDraw(currentDraw)

      const { data: activeContracts } = await supabase
        .from('project_contracts')
        .select('id, title, status, project_contacts!project_contracts_contact_id_fkey(company)')
        .eq('project_id', id)
        .in('status', ['Active', 'Completed'])
      
      const formattedContracts = activeContracts?.map(c => ({
          ...c,
          project_contacts: Array.isArray(c.project_contacts) ? c.project_contacts[0] : c.project_contacts
      }))
      setContracts(formattedContracts || [])

      const contractIds = formattedContracts?.length ? formattedContracts.map(c => c.id) : ['00000000-0000-0000-0000-000000000000']
      const { data: lines } = await supabase.from('sov_line_items').select('*').in('contract_id', contractIds)
      setSovLines(lines || [])

      let { data: billedLines } = await supabase.from('draw_line_items').select('*').eq('draw_id', currentDraw.id)
      
      const missingLines = lines?.filter(l => !billedLines?.some((b: any) => b.sov_line_id === l.id)) || []
      if (missingLines.length > 0) {
        const seed = missingLines.map(l => ({ draw_id: currentDraw.id, sov_line_id: l.id, claimed_amount: 0, verified_amount: 0 }))
        await supabase.from('draw_line_items').insert(seed)
        const r = await supabase.from('draw_line_items').select('*').eq('draw_id', currentDraw.id)
        billedLines = r.data || []
      }
      
      setDrawLines(billedLines || [])
      if (formattedContracts?.length && !reviewingContractId) setReviewingContractId(formattedContracts[0].id)
      
    } catch (err) { console.error("Fetch Error:", err) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleNewDraw = async () => {
    setLoading(true);
    const nextNum = allDraws.length > 0 ? Math.max(...allDraws.map(d => d.draw_number)) + 1 : 1;
    const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    const { data, error } = await supabase.from('project_draws').insert([{
      project_id: id,
      draw_number: nextNum,
      period: currentPeriod,
      status: 'Draft'
    }]).select().single();

    if (error) {
      alert(`Failed to create draw: ${error.message}`);
      setLoading(false);
    } else if (data) {
      fetchData(data.id);
    }
  }

  // NEW: Update the period inline
  const handleUpdatePeriod = async () => {
    if (!activeDraw) return;
    await supabase.from('project_draws').update({ period: activeDraw.period }).eq('id', activeDraw.id);
    setAllDraws(prev => prev.map(d => d.id === activeDraw.id ? { ...d, period: activeDraw.period } : d));
  }

  const currentIndex = allDraws.findIndex(d => d.id === activeDraw?.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allDraws.length - 1

  const goPrev = () => { if (hasPrev) fetchData(allDraws[currentIndex - 1].id) }
  const goNext = () => { if (hasNext) fetchData(allDraws[currentIndex + 1].id) }

  const tradeBills = useMemo(() => contracts.map(contract => {
    const mySovs = sovLines.filter(s => s.contract_id === contract.id)
    let totalScheduled = 0, totalClaimed = 0, totalVerified = 0
    let invoiceUrl: string | null = null

    const mappedLines = mySovs.map(sov => {
      const billed = drawLines.find(d => d.sov_line_id === sov.id)
      if (billed?.invoice_link && !invoiceUrl) invoiceUrl = billed.invoice_link
      totalScheduled += Number(sov.scheduled_value || 0)
      totalClaimed += Number(billed?.claimed_amount || 0)
      totalVerified += Number(billed?.verified_amount || 0)
      return { id: sov.id, desc: sov.description, scheduled: Number(sov.scheduled_value || 0), claimed: Number(billed?.claimed_amount || 0), verified: Number(billed?.verified_amount || 0), dbId: billed?.id }
    })

    const status = totalVerified === 0 ? 'Pending Review' : (totalVerified >= totalClaimed ? 'Verified Matched' : 'Verified Adjusted')
    return { ...contract, company: contract.project_contacts?.company || 'Unknown Trade', totalScheduled, totalClaimed, totalVerified, invoiceUrl, lines: mappedLines, status }
  }), [contracts, sovLines, drawLines])

  const reviewingTrade = tradeBills.find(t => t.id === reviewingContractId)

  const handleUpdate = (sovLineId: string, val: number) => {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    setDrawLines(prev => prev.map(dl => dl.sov_line_id === sovLineId ? { ...dl, verified_amount: safeVal } : dl))
  }
  
  const handleSave = async () => {
    setSaving(true)
    if (reviewingTrade) {
      const updates = reviewingTrade.lines.map((l: any) => {
        const payload: any = { draw_id: activeDraw.id, sov_line_id: l.id, claimed_amount: l.claimed, verified_amount: l.verified };
        if (l.dbId) payload.id = l.dbId; 
        return payload;
      });
      const { error } = await supabase.from('draw_line_items').upsert(updates)
      if (error) alert(`Failed to save: ${error.message}`);
      else await fetchData(activeDraw.id);
    }
    setSaving(false)
  }

  const handleUploadInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !reviewingTrade) return
    setSaving(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `invoice_${reviewingTrade.id}_${Date.now()}.${fileExt}`
      const filePath = `${id}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)
      const firstLineDbId = reviewingTrade.lines[0]?.dbId
      if (firstLineDbId) await supabase.from('draw_line_items').update({ invoice_link: publicUrl }).eq('id', firstLineDbId)
      fetchData(activeDraw.id)
    } catch (error: any) { alert(`Upload failed.`) }
    setSaving(false)
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      <FinancialHeader id={id as string} active="draws" />
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-8 flex justify-between items-center shadow-xl">
        <button onClick={goPrev} disabled={!hasPrev} className={`p-2 rounded-xl flex items-center gap-2 transition-all ${hasPrev ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700 cursor-not-allowed'}`}>
          <ChevronLeft size={20} /> <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Previous</span>
        </button>
        
        <div className="text-center flex flex-col items-center min-w-[140px]">
          <h2 className="text-2xl font-black text-amber-500 uppercase italic tracking-tighter leading-none mb-1">Draw #{activeDraw?.draw_number}</h2>
          {/* UPDATED: Editable Input Field for the Period */}
          <input 
            value={activeDraw?.period || ''} 
            onChange={(e) => setActiveDraw({...activeDraw, period: e.target.value})}
            onBlur={handleUpdatePeriod}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdatePeriod()}
            placeholder="e.g. March 2026"
            className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-transparent border-b border-dashed border-slate-700 hover:border-slate-500 focus:border-blue-500 focus:text-white text-center outline-none w-full transition-colors pb-0.5"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={goNext} disabled={!hasNext} className={`p-2 rounded-xl flex items-center gap-2 transition-all ${hasNext ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700 cursor-not-allowed'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Next</span> <ChevronRight size={20} />
          </button>
          {!hasNext && (
             <button onClick={handleNewDraw} className="bg-amber-600 hover:bg-amber-500 text-white p-2 md:px-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg ml-4">
               <Plus size={16}/> <span className="hidden md:inline">Create Next</span>
             </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Trade Invoice Queue</h3>

          {tradeBills.length === 0 && (
            <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-12 rounded-[32px] text-center">
              <p className="text-slate-400 font-bold text-xs uppercase">No Active Contracts</p>
              <p className="text-slate-600 text-[10px] mt-2 uppercase tracking-tight">Lock an SOV in the Contracts tab to begin monthly billing.</p>
            </div>
          )}

          {tradeBills.map(trade => (
            <div key={trade.id} onClick={() => setReviewingContractId(trade.id)} className={`p-6 rounded-[32px] border transition-all cursor-pointer group shadow-xl ${reviewingContractId === trade.id ? 'bg-amber-950/20 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`text-lg font-black uppercase italic leading-none mb-1 ${reviewingContractId === trade.id ? 'text-amber-400' : 'text-white'}`}>{trade.company}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[180px]">{trade.title}</p>
                </div>
                {trade.status === 'Pending Review' ? <Clock size={20} className="text-slate-600" /> : <CheckCircle2 size={20} className="text-emerald-500" />}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800/50">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Trade Claims</p>
                  <p className="text-lg font-black text-white">{formatMoney(trade.totalClaimed)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">Super Verified</p>
                  <p className={`text-lg font-black ${trade.totalVerified < trade.totalClaimed && trade.totalVerified > 0 ? 'text-red-400' : 'text-blue-400'}`}>{formatMoney(trade.totalVerified)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8">
          {reviewingTrade ? (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden sticky top-8">
              <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">{reviewingTrade.company}</h2>
                  <div className="flex gap-4 items-center mt-3">
                    <span className="px-2 py-1 bg-slate-800 rounded text-slate-300 text-[10px] font-black uppercase">Contract Sum: {formatMoney(reviewingTrade.totalScheduled)}</span>
                    
                    {reviewingTrade.invoiceUrl ? (
                      <a href={reviewingTrade.invoiceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase bg-blue-950/30 px-2 py-1 rounded">
                        <ExternalLink size={12}/> View Attached PDF
                      </a>
                    ) : (
                      <div className="relative">
                        <input type="file" accept=".pdf,.jpg,.png" onChange={handleUploadInvoice} ref={fileInputRef} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-white uppercase bg-slate-800 px-2 py-1 rounded transition-colors">
                          <UploadCloud size={12}/> Attach Missing Invoice
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="bg-amber-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 flex items-center gap-2 shadow-lg">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Lock Assessment
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="p-6">Description</th>
                      <th className="p-6 text-right">Scheduled</th>
                      <th className="p-6 text-right border-l border-slate-800/50 bg-slate-950/30">AI Claim</th>
                      <th className="p-6 text-right bg-slate-950/30">Claim %</th>
                      <th className="p-6 text-center bg-blue-950/10 border-l border-blue-900/30 text-blue-400">Verif %</th>
                      <th className="p-6 pl-8 bg-blue-950/10 text-blue-400 text-right">Super Verified ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {reviewingTrade.lines.map((line: any) => {
                      const isOverbilled = line.verified > line.claimed;
                      const percentClaimed = line.scheduled > 0 ? ((line.claimed / line.scheduled) * 100).toFixed(1) : '0.0';
                      const verifiedPercent = line.scheduled > 0 ? Number(((line.verified / line.scheduled) * 100).toFixed(1)) : 0;

                      return (
                        <tr key={line.id} className="hover:bg-slate-800/20 transition-colors group">
                          <td className="p-6"><p className="font-bold text-white text-sm">{line.desc}</p></td>
                          <td className="p-6 text-right font-black text-slate-400">{formatMoney(line.scheduled)}</td>
                          <td className="p-6 text-right border-l border-slate-800/50 bg-slate-950/30 font-black text-amber-500">{formatMoney(line.claimed)}</td>
                          <td className="p-6 text-right bg-slate-950/30 font-bold text-slate-500">{percentClaimed}%</td>
                          
                          <td className="p-4 bg-blue-950/10 border-l border-blue-900/30 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={verifiedPercent === 0 ? '' : verifiedPercent} placeholder="0"
                                onChange={(e) => {
                                  const pct = parseFloat(e.target.value) || 0;
                                  handleUpdate(line.id, Number(((pct / 100) * line.scheduled).toFixed(2)));
                                }} 
                                className={`w-16 bg-slate-950 border p-3 rounded-xl font-black text-center outline-none transition-all ${isOverbilled ? 'border-red-900/50 text-red-400' : 'border-slate-700 text-blue-400 focus:border-blue-500'}`} 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                          </td>

                          <td className="p-4 pl-6 bg-blue-950/10 align-middle">
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                              <input type="number" value={line.verified === 0 ? '' : line.verified} placeholder="0.00"
                                onChange={(e) => handleUpdate(line.id, parseFloat(e.target.value) || 0)} 
                                className={`w-full bg-slate-950 border py-3 pl-8 pr-4 rounded-xl font-black text-right outline-none transition-all ${isOverbilled ? 'border-red-900/50 text-red-400 focus:border-red-500' : 'border-slate-700 text-white focus:border-blue-500'}`} 
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-slate-950 flex justify-between items-center border-t border-slate-800/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gross Assessment</p>
                <p className="text-4xl font-black text-white">{formatMoney(reviewingTrade.totalVerified)}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-20 flex flex-col items-center text-center">
              <FileText size={64} className="text-slate-800 mb-6" />
              <h3 className="text-2xl font-black text-slate-600 uppercase italic">Select Assessment</h3>
              <p className="text-slate-500 text-sm mt-2 font-bold max-w-sm">Click a trade on the left to verify their monthly draw claim.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}