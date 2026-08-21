'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../../page'
import { ChevronLeft, ChevronRight, FileStack, ShieldCheck, DollarSign, Download, Loader2, CheckCircle2, AlertCircle, UploadCloud, FileText, Save, Plus, Trash2, Wallet, Landmark } from 'lucide-react'

export default function BankPackageGenerator() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingExtra, setUploadingExtra] = useState(false) 
  
  const [allDraws, setAllDraws] = useState<any[]>([])
  const [activeDraw, setActiveDraw] = useState<any>(null)
  
  const [stats, setStats] = useState({ 
    currentClaimed: 0, 
    previousBilled: 0,
    totalCompleted: 0,
    hardCosts: 0,
    softCosts: 0,
    holdback: 0, 
    netPayment: 0, 
    backupCount: 0 
  })
  
  const [tradeBackupLinks, setTradeBackupLinks] = useState<string[]>([])
  const [softCostsData, setSoftCostsData] = useState<any[]>([])
  const [foundAttachmentsList, setFoundAttachmentsList] = useState<string[]>([]) 
  
  const [companyName, setCompanyName] = useState("")
  const [projectName, setProjectName] = useState("")
  const [lenderName, setLenderName] = useState("") 
  const [lenderAddress, setLenderAddress] = useState("") 
  
  const [statDecFile, setStatDecFile] = useState<File | null>(null)
  const statDecInputRef = useRef<HTMLInputElement>(null)

  const [extraDocs, setExtraDocs] = useState<any[]>([])
  const extraDocInputRef = useRef<HTMLInputElement>(null)

  const loadDrawData = async (targetDraw: any) => {
    setActiveDraw(targetDraw)
    
    const { data: extra } = await supabase.from('draw_attachments').select('*').eq('draw_id', targetDraw.id)
    setExtraDocs(extra || [])

    const { data: previousDraws } = await supabase
      .from('project_draws')
      .select('id')
      .eq('project_id', id)
      .lt('draw_number', targetDraw.draw_number)

    const prevDrawIds = previousDraws?.map(d => d.id) || []
    let prevBilledTotal = 0
    let prevDrawLines: any[] = []

    if (prevDrawIds.length > 0) {
      const { data: prevSummaries } = await supabase
        .from('draw_summaries')
        .select('gross_hard_costs, gross_soft_costs')
        .in('draw_id', prevDrawIds)
      
      prevBilledTotal = prevSummaries?.reduce((sum, s) => sum + Number(s.gross_hard_costs) + Number(s.gross_soft_costs), 0) || 0

      const { data: pLines } = await supabase.from('draw_line_items').select('*').in('draw_id', prevDrawIds)
      prevDrawLines = pLines || []
    }

    const { data: summary } = await supabase
      .from('draw_summaries')
      .select('*')
      .eq('draw_id', targetDraw.id)
      .single()

    if (summary) {
      const { data: lines } = await supabase
        .from('draw_line_items')
        .select(`
          *,
          sov_line_items( project_contracts( project_contacts( company ) ) )
        `)
        .eq('draw_id', summary.id)

      const currentDrawLines = lines || []
      const combinedBackups: string[] = []
      const foundNames: string[] = [] 
      
      currentDrawLines.forEach((l: any) => {
        if (!l.is_soft_cost && l.sov_code !== 'SOFT') {
           const contactInfo = l.sov_line_items?.project_contracts?.project_contacts
           const companyName = Array.isArray(contactInfo) ? contactInfo[0]?.company : contactInfo?.company || l.description

           if (l.invoice_link) {
             combinedBackups.push(l.invoice_link)
             foundNames.push(`${companyName} (Invoice)`)
           }
           if (l.trade_sov_link) {
             combinedBackups.push(l.trade_sov_link)
             foundNames.push(`${companyName} (SOV)`)
           }
        }
      })
      
      const allSoftLines = [...prevDrawLines, ...currentDrawLines].filter(l => l.is_soft_cost || l.sov_code === 'SOFT')
      const uniqueSoftMap = new Map()
      
      allSoftLines.forEach(l => {
         if (!uniqueSoftMap.has(l.description)) {
             uniqueSoftMap.set(l.description, {
                 desc: l.description,
                 scheduled: Number(l.original_budget || 0) + Number(l.approved_changes || 0),
                 previous: 0,
                 verified: 0,
                 holdback: 0
             })
         }
         const item = uniqueSoftMap.get(l.description)
         item.scheduled = Math.max(item.scheduled, Number(l.original_budget || 0) + Number(l.approved_changes || 0))
         
         const rate = Number(l.holdback_rate !== undefined ? l.holdback_rate : 0)
         const amt = Number(l.current_gross_billed || 0)

         if (l.draw_id === targetDraw.id) {
             item.verified = amt
             item.holdback += amt * rate
         } else {
             item.previous += amt
             item.holdback += amt * rate
         }
      })
      
      setFoundAttachmentsList(Array.from(new Set(foundNames)))
      setTradeBackupLinks(combinedBackups)
      setSoftCostsData(Array.from(uniqueSoftMap.values()))
      
      const currentGross = Number(summary.gross_hard_costs) + Number(summary.gross_soft_costs)

      setStats({ 
        currentClaimed: currentGross,
        previousBilled: prevBilledTotal,
        totalCompleted: prevBilledTotal + currentGross,
        hardCosts: Number(summary.gross_hard_costs),
        softCosts: Number(summary.gross_soft_costs),
        holdback: Number(summary.hard_cost_holdback) + Number(summary.soft_cost_holdback), 
        netPayment: Number(summary.net_lender_advance), 
        backupCount: combinedBackups.length 
      })
    } else {
      setStats({ currentClaimed: 0, previousBilled: 0, totalCompleted: 0, hardCosts: 0, softCosts: 0, holdback: 0, netPayment: 0, backupCount: 0 })
      setTradeBackupLinks([])
      setSoftCostsData([])
      setFoundAttachmentsList([])
    }
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: project } = await supabase.from('projects').select('title, owner_name, lender_name, lender_address').eq('id', id).single()
    if (project) {
      setProjectName(project.title || '')
      setCompanyName(project.owner_name || 'PRECISION BUILDERS LTD.')
      setLenderName(project.lender_name || '')
      setLenderAddress(project.lender_address || '')
    }

    const { data: draws } = await supabase.from('project_draws').select('*').eq('project_id', id).order('draw_number', { ascending: true })
    if (!draws || draws.length === 0) { setLoading(false); return; }
    
    setAllDraws(draws)
    await loadDrawData(draws[draws.length - 1]) 
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const currentIndex = allDraws.findIndex(d => d.id === activeDraw?.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allDraws.length - 1

  const goPrev = () => { if (hasPrev) loadDrawData(allDraws[currentIndex - 1]) }
  const goNext = () => { if (hasNext) loadDrawData(allDraws[currentIndex + 1]) }

  const handleUpdatePeriod = async () => {
    if (!activeDraw) return;
    await supabase.from('project_draws').update({ period: activeDraw.period }).eq('id', activeDraw.id);
    setAllDraws(prev => prev.map(d => d.id === activeDraw.id ? { ...d, period: activeDraw.period } : d));
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    const { error } = await supabase.from('projects').update({ 
      title: projectName, owner_name: companyName, lender_name: lenderName, lender_address: lenderAddress
    }).eq('id', id)
    if (error) alert("Failed to save settings: " + error.message)
    setSavingSettings(false)
  }

  const handleUploadExtra = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeDraw) return
    setUploadingExtra(true) 
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `extra_${activeDraw.id}_${Date.now()}.${fileExt}`
      const filePath = `${id}/${fileName}`
      const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, file)
      if (uploadError) throw new Error("Storage Error")
      const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)
      await supabase.from('draw_attachments').insert([{ draw_id: activeDraw.id, file_name: file.name, file_link: publicUrl }])
      
      const { data: extra } = await supabase.from('draw_attachments').select('*').eq('draw_id', activeDraw.id)
      setExtraDocs(extra || [])
    } catch (err: any) { alert(err.message) } 
    finally { setUploadingExtra(false); if (extraDocInputRef.current) extraDocInputRef.current.value = '' }
  }

  const handleDeleteExtra = async (docId: string) => {
    await supabase.from('draw_attachments').delete().eq('id', docId)
    const { data: extra } = await supabase.from('draw_attachments').select('*').eq('draw_id', activeDraw?.id)
    setExtraDocs(extra || [])
  }

  const handleDownload = async () => {
    setGenerating(true)
    try {
      let finalStatDecLink = activeDraw.stat_dec_link;

      if (statDecFile) {
        const fileExt = statDecFile.name.split('.').pop()
        const fileName = `statdec_draw${activeDraw.draw_number}_${Date.now()}.${fileExt}`
        const filePath = `${id}/${fileName}`
        const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, statDecFile)
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)
          finalStatDecLink = publicUrl
          await supabase.from('project_draws').update({ stat_dec_link: publicUrl }).eq('id', activeDraw.id)
          setActiveDraw({...activeDraw, stat_dec_link: publicUrl})
        }
      }

      const payload = { 
        projectId: id, 
        drawNumber: activeDraw.draw_number, 
        companyName, projectName, lenderName, lenderAddress,     
        drawData: { 
          period: activeDraw.period, 
          totalCompleted: stats.totalCompleted, 
          current: stats.currentClaimed, 
          previous: stats.previousBilled, 
          holdback: stats.holdback, 
          net: stats.netPayment,
          softCostList: softCostsData 
        },
        attachments: {
          statDec: finalStatDecLink || null,
          invoices: tradeBackupLinks, 
          extraDocs: extraDocs.map(doc => doc.file_link || doc.url).filter(Boolean)
        }
      }

      const response = await fetch('/api/export-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(`API failed: ${response.status}`)
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safeProjectName = projectName ? projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'project'
      a.download = `GC_Draw_Package_${safeProjectName}_#${activeDraw.draw_number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) { alert(`Failed to generate PDF. Error: ${err.message}`) }
    setGenerating(false)
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100 pb-32">
      
      <FinancialHeader id={id as string} active="bank" />
      
      <div className="flex flex-col items-center justify-center text-center mb-12 mt-8">
        <div className="w-24 h-24 bg-blue-900/30 border-4 border-blue-600 rounded-[32px] flex items-center justify-center text-blue-500 mb-6 shadow-2xl shadow-blue-900/40">
          <FileStack size={48} />
        </div>
        <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-6">GC Draw <span className="text-blue-500">Package</span></h1>
        
        <div className="flex items-center justify-center gap-6 bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-xl min-w-[300px]">
          <button onClick={goPrev} disabled={!hasPrev} className={`p-2 rounded-xl transition-all ${hasPrev ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700 cursor-not-allowed'}`}><ChevronLeft size={20} /></button>
          
          <div className="text-center min-w-[140px]">
            <p className="text-lg font-black text-blue-400 uppercase tracking-tighter leading-none mb-1">Draw #{activeDraw?.draw_number}</p>
            <input 
              value={activeDraw?.period || ''} 
              onChange={(e) => setActiveDraw({...activeDraw, period: e.target.value})}
              onBlur={handleUpdatePeriod}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdatePeriod()}
              placeholder="e.g. March 2026"
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-transparent border-b border-dashed border-slate-700 hover:border-slate-500 focus:border-blue-500 focus:text-white text-center outline-none w-full transition-colors pb-0.5"
            />
          </div>

          <button onClick={goNext} disabled={!hasNext} className={`p-2 rounded-xl transition-all ${hasNext ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-950 text-slate-700 cursor-not-allowed'}`}><ChevronRight size={20} /></button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 mb-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Cover Sheet Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Billed To (Owner / Holdco)</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Project Name</label>
                <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. 123 Main St Build" className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">QS / Lender Name</label>
                <input type="text" value={lenderName} onChange={e => setLenderName(e.target.value)} placeholder="e.g. First National Bank" className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">QS / Lender Address</label>
                <input type="text" value={lenderAddress} onChange={e => setLenderAddress(e.target.value)} placeholder="e.g. 100 Bay St, Toronto" className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={savingSettings} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all w-full md:w-auto self-start shadow-lg border border-slate-700">
            {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14}/>} Save Settings
          </button>
        </div>

        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-8 lg:pt-0 lg:pl-8">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Statutory Declaration</h3>
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl h-[160px] flex flex-col items-center justify-center text-center border-dashed relative hover:border-slate-600 transition-colors">
            <input type="file" accept=".pdf,.jpg,.png" onChange={e => setStatDecFile(e.target.files?.[0] || null)} ref={statDecInputRef} className="hidden" />
            {statDecFile || activeDraw?.stat_dec_link ? (
              <div className="flex flex-col items-center text-emerald-500">
                <FileText size={32} className="mb-3" />
                <p className="text-xs font-bold truncate max-w-[180px]">{statDecFile ? statDecFile.name : 'Stat Dec Attached'}</p>
                <button onClick={() => statDecInputRef.current?.click()} className="text-[9px] uppercase tracking-widest text-slate-500 hover:text-white mt-2 bg-slate-900 px-3 py-1 rounded">Replace File</button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-500 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => statDecInputRef.current?.click()}>
                <UploadCloud size={32} className="mb-3" />
                <p className="text-xs font-bold uppercase tracking-widest">Upload CCDC-9A</p>
                <p className="text-[9px] text-slate-600 mt-2">PDF, JPG, or PNG</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 mb-10">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Project Support Documents</h3>
          <button onClick={() => extraDocInputRef.current?.click()} disabled={uploadingExtra} className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase flex items-center gap-2 transition-colors disabled:opacity-50 bg-blue-950/30 px-3 py-1.5 rounded-lg">
            {uploadingExtra ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14}/>} Add Document
          </button>
        </div>
        <input type="file" accept=".pdf,.jpg,.png" ref={extraDocInputRef} onChange={handleUploadExtra} className="hidden" />
        
        {extraDocs.length === 0 ? (
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center py-8">No extra documents attached to this draw.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extraDocs.map(doc => (
              <div key={doc.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-blue-500" />
                  <p className="text-xs font-bold text-white truncate max-w-[250px]">{doc.file_name}</p>
                </div>
                <button onClick={() => handleDeleteExtra(doc.id)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] flex flex-col justify-center text-center sm:text-left">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><Wallet size={12} className="inline mr-1"/> Prev. Billed</p>
          <p className="text-xl lg:text-2xl font-black text-slate-400">{formatMoney(stats.previousBilled)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] text-center sm:text-left">
          <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2"><DollarSign size={12} className="inline mr-1"/> Current Claim</p>
          <p className="text-2xl lg:text-3xl font-black text-white">{formatMoney(stats.currentClaimed)}</p>
          <div className="flex gap-4 mt-2 justify-center sm:justify-start">
            <p className="text-[9px] font-bold text-slate-500">Hard: <span className="text-slate-300">{formatMoney(stats.hardCosts)}</span></p>
            <p className="text-[9px] font-bold text-slate-500">GC: <span className="text-emerald-400">{formatMoney(stats.softCosts)}</span></p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] flex flex-col justify-center text-center sm:text-left">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1"><ShieldCheck size={12} className="inline mr-1"/> Holdback</p>
          <p className="text-xl lg:text-2xl font-black text-amber-500">-{formatMoney(stats.holdback)}</p>
        </div>
        <div className="bg-blue-950/20 border border-blue-900/50 p-6 rounded-[32px] flex flex-col justify-center relative overflow-hidden shadow-lg shadow-blue-900/20 text-center sm:text-left">
          <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Progress Payment</p>
          <p className="text-2xl lg:text-3xl font-black text-white relative z-10">{formatMoney(stats.netPayment)}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 mb-10">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Package Contents Verification</h3>
        <ul className="space-y-4">
          <li className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <span className="font-bold text-white text-sm">G702 Cover Sheet & Summary</span>
          </li>
          <li className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <span className="font-bold text-white text-sm">G703 Master Schedule of Values</span>
          </li>
          <li className="flex items-center gap-3">
            {statDecFile || activeDraw?.stat_dec_link ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-amber-500" />}
            <span className={`font-bold text-sm ${statDecFile || activeDraw?.stat_dec_link ? 'text-white' : 'text-amber-500'}`}>CCDC-9A Statutory Declaration</span>
          </li>
          <li className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {stats.backupCount > 0 ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-amber-500" />}
              <span className="font-bold text-white text-sm">{stats.backupCount} Trade Backups Stitched</span>
            </div>
            {foundAttachmentsList.length > 0 && (
              <div className="ml-8 mt-2 flex flex-wrap gap-2">
                {foundAttachmentsList.map((name, i) => (
                  <span key={i} className="bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </li>
          <li className="flex items-center gap-3">
            {extraDocs.length > 0 ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-slate-600" />}
            <span className={`font-bold text-sm ${extraDocs.length > 0 ? 'text-white' : 'text-slate-500'}`}>{extraDocs.length} Support Document(s) Stitched</span>
          </li>
        </ul>
      </div>

      <button 
        onClick={handleDownload}
        disabled={generating || uploadingExtra || !activeDraw}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-6 rounded-3xl text-sm flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-900/50 disabled:opacity-50"
      >
        {generating ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
        {generating ? 'Stitching Draw Package...' : 'Generate & Download GC Draw PDF'}
      </button>
    </div>
  )
}