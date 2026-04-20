'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, X, ShieldCheck, Wallet, 
  FileStack, ArrowRight, Trash2, Check, Lock, 
  Loader2, ChevronDown, ChevronRight, Users, Printer
} from 'lucide-react'

export default function FinancialMaster() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [costCodes, setCostCodes] = useState<any[]>([])
  
  // Hierarchy States
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: string } | null>(null)
  const [isAdding, setIsAdding] = useState<{ show: boolean, parentId: string | null }>({ show: false, parentId: null })
  const [newRow, setNewRow] = useState({ code: '', name: '', budget: '' })

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    
    let { data: codes } = await supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code')
    
    const { data: contracts } = await supabase
      .from('project_contracts')
      .select('id, status, cost_code_id, project_contacts!project_contracts_contact_id_fkey(company)')
      .eq('project_id', id)

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
    if (!newRow.code || !newRow.name) return
    const payload = { 
      project_id: id, 
      code: newRow.code, 
      name: newRow.name, 
      original_budget: parseFloat(newRow.budget) || 0,
      parent_id: isAdding.parentId 
    }
    await supabase.from('project_cost_codes').insert([payload])
    setNewRow({ code: '', name: '', budget: '' }); setIsAdding({ show: false, parentId: null }); fetchData()
  }

  const handleDelete = async (rowId: string) => {
    const { error } = await supabase.from('project_cost_codes').delete().eq('id', rowId)
    if (error) alert("Line is locked to an active contract."); else fetchData()
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

      if (expandedRows.has(p.id) || typeof window !== 'undefined' && window.matchMedia('print').matches) {
        // Force expand all rows if printing
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

  // Listen for print events to auto-expand all rows so the PDF is fully populated
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
      <FinancialHeader id={id} active="master" />
      
      <div className="space-y-8 w-full print:space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter print:text-black">WBS <span className="text-emerald-500 print:text-black">Ledger</span></h2>
          <button onClick={() => setIsAdding({ show: true, parentId: null })} className="print:hidden bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-2 transition-all shadow-lg"><Plus size={16}/> New Category</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:gap-2">
          <StatCard label="Base Budget" value={totals.original} color="text-slate-400 print:text-black" />
          <StatCard label="Committed" value={totals.committed} color="text-slate-300 print:text-black" />
          <StatCard label="Approved Changes" value={totals.changes} color="text-amber-500 print:text-black" />
          <StatCard label="Budget Variance" value={Math.abs(totals.variance)} color={totals.variance < 0 ? "text-red-500 print:text-black" : "text-emerald-500 print:text-black"} isOver={totals.variance < 0} />
        </div>

        <div className="bg-slate-900 print:bg-white rounded-[40px] print:rounded-none border border-slate-800 print:border-none shadow-2xl print:shadow-none overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[1100px] print:min-w-full">
              <thead>
                <tr className="bg-slate-950 print:bg-slate-100 text-[10px] font-black uppercase text-slate-500 print:text-slate-800 border-b border-slate-800 print:border-slate-300">
                  <th className="p-6 print:p-3 w-48">Cost Code</th>
                  <th className="p-6 print:p-3">Description</th>
                  <th className="p-6 print:p-3">Contractor</th>
                  <th className="p-6 print:p-3 text-right">Base Budget</th>
                  <th className="p-6 print:p-3 text-right border-l border-slate-800/50 print:border-slate-300">Committed</th>
                  <th className="p-6 print:p-3 text-right text-amber-500/50 print:text-slate-800 border-l border-slate-800/50 print:border-slate-300">COs</th>
                  <th className="p-6 print:p-3 text-right bg-blue-950/10 print:bg-transparent text-blue-500/70 print:text-slate-800 border-l border-blue-900/30 print:border-slate-300">Revised Total</th>
                  <th className="p-6 print:p-3 text-right border-l border-slate-800/50 print:border-slate-300">Variance</th>
                  <th className="p-6 w-24 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-slate-200 font-bold">
                {organizedData.map(row => {
                  const hasChildren = costCodes.some(c => c.parent_id === row.id)
                  const isExpanded = expandedRows.has(row.id)
                  
                  return (
                    <tr key={row.id} className={`transition-colors group ${row.depth > 0 ? 'bg-slate-950/30 print:bg-transparent' : 'hover:bg-slate-800/20 print:bg-slate-50'}`}>
                      <td className="p-6 print:p-3">
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
                              <span className="cursor-pointer text-blue-400 print:text-black text-xs uppercase" onClick={() => setEditingCell({ id: row.id, field: 'code', value: row.code })}>{row.code}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6 print:p-3">
                        {editingCell?.id === row.id && editingCell?.field === 'name' ? (
                          <input autoFocus className="bg-slate-950 border border-slate-500 p-1.5 rounded text-white text-xs outline-none w-full print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className={`cursor-pointer uppercase text-xs ${row.depth === 0 ? 'text-white font-black print:text-black' : 'text-slate-400 print:text-slate-700'}`} onClick={() => setEditingCell({ id: row.id, field: 'name', value: row.name })}>{row.name}</span>
                        )}
                      </td>
                      <td className="p-6 print:p-3 text-slate-500 print:text-slate-600 text-[10px] uppercase truncate max-w-[120px]">{row.trade}</td>
                      
                      <td className="p-6 print:p-3 text-right">
                        {row.display_committed > 0 && row.display_original === 0 ? (
                           <div className="flex items-center justify-end gap-2 text-slate-500 print:text-black text-xs font-bold"><Lock size={10} className="text-emerald-500 print:hidden" /> {formatMoney(row.display_original)}</div>
                        ) : editingCell?.id === row.id && editingCell?.field === 'original_budget' ? (
                          <input type="number" autoFocus className="bg-slate-950 border border-emerald-500 p-1.5 rounded text-right text-emerald-400 text-xs outline-none w-24 print:hidden" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className="cursor-pointer text-slate-400 print:text-black text-xs hover:text-white transition-colors" onClick={() => setEditingCell({ id: row.id, field: 'original_budget', value: row.original.toString() })}>{formatMoney(row.display_original)}</span>
                        )}
                      </td>
                      
                      <td className="p-6 print:p-3 text-right border-l border-slate-800/50 print:border-slate-300">
                        {editingCell?.id === row.id && editingCell?.field === 'manual_commitment' ? (
                          <input 
                            type="number" 
                            autoFocus 
                            placeholder="Direct Cost"
                            className="bg-slate-950 border border-blue-500 p-1.5 rounded text-right text-slate-300 text-xs font-bold outline-none w-24 print:hidden" 
                            value={editingCell?.value || ''} 
                            onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} 
                            onBlur={() => handleSaveCell(row.id)} 
                          />
                        ) : (
                          <div 
                            className="flex flex-col items-end cursor-pointer group" 
                            onClick={() => setEditingCell({ id: row.id, field: 'manual_commitment', value: row.manual_commitment?.toString() || '0' })}
                          >
                            <span className="text-slate-300 print:text-black text-xs font-bold group-hover:text-blue-400 transition-colors">
                              {formatMoney(row.display_committed)}
                            </span>
                            {row.has_contracts && (
                              <span className="text-[8px] text-slate-600 print:text-slate-500 font-black uppercase mt-0.5 group-hover:text-blue-500/50 transition-colors">
                                Includes SOVs
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-6 print:p-3 text-right text-xs text-amber-500 print:text-black border-l border-slate-800/50 print:border-slate-300">{row.display_changes > 0 ? `+${formatMoney(row.display_changes)}` : '-'}</td>
                      <td className="p-6 print:p-3 text-right text-xs bg-blue-950/10 print:bg-transparent text-blue-400 print:text-black border-l border-blue-900/30 print:border-slate-300 font-black">{formatMoney(row.total)}</td>
                      <td className={`p-6 print:p-3 text-right text-xs font-black border-l border-slate-800/50 print:border-slate-300 ${row.isOverBudget ? 'text-red-500 print:text-black' : 'text-emerald-500 print:text-black'}`}>{formatMoney(Math.abs(row.variance))}</td>
                      
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

// --- UPDATED HEADER WITH DIRECTORY BUTTON ---
export function FinancialHeader({ id, active }: { id: any, active: string }) {
  const router = useRouter()
  return (
    <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 print:hidden">
      <div>
        <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Project <span className="text-emerald-500">Financials</span></h1>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-xl">
          <button onClick={() => router.push(`/projects/${id}/financials`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'master' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Master Budget</button>
          <button onClick={() => router.push(`/projects/${id}/financials/contracts`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'sov' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Contracts & SOVs</button>
          <button onClick={() => router.push(`/projects/${id}/financials/draws`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'draws' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Monthly Draws</button>
        </div>
        
        {/* NEW PDF EXPORT BUTTON */}
        <button 
          onClick={() => window.print()}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-xl"
        >
          <Printer size={16}/> Export PDF
        </button>

        {/* THE NEW DIRECTORY BUTTON */}
        <button 
          onClick={() => router.push(`/projects/${id}/trades`)}
          className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2 shadow-xl border-t border-white/50"
        >
          <Users size={16}/> Site Directory
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, isOver }: any) {
  return (
    <div className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 print:border-2 p-6 rounded-[28px] print:rounded-xl shadow-xl print:shadow-none">
      <p className="text-[9px] font-black text-slate-500 print:text-slate-600 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>${value.toLocaleString()}</p>
      {isOver !== undefined && <p className="text-[8px] font-black uppercase text-slate-600 print:text-slate-500">{isOver ? 'Over Budget' : 'Under Budget'}</p>}
    </div>
  )
}