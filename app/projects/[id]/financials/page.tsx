'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, X, ShieldCheck, Wallet, FileStack, ArrowRight, Trash2, Check, Lock, Loader2 } from 'lucide-react'

export default function FinancialMaster() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [costCodes, setCostCodes] = useState<any[]>([])
  
  // Spreadsheet States
  const [editingCell, setEditingCell] = useState<{ id: string, field: 'code' | 'name' | 'original_budget', value: string } | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newRow, setNewRow] = useState({ code: '', name: '', budget: '' })

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    let { data: codes } = await supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code')
    
    if (!codes || codes.length === 0) {
      const seed = [
        { code: '01-0000', name: 'General Requirements', original_budget: 0 },
        { code: '03-3000', name: 'Concrete', original_budget: 0 },
        { code: '06-1000', name: 'Framing', original_budget: 0 },
        { code: '07-3100', name: 'Roofing', original_budget: 0 },
        { code: '22-0000', name: 'Plumbing', original_budget: 0 }
      ]
      await supabase.from('project_cost_codes').insert(seed.map(c => ({ project_id: id, ...c })))
      const refreshed = await supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code')
      codes = refreshed.data || []
    }

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

               if (isBaseLine || isApprovedCO) {
                  committed += Number(line.scheduled_value || 0)
               }
               
               if (isApprovedCO) {
                  changes += Number(line.scheduled_value || 0)
               }
            })
         }
      })
      
      return { 
        ...code, 
        original: Number(code.original_budget || 0), 
        changes, 
        committed, 
        trade: Array.from(trades).join(', ') || 'Unassigned' 
      }
    }) || []
    
    setCostCodes(aggregated)
    if (!silent) setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  // --- ACTIONS ---

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
    const payload = { project_id: id, code: newRow.code, name: newRow.name, original_budget: parseFloat(newRow.budget) || 0 }
    await supabase.from('project_cost_codes').insert([payload])
    setNewRow({ code: '', name: '', budget: '' }); setIsAdding(false); fetchData()
  }

  const handleDelete = async (rowId: string) => {
    const { error } = await supabase.from('project_cost_codes').delete().eq('id', rowId)
    if (error) alert("Code is locked to an active contract."); else fetchData()
  }

  const tableData = useMemo(() => costCodes.map(row => {
    const total = row.committed 
    const revised = row.original + row.changes 
    const variance = revised - total 
    
    const baseCommitted = total - row.changes;

    return { ...row, baseCommitted, revised, total, variance, isOverBudget: variance < 0 }
  }), [costCodes])

  const totals = useMemo(() => tableData.reduce((acc, row) => ({
    original: acc.original + row.original,
    baseCommitted: acc.baseCommitted + row.baseCommitted,
    changes: acc.changes + row.changes,
    total: acc.total + row.total,
    variance: acc.variance + row.variance
  }), { original: 0, baseCommitted: 0, changes: 0, total: 0, variance: 0 }), [tableData])

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-emerald-500" size={40} /><p className="text-emerald-500 font-black uppercase tracking-widest text-xs">Syncing Ledger...</p></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      <FinancialHeader id={id} active="master" />
      
      {/* 100% WIDTH SPREADSHEET AREA */}
      <div className="space-y-8 w-full">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">WBS <span className="text-emerald-500">Ledger</span></h2>
          <button onClick={() => setIsAdding(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-2 transition-all shadow-lg"><Plus size={16}/> Add Row</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Base Budget" value={totals.original} color="text-slate-400" />
          <StatCard label="Committed" value={totals.baseCommitted} color="text-slate-300" />
          <StatCard label="Total Costs" value={totals.total} color="text-blue-500" />
          <StatCard label="Variance" value={Math.abs(totals.variance)} color={totals.variance < 0 ? "text-red-500" : "text-emerald-500"} isOver={totals.variance < 0} />
        </div>

        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden w-full">
          <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-blue-500">Master Ledger</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cost Code Aggregation</p>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-slate-950/50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-800">
                  <th className="p-6 w-32">Code</th>
                  <th className="p-6">Description</th>
                  <th className="p-6">Trade</th>
                  <th className="p-6 text-right">Budget</th>
                  <th className="p-6 text-right border-l border-slate-800/50">Committed</th>
                  <th className="p-6 text-right text-amber-500/50 border-l border-slate-800/50">C.O.s</th>
                  <th className="p-6 text-right bg-blue-950/10 text-blue-500/70 border-l border-blue-900/30">Total</th>
                  <th className="p-6 text-right border-l border-slate-800/50">Variance</th>
                  <th className="p-6 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-bold">
                {tableData.map(row => (
                  <tr key={row.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="p-6">
                      {editingCell?.id === row.id && editingCell?.field === 'code' ? (
                        <input autoFocus className="w-full max-w-[120px] bg-slate-950 border border-blue-500 p-2 rounded-lg text-blue-400 font-black outline-none shadow-inner" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} onKeyDown={e => e.key === 'Enter' && handleSaveCell(row.id)} />
                      ) : (
                        <div className="cursor-pointer text-blue-400 border-b border-dashed border-transparent hover:border-blue-400 inline-block transition-colors" onClick={() => setEditingCell({ id: row.id, field: 'code', value: row.code })}>{row.code}</div>
                      )}
                    </td>
                    <td className="p-6">
                      {editingCell?.id === row.id && editingCell?.field === 'name' ? (
                        <input autoFocus className="w-full max-w-[200px] bg-slate-950 border border-slate-500 p-2 rounded-lg text-white font-bold outline-none shadow-inner" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} onKeyDown={e => e.key === 'Enter' && handleSaveCell(row.id)} />
                      ) : (
                        <div className="cursor-pointer text-white uppercase text-xs border-b border-dashed border-transparent hover:border-white inline-block transition-colors" onClick={() => setEditingCell({ id: row.id, field: 'name', value: row.name })}>{row.name}</div>
                      )}
                    </td>
                    <td className="p-6 text-slate-500 text-[10px] uppercase truncate max-w-[150px]">{row.trade}</td>
                    
                    <td className="p-6 text-right">
                      {row.baseCommitted > 0 ? (
                         <div className="flex items-center justify-end gap-2 text-slate-500 font-bold cursor-default" title="Locked by Active Contract"><Lock size={12} className="text-emerald-500" /> {formatMoney(row.original)}</div>
                      ) : editingCell?.id === row.id && editingCell?.field === 'original_budget' ? (
                        <input type="number" autoFocus className="w-full max-w-[120px] bg-slate-950 border border-emerald-500 p-2 rounded-lg text-right text-emerald-400 font-black outline-none shadow-inner" value={editingCell?.value || ''} onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)} onBlur={() => handleSaveCell(row.id)} onKeyDown={e => e.key === 'Enter' && handleSaveCell(row.id)} />
                      ) : (
                        <div className="cursor-pointer text-slate-400 hover:text-white border-b border-dashed border-slate-600 hover:border-white inline-block transition-colors" onClick={() => setEditingCell({ id: row.id, field: 'original_budget', value: row.original.toString() })}>{formatMoney(row.original)}</div>
                      )}
                    </td>
                    
                    <td className="p-6 text-right font-bold text-slate-300 border-l border-slate-800/50">
                      {row.baseCommitted > 0 ? `${formatMoney(row.baseCommitted)}` : '-'}
                    </td>

                    <td className="p-6 text-right text-amber-500 border-l border-slate-800/50 font-bold">
                      {row.changes > 0 ? `+ ${formatMoney(row.changes)}` : '-'}
                    </td>
                    
                    <td className="p-6 text-right bg-blue-950/10 text-blue-400 border-l border-blue-900/30 font-black">
                      {formatMoney(row.total)}
                    </td>

                    <td className={`p-6 text-right font-black border-l border-slate-800/50 ${row.isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                      {formatMoney(Math.abs(row.variance))}
                    </td>
                    
                    <td className="p-6 text-right w-12 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDelete(row.id)} className="text-slate-600 hover:text-red-500 transition-colors" title="Delete Cost Code"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {isAdding && (
                  <tr className="bg-blue-950/20 border-t-2 border-blue-900/50 animate-in fade-in zoom-in-95">
                    <td className="p-4"><input autoFocus placeholder="Code..." className="w-full max-w-[120px] bg-slate-950 border border-blue-500 p-3 rounded-lg text-blue-400 font-black outline-none" value={newRow.code} onChange={e => setNewRow({...newRow, code: e.target.value})} /></td>
                    <td className="p-4"><input placeholder="Description..." className="w-full max-w-[200px] bg-slate-950 border border-slate-500 p-3 rounded-lg text-white font-bold outline-none" value={newRow.name} onChange={e => setNewRow({...newRow, name: e.target.value})} /></td>
                    <td className="p-4 text-slate-500 text-[10px] uppercase">New</td>
                    <td className="p-4 text-right"><input type="number" placeholder="Budget..." className="w-full max-w-[120px] bg-slate-950 border border-emerald-500 p-3 rounded-lg text-emerald-400 font-black outline-none text-right" value={newRow.budget} onChange={e => setNewRow({...newRow, budget: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleSaveNew()} /></td>
                    <td colSpan={4} className="p-4 border-l border-slate-800/50"></td>
                    <td className="p-4 text-right whitespace-nowrap"><button onClick={handleSaveNew} className="text-emerald-500 hover:text-emerald-400 mr-3 transition-colors"><Check size={18}/></button><button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-red-500 transition-colors"><X size={18}/></button></td>
                  </tr>
                )}
              </tbody>
              
              <tfoot className="bg-slate-950 border-t-2 border-slate-800">
                <tr>
                  <td colSpan={3} className="p-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Project Totals</td>
                  <td className="p-6 text-right font-black text-slate-400 text-lg border-l border-slate-800/50">{formatMoney(totals.original)}</td>
                  <td className="p-6 text-right font-black text-slate-300 text-lg border-l border-slate-800/50">{formatMoney(totals.baseCommitted)}</td>
                  <td className="p-6 text-right font-black text-amber-500 text-lg border-l border-slate-800/50">{formatMoney(totals.changes)}</td>
                  <td className="p-6 text-right font-black text-blue-500 text-xl border-l border-blue-900/30 bg-blue-950/10">{formatMoney(totals.total)}</td>
                  <td className={`p-6 text-right font-black text-lg border-l border-slate-800/50 ${totals.variance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatMoney(Math.abs(totals.variance))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* FULL WIDTH BOTTOM TOOLKIT GRID */}
      <div className="mt-16 w-full pt-10 border-t border-slate-800/50">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center md:text-left">Compliance Toolkit</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
           <ToolLink title="Holdback Ledger" desc="Lien Clock & Retainage" icon={<ShieldCheck size={24}/>} color="bg-emerald-600" onClick={() => router.push(`/projects/${id}/financials/holdback`)} />
           <ToolLink title="Change Orders" desc="Scope Revisions & Extras" icon={<Wallet size={24}/>} color="bg-amber-600" onClick={() => router.push(`/projects/${id}/financials/change-orders`)} />
           <ToolLink title="Bank Package" desc="CMHC / Bank PDF Export" icon={<FileStack size={24}/>} color="bg-blue-600" onClick={() => router.push(`/projects/${id}/financials/reports/draw-package`)} />
        </div>
      </div>

    </div>
  )
}

export function FinancialHeader({ id, active }: { id: any, active: string }) {
  const router = useRouter()
  return (
    <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
      <div>
        <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
        <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Project <span className="text-emerald-500">Financials</span></h1>
      </div>
      <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-xl overflow-x-auto max-w-full">
        <button onClick={() => router.push(`/projects/${id}/financials`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'master' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Master Budget</button>
        <button onClick={() => router.push(`/projects/${id}/financials/contracts`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'sov' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Contracts & SOVs</button>
        <button onClick={() => router.push(`/projects/${id}/financials/draws`)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${active === 'draws' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Monthly Draws</button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, isOver }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[28px] shadow-xl">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>${value.toLocaleString()}</p>
      {isOver !== undefined && <p className="text-[8px] font-black uppercase text-slate-600">{isOver ? 'Over' : 'Under'}</p>}
    </div>
  )
}

function ToolLink({ title, desc, icon, color, onClick }: any) {
  return (
    <div onClick={onClick} className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] hover:bg-slate-800/80 transition-all cursor-pointer group shadow-xl relative overflow-hidden">
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-10 ${color.replace('bg-', '')}`} />
      <div className={`${color} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-black/50 group-hover:scale-110 transition-transform`}>{icon}</div>
      <h4 className="text-lg font-black text-white uppercase italic leading-tight">{title}</h4>
      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{desc}</p>
      <div className="mt-6 flex items-center justify-between text-slate-500 group-hover:text-white font-black text-[9px] uppercase tracking-widest transition-colors">
        Launch <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  )
}