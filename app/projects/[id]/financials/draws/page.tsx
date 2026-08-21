'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  CheckCircle2, Clock, Loader2, FileText, 
  UploadCloud, Save, Plus, ChevronLeft, ChevronRight, 
  AlertCircle, Printer, Landmark, ShieldCheck, ChevronDown, ChevronUp,
  Receipt, FileSpreadsheet, Trash2, ExternalLink
} from 'lucide-react'

export default function DrawsManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<'invoice' | 'sov' | null>(null)
  
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
  
  const invoiceInputRef = useRef<HTMLInputElement>(null)
  const sovInputRef = useRef<HTMLInputElement>(null)

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
      
      const missingTrades = lines?.filter(l => !currentBilled.some((b: any) => b.sov_line_id === l.id && b.sov_code !== 'SOFT')) || []

      if (missingTrades.length > 0) {
        const fullSeed = missingTrades.map(l => ({ 
          draw_id: summaryData.id, 
          sov_line_id: l.id, 
          sov_code: l.cost_code || '00-000',
          description: l.description || 'Line Item',
          original_budget: l.scheduled_value || 0,
          approved_changes: 0,
          claimed_amount: 0, 
          current_gross_billed: 0,
          holdback_rate: 0.10,
          is_soft_cost: false
        }));
        await supabase.from('draw_line_items').insert(fullSeed)
        const r = await supabase.from('draw_line_items').select('*')
        allBilledLines = r.data || []
      }
      
      setDrawLines(allBilledLines || [])
    } catch (err) { console.error("Fetch Error:", err) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const currentIndex = allDraws.findIndex(d => d.id === activeDraw?.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allDraws.length - 1

  const goPrev = () => { if (hasPrev) { setReviewingContractId('summary'); fetchData(allDraws[currentIndex - 1].id); } }
  const goNext = () => { if (hasNext) { setReviewingContractId('summary'); fetchData(allDraws[currentIndex + 1].id); } }

  const handleUpdatePeriod = async () => {
    if (!activeDraw) return;
    await supabase.from('project_draws').update({ period: activeDraw.period }).eq('id', activeDraw.id);
    setAllDraws(prev => prev.map(d => d.id === activeDraw.id ? { ...d, period: activeDraw.period } : d));
  }

  const handleNewDraw = async () => {
    setLoading(true);
    try {
      const nextNum = allDraws.length > 0 ? Math.max(...allDraws.map(d => d.draw_number)) + 1 : 1;
      const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      
      const { data: newDraw, error: drawErr } = await supabase.from('project_draws').insert([{
        project_id: id,
        draw_number: nextNum,
        period: currentPeriod,
        status: 'Draft'
      }]).select().single();

      if (drawErr) throw drawErr;

      const { data: newSum, error: sumErr } = await supabase.from('draw_summaries').insert([{ draw_id: newDraw.id }]).select().single();
      if (sumErr) throw sumErr;

      if (drawSummary) {
         const { data: prevSofts } = await supabase.from('draw_line_items').select('*').eq('draw_id', drawSummary.id).eq('is_soft_cost', true);
         if (prevSofts && prevSofts.length > 0) {
            const softCopy = prevSofts.map(s => ({
               draw_id: newSum.id,
               sov_code: 'SOFT',
               description: s.description,
               original_budget: s.original_budget,
               approved_changes: s.approved_changes,
               current_gross_billed: 0, 
               holdback_rate: s.holdback_rate,
               is_soft_cost: true
            }));
            const { error: copyErr } = await supabase.from('draw_line_items').insert(softCopy);
            if (copyErr) throw copyErr;
         }
      }

      await fetchData(newDraw.id);
    } catch (err: any) {
      alert(`Failed to create draw: ${err.message}`);
      setLoading(false);
    }
  }

  const handleDeleteDraw = async () => {
    if (!activeDraw) return;
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete Draw #${activeDraw.draw_number}? This cannot be undone.`);
    if (!confirmDelete) return;

    setSaving(true);
    try {
      await supabase.from('draw_line_items').delete().eq('draw_id', activeDraw.id);
      await supabase.from('draw_summaries').delete().eq('draw_id', activeDraw.id);
      await supabase.from('draw_attachments').delete().eq('draw_id', activeDraw.id);
      await supabase.from('project_draws').delete().eq('id', activeDraw.id);
      
      setReviewingContractId('summary')
      await fetchData(); 
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    }
    setSaving(false);
  }

  const handleDeleteSoftCost = async (dbId: string) => {
    if (!window.confirm("Permanently delete this item?")) return;
    setSaving(true);
    const { error } = await supabase.from('draw_line_items').delete().eq('id', dbId);
    if (error) alert(`Failed to delete: ${error.message}`);
    await fetchData(activeDraw.id);
    setSaving(false);
  }

  const tradeBills = useMemo(() => {
    if (!drawSummary || !allDraws.length) return { trades: [], softCosts: [] };
    
    const processedTrades = contracts.map(contract => {
      const mySovs = sovLines.filter(s => s.contract_id === contract.id)
      let totalOriginal = 0, totalCOs = 0, totalScheduled = 0
      let totalClaimed = 0, totalVerified = 0, previousVerified = 0
      let totalHoldback = 0, netPayable = 0
      let invoiceUrl: string | null = null
      let tradeSovUrl: string | null = null

      const mappedLines = mySovs.map(sov => {
        const allMyDrawLines = drawLines.filter(d => d.sov_line_id === sov.id)
        
        const currentLine = allMyDrawLines.find(d => d.draw_id === drawSummary.id)
        const pastLines = allMyDrawLines.filter(d => d.draw_id !== drawSummary.id)

        const prevVer = pastLines.reduce((sum, l) => sum + Number(l.current_gross_billed || 0), 0)
        
        const original = sov.change_order_id ? 0 : Number(sov.scheduled_value || 0)
        const cos = sov.change_order_id ? Number(sov.scheduled_value || 0) : 0
        const sched = original + cos 
        
        const claim = Number(currentLine?.claimed_amount || 0)
        const verif = Number(currentLine?.current_gross_billed || 0)
        const holdbackRate = currentLine?.holdback_rate !== undefined ? Number(currentLine.holdback_rate) : 0.10
        
        const lineHoldback = verif * holdbackRate
        const lineNet = verif - lineHoldback

        if (currentLine?.invoice_link && !invoiceUrl) invoiceUrl = currentLine.invoice_link
        if (currentLine?.trade_sov_link && !tradeSovUrl) tradeSovUrl = currentLine.trade_sov_link
        
        totalOriginal += original
        totalCOs += cos
        totalScheduled += sched
        previousVerified += prevVer
        totalClaimed += claim
        totalVerified += verif
        totalHoldback += lineHoldback
        netPayable += lineNet
        
        return { 
          id: sov.id, desc: sov.description, original, cos, scheduled: sched, previous: prevVer, 
          claimed: claim, verified: verif, rate: holdbackRate, holdback: lineHoldback, net: lineNet, dbId: currentLine?.id,
          isCO: !!sov.change_order_id
        }
      })

      const status = totalClaimed === 0 ? 'No Claim' : (totalVerified === 0 ? 'Pending Review' : (totalVerified >= totalClaimed ? 'Verified Matched' : 'Verified Adjusted'))
      const totalToDate = previousVerified + totalVerified
      const percentComplete = totalScheduled > 0 ? ((totalToDate / totalScheduled) * 100) : 0

      return { 
        ...contract, company: contract.project_contacts?.company || 'Unknown Trade', 
        totalOriginal, totalCOs, totalScheduled, previousVerified, totalClaimed, totalVerified, totalHoldback, netPayable,
        totalToDate, percentComplete, invoiceUrl, tradeSovUrl, lines: mappedLines, status 
      }
    })

    const processedSoftCosts = drawLines.filter(d => d.draw_id === drawSummary.id && d.is_soft_cost).map(sc => {
      const pastLines = drawLines.filter(d => d.draw_id !== drawSummary.id && d.is_soft_cost && d.description === sc.description)
      const prevVer = pastLines.reduce((sum, l) => sum + Number(l.current_gross_billed || 0), 0)
      
      const scheduled = Number(sc.original_budget || 0) + Number(sc.approved_changes || 0)
      const verif = Number(sc.current_gross_billed || 0)
      const rate = Number(sc.holdback_rate !== undefined ? sc.holdback_rate : 0)
      const lineHoldback = verif * rate 
      
      return {
        id: sc.id, desc: sc.description, scheduled, previous: prevVer, verified: verif, 
        rate, holdback: lineHoldback, net: verif - lineHoldback
      }
    })

    return { trades: processedTrades, softCosts: processedSoftCosts }
  }, [contracts, sovLines, drawLines, drawSummary, allDraws])

  const reviewingTrade = tradeBills.trades.find(t => t.id === reviewingContractId)

  const projectTotals = useMemo(() => {
    const tradeTotals = tradeBills.trades.reduce((acc, trade) => ({
      scheduled: acc.scheduled + trade.totalScheduled,
      previous: acc.previous + trade.previousVerified,
      verified: acc.verified + trade.totalVerified,
      holdback: acc.holdback + trade.totalHoldback,
      net: acc.net + trade.netPayable
    }), { scheduled: 0, previous: 0, verified: 0, holdback: 0, net: 0 })

    const softTotals = tradeBills.softCosts.reduce((acc, sc) => ({
      scheduled: acc.scheduled + sc.scheduled,
      previous: acc.previous + sc.previous,
      verified: acc.verified + sc.verified,
      holdback: acc.holdback + sc.holdback,
      net: acc.net + sc.net
    }), { scheduled: 0, previous: 0, verified: 0, holdback: 0, net: 0 })

    return {
      scheduled: tradeTotals.scheduled + softTotals.scheduled,
      previous: tradeTotals.previous + softTotals.previous,
      verified: tradeTotals.verified + softTotals.verified,
      holdback: tradeTotals.holdback + softTotals.holdback,
      net: tradeTotals.net + softTotals.net
    }
  }, [tradeBills])

  const handleUpdateLine = (dbId: string, field: string, val: number) => {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    setDrawLines(prev => prev.map(dl => dl.id === dbId ? { ...dl, [field]: safeVal } : dl))
  }

  const handleAddSoftCost = async () => {
    const desc = prompt("Enter description (e.g. GC Fee, General Conditions, Bond):")
    if (!desc) return
    const budget = prompt("Enter total budget for this item:")
    
    setSaving(true)
    const { error } = await supabase.from('draw_line_items').insert([{
      draw_id: drawSummary.id,
      sov_code: 'SOFT',
      description: desc,
      original_budget: Number(budget) || 0,
      current_gross_billed: 0,
      holdback_rate: 0.00, 
      is_soft_cost: true
    }])
    
    if (error) {
       alert(`Database Error: Failed to add item. ${error.message}`)
    } else {
       await fetchData(activeDraw.id)
    }
    setSaving(false)
  }
  
  const handleSave = async () => {
    setSaving(true)
    try {
      if (reviewingTrade) {
        const promises = reviewingTrade.lines.filter((l:any) => l.dbId).map(async (l: any) => {
          const { error } = await supabase.from('draw_line_items').update({
            claimed_amount: l.claimed, 
            current_gross_billed: l.verified,
            holdback_rate: l.rate 
          }).eq('id', l.dbId);
          if (error) throw error;
        });
        await Promise.all(promises);
      }

      if (reviewingContractId === 'summary') {
        const promises = tradeBills.softCosts.map(async sc => {
          const { error } = await supabase.from('draw_line_items').update({
            current_gross_billed: sc.verified,
            holdback_rate: sc.rate
          }).eq('id', sc.id);
          if (error) throw error;
        });
        await Promise.all(promises);
      }

      await fetchData(activeDraw.id)
    } catch (error: any) {
      alert(`Save failed: ${error.message}`)
    }
    setSaving(false)
  }

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'sov') => {
    const file = e.target.files?.[0]
    if (!file || !reviewingTrade) return
    
    setUploadingDoc(type)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${type}_${reviewingTrade.id}_${Date.now()}.${fileExt}`
      const filePath = `${id}/${fileName}`
      
      const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)
      
      const sovIds = reviewingTrade.lines.map((l: any) => l.id).filter(Boolean)
      
      if (sovIds.length > 0) {
        const updateField = type === 'invoice' ? { invoice_link: publicUrl } : { trade_sov_link: publicUrl }
        const { error: dbErr } = await supabase.from('draw_line_items').update(updateField).eq('draw_id', drawSummary.id).in('sov_line_id', sovIds)
        if (dbErr) throw dbErr;
        
        await fetchData(activeDraw.id)
      } else {
        alert("Cannot attach document: No SOV lines found for this trade.")
      }
    } catch (error: any) { 
      alert(`Upload failed: ${error.message}`) 
    }
    
    if (e.target) e.target.value = ''
    setUploadingDoc(null)
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)

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
    doc.text(`Master Internal Draw - #${activeDraw?.draw_number}`, 14, 30)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text(`Project: ${project?.name || 'Unassigned'}`, 14, 38)
    doc.text(`Period: ${activeDraw?.period || 'N/A'}`, 14, 44)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 50)

    const tableData = tradeBills.trades.map(trade => [
      trade.company,
      formatMoney(trade.totalScheduled),
      formatMoney(trade.previousVerified),
      formatMoney(trade.totalVerified),
      trade.totalScheduled > 0 ? `${Math.round(((trade.previousVerified + trade.totalVerified) / trade.totalScheduled) * 100)}%` : '0%',
      formatMoney(trade.totalHoldback),
      formatMoney(trade.netPayable)
    ])

    tradeBills.softCosts.forEach(sc => {
      tableData.push([
        sc.desc + " (GC / General)",
        formatMoney(sc.scheduled),
        formatMoney(sc.previous),
        formatMoney(sc.verified),
        sc.scheduled > 0 ? `${Math.round(((sc.previous + sc.verified) / sc.scheduled) * 100)}%` : '0%',
        formatMoney(sc.holdback),
        formatMoney(sc.net)
      ])
    })

    const totalPct = projectTotals.scheduled > 0 ? `${Math.round(((projectTotals.previous + projectTotals.verified) / projectTotals.scheduled) * 100)}%` : '0%';
    const footerData = [[
      'PROJECT TOTALS',
      formatMoney(projectTotals.scheduled),
      formatMoney(projectTotals.previous),
      formatMoney(projectTotals.verified),
      totalPct,
      formatMoney(projectTotals.holdback),
      formatMoney(projectTotals.net)
    ]]

    autoTable(doc, {
      startY: 60,
      head: [['Trade / Cost Item', 'Revised Budget', 'Prev Billed', 'Current Gross', '% Comp', 'Holdback', 'Net Payable']],
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
        4: { halign: 'right', fontStyle: 'bold' }, 
        5: { halign: 'right', textColor: [217, 119, 6] }, 
        6: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
      }
    })

    doc.save(`${project?.name || 'Project'}_MasterDraw_${activeDraw?.draw_number}.pdf`)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100 pb-32">
      <FinancialHeader id={id as string} active="draws" />
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-8 flex justify-between items-center shadow-xl">
        <button onClick={goPrev} disabled={!hasPrev} className={`p-2 rounded-xl flex items-center gap-2 transition-all ${hasPrev ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700 cursor-not-allowed'}`}>
          <ChevronLeft size={20} /> <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Previous</span>
        </button>
        
        <div className="text-center flex flex-col items-center min-w-[140px]">
          <h2 className="text-2xl font-black text-amber-500 uppercase italic tracking-tighter leading-none mb-1">Draw #{activeDraw?.draw_number}</h2>
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
            <div className="flex gap-2">
              <button onClick={handleDeleteDraw} className="bg-red-950/50 hover:bg-red-900 text-red-500 p-2 md:px-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg border border-red-900/50">
                <Trash2 size={16}/> <span className="hidden md:inline">Delete Draw</span>
              </button>
              <button onClick={handleNewDraw} className="bg-amber-600 hover:bg-amber-500 text-white p-2 md:px-4 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg ml-2">
                <Plus size={16}/> <span className="hidden md:inline">Create Next</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-4">
          <button 
            onClick={() => setReviewingContractId('summary')}
            className={`w-full p-6 rounded-[32px] border text-left transition-all shadow-xl flex items-center justify-between group ${reviewingContractId === 'summary' ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
          >
            <div>
              <h3 className={`text-xl font-black uppercase italic tracking-tight ${reviewingContractId === 'summary' ? 'text-white' : 'text-slate-300'}`}>Contractor Master Draw</h3>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${reviewingContractId === 'summary' ? 'text-blue-200' : 'text-slate-500'}`}>Rolled up Trades & GC Costs</p>
            </div>
            <Landmark size={24} className={reviewingContractId === 'summary' ? 'text-white' : 'text-slate-600'} />
          </button>

          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 pt-4 mb-2">Trade Contract Assessment</h3>

          {tradeBills.trades.map(trade => (
            <div key={trade.id} onClick={() => setReviewingContractId(trade.id)} className={`p-6 rounded-[32px] border transition-all cursor-pointer group shadow-xl ${reviewingContractId === trade.id ? 'bg-amber-950/20 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className={`text-lg font-black uppercase italic leading-none mb-1 ${reviewingContractId === trade.id ? 'text-amber-400' : 'text-white'}`}>{trade.company}</h4>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {trade.status === 'No Claim' && <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-black uppercase rounded">No Claim</span>}
                    {trade.status === 'Pending Review' && <span className="px-2 py-0.5 bg-amber-950 text-amber-500 border border-amber-900/50 text-[8px] font-black uppercase rounded animate-pulse">Pending Review</span>}
                    {trade.status.includes('Verified') && <span className="px-2 py-0.5 bg-emerald-950/50 text-emerald-500 border border-emerald-900/50 text-[8px] font-black uppercase rounded">Verified</span>}
                    
                    {trade.invoiceUrl && <span title="Invoice Attached"><Receipt size={14} className="text-blue-400 ml-2" /></span>}
                    {trade.tradeSovUrl && <span title="SOV Attached"><FileSpreadsheet size={14} className="text-indigo-400" /></span>}
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
              
              <div className="p-8 border-b border-slate-800 bg-blue-950/20 flex justify-between items-start md:items-center">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Master Draw Certificate</h2>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Internal Summary for Draw #{activeDraw?.draw_number}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExportPDF} className="bg-slate-800 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700">
                    <Printer size={16}/> Export PDF
                  </button>
                  <button onClick={handleAddSoftCost} className="bg-slate-800 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700">
                    <Plus size={16}/> Add GC Cost
                  </button>
                  <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg border border-blue-500">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Save Master
                  </button>
                </div>
              </div>

              {drawSummary && (
                <div className="p-8 border-b border-slate-800 bg-slate-950/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Gross Billed to Date</p>
                      <p className="text-2xl font-black text-white">{formatMoney(projectTotals.verified)}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Statutory Holdback</p>
                      <p className="text-2xl font-black text-amber-500">{formatMoney(projectTotals.holdback)}</p>
                    </div>
                    <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-5 shadow-inner">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Net Payment Due</p>
                      <p className="text-2xl font-black text-blue-400">{formatMoney(drawSummary.net_lender_advance)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-950 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                      <th className="p-5">Trade / Cost Code</th>
                      <th className="p-5 text-right">Revised Contract</th>
                      <th className="p-5 text-right">Prev Billed</th>
                      <th className="p-5 text-right text-white">Current Gross</th>
                      <th className="p-5 text-right text-emerald-400">% Comp</th>
                      <th className="p-5 text-right text-amber-500/70 border-l border-slate-800/50">Holdback %</th>
                      <th className="p-5 text-right text-blue-400/70 border-l border-slate-800/50">Net Payable</th>
                      <th className="p-5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    
                    {tradeBills.trades.map(trade => (
                      <Fragment key={trade.id}>
                        <tr className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedTrades[trade.id] ? 'bg-slate-800/20' : ''}`} onClick={() => toggleTradeExpansion(trade.id)}>
                          <td className="p-5 flex items-center gap-3">
                            <div className="text-slate-500">{expandedTrades[trade.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-white text-sm">{trade.company}</p>
                                {trade.invoiceUrl && <span title="Invoice Attached"><Receipt size={14} className="text-blue-400" /></span>}
                                {trade.tradeSovUrl && <span title="SOV Attached"><FileSpreadsheet size={14} className="text-indigo-400" /></span>}
                              </div>
                              <p className="text-[10px] font-black text-slate-500 uppercase mt-1">Hard Cost</p>
                            </div>
                          </td>
                          <td className="p-5 text-right font-bold text-slate-400">{formatMoney(trade.totalScheduled)}</td>
                          <td className="p-5 text-right font-bold text-slate-500">{formatMoney(trade.previousVerified)}</td>
                          <td className="p-5 text-right font-black text-white">{formatMoney(trade.totalVerified)}</td>
                          
                          <td className="p-5 text-right font-bold text-emerald-400">
                            {trade.totalScheduled > 0 ? Math.round(((trade.previousVerified + trade.totalVerified) / trade.totalScheduled) * 100) : 0}%
                          </td>

                          <td className="p-5 text-right border-l border-slate-800/50 font-black text-amber-500/80">{formatMoney(trade.totalHoldback)}</td>
                          <td className="p-5 text-right border-l border-slate-800/50 font-black text-blue-400">{formatMoney(trade.netPayable)}</td>
                          <td className="p-5"></td>
                        </tr>

                        {expandedTrades[trade.id] && (
                          <tr className="bg-slate-950 border-b-2 border-slate-800 shadow-inner">
                            <td colSpan={8} className="p-0">
                              <div className="pl-16 pr-5 py-4 border-l-4 border-blue-500/50 bg-slate-950">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[9px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-800/50">
                                      <th className="pb-3 text-left">Detailed SOV Line Item</th>
                                      <th className="pb-3 text-right">Rev. Budget</th>
                                      <th className="pb-3 text-right">Previously Billed</th>
                                      <th className="pb-3 text-right text-slate-400">Current Work</th>
                                      <th className="pb-3 text-right text-emerald-400">% Comp</th>
                                      <th className="pb-3 text-right text-amber-500">Holdback %</th>
                                      <th className="pb-3 text-right text-amber-500">Holdback ($)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {trade.lines.map((line: any) => (
                                      <tr key={line.id} className="border-b border-slate-800/30 last:border-0">
                                        <td className="py-3 font-bold text-slate-300">
                                          {line.desc}
                                          {line.isCO && <span className="ml-2 text-[8px] bg-emerald-950/50 text-emerald-500 px-1 py-0.5 rounded border border-emerald-900/50">CO</span>}
                                        </td>
                                        <td className="py-3 text-right text-slate-500">{formatMoney(line.scheduled)}</td>
                                        <td className="py-3 text-right text-slate-500">{formatMoney(line.previous)}</td>
                                        <td className="py-3 text-right font-bold text-slate-300">{formatMoney(line.verified)}</td>
                                        <td className="py-3 text-right font-bold text-emerald-400">
                                          {line.scheduled > 0 ? Math.round(((line.previous + line.verified) / line.scheduled) * 100) : 0}%
                                        </td>
                                        <td className="py-3 align-middle">
                                          <div className="flex items-center justify-end gap-1">
                                            <input type="number" value={line.rate * 100} placeholder="10"
                                              onChange={(e) => handleUpdateLine(line.dbId, 'holdback_rate', (parseFloat(e.target.value) || 0) / 100)} 
                                              className="w-16 bg-slate-950 border border-slate-700 p-2 rounded-lg font-black text-center text-amber-500 outline-none focus:border-amber-500" 
                                            />
                                            <span className="text-slate-500 font-bold text-xs">%</span>
                                          </div>
                                        </td>
                                        <td className="py-3 text-right font-bold text-amber-500/80">{formatMoney(line.holdback)}</td>
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

                    {/* SOFT COSTS / GC FEES */}
                    {tradeBills.softCosts.map(sc => (
                      <tr key={sc.id} className="bg-slate-900/50 border-t-2 border-slate-800 hover:bg-slate-800/30">
                        <td className="p-5">
                          <p className="font-bold text-emerald-400 text-sm">{sc.desc}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase mt-1">GC General Conditions</p>
                        </td>
                        <td className="p-5 text-right font-bold text-slate-400">{formatMoney(sc.scheduled)}</td>
                        <td className="p-5 text-right font-bold text-slate-500">{formatMoney(sc.previous)}</td>
                        <td className="p-5 text-right font-black text-white align-middle">
                          <div className="flex justify-end">
                            <input type="number" value={sc.verified === 0 ? '' : sc.verified} placeholder="0.00"
                                onChange={(e) => handleUpdateLine(sc.id, 'current_gross_billed', parseFloat(e.target.value) || 0)} 
                                className="w-28 bg-slate-950 border border-slate-700 py-2 px-3 rounded-lg font-black text-right outline-none focus:border-blue-500 transition-all" 
                            />
                          </div>
                        </td>
                        
                        <td className="p-5 text-right font-bold text-emerald-400 align-middle">
                          {sc.scheduled > 0 ? Math.round(((sc.previous + sc.verified) / sc.scheduled) * 100) : 0}%
                        </td>

                        <td className="p-5 border-l border-slate-800/50 align-middle">
                           <div className="flex items-center justify-end gap-1">
                              <input type="number" value={sc.rate * 100} placeholder="0"
                                onChange={(e) => handleUpdateLine(sc.id, 'holdback_rate', (parseFloat(e.target.value) || 0) / 100)} 
                                className="w-16 bg-slate-950 border border-slate-700 p-2 rounded-lg font-black text-center text-amber-500 outline-none focus:border-amber-500" 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                            <p className="text-[9px] text-amber-500/50 font-bold text-right mt-1">{formatMoney(sc.holdback)} HB</p>
                        </td>
                        <td className="p-5 text-right border-l border-slate-800/50 font-black text-blue-400">{formatMoney(sc.net)}</td>
                        <td className="p-5 align-middle">
                           <button onClick={() => handleDeleteSoftCost(sc.id)} className="text-slate-600 hover:text-red-500 transition-colors p-2">
                             <Trash2 size={16}/>
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-950 border-t-2 border-slate-800">
                      <td className="p-6 text-right text-xs font-black uppercase tracking-widest text-slate-500">Master Totals:</td>
                      <td className="p-6 text-right text-sm font-black text-slate-300">{formatMoney(projectTotals.scheduled)}</td>
                      <td className="p-6 text-right text-sm font-black text-slate-400">{formatMoney(projectTotals.previous)}</td>
                      <td className="p-6 text-right text-lg font-black text-white">{formatMoney(projectTotals.verified)}</td>
                      
                      <td className="p-6 text-right text-sm font-black text-emerald-400">
                        {projectTotals.scheduled > 0 ? Math.round(((projectTotals.previous + projectTotals.verified) / projectTotals.scheduled) * 100) : 0}%
                      </td>

                      <td className="p-6 text-right text-sm font-black text-amber-500 border-l border-slate-800/50">{formatMoney(projectTotals.holdback)}</td>
                      <td className="p-6 text-right text-lg font-black text-blue-400 border-l border-slate-800/50">{formatMoney(projectTotals.net)}</td>
                      <td></td>
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
                    <span className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-300 text-[10px] font-black uppercase tracking-widest">Rev. Contract: {formatMoney(reviewingTrade.totalScheduled)}</span>
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                      <ShieldCheck size={12}/> {reviewingTrade.percentComplete.toFixed(1)}% Complete
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <div className="flex gap-2 w-full">
                    
                    <div className="relative w-1/2 flex">
                      <input type="file" accept=".pdf,.jpg" onChange={(e) => handleUploadDocument(e, 'invoice')} ref={invoiceInputRef} className="hidden" />
                      {reviewingTrade.invoiceUrl ? (
                        <div className="flex w-full gap-1">
                          <a href={reviewingTrade.invoiceUrl} target="_blank" rel="noreferrer" className="w-3/4 flex items-center justify-center gap-1 text-[9px] font-black uppercase px-2 py-2 rounded-xl transition-colors border shadow-inner bg-blue-950/30 text-blue-400 border-blue-900/50 hover:bg-blue-900/50">
                            <ExternalLink size={14}/> View Invoice
                          </a>
                          <button onClick={() => invoiceInputRef.current?.click()} disabled={uploadingDoc === 'invoice'} className="w-1/4 flex items-center justify-center rounded-xl border bg-slate-800 text-slate-400 hover:text-white border-slate-700">
                            {uploadingDoc === 'invoice' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => invoiceInputRef.current?.click()} disabled={uploadingDoc === 'invoice'} className="w-full flex items-center justify-center gap-1 text-[9px] font-black uppercase px-3 py-2 rounded-xl transition-colors border shadow-inner bg-slate-800 text-slate-400 border-slate-700 hover:text-white">
                          {uploadingDoc === 'invoice' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>} 
                          {uploadingDoc === 'invoice' ? 'Uploading...' : 'Attach Invoice'}
                        </button>
                      )}
                    </div>

                    <div className="relative w-1/2 flex">
                      <input type="file" accept=".pdf,.xls,.xlsx" onChange={(e) => handleUploadDocument(e, 'sov')} ref={sovInputRef} className="hidden" />
                      {reviewingTrade.tradeSovUrl ? (
                        <div className="flex w-full gap-1">
                          <a href={reviewingTrade.tradeSovUrl} target="_blank" rel="noreferrer" className="w-3/4 flex items-center justify-center gap-1 text-[9px] font-black uppercase px-2 py-2 rounded-xl transition-colors border shadow-inner bg-indigo-950/30 text-indigo-400 border-indigo-900/50 hover:bg-indigo-900/50">
                            <ExternalLink size={14}/> View SOV
                          </a>
                          <button onClick={() => sovInputRef.current?.click()} disabled={uploadingDoc === 'sov'} className="w-1/4 flex items-center justify-center rounded-xl border bg-slate-800 text-slate-400 hover:text-white border-slate-700">
                            {uploadingDoc === 'sov' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => sovInputRef.current?.click()} disabled={uploadingDoc === 'sov'} className="w-full flex items-center justify-center gap-1 text-[9px] font-black uppercase px-3 py-2 rounded-xl transition-colors border shadow-inner bg-slate-800 text-slate-400 border-slate-700 hover:text-white">
                          {uploadingDoc === 'sov' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>} 
                          {uploadingDoc === 'sov' ? 'Uploading...' : 'Attach SOV'}
                        </button>
                      )}
                    </div>
                  </div>

                  <button onClick={handleSave} disabled={saving} className="bg-amber-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 flex items-center justify-center gap-2 shadow-lg w-full">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} Lock Assessment
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="p-6">SOV Description</th>
                      <th className="p-6 text-right border-l border-slate-800/50">Orig. Contract</th>
                      <th className="p-6 text-right text-emerald-400/70">Apprv. COs</th>
                      <th className="p-6 text-right text-white">Revised Budget</th>
                      
                      <th className="p-6 text-center bg-amber-950/10 border-l border-amber-900/30 text-amber-500">Sub Claim %</th>
                      <th className="p-6 pr-8 bg-amber-950/10 border-amber-900/30 text-amber-500 text-right">Sub Claim ($)</th>
                      
                      <th className="p-6 text-center bg-blue-950/10 border-l border-blue-900/30 text-blue-400">GC Verif %</th>
                      <th className="p-6 pl-8 bg-blue-950/10 border-blue-900/30 text-blue-400 text-right">Super Verified ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {reviewingTrade.lines.map((line: any) => {
                      const isOverbilled = line.verified > line.claimed;
                      const percentClaimed = line.scheduled > 0 ? Number(((line.claimed / line.scheduled) * 100).toFixed(1)) : 0;
                      const verifiedPercent = line.scheduled > 0 ? Number(((line.verified / line.scheduled) * 100).toFixed(1)) : 0;

                      return (
                        <tr key={line.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-6">
                            <p className="font-bold text-white text-sm">
                              {line.desc} 
                              {line.isCO && <span className="ml-2 text-[8px] bg-emerald-950/50 text-emerald-500 px-1 py-0.5 rounded border border-emerald-900/50 align-middle">CO</span>}
                            </p>
                          </td>
                          
                          <td className="p-6 text-right font-bold text-slate-400 border-l border-slate-800/50">{formatMoney(line.original)}</td>
                          
                          <td className="p-6 text-right font-black text-emerald-400">
                            {formatMoney(line.cos)}
                          </td>

                          <td className="p-6 text-right font-black text-white">{formatMoney(line.scheduled)}</td>
                          
                          <td className="p-4 bg-amber-950/10 border-l border-amber-900/30 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={percentClaimed === 0 ? '' : percentClaimed} placeholder="0"
                                onChange={(e) => handleUpdateLine(line.dbId, 'claimed_amount', Number(((parseFloat(e.target.value) || 0) / 100) * line.scheduled))} 
                                className="w-16 bg-slate-950 border border-slate-700 p-3 rounded-xl font-black text-center text-amber-500 outline-none focus:border-amber-500" 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                          </td>

                          <td className="p-4 pr-6 bg-amber-950/10 align-middle">
                            <div className="relative flex justify-end">
                              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-500/50 font-bold">$</span>
                              <input type="number" value={line.claimed === 0 ? '' : line.claimed} placeholder="0.00"
                                onChange={(e) => handleUpdateLine(line.dbId, 'claimed_amount', parseFloat(e.target.value) || 0)} 
                                className="w-36 bg-slate-950 border border-slate-700 py-2 pl-8 pr-3 rounded-lg font-black text-right text-amber-400 outline-none focus:border-amber-500" 
                              />
                            </div>
                          </td>
                          
                          <td className="p-4 bg-blue-950/10 border-l border-blue-900/30 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={verifiedPercent === 0 ? '' : verifiedPercent} placeholder="0"
                                onChange={(e) => handleUpdateLine(line.dbId, 'current_gross_billed', Number(((parseFloat(e.target.value) || 0) / 100) * line.scheduled))} 
                                className={`w-16 bg-slate-950 border p-3 rounded-xl font-black text-center outline-none ${isOverbilled ? 'border-red-900/50 text-red-400' : 'border-slate-700 text-blue-400 focus:border-blue-500'}`} 
                              />
                              <span className="text-slate-500 font-bold text-xs">%</span>
                            </div>
                          </td>

                          <td className="p-4 pl-6 bg-blue-950/10 align-middle">
                            <div className="relative flex justify-end">
                              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                              <input type="number" value={line.verified === 0 ? '' : line.verified} placeholder="0.00"
                                onChange={(e) => handleUpdateLine(line.dbId, 'current_gross_billed', parseFloat(e.target.value) || 0)} 
                                className={`w-36 bg-slate-950 border py-2 pl-8 pr-3 rounded-lg font-black text-right outline-none ${isOverbilled ? 'border-red-900/50 text-red-400 focus:border-red-500' : 'border-slate-700 text-white focus:border-blue-500'}`} 
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