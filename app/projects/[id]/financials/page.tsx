'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  ChevronLeft, Plus, X, ShieldCheck, Wallet, 
  FileStack, ArrowRight, Trash2, Check, Lock, 
  Loader2, ChevronDown, ChevronRight, Users, Printer, FileSpreadsheet,
  Copy, Save
} from 'lucide-react'

export default function FinancialMaster() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [costCodes, setCostCodes] = useState<any[]>([])
  const [project, setProject] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null) 
  
  // Hierarchy States
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: string } | null>(null)
  const [isAdding, setIsAdding] = useState<{ show: boolean, parentId: string | null }>({ show: false, parentId: null })
  const [newRow, setNewRow] = useState({ code: '', name: '', budget: '' })

  // WBS Import States
  const [availableProjects, setAvailableProjects] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    
    const [pRes, codesRes, contractsRes, settingsRes, allProjRes] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code'),
      supabase.from('project_contracts').select('id, status, cost_code_id, project_contacts!project_contracts_contact_id_fkey(company)').eq('project_id', id),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('projects').select('id, name').neq('id', id)
    ])
    
    setProject(pRes.data)
    if (settingsRes.data) setSettings(settingsRes.data)
    if (allProjRes.data) setAvailableProjects(allProjRes.data)
    
    const codes = codesRes.data
    const contracts = contractsRes.data

    const activeIds = contracts?.filter(c => c.status === 'Active' || c.status === 'Completed').map(c => c.id) || []
    
    const { data: sovLines } = await supabase
      .from('sov_line_items')
      .select('*, change_orders(status)')
      .in('contract_id', activeIds.length ? activeIds : ['00000000-0000-0000-0000-000000000000'])

    const aggregated = codes?.map(code => {
      let contract_committed = 0, changes = 0, trades = new Set<string>()
      const matchingContracts = contracts?.filter(c => c.cost_code_id === code.id) || []
      
      matchingContracts.forEach(c => {
         const contactInfo: any = Array.isArray(c?.project_contacts) ? c?.project_contacts[0] : c?.project_contacts
         if (contactInfo?.company) trades.add(contactInfo.company)

         if (c.status === 'Active' || c.status === 'Completed') {
            const linesForContract = sovLines?.filter(l => l.contract_id === c.id) || []
            linesForContract.forEach(line => {
               const isBaseLine = !line.change_order_id;
               const isApprovedCO = line.change_order_id && line.change_orders?.status === 'Approved';
               if (isBaseLine || isApprovedCO) contract_committed += Number(line.scheduled_value || 0)
               if (isApprovedCO) changes += Number(line.scheduled_value || 0)
            })
         }
      })
      
      const manual_commitment = Number(code.manual_commitment || 0)
      
      return { 
        ...code, 
        original: Number(code.original_budget || 0), 
        changes, 
        manual_commitment,
        contract_committed,
        committed: manual_commitment + contract_committed, 
        trade: Array.from(trades).join(', ') || '-' 
      }
    }) || []
    
    setCostCodes(aggregated)
    if (!silent) setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const toggleRow = (rowId: string) => {
    const next = new Set(expandedRows)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    setExpandedRows(next)
  }

  const handleSaveCell = async (rowId: string) => {
    if (!editingCell) return
    const updateData = (editingCell.field === 'original_budget' || editingCell.field === 'manual_commitment')
      ? { [editingCell.field]: parseFloat(editingCell.value) || 0 } 
      : { [editingCell.field]: editingCell.value }
      
    await supabase.from('project_cost_codes').update(updateData).eq('id', rowId)
    setEditingCell(null)
    fetchData(true) 
  }

  const handleSaveNew = async () => {
    if (!newRow.code || !newRow.name) return alert("Code and Name are required.")
    const payload = { 
      project_id: id, 
      code: newRow.code, 
      name: newRow.name, 
      original_budget: parseFloat(newRow.budget) || 0,
      parent_id: isAdding.parentId 
    }
    await supabase.from('project_cost_codes').insert([payload])
    setNewRow({ code: '', name: '', budget: '' })
    setIsAdding({ show: false, parentId: null })
    fetchData()
  }

  const handleDelete = async (rowId: string) => {
    const { error } = await supabase.from('project_cost_codes').delete().eq('id', rowId)
    if (error) alert("Line is locked to an active contract. You cannot delete it."); else fetchData()
  }

  const handleImportWBS = async (sourceProjectId: string) => {
    setImporting(true)
    try {
      const { data: sourceCodes } = await supabase.from('project_cost_codes').select('*').eq('project_id', sourceProjectId)
      if (!sourceCodes || sourceCodes.length === 0) {
        alert('No cost codes found in the selected project.')
        setImporting(false)
        return
      }

      const parents = sourceCodes.filter(c => !c.parent_id)
      const children = sourceCodes.filter(c => c.parent_id)

      const parentPayload = parents.map(p => ({
        project_id: id,
        code: p.code,
        name: p.name,
        original_budget: 0,
        manual_commitment: 0
      }))

      const { data: insertedParents, error: pErr } = await supabase.from('project_cost_codes').insert(parentPayload).select()
      if (pErr) throw pErr

      const parentMap: Record<string, string> = {}
      parents.forEach(oldP => {
        const newP = insertedParents.find(np => np.code === oldP.code && np.name === oldP.name)
        if (newP) parentMap[oldP.id] = newP.id
      })

      if (children.length > 0) {
        const childPayload = children.map(c => ({
          project_id: id,
          parent_id: parentMap[c.parent_id],
          code: c.code,
          name: c.name,
          original_budget: 0,
          manual_commitment: 0
        }))
        await supabase.from('project_cost_codes').insert(childPayload)
      }

      setShowImportModal(false)
      fetchData()
    } catch(err:any) {
      alert('Error importing WBS: ' + err.message)
    }
    setImporting(false)
  }

  const organizedData = useMemo(() => {
    const parents = costCodes.filter(c => !c.parent_id)
    const children = costCodes.filter(c => c.parent_id)

    const final: any[] = []
    parents.forEach(p => {
      const myChildren = children.filter(c => c.parent_id === p.id)
      
      const display_original = p.original + myChildren.reduce((sum, child) => sum + child.original, 0)
      const display_committed = p.committed + myChildren.reduce((sum, child) => sum + child.committed, 0)
      const display_changes = p.changes + myChildren.reduce((sum, child) => sum + child.changes, 0)
      
      const has_contracts = p.contract_committed > 0 || myChildren.some(child => child.contract_committed > 0)

      const total = display_committed 
      const revised = display_original + display_changes 
      const variance = revised - total

      final.push({ 
        ...p, 
        depth: 0, 
        display_original, 
        display_committed, 
        display_changes,
        has_contracts,
        revised, 
        total, 
        variance, 
        isOverBudget: variance < 0 
      })

      if (expandedRows.has(p.id) || (typeof window !== 'undefined' && window.matchMedia('print').matches)) {
        myChildren.forEach(child => {
          const cTotal = child.committed 
          const cRevised = child.original + child.changes 
          const cVariance = cRevised - cTotal
          final.push({ 
            ...child, 
            depth: 1, 
            display_original: child.original, 
            display_committed: child.committed, 
            display_changes: child.changes,
            has_contracts: child.contract_committed > 0,
            revised: cRevised, 
            total: cTotal, 
            variance: cVariance, 
            isOverBudget: cVariance < 0 
          })
        })
      }
    })
    return final
  }, [costCodes, expandedRows])

  const totals = useMemo(() => costCodes.reduce((acc, row) => ({
    original: acc.original + Number(row.original_budget || 0),
    committed: acc.committed + Number(row.committed || 0),
    changes: acc.changes + Number(row.changes || 0),
    total: acc.total + Number(row.committed || 0),
    variance: acc.variance + (Number(row.original_budget || 0) + Number(row.changes || 0) - Number(row.committed || 0))
  }), { original: 0, committed: 0, changes: 0, total: 0, variance: 0 }), [costCodes])

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  const handleExportExcel = () => {
    const excelData = organizedData.map(row => ({
      'Type': row.depth === 0 ? 'Category' : 'Sub-Item',
      'Cost Code': row.code,
      'Description': row.name,
      'Contractor': row.trade || '',
      'Base Budget': row.display_original,
      'Committed Costs': row.display_committed,
      'Approved COs': row.display_changes,
      'Revised Total': row.total,
      'Variance': row.variance
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Project Ledger")
    const colWidths = [ { wch: 10 }, { wch: 15 }, { wch: 40 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ]
    worksheet['!cols'] = colWidths
    XLSX.writeFile(workbook, `${project?.name || 'Project'}_Financial_Ledger.xlsx`)
  }

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
    doc.text(`Master Financial Ledger`, 14, 30)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text(`Project: ${project?.name || 'Unassigned'}`, 14, 38)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44)

    const parents = costCodes.filter(c => !c.parent_id)
    const children = costCodes.filter(c => c.parent_id)
    const fullData: any[] = []
    
    parents.forEach(p => {
      const myChildren = children.filter(c => c.parent_id === p.id)
      const display_original = p.original + myChildren.reduce((sum, child) => sum + child.original, 0)
      const display_committed = p.committed + myChildren.reduce((sum, child) => sum + child.committed, 0)
      const display_changes = p.changes + myChildren.reduce((sum, child) => sum + child.changes, 0)
      const total = display_committed 
      const revised = display_original + display_changes 
      const variance = revised - total
      
      fullData.push({ ...p, depth: 0, display_original, display_committed, display_changes, revised, total, variance })
      
      myChildren.forEach(child => {
        const cTotal = child.committed 
        const cRevised = child.original + child.changes 
        const cVariance = cRevised - cTotal
        fullData.push({ ...child, depth: 1, display_original: child.original, display_committed: child.committed, display_changes: child.changes, revised: cRevised, total: cTotal, variance: cVariance })
      })
    })

    const tableData = fullData.map(row => [
      row.code,
      row.depth > 0 ? `   ${row.name}` : row.name,
      row.trade || '-',
      formatMoney(row.display_original),
      formatMoney(row.display_committed),
      row.display_changes > 0 ? `+${formatMoney(row.display_changes)}` : '-',
      formatMoney(row.total),
      formatMoney(Math.abs(row.variance))
    ])

    const footerData = [['TOTALS', '', '', formatMoney(totals.original), formatMoney(totals.committed), formatMoney(totals.changes), formatMoney(totals.total), formatMoney(Math.abs(totals.variance))]]

    autoTable(doc, {
      startY: 55,
      head: [['Cost Code', 'Description', 'Contractor', 'Base Budget', 'Committed', 'COs', 'Revised Total', 'Variance']],
      body: tableData,
      foot: footerData,
      theme: 'grid',
      headStyles: { fillColor: brandRgb, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' }, 
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      columnStyles: {
        3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', textColor: [217, 119, 6] }, 6: { halign: 'right', textColor: brandRgb, fontStyle: 'bold' }, 7: { halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const isParent = fullData[data.row.index]?.depth === 0;
          if (isParent) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [15, 23, 42]; } 
          else { data.cell.styles.textColor = [100, 116, 139]; }
          if (data.column.index === 7) {
             const variance = fullData[data.row.index]?.variance;
             data.cell.styles.textColor = variance < 0 ? [239, 68, 68] : [16, 185, 129]; 
          }
        }
      }
    })
    doc.save(`${project?.name || 'Project'}_Master_Ledger.pdf`)
  }

  useEffect(() => {
    const handleBeforePrint = () => {
      const allParentIds = costCodes.filter(c => !c.parent_id).map(c => c.id)
      setExpandedRows(new Set(allParentIds))
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    return () => window.removeEventListener('beforeprint', handleBeforePrint)
  }, [costCodes])

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-emerald-500" size={40} /><p className="text-emerald-500 font-black uppercase tracking-widest text-xs">Structuring Budget...</p></div>

  return (
    <div className="w-full bg-slate-950 print:bg-white min-h-screen p-6 md:p-12 text-slate-100 print:text-black print:p-0">
      
      {/* --- IMPORT MODAL --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Import WBS</h3>
                 <button onClick={() => setShowImportModal(false)} className="bg-slate-950 p-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
              </div>
              <p className="text-xs font-bold text-slate-400 mb-6">Select a past project to clone its Cost Code structure. Budgets and commitments will be reset to $0.</p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                 {availableProjects.map(proj => (
                    <button key={proj.id} onClick={() => handleImportWBS(proj.id)} disabled={importing} className="w-full text-left p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 transition-colors group flex justify-between items-center">
                       <span className="text-sm font-bold text-slate-300 group-hover:text-white uppercase">{proj.name}</span>
                       {importing ? <Loader2 size={16} className="animate-spin text-emerald-500"/> : <Copy size={16} className="text-slate-600 group-hover:text-emerald-500"/>}
                    </button>
                 ))}
                 {availableProjects.length === 0 && <p className="text-xs font-bold text-slate-500 text-center py-4">No other projects found.</p>}
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.5in; size: landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          ::-webkit-scrollbar { display: none; }
        }
      `}} />

      <div className="hidden print:flex justify-between items-end border-b-4 pb-6 mb-8" style={{ borderBottomColor: settings?.primary_color || '#0f172a' }}>
        <div className="flex items-center gap-6">
          {settings?.logo_url && <img src={settings.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />}
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter" style={{ color: settings?.primary_color || '#0f172a' }}>{settings?.company_name || 'YOUR COMPANY'}</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Project Financial Ledger</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black uppercase text-slate-900">{project?.name || 'Project Name'}</p>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <FinancialHeader id={id} active="master" onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
      
      <div className="space-y-8 w-full print:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter print:text-black">WBS <span className="text-emerald-500 print:text-emerald-600">Ledger</span></h2>
          <div className="flex gap-3">
            <button onClick={() => setShowImportModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-2 transition-all shadow-lg">
              <Copy size={14}/> Import WBS
            </button>
            <button onClick={() => setIsAdding({ show: true, parentId: null })} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg">
              <Plus size={14}/> New Category
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:gap-4">
          <StatCard label="Base Budget" value={totals.original} color="text-slate-400 print:text-slate-800" />
          <StatCard label="Committed" value={totals.committed} color="text-slate-300 print:text-slate-900" />
          <StatCard label="Approved Changes" value={totals.changes} color="text-amber-500 print:text-amber-600" />
          <StatCard label="Budget Variance" value={Math.abs(totals.variance)} color={totals.variance < 0 ? "text-red-500 print:text-red-600" : "text-emerald-500 print:text-emerald-600"} isOver={totals.variance < 0} />
        </div>

        <div className="bg-slate-900 print:bg-white rounded-[40px] print:rounded-2xl border border-slate-800 print:border-slate-300 shadow-2xl print:shadow-none overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[1100px] print:min-w-full">
              <thead>
                <tr className="bg-slate-950 print:bg-slate-100 text-[10px] font-black uppercase text-slate-500 print:text-slate-700 border-b border-slate-800 print:border-slate-300">
                  <th className="p-6 print:p-4 w-48">Cost Code</th>
                  <th className="p-6 print:p-4">Description</th>
                  <th className="p-6 print:p-4">Contractor</th>
                  <th className="p-6 print:p-4 text-right">Base Budget</th>
                  <th className="p-6 print:p-4 text-right border-l border-slate-800/50 print:border-slate-300">Committed</th>
                  <th className="p-6 print:p-4 text-right text-amber-500/50 print:text-slate-700 border-l border-slate-800/50 print:border-slate-300">COs</th>
                  <th className="p-6 print:p-4 text-right bg-blue-950/10 print:bg-slate-50 text-blue-500/70 print:text-slate-800 border-l border-blue-900/30 print:border-slate-300">Revised Total</th>
                  <th className="p-6 print:p-4 text-right border-l border-slate-800/50 print:border-slate-300">Variance</th>
                  <th className="p-6 w-24 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-slate-200 font-bold">
                
                {isAdding.show && (
                  <tr className="bg-emerald-950/20 border-b border-emerald-900/50 print:hidden">
                    <td className="p-4">
                      <input autoFocus placeholder="Code" className="w-full bg-slate-950 border border-emerald-500 p-3 rounded-xl text-white font-black outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-xs" value={newRow.code} onChange={e => setNewRow({...newRow, code: e.target.value})} />
                    </td>
                    <td className="p-4">
                      <input placeholder="Description" className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-white font-bold outline-none focus:border-emerald-500 transition-all text-xs" value={newRow.name} onChange={e => setNewRow({...newRow, name: e.target.value})} />
                    </td>
                    <td className="p-4" colSpan={2}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-black">$</span>
                        <input type="number" placeholder="Budget" className="w-full bg-slate-950 border border-slate-700 py-3 pl-8 pr-3 rounded-xl text-white font-black outline-none focus:border-emerald-500 transition-all text-xs" value={newRow.budget} onChange={e => setNewRow({...newRow, budget: e.target.value})} />
                      </div>
                    </td>
                    <td colSpan={5} className="p-4">
                      <div className="flex justify-end gap-3 items-center h-full">
                        <button onClick={() => setIsAdding({show: false, parentId: null})} className="text-slate-500 hover:text-white text-[10px] uppercase font-black tracking-widest px-4 transition-colors">Cancel</button>
                        <button onClick={handleSaveNew} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"><Save size={14}/> Save Item</button>
                      </div>
                    </td>
                  </tr>
                )}

                {organizedData.map(row => {
                  const hasChildren = costCodes.some(c => c.parent_id === row.id)
                  const isExpanded = expandedRows.has(row.id)
                  
                  return (
                    <tr key={row.id} className={`transition-colors group ${row.depth > 0 ? 'bg-slate-950/30 print:bg-white' : 'hover:bg-slate-800/20 print:bg-slate-50/50'}`}>
                      <td className="p-6 print:p-4">
                        <div className="flex items-center gap-3">
                          {row.depth === 0 && (
                            <button onClick={() => toggleRow(row.id)} className={`print:hidden text-slate-500 hover:text-white transition-colors ${!hasChildren && 'opacity-30 pointer-events-none'}`}>
                              {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </button>
                          )}
                          <div className={`${row.depth > 0 ? 'ml-6 print:ml-4' : ''}`}>
                            {editingCell?.id === row.id && editingCell?.field === 'code' ? (
                              <input autoFocus className="bg-slate-950 border border-blue-500 p-1.5 rounded text-blue-400 text-xs font-black outline-none w-24 print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                            ) : (
                              <span className={`cursor-pointer text-xs uppercase ${row.depth === 0 ? 'text-blue-400 print:text-slate-900 font-black' : 'text-blue-400 print:text-slate-600'}`} onClick={() => setEditingCell({ id: row.id, field: 'code', value: row.code })}>{row.code}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6 print:p-4">
                        {editingCell?.id === row.id && editingCell?.field === 'name' ? (
                          <input autoFocus className="bg-slate-950 border border-slate-500 p-1.5 rounded text-white text-xs outline-none w-full print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className={`cursor-pointer uppercase text-xs ${row.depth === 0 ? 'text-white font-black print:text-black' : 'text-slate-400 print:text-slate-700'}`} onClick={() => setEditingCell({ id: row.id, field: 'name', value: row.name })}>{row.name}</span>
                        )}
                      </td>
                      <td className="p-6 print:p-4 text-slate-500 print:text-slate-600 text-[10px] uppercase truncate max-w-[120px]">{row.trade}</td>
                      
                      <td className="p-6 print:p-4 text-right">
                        {row.display_committed > 0 && row.display_original === 0 ? (
                           <div className="flex items-center justify-end gap-2 text-slate-500 print:text-slate-800 text-xs font-bold"><Lock size={10} className="text-emerald-500 print:hidden" /> {formatMoney(row.display_original)}</div>
                        ) : editingCell?.id === row.id && editingCell?.field === 'original_budget' ? (
                          <input type="number" autoFocus className="bg-slate-950 border border-emerald-500 p-1.5 rounded text-right text-emerald-400 text-xs outline-none w-24 print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className="cursor-pointer text-slate-400 print:text-slate-800 text-xs hover:text-white transition-colors" onClick={() => setEditingCell({ id: row.id, field: 'original_budget', value: row.original.toString() })}>{formatMoney(row.display_original)}</span>
                        )}
                      </td>
                      
                      <td className="p-6 print:p-4 text-right border-l border-slate-800/50 print:border-slate-300">
                        {editingCell?.id === row.id && editingCell?.field === 'manual_commitment' ? (
                          <input type="number" autoFocus placeholder="Direct Cost" className="bg-slate-950 border border-blue-500 p-1.5 rounded text-right text-slate-300 text-xs font-bold outline-none w-24 print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <div className="flex flex-col items-end cursor-pointer group" onClick={() => setEditingCell({ id: row.id, field: 'manual_commitment', value: row.manual_commitment?.toString() || '0' })}>
                            <span className="text-slate-300 print:text-slate-900 text-xs font-bold group-hover:text-blue-400 transition-colors">{formatMoney(row.display_committed)}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-6 print:p-4 text-right text-xs text-amber-500 print:text-amber-700 border-l border-slate-800/50 print:border-slate-300">{row.display_changes > 0 ? `+${formatMoney(row.display_changes)}` : '-'}</td>
                      <td className="p-6 print:p-4 text-right text-xs bg-blue-950/10 print:bg-slate-50 text-blue-400 print:text-slate-900 border-l border-blue-900/30 print:border-slate-300 font-black">{formatMoney(row.total)}</td>
                      <td className={`p-6 print:p-4 text-right text-xs font-black border-l border-slate-800/50 print:border-slate-300 ${row.isOverBudget ? 'text-red-500 print:text-red-700' : 'text-emerald-500 print:text-emerald-700'}`}>{formatMoney(Math.abs(row.variance))}</td>
                      
                      <td className="p-6 text-right w-24 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        {row.depth === 0 && <button onClick={() => setIsAdding({ show: true, parentId: row.id })} className="text-blue-500 hover:text-blue-400 mr-4" title="Add Sub-item"><Plus size={16} /></button>}
                        <button onClick={() => handleDelete(row.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FinancialHeader({ id, active, onExportExcel, onExportPDF }: { id: any, active: string, onExportExcel?: () => void, onExportPDF?: () => void }) {
  const router = useRouter()
  return (
    <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 print:hidden">
      <div>
        <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Project <span className="text-emerald-500">Financials</span></h1>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-xl">
          <button onClick={() => router.push(`/projects/${id}/financials`)} className={`whitespace-nowrap px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'master' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Master Budget</button>
          <button onClick={() => router.push(`/projects/${id}/financials/contracts`)} className={`whitespace-nowrap px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'sov' || active === 'contracts' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Contracts & SOVs</button>
          <button onClick={() => router.push(`/projects/${id}/financials/change-orders`)} className={`whitespace-nowrap px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'cos' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Change Orders</button>
          <button onClick={() => router.push(`/projects/${id}/financials/draws`)} className={`whitespace-nowrap px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'draws' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Monthly Draws</button>
          <button onClick={() => router.push(`/projects/${id}/financials/reports/draw-package`)} className={`whitespace-nowrap px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'bank' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Bank Draw</button>
        </div>
        
        <div className="flex gap-2">
          {onExportExcel && (
            <button onClick={onExportExcel} className="bg-slate-800 text-slate-300 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 border border-slate-700">
              <FileSpreadsheet size={16}/> Excel
            </button>
          )}
          <button onClick={() => onExportPDF ? onExportPDF() : window.print()} className="bg-slate-800 text-slate-300 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 border border-slate-700">
            <Printer size={16}/> PDF
          </button>
        </div>

        <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block"></div>

        <button onClick={() => router.push(`/projects/${id}/trades`)} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 shadow-xl border-t border-white/50">
          <Users size={16}/> Site Directory
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, isOver }: any) {
  return (
    <div className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 print:border p-6 print:p-4 rounded-[28px] print:rounded-xl shadow-xl print:shadow-none">
      <p className="text-[9px] font-black text-slate-500 print:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>${value.toLocaleString()}</p>
      {isOver !== undefined && <p className="text-[8px] font-black uppercase text-slate-600 print:text-slate-400 mt-1">{isOver ? 'Over Budget' : 'Under Budget'}</p>}
    </div>
  )
}