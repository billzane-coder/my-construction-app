'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  CheckCircle2, Clock, Loader2, ExternalLink, FileText, 
  UploadCloud, Save, Plus, ChevronLeft, ChevronRight, 
  BarChart3, AlertCircle, Printer, Landmark, Building2, Wallet,
  ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react'

export default function DrawsManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [allDraws, setAllDraws] = useState<any[]>([])
  const [activeDraw, setActiveDraw] = useState<any>(null)
  const [drawSummary, setDrawSummary] = useState<any>(null) 
  
  const [project, setProject] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  
  const [contracts, setContracts] = useState<any[]>([])
  const [sovLines, setSovLines] = useState<any[]>([])
  const [drawLines, setDrawLines] = useState<any[]>([]) 
  
  const [reviewingContractId, setReviewingContractId] = useState<string | 'summary'>('summary')
  const [expandedTrades, setExpandedTrades] = useState<Record<string, boolean>>({})
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleTradeExpansion = (tradeId: string) => {
    setExpandedTrades(prev => ({ ...prev, [tradeId]: !prev[tradeId] }))
  }

  const fetchData = async (targetDrawId?: string) => {
    setLoading(true)
    try {
      const [pRes, sRes] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('company_settings').select('*').eq('id', 1).single()
      ])
      if (pRes.data) setProject(pRes.data)
      if (sRes.data) setSettings(sRes.data)

      let { data: draws } = await supabase.from('project_draws').select('*').eq('project_id', id).order('draw_number', { ascending: true })
      
      if (!draws || draws.length === 0) {
        const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const { data: n } = await supabase.from('project_draws').insert([{ project_id: id, draw_number: 1, period: currentPeriod, status: 'Draft' }]).select()
        draws = n || []
      }
      setAllDraws(draws || [])
      
      const currentDraw = targetDrawId ? draws.find(d => d.id === targetDrawId) : draws[draws.length - 1]
      setActiveDraw(currentDraw)

      let { data: summaryData } = await supabase.from('draw_summaries').select('*').eq('draw_id', currentDraw.id).single()
      if (!summaryData) {
        const { data: newSummary } = await supabase.from('draw_summaries').insert([{ draw_id: currentDraw.id }]).select().single()
        summaryData = newSummary
      }
      setDrawSummary(summaryData)

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

      let { data: allBilledLines } = await supabase.from('draw_line_items').select('*')
      
      const currentBilled = allBilledLines?.filter(b => b.draw_id === summaryData.id) || []
      const missingLines = lines?.filter(l => !currentBilled.some((b: any) => b.sov_line_id === l.id)) || []
      
      if (missingLines.length > 0) {
        const seed = missingLines.map(l => ({ 
          draw_id: summaryData.id, 
          sov_line_id: l.id, 
          sov_code: l.cost_code || '00-000',
          description: l.description || 'Line Item',
          original_budget: l.scheduled_value || 0,
          claimed_amount: 0, 
          current_gross_billed: 0,
          holdback_rate: 0.10
        }))
        await supabase.from('draw_line_items').insert(seed)
        const r = await supabase.from('draw_line_items').select('*')
        allBilledLines = r.data || []
      }
      
      setDrawLines(allBilledLines || [])
    } catch (err) { console.error("Fetch Error:", err) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const tradeBills = useMemo(() => {
    if (!drawSummary || !allDraws.length) return [];
    
    return contracts.map(contract => {
      const mySovs = sovLines.filter(s => s.contract_id === contract.id)
      let totalScheduled = 0, totalClaimed = 0, totalVerified = 0, previousVerified = 0
      let totalHoldback = 0, netPayable = 0
      let invoiceUrl: string | null = null

      const mappedLines = mySovs.map(sov => {
        const allMyDrawLines = drawLines.filter(d => d.sov_line_id === sov.id)
        
        const currentLine = allMyDrawLines.find(d => d.draw_id === drawSummary.id)
        const pastLines = allMyDrawLines.filter(d => d.draw_id !== drawSummary.id)

        const prevVer = pastLines.reduce((sum, l) => sum + Number(l.current_gross_billed || 0), 0)
        const sched = Number(sov.scheduled_value || 0)
        const claim = Number(currentLine?.claimed_amount || 0)
        const verif = Number(currentLine?.current_gross_billed || 0)
        const holdbackRate = Number(currentLine?.holdback_rate || 0.10)
        
        const lineHoldback = verif * holdbackRate
        const lineNet = verif - lineHoldback

        if (currentLine?.invoice_link && !invoiceUrl) invoiceUrl = currentLine.invoice_link
        
        totalScheduled += sched
        previousVerified += prevVer
        totalClaimed += claim
        totalVerified += verif
        totalHoldback += lineHoldback
        netPayable += lineNet
        
        return { 
          id: sov.id, desc: sov.description, scheduled: sched, previous: prevVer, 
          claimed: claim, verified: verif, holdback: lineHoldback, net: lineNet, dbId: currentLine?.id 
        }
      })

      const status = totalClaimed === 0 ? 'No Claim' : (totalVerified === 0 ? 'Pending Review' : (totalVerified >= totalClaimed ? 'Verified Matched' : 'Verified Adjusted'))
      const totalToDate = previousVerified + totalVerified
      const percentComplete = totalScheduled > 0 ? ((totalToDate / totalScheduled) * 100) : 0

      return { 
        ...contract, company: contract.project_contacts?.company || 'Unknown Trade', 
        totalScheduled, previousVerified, totalClaimed, totalVerified, totalHoldback, netPayable,
        totalToDate, percentComplete, invoiceUrl, lines: mappedLines, status 
      }
    })
  }, [contracts, sovLines, drawLines, drawSummary, allDraws])

  const reviewingTrade = tradeBills.find(t => t.id === reviewingContractId)

  const projectTotals = tradeBills.reduce((acc, trade) => ({
    scheduled: acc.scheduled + trade.totalScheduled,
    previous: acc.previous + trade.previousVerified,
    claimed: acc.claimed + trade.totalClaimed,
    verified: acc.verified + trade.totalVerified,
    holdback: acc.holdback + trade.totalHoldback,
    net: acc.net + trade.netPayable,
    toDate: acc.toDate + trade.totalToDate
  }), { scheduled: 0, previous: 0, claimed: 0, verified: 0, holdback: 0, net: 0, toDate: 0 })

  const handleUpdateClaim = (sovLineId: string, val: number) => {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    setDrawLines(prev => prev.map(dl => (dl.sov_line_id === sovLineId && dl.draw_id === drawSummary.id) ? { ...dl, claimed_amount: safeVal } : dl))
  }

  const handleUpdateVerif = (sovLineId: string, val: number) => {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    setDrawLines(prev => prev.map(dl => (dl.sov_line_id === sovLineId && dl.draw_id === drawSummary.id) ? { ...dl, current_gross_billed: safeVal } : dl))
  }
  
  const handleSave = async () => {
    setSaving(true)
    if (reviewingTrade) {
      const updates = reviewingTrade.lines.map((l: any) => {
        const payload: any = { 
          draw_id: drawSummary.id, 
          sov_line_id: l.id, 
          claimed_amount: l.claimed, 
          current_gross_billed: l.verified 
        };
        if (l.dbId) payload.id = l.dbId; 
        return payload;
      });
      const { error } = await supabase.from('draw_line_items').upsert(updates)
      if (error) alert(`Failed to save: ${error.message}`);
      else await fetchData(activeDraw.id);
    }
    setSaving(false)
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)

  // --- RESTORED NATIVE PDF EXPORT ENGINE ---
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')
    
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [37, 99, 235]; 
    }
    const brandRgb = hexToRgb(settings?.primary_color || '#2563eb')

    doc.setFontSize(22)
    doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2])
    doc.setFont("helvetica", "bold")
    doc.text(settings?.company_name || 'COMPANY NAME', 14, 20)

    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text(`Internal Master Draw Report - Draw #${activeDraw?.draw_number}`, 14, 30)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text(`Project: ${project?.name || 'Unassigned'}`, 14, 38)
    doc.text(`Period: ${activeDraw?.period || 'N/A'}`, 14, 44)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 50)

    const tableData = tradeBills.map(trade => [
      trade.company,
      formatMoney(trade.totalScheduled),
      formatMoney(trade.previousVerified),
      formatMoney(trade.totalVerified),
      formatMoney(trade.totalHoldback),
      formatMoney(trade.netPayable)
    ])

    const footerData = [[
      'PROJECT TOTALS',
      formatMoney(projectTotals.scheduled),
      formatMoney(projectTotals.previous),
      formatMoney(projectTotals.verified),
      formatMoney(projectTotals.holdback),
      formatMoney(projectTotals.net)
    ]]

    autoTable(doc, {
      startY: 60,
      head: [['Trade / Contract', 'Contract Sum', 'Prev Billed', 'Current Gross', 'Holdback (10%)', 'Net Payable']],
      body: tableData,
      foot: footerData,
      theme: 'grid',
      headStyles: { fillColor: brandRgb, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' }, 
      alternateRowStyles: { fillColor: [248, 250, 252] }, 
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', textColor: brandRgb, fontStyle: 'bold' }, 
        4: { halign: 'right', textColor: [217, 119, 6] }, 
        5: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
      }
    })

    doc.save(`${project?.name || 'Project'}_MasterDraw_${activeDraw?.draw_number}.pdf`)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100 pb-32">
      <FinancialHeader id={id as string} active="draws" />
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-8 flex justify-between items-center shadow-xl">
        <button disabled={true} className="p-2 rounded-xl flex items-center gap-2 transition-all bg-slate-950 text-slate-700 cursor-not-allowed">
          <ChevronLeft size={20} /> <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Previous</span>
        </button>
        
        <div className="text-center flex flex-col items-center min-w-[140px]">
          <h2 className="text-2xl font-black text-amber-500 uppercase italic tracking-tighter leading-none mb-1">Draw #{activeDraw?.draw_number}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-transparent text-center outline-none w-full">{activeDraw?.period}</p>
        </div>

        <div className="flex gap-2">
          <button disabled={true} className="p-2 rounded-xl flex items-center gap-2 transition-all bg-slate-950 text-slate-700 cursor-not-allowed">
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Next</span> <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-4">
          <button 
            onClick={() => setReviewingContractId('summary')}
            className={`w-full p-6 rounded-[32px] border text-left transition-all shadow-xl flex items-center justify-between group ${reviewingContractId === 'summary' ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
          >
            <div>
              <h3 className={`text-xl font-black uppercase italic tracking-tight ${reviewingContractId === 'summary' ? 'text-white' : 'text-slate-300'}`}>Owner Master Draw</h3>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${reviewingContractId === 'summary' ? 'text-blue-200' : 'text-slate-500'}`}>Rolled up to Contract Level</p>
            </div>
            <Landmark size={24} className={reviewingContractId === 'summary' ? 'text-white' : 'text-slate-600'} />
          </button>

          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 pt-4 mb-2">GC Field Assessment</h3>

          {tradeBills.map(trade => (
            <div key={trade.id} onClick={() => setReviewingContractId(trade.id)} className={`p-6 rounded-[32px] border transition-all cursor-pointer group shadow-xl ${reviewingContractId === trade.id ? 'bg-amber-950/20 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`text-lg font-black uppercase italic leading-none mb-1 ${reviewingContractId === trade.id ? 'text-amber-400' : 'text-white'}`}>{trade.company}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    {trade.status === 'No Claim' && <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-black uppercase rounded">No Claim</span>}
                    {trade.status === 'Pending Review' && <span className="px-2 py-0.5 bg-amber-950 text-amber-500 border border-amber-900/50 text-[8px] font-black uppercase rounded animate-pulse">Pending Review</span>}
                    {trade.status.includes('Verified') && <span className="px-2 py-0.5 bg-emerald-950/50 text-emerald-500 border border-emerald-900/50 text-[8px] font-black uppercase rounded">Verified</span>}
                  </div>
                </div>
                {trade.status === 'Pending Review' ? <Clock size={20} className="text-amber-500" /> : <CheckCircle2 size={20} className="text-emerald-500" />}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8">
          
          {reviewingContractId === 'summary' && (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in duration-300">
              
              <div className="p-8 border-b border-slate-800 bg-blue-950/20 flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Master Draw Certificate</h2>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Lender Summary for Draw #{activeDraw?.draw_number}</p>
                </div>
                {/* BUTTON IS NOW WIRED TO handleExportPDF */}
                <button onClick={handleExportPDF} className="bg-slate-800 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg border border-slate-700">
                  <Printer size={16}/> Export PDF
                </button>
              </div>

              {drawSummary && (
                <div className="p-8 border-b border-slate-800 bg-slate-950/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gross Costs Billed</p>
                      <p className="text-2xl font-black text-white">{formatMoney(drawSummary.gross_hard_costs)}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Statutory Holdback (10%)</p>
                      <p className="text-2xl font-black text-amber-500">{formatMoney(drawSummary.hard_cost_holdback)}</p>
                    </div>
                    <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Net Lender Advance</p>
                      <p className="text-2xl font-black text-blue-400">{formatMoney(drawSummary.net_lender_advance)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-950 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                      <th className="p-5">Trade / Contract</th>
                      <th className="p-5 text-center">Backup</th>
                      <th className="p-5 text-right">Contract Sum</th>
                      <th className="p-5 text-right">Prev Billed</th>
                      <th className="p-5 text-right text-white">Current Gross</th>
                      <th className="p-5 text-right text-amber-500/70 border-l border-slate-800/50">Holdback</th>
                      <th className="p-5 text-right text-blue-400/70 border-l border-slate-800/50">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    
                    {tradeBills.map(trade => (
                      <Fragment key={trade.id}>
                        <tr 
                          className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedTrades[trade.id] ? 'bg-slate-800/20' : ''}`}
                          onClick={() => toggleTradeExpansion(trade.id)}
                        >
                          <td className="p-5 flex items-center gap-3">
                            <div className="text-slate-500">
                              {expandedTrades[trade.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{trade.company}</p>
                              <p className="text-[10px] font-black text-slate-500 uppercase mt-1">Hard Cost</p>
                            </div>
                          </td>
                          <td className="p-5 text-center align-middle">
                            {trade.invoiceUrl ? (
                              <a 
                                href={trade.invoiceUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                onClick={(e) => e.stopPropagation()} 
                                className="inline-flex items-center justify-center p-2 bg-blue-950/30 text-blue-400 hover:bg-blue-900/50 rounded-lg transition-colors border border-blue-900/30 group-hover:border-blue-500"
                                title="View Trade Invoice"
                              >
                                <FileText size={16} />
                              </a>
                            ) : (
                              <span className="text-slate-700 block text-center" title="No Invoice Attached"><FileText size={16} className="mx-auto"/></span>
                            )}
                          </td>
                          <td className="p-5 text-right font-bold text-slate-400">{formatMoney(trade.totalScheduled)}</td>
                          <td className="p-5 text-right font-bold text-slate-500">{formatMoney(trade.previousVerified)}</td>
                          <td className="p-5 text-right font-black text-white">{formatMoney(trade.totalVerified)}</td>
                          <td className="p-5 text-right border-l border-slate-800/50 font-black text-amber-500/80">{formatMoney(trade.totalHoldback)}</td>
                          <td className="p-5 text-right border-l border-slate-800/50 font-black text-blue-400">{formatMoney(trade.netPayable)}</td>
                        </tr>

                        {expandedTrades[trade.id] && (
                          <tr className="bg-slate-950 border-b-2 border-slate-800 shadow-inner">
                            <td colSpan={7} className="p-0">
                              <div className="pl-16 pr-5 py-4 border-l-4 border-blue-500/50 bg-slate-950">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-800/50">
                                      <th className="pb-3 text-left">Detailed SOV Line Item</th>
                                      <th className="pb-3 text-right">Budget</th>
                                      <th className="pb-3 text-right">Previously Billed</th>
                                      <th className="pb-3 text-right text-slate-400">Current Work</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {trade.lines.map((line: any) => (
                                      <tr key={line.id} className="border-b border-slate-800/30 last:border-0">
                                        <td className="py-3 font-bold text-slate-300">{line.desc}</td>
                                        <td className="py-3 text-right text-slate-500">{formatMoney(line.scheduled)}</td>
                                        <td className="py-3 text-right text-slate-500">{formatMoney(line.previous)}</td>
                                        <td className="py-3 text-right font-bold text-slate-300">{formatMoney(line.verified)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}

                    <tr className="bg-slate-900/50 border-t-2 border-slate-800">
                      <td className="p-5">
                        <p className="font-bold text-emerald-400 text-sm">GC Management Fee</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase mt-1">Soft Cost</p>
                      </td>
                      <td className="p-5"></td>
                      <td className="p-5 text-right font-bold text-slate-400">{formatMoney(100000)}</td>
                      <td className="p-5 text-right font-bold text-slate-500">{formatMoney(20000)}</td>
                      <td className="p-5 text-right font-black text-white">{formatMoney(5000)}</td>
                      <td className="p-5 text-right border-l border-slate-800/50 font-black text-slate-600">{formatMoney(0)} <span className="text-[8px]">No HB</span></td>
                      <td className="p-5 text-right border-l border-slate-800/50 font-black text-blue-400">{formatMoney(5000)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-950 border-t-2 border-slate-800">
                      <td colSpan={2} className="p-6 text-right text-xs font-black uppercase tracking-widest text-slate-500">Master Totals:</td>
                      <td className="p-6 text-right text-sm font-black text-slate-300">{formatMoney(projectTotals.scheduled + 100000)}</td>
                      <td className="p-6 text-right text-sm font-black text-slate-400">{formatMoney(projectTotals.previous + 20000)}</td>
                      <td className="p-6 text-right text-lg font-black text-white">{formatMoney(projectTotals.verified + 5000)}</td>
                      <td className="p-6 text-right text-sm font-black text-amber-500 border-l border-slate-800/50">{formatMoney(projectTotals.holdback)}</td>
                      <td className="p-6 text-right text-lg font-black text-blue-400 border-l border-slate-800/50">{formatMoney(projectTotals.net + 5000)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {reviewingContractId !== 'summary' && reviewingTrade && (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden sticky top-8 animate-in fade-in duration-300">
              <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">{reviewingTrade.company}</h2>
                  <div className="flex flex-wrap gap-3 items-center mt-3">
                    <span className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-300 text-[10px] font-black uppercase tracking-widest">Sum: {formatMoney(reviewingTrade.totalScheduled)}</span>
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                      <ShieldCheck size={12}/> {reviewingTrade.percentComplete.toFixed(1)}% Complete
                    </span>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="bg-amber-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 flex items-center gap-2 shadow-lg">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Lock Assessment
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="p-6">SOV Description</th>
                      <th className="p-6 text-right">Scheduled</th>
                      
                      <th className="p-6 text-center bg-amber-950/10 border-l border-amber-900/30 text-amber-500">Sub Claim %</th>
                      <th className="p-6 pr-8 bg-amber-950/10 text-amber-500 text-right">Sub Claim ($)</th>
                      
                      <th className="p-6 text-center bg-blue-950/10 border-l border-blue-900/30 text-blue-400">GC Verif %</th>
                      <th className="p-6 pl-8 bg-blue-950/10 text-blue-400 text-right">Super Verified ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {reviewingTrade.lines.map((line: any) => {
                      const isOverbilled = line.verified > line.claimed;
                      const percentClaimed = line.scheduled > 0 ? Number(((line.claimed / line.scheduled) * 100).toFixed(1)) : 0;
                      const verifiedPercent = line.scheduled > 0 ? Number(((line.verified / line.scheduled) * 100).toFixed(1)) : 0;

                      return (
                        <tr key={line.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-6"><p className="font-bold text-white text-sm">{line.desc}</p></td>
                          <td className="p-6 text-right font-black text-slate-400">{formatMoney(line.scheduled)}</td>
                          
                          <td className="p-4 bg-amber-950/10 border-l border-amber-900/30 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={percentClaimed === 0 ? '' : percentClaimed} placeholder="0"
                                onChange={(e) => handleUpdateClaim(line.id, Number(((parseFloat(e.target.value) || 0) / 100) * line.scheduled))} 
                                className="w-16 bg-slate-950 border border-slate-700 p-3 rounded-xl font-black text-center text-amber-500 outline-none focus:border-amber-500" 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                          </td>

                          <td className="p-4 pr-6 bg-amber-950/10 align-middle">
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/50 font-bold">$</span>
                              <input type="number" value={line.claimed === 0 ? '' : line.claimed} placeholder="0.00"
                                onChange={(e) => handleUpdateClaim(line.id, parseFloat(e.target.value) || 0)} 
                                className="w-full bg-slate-950 border border-slate-700 py-3 pl-8 pr-4 rounded-xl font-black text-right text-amber-400 outline-none focus:border-amber-500" 
                              />
                            </div>
                          </td>
                          
                          <td className="p-4 bg-blue-950/10 border-l border-blue-900/30 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={verifiedPercent === 0 ? '' : verifiedPercent} placeholder="0"
                                onChange={(e) => handleUpdateVerif(line.id, Number(((parseFloat(e.target.value) || 0) / 100) * line.scheduled))} 
                                className={`w-16 bg-slate-950 border p-3 rounded-xl font-black text-center outline-none ${isOverbilled ? 'border-red-900/50 text-red-400' : 'border-slate-700 text-blue-400 focus:border-blue-500'}`} 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                          </td>

                          <td className="p-4 pl-6 bg-blue-950/10 align-middle">
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                              <input type="number" value={line.verified === 0 ? '' : line.verified} placeholder="0.00"
                                onChange={(e) => handleUpdateVerif(line.id, parseFloat(e.target.value) || 0)} 
                                className={`w-full bg-slate-950 border py-3 pl-8 pr-4 rounded-xl font-black text-right outline-none ${isOverbilled ? 'border-red-900/50 text-red-400 focus:border-red-500' : 'border-slate-700 text-white focus:border-blue-500'}`} 
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}