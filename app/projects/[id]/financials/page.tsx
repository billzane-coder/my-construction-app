'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, X, ShieldCheck, Wallet, 
  FileStack, ArrowRight, Trash2, Check, Lock, 
  Loader2, ChevronDown, ChevronRight, Users
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
    
    // 1. Fetch All Codes
    let { data: codes } = await supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code')
    
    // 2. Fetch Contracts and SOVs for Commitment calculations
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
      let committed = 0, changes = 0, trades = new Set<string>()
      const matchingContracts = contracts?.filter(c => c.cost_code_id === code.id) || []
      
      matchingContracts.forEach(c => {
         const contactInfo: any = Array.isArray(c?.project_contacts) ? c?.project_contacts[0] : c?.project_contacts
         if (contactInfo?.company) trades.add(contactInfo.company)

         if (c.status === 'Active' || c.status === 'Completed') {
            const linesForContract = sovLines?.filter(l => l.contract_id === c.id) || []
            linesForContract.forEach(line => {
               const isBaseLine = !line.change_order_id;
               const isApprovedCO = line.change_order_id && line.change_orders?.status === 'Approved';
               if (isBaseLine || isApprovedCO) committed += Number(line.scheduled_value || 0)
               if (isApprovedCO) changes += Number(line.scheduled_value || 0)
            })
         }
      })
      
      return { 
        ...code, 
        original: Number(code.original_budget || 0), 
        changes, 
        committed, 
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
    const updateData = editingCell.field === 'original_budget' 
      ? { original_budget: parseFloat(editingCell.value) || 0 } 
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

  // --- HIERARCHY LOGIC ---
  const organizedData = useMemo(() => {
    const parents = costCodes.filter(c => !c.parent_id)
    const children = costCodes.filter(c => c.parent_id)

    const final: any[] = []
    parents.forEach(p => {
      const total = p.committed 
      const revised = p.original + p.changes 
      const variance = revised - total
      final.push({ ...p, depth: 0, revised, total, variance, isOverBudget: variance < 0 })

      if (expandedRows.has(p.id)) {
        children.filter(c => c.parent_id === p.id).forEach(child => {
          const cTotal = child.committed 
          const cRevised = child.original + child.changes 
          const cVariance = cRevised - cTotal
          final.push({ ...child, depth: 1, revised: cRevised, total: cTotal, variance: cVariance, isOverBudget: cVariance < 0 })
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-emerald-500" size={40} /><p className="text-emerald-500 font-black uppercase tracking-widest text-xs">Structuring Budget...</p></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      <FinancialHeader id={id} active="master" />
      
      <div className="space-y-8 w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">WBS <span className="text-emerald-500">Ledger</span></h2>
          <button onClick={() => setIsAdding({ show: true, parentId: null })} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-2 transition-all shadow-lg"><Plus size={16}/> New Category</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Base Budget" value={totals.original} color="text-slate-400" />
          <StatCard label="Committed" value={totals.committed} color="text-slate-300" />
          <StatCard label="Approved Changes" value={totals.changes} color="text-amber-500" />
          <StatCard label="Budget Variance" value={Math.abs(totals.variance)} color={totals.variance < 0 ? "text-red-500" : "text-emerald-500"} isOver={totals.variance < 0} />
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[1100px]">
              <thead>
                <tr className="bg-slate-950 text-[10px] font-black uppercase text-slate-500 border-b border-slate-800">
                  <th className="p-6 w-48">Cost Code</th>
                  <th className="p-6">Description</th>
                  <th className="p-6">Contractor</th>
                  <th className="p-6 text-right">Base Budget</th>
                  <th className="p-6 text-right border-l border-slate-800/50">Committed</th>
                  <th className="p-6 text-right text-amber-500/50 border-l border-slate-800/50">COs</th>
                  <th className="p-6 text-right bg-blue-950/10 text-blue-500/70 border-l border-blue-900/30">Revised Total</th>
                  <th className="p-6 text-right border-l border-slate-800/50">Variance</th>
                  <th className="p-6 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-bold">
                {organizedData.map(row => {
                  const hasChildren = costCodes.some(c => c.parent_id === row.id)
                  const isExpanded = expandedRows.has(row.id)
                  
                  return (
                    <tr key={row.id} className={`transition-colors group ${row.depth > 0 ? 'bg-slate-950/30' : 'hover:bg-slate-800/20'}`}>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          {row.depth === 0 && (
                            <button onClick={() => toggleRow(row.id)} className="text-slate-500 hover:text-white transition-colors">
                              {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                            </button>
                          )}
                          <div className={`${row.depth > 0 ? 'ml-6' : ''}`}>
                            {editingCell?.id === row.id && editingCell?.field === 'code' ? (
                              <input autoFocus className="bg-slate-950 border border-blue-500 p-1.5 rounded text-blue-400 text-xs font-black outline-none w-24" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                            ) : (
                              <span className="cursor-pointer text-blue-400 text-xs uppercase" onClick={() => setEditingCell({ id: row.id, field: 'code', value: row.code })}>{row.code}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        {editingCell?.id === row.id && editingCell?.field === 'name' ? (
                          <input autoFocus className="bg-slate-950 border border-slate-500 p-1.5 rounded text-white text-xs outline-none w-full" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className={`cursor-pointer uppercase text-xs ${row.depth === 0 ? 'text-white font-black' : 'text-slate-400'}`} onClick={() => setEditingCell({ id: row.id, field: 'name', value: row.name })}>{row.name}</span>
                        )}
                      </td>
                      <td className="p-6 text-slate-500 text-[10px] uppercase truncate max-w-[120px]">{row.trade}</td>
                      
                      <td className="p-6 text-right">
                        {row.committed > 0 ? (
                           <div className="flex items-center justify-end gap-2 text-slate-500 text-xs font-bold"><Lock size={10} className="text-emerald-500" /> {formatMoney(row.original)}</div>
                        ) : editingCell?.id === row.id && editingCell?.field === 'original_budget' ? (
                          <input type="number" autoFocus className="bg-slate-950 border border-emerald-500 p-1.5 rounded text-right text-emerald-400 text-xs outline-none w-24" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} />
                        ) : (
                          <span className="cursor-pointer text-slate-400 text-xs" onClick={() => setEditingCell({ id: row.id, field: 'original_budget', value: row.original.toString() })}>{formatMoney(row.original)}</span>
                        )}
                      </td>
                      
                      <td className="p-6 text-right text-xs font-bold text-slate-300 border-l border-slate-800/50">{formatMoney(row.committed)}</td>
                      <td className="p-6 text-right text-xs text-amber-500 border-l border-slate-800/50">{row.changes > 0 ? `+${formatMoney(row.changes)}` : '-'}</td>
                      <td className="p-6 text-right text-xs bg-blue-950/10 text-blue-400 border-l border-blue-900/30 font-black">{formatMoney(row.total)}</td>
                      <td className={`p-6 text-right text-xs font-black border-l border-slate-800/50 ${row.isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>{formatMoney(Math.abs(row.variance))}</td>
                      
                      <td className="p-6 text-right w-24 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {row.depth === 0 && <button onClick={() => setIsAdding({ show: true, parentId: row.id })} className="text-blue-500 hover:text-blue-400 mr-4" title="Add Sub-item"><Plus size={16} /></button>}
                        <button onClick={() => handleDelete(row.id)} className="text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
                {isAdding.show && (
                  <tr className="bg-blue-950/20 border-t-2 border-blue-900/50 animate-in fade-in zoom-in-95">
                    <td className="p-4"><input autoFocus placeholder="Code..." className={`bg-slate-950 border border-blue-500 p-2 rounded text-blue-400 text-xs font-black outline-none w-24 ${isAdding.parentId ? 'ml-6' : ''}`} value={newRow.code} onChange={e => setNewRow({...newRow, code: e.target.value})} /></td>
                    <td className="p-4"><input placeholder="Description..." className="w-full bg-slate-950 border border-slate-500 p-2 rounded text-white text-xs outline-none" value={newRow.name} onChange={e => setNewRow({...newRow, name: e.target.value})} /></td>
                    <td className="p-4"></td>
                    <td className="p-4 text-right"><input type="number" placeholder="Budget..." className="w-24 bg-slate-950 border border-emerald-500 p-2 rounded text-emerald-400 text-xs outline-none text-right" value={newRow.budget} onChange={e => setNewRow({...newRow, budget: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleSaveNew()} /></td>
                    <td colSpan={4} className="border-l border-slate-800/50"></td>
                    <td className="p-4 text-right whitespace-nowrap"><button onClick={handleSaveNew} className="text-emerald-500 mr-3"><Check size={18}/></button><button onClick={() => setIsAdding({ show: false, parentId: null })} className="text-slate-500"><X size={18}/></button></td>
                  </tr>
                )}
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
    <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
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
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] shadow-xl">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>${value.toLocaleString()}</p>
      {isOver !== undefined && <p className="text-[8px] font-black uppercase text-slate-600">{isOver ? 'Over Budget' : 'Under Budget'}</p>}
    </div>
  )
}