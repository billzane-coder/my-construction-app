'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import { Plus, CheckCircle2, Lock, Unlock, X, DollarSign, LayoutGrid, Mail, Copy, Loader2 } from 'lucide-react'

export default function ContractsManager() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [newSovDesc, setNewSovDesc] = useState('')
  const [newSovAmount, setNewSovAmount] = useState('')

  // Cloning States
  const [availableProjects, setAvailableProjects] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    
    const [codesRes, contactsRes, projRes] = await Promise.all([
      supabase.from('project_cost_codes').select('*').eq('project_id', id),
      supabase.from('project_contacts').select('*').eq('project_id', id),
      supabase.from('projects').select('id, name').neq('id', id)
    ])

    setCostCodes(codesRes.data || [])
    setContacts(contactsRes.data || [])
    if (projRes.data) setAvailableProjects(projRes.data)

    const { data: contractData } = await supabase
      .from('project_contracts')
      .select(`
        id, title, status, project_id, contact_id, cost_code_id, created_at,
        project_contacts!project_contracts_contact_id_fkey(company, trade_role), 
        project_cost_codes(code, name, original_budget), 
        sov_line_items(*)
      `)
      .eq('project_id', id).order('created_at', { ascending: false })

    const formattedData = contractData?.map(contract => ({ ...contract, project_contacts: Array.isArray(contract.project_contacts) ? contract.project_contacts[0] : contract.project_contacts }))
    setContracts(formattedData || [])
    if (selectedContract && formattedData) setSelectedContract(formattedData.find(c => c.id === selectedContract.id))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    await supabase.from('project_contracts').insert([{ project_id: id, contact_id: fd.get('contact_id'), cost_code_id: fd.get('cost_code_id'), title: fd.get('title'), status: 'Draft' }])
    setShowNewModal(false); fetchData()
  }

  const handleAddSovLine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContract || !newSovDesc || !newSovAmount) return
    await supabase.from('sov_line_items').insert([{ contract_id: selectedContract.id, cost_code_id: selectedContract.cost_code_id, description: newSovDesc, scheduled_value: parseFloat(newSovAmount) }])
    setNewSovDesc(''); setNewSovAmount(''); fetchData()
  }

  const handleDeleteSovLine = async (lineId: string) => {
    await supabase.from('sov_line_items').delete().eq('id', lineId); fetchData()
  }

  const handleActivateContract = async () => {
    if (!selectedContract) return
    const total = calculateContractTotal(selectedContract.sov_line_items)
    await supabase.from('project_contracts').update({ status: 'Active' }).eq('id', selectedContract.id)
    
    const currentBudget = Number(selectedContract.project_cost_codes?.original_budget || 0)

    if (currentBudget === 0) {
      await supabase.from('project_cost_codes').update({ original_budget: total }).eq('id', selectedContract.cost_code_id)
    }
    fetchData()
  }

  const handleUnlockContract = async () => {
    if (!selectedContract) return
    await supabase.from('project_contracts').update({ status: 'Draft' }).eq('id', selectedContract.id)
    fetchData()
  }

  // --- CONTRACT CLONING ENGINE ---
  const handleImportContracts = async (sourceProjectId: string) => {
    setImporting(true)
    try {
      // 1. Get old contracts, their SOVs, and the names/codes of their trades & WBS
      const { data: sourceContracts } = await supabase
        .from('project_contracts')
        .select(`
          *,
          project_cost_codes(code),
          project_contacts(company),
          sov_line_items(*)
        `)
        .eq('project_id', sourceProjectId)

      if (!sourceContracts || sourceContracts.length === 0) {
        alert('No contracts found in the selected project.')
        setImporting(false)
        return
      }

      // 2. Loop and map to the new project
      for (const sContract of sourceContracts) {
        
        // Smart match WBS code
        const sourceCode = sContract.project_cost_codes?.code
        const matchCode = costCodes.find(c => c.code === sourceCode)

        // Smart match Trade Partner
        const sourceCompany = Array.isArray(sContract.project_contacts) ? sContract.project_contacts[0]?.company : sContract.project_contacts?.company
        const matchContact = contacts.find(c => c.company === sourceCompany)

        // Insert shell contract
        const newContractPayload = {
          project_id: id,
          title: sContract.title,
          status: 'Draft',
          cost_code_id: matchCode?.id || null,
          contact_id: matchContact?.id || null
        }

        const { data: newContract, error: cErr } = await supabase
          .from('project_contracts')
          .insert([newContractPayload])
          .select()
          .single()

        if (cErr) {
          console.error('Failed to import contract:', sContract.title, cErr)
          continue
        }

        // Insert all SOV line items and keep their dollar values
        if (sContract.sov_line_items && sContract.sov_line_items.length > 0) {
          const newSovs = sContract.sov_line_items.map((sov: any) => ({
            contract_id: newContract.id,
            cost_code_id: matchCode?.id || null,
            description: sov.description,
            scheduled_value: sov.scheduled_value
          }))
          await supabase.from('sov_line_items').insert(newSovs)
        }
      }

      setShowImportModal(false)
      fetchData()
    } catch (err: any) {
      alert('Error importing contracts: ' + err.message)
    }
    setImporting(false)
  }

  const handleGenerateEmail = () => {
    const subject = `Award & Onboarding Requirements: ${selectedContract.title}`
    const body = `Hi Team,\n\nCongratulations on being awarded the ${selectedContract.title} package.\n\nBefore mobilizing, please submit the following required compliance documents to our Trade Hub:\n\n1. WSIB Clearance Certificate\n2. Form 1000\n3. General Liability Insurance Certificate\n4. Corporate Health & Safety Policy\n\nThanks,\nSiteMaster Pro`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  const calculateContractTotal = (sovLines: any[]) => sovLines?.reduce((sum, line) => sum + Number(line.scheduled_value || 0), 0) || 0

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse tracking-widest">Syncing Contracts...</div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      
      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Clone Contracts & SOVs</h3>
                 <button onClick={() => setShowImportModal(false)} className="bg-slate-950 p-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
              </div>
              <p className="text-xs font-bold text-slate-400 mb-2">Select a past project to clone its contracts and schedule of values. Dollar amounts will be preserved.</p>
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-6">Note: Import your WBS and Directory first to auto-link trades.</p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                 {availableProjects.map(proj => (
                    <button key={proj.id} onClick={() => handleImportContracts(proj.id)} disabled={importing} className="w-full text-left p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500 transition-colors group flex justify-between items-center">
                       <span className="text-sm font-bold text-slate-300 group-hover:text-white uppercase">{proj.name}</span>
                       {importing ? <Loader2 size={16} className="animate-spin text-blue-500"/> : <Copy size={16} className="text-slate-600 group-hover:text-blue-500"/>}
                    </button>
                 ))}
                 {availableProjects.length === 0 && <p className="text-xs font-bold text-slate-500 text-center py-4">No other projects found.</p>}
              </div>
           </div>
        </div>
      )}

      <FinancialHeader id={id} active="sov" />
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Awarded <span className="text-blue-500">Contracts</span></h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="bg-slate-900 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase border border-slate-800 hover:bg-slate-800 flex items-center gap-2 transition-all shadow-lg"><Copy size={16}/> Clone Prev Project</button>
          <button onClick={() => setShowNewModal(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-xl hover:bg-blue-500 flex items-center gap-2 transition-all"><Plus size={16}/> New Contract</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          {contracts.map(contract => {
            const total = calculateContractTotal(contract.sov_line_items)
            const isSelected = selectedContract?.id === contract.id
            return (
              <div key={contract.id} onClick={() => setSelectedContract(contract)} className={`p-6 rounded-[32px] border transition-all cursor-pointer group shadow-xl ${isSelected ? 'bg-blue-950/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest mb-2 inline-block ${contract.status === 'Active' ? 'bg-emerald-950 text-emerald-500' : 'bg-amber-950 text-amber-500'}`}>
                      {contract.status === 'Active' ? 'Locked' : 'Draft SOV'}
                    </span>
                    <h4 className={`text-xl font-black uppercase italic leading-none mb-1 ${isSelected ? 'text-blue-400' : 'text-white'}`}>{contract.project_contacts?.company || 'Unknown Trade'}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{contract.title}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${contract.status === 'Active' ? 'text-emerald-400' : 'text-slate-300'}`}>{formatMoney(total)}</p>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">{contract.project_cost_codes?.code}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="lg:col-span-7">
          {selectedContract ? (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl sticky top-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-8 border-b border-slate-800 gap-4">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic leading-none mb-2">Schedule of Values</h2>
                  <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">{selectedContract.project_contacts?.company}</p>
                </div>
                {selectedContract.status === 'Draft' ? (
                  <button onClick={handleActivateContract} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2">
                    <Lock size={14}/> Lock & Commit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleUnlockContract} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Unlock size={14}/> Unlock</button>
                    <button onClick={handleGenerateEmail} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Mail size={14}/> Onboarding Email</button>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {selectedContract.sov_line_items?.map((line: any, idx: number) => (
                  <div key={line.id} className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="font-bold text-white text-sm"><span className="text-slate-500 mr-4 text-[10px]">{String(idx + 1).padStart(2, '0')}</span>{line.description}</p>
                    <div className="flex items-center gap-6">
                      <p className="font-black text-emerald-400 text-lg">{formatMoney(line.scheduled_value)}</p>
                      {selectedContract.status === 'Draft' && <button onClick={() => handleDeleteSovLine(line.id)} className="text-slate-600 hover:text-red-500"><X size={16}/></button>}
                    </div>
                  </div>
                ))}
              </div>

              {selectedContract.status === 'Draft' && (
                <form onSubmit={handleAddSovLine} className="bg-blue-950/10 border border-blue-900/30 p-6 rounded-[24px]">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <input required placeholder="Line Description" className="md:col-span-7 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={newSovDesc} onChange={(e) => setNewSovDesc(e.target.value)} />
                    <input required type="number" step="0.01" placeholder="Value" className="md:col-span-3 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-black text-emerald-500 outline-none focus:border-blue-500" value={newSovAmount} onChange={(e) => setNewSovAmount(e.target.value)} />
                    <button type="submit" className="md:col-span-2 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase hover:bg-blue-600">Add</button>
                  </div>
                </form>
              )}
            </div>
          ) : <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-20 flex flex-col items-center justify-center text-center"><LayoutGrid size={48} className="text-slate-800 mb-6" /><h3 className="text-2xl font-black text-slate-600 uppercase italic">Select Contract</h3></div>}
        </div>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleCreateContract} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-lg w-full space-y-6">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">New Contract</h2>
            <select name="cost_code_id" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-blue-400 outline-none">
              <option value="">Select Master Cost Code...</option>
              {costCodes.map(code => <option key={code.id} value={code.id}>{code.code} — {code.name}</option>)}
            </select>
            <select name="contact_id" required className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none">
              <option value="">Select Subcontractor...</option>
              {contacts.map(trade => <option key={trade.id} value={trade.id}>{trade.company}</option>)}
            </select>
            <input name="title" required placeholder="Contract Scope" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-bold text-white outline-none" />
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}