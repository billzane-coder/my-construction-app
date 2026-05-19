'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dynamicImport from 'next/dynamic'
import { 
  Plus, CheckCircle2, Lock, Unlock, X, DollarSign, 
  LayoutGrid, Mail, Copy, Loader2, Edit3, Trash2, 
  ChevronDown, Save, FileSignature, Printer, FileText 
} from 'lucide-react'

// Bring the Editor into the Dashboard for modifications
const ReactQuill = dynamicImport(() => import('react-quill-new'), { 
  ssr: false,
  loading: () => <div className="h-48 w-full bg-slate-950 animate-pulse rounded-2xl border border-slate-800" />
})
import 'react-quill-new/dist/quill.snow.css'

export default function ContractsManager() {
  const { id } = useParams()
  const router = useRouter()
  
  // --- CORE STATES ---
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [project, setProject] = useState<any>(null)
  
  // --- UI STATES ---
  const [newSovDesc, setNewSovDesc] = useState('')
  const [newSovAmount, setNewSovAmount] = useState('')
  const [expandedContract, setExpandedContract] = useState<string | null>(null)
  const [editingSub, setEditingSub] = useState<{ contractId: string, subId: string } | null>(null)
  
  // NEW: Scope Editing States
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null)
  const [editableScope, setEditableScope] = useState('')

  // --- CLONING STATES ---
  const [availableProjects, setAvailableProjects] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    
    const [codesRes, contactsRes, projRes, settingsRes, pRes] = await Promise.all([
      supabase.from('project_cost_codes').select('*').eq('project_id', id),
      supabase.from('project_contacts').select('*').eq('project_id', id).order('company'),
      supabase.from('projects').select('id, name').neq('id', id),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('projects').select('*').eq('id', id).single()
    ])

    setCostCodes(codesRes.data || [])
    setContacts(contactsRes.data || [])
    if (projRes.data) setAvailableProjects(projRes.data)
    if (settingsRes.data) setSettings(settingsRes.data)
    if (pRes.data) setProject(pRes.data)

    const { data: contractData } = await supabase
      .from('project_contracts')
      .select(`
        id, title, status, project_id, contact_id, cost_code_id, created_at, scope_of_work,
        project_contacts!project_contracts_contact_id_fkey(id, company, trade_role), 
        project_cost_codes(code, name, original_budget), 
        sov_line_items(*)
      `)
      .eq('project_id', id).order('created_at', { ascending: false })

    const formattedData = contractData?.map(contract => ({ 
      ...contract, 
      project_contacts: Array.isArray(contract.project_contacts) ? contract.project_contacts[0] : contract.project_contacts 
    }))
    
    setContracts(formattedData || [])
    if (selectedContract && formattedData) {
      setSelectedContract(formattedData.find(c => c.id === selectedContract.id))
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  // --- CONTRACT ACTIONS ---
  const handleUpdateContractor = async (contractId: string) => {
    if (!editingSub) return
    await supabase.from('project_contracts').update({ contact_id: editingSub.subId }).eq('id', contractId)
    setEditingSub(null)
    fetchData()
  }

  const handleDeleteContract = async (contractId: string, companyName: string) => {
    if (!confirm(`Are you absolutely sure you want to delete the commitment for ${companyName || 'this trade'}? This will wipe the SOV schedule.`)) return
    await supabase.from('sov_line_items').delete().eq('contract_id', contractId)
    await supabase.from('project_contracts').delete().eq('id', contractId)
    if (selectedContract?.id === contractId) setSelectedContract(null)
    fetchData()
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

  // --- NEW: SAVE EDITED SCOPE ---
  const handleSaveScope = async (contractId: string) => {
    await supabase.from('project_contracts').update({ scope_of_work: editableScope }).eq('id', contractId)
    setEditingScopeId(null)
    fetchData()
  }

  // --- SOV ACTIONS ---
  const handleAddSovLine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContract || !newSovDesc || !newSovAmount) return
    await supabase.from('sov_line_items').insert([{ 
      contract_id: selectedContract.id, 
      cost_code_id: selectedContract.cost_code_id, 
      description: newSovDesc, 
      scheduled_value: parseFloat(newSovAmount) 
    }])
    setNewSovDesc('')
    setNewSovAmount('')
    fetchData()
  }

  const handleDeleteSovLine = async (lineId: string) => {
    await supabase.from('sov_line_items').delete().eq('id', lineId)
    fetchData()
  }

  // --- PDF GENERATOR ---
  const generatePODocument = (contract: any) => {
    const doc = new jsPDF()
    const brandHex = settings?.primary_color || '#2563eb'
    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [37, 99, 235]; 
    }
    const brandRgb = hexToRgb(brandHex)

    if (settings?.logo_url) {
      doc.addImage(settings.logo_url, 'PNG', 14, 15, 40, 15)
    }
    
    doc.setFontSize(24)
    doc.setTextColor(brandRgb[0], brandRgb[1], brandRgb[2])
    doc.setFont("helvetica", "bold")
    doc.text("PURCHASE ORDER", 196, 25, { align: "right" })
    
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`PO Number: ${contract.title}`, 196, 32, { align: "right" })
    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`, 196, 38, { align: "right" }) // Prints current date for re-issues

    doc.setDrawColor(226, 232, 240)
    doc.line(14, 45, 196, 45)

    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.text("FROM (ISSUER):", 14, 55)
    doc.setFont("helvetica", "normal")
    doc.text(settings?.company_name || "Your Company Name", 14, 61)
    doc.text("Project: " + (project?.name || "Unassigned"), 14, 67)

    doc.setFont("helvetica", "bold")
    doc.text("TO (CONTRACTOR):", 110, 55)
    doc.setFont("helvetica", "normal")
    doc.text(contract.project_contacts?.company || "Trade Name", 110, 61)
    doc.text("Attention: Project Manager", 110, 67)

    // Table
    const tableData = contract.sov_line_items?.map((line: any, index: number) => [
      String(index + 1).padStart(2, '0'),
      line.description,
      formatMoney(line.scheduled_value)
    ]) || []

    autoTable(doc, {
      startY: 85,
      head: [['Item', 'Schedule of Values', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: brandRgb, textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      }
    })

    const tableEndY = (doc as any).lastAutoTable.finalY + 15

    // Scope Parsing
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.text("Scope of Work / Terms:", 14, tableEndY)

    let htmlContent = contract.scope_of_work || "No detailed scope provided.";
    htmlContent = htmlContent.replace(/<li[^>]*>/gi, '  • '); 
    htmlContent = htmlContent.replace(/<\/li>/gi, '<br>');
    htmlContent = htmlContent.replace(/<\/p>/gi, '<br><br>'); 
    htmlContent = htmlContent.replace(/<\/h[1-6]>/gi, '<br><br>'); 
    htmlContent = htmlContent.replace(/<br\s*[\/]?>/gi, '\n');

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    let plainTextScope = tempDiv.textContent || tempDiv.innerText || "";
    plainTextScope = plainTextScope.replace(/\n{3,}/g, '\n\n').trim();

    doc.setFont("helvetica", "normal")
    const splitScope = doc.splitTextToSize(plainTextScope, 180);
    
    let currentY = tableEndY + 8;
    for (let i = 0; i < splitScope.length; i++) {
      if (currentY > 280) {
        doc.addPage();
        currentY = 20; 
      }
      doc.text(splitScope[i], 14, currentY);
      currentY += 4.5;
    }

    let finalSectionY = currentY + 15;
    if (finalSectionY > 280) {
      doc.addPage();
      finalSectionY = 20;
    }

    const total = calculateContractTotal(contract.sov_line_items)
    
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.text(`Total Authorized Value: ${formatMoney(total)}`, 196, finalSectionY, { align: "right" })

    doc.save(`${contract.project_contacts?.company.replace(/\s+/g, '_') || 'Trade'}_${contract.title.replace(/\s+/g, '_')}.pdf`)
  }

  // --- CLONING & COMMS ---
  const handleImportContracts = async (sourceProjectId: string) => {
    setImporting(true)
    try {
      const { data: sourceContracts } = await supabase
        .from('project_contracts')
        .select(`*, project_cost_codes(code), project_contacts(company), sov_line_items(*)`)
        .eq('project_id', sourceProjectId)

      if (!sourceContracts || sourceContracts.length === 0) {
        alert('No contracts found in the selected project.')
        setImporting(false)
        return
      }

      for (const sContract of sourceContracts) {
        const sourceCode = sContract.project_cost_codes?.code
        const matchCode = costCodes.find(c => c.code === sourceCode)

        const sourceCompany = Array.isArray(sContract.project_contacts) ? sContract.project_contacts[0]?.company : sContract.project_contacts?.company
        const matchContact = contacts.find(c => c.company === sourceCompany)

        const newContractPayload = {
          project_id: id,
          title: sContract.title,
          status: 'Draft',
          cost_code_id: matchCode?.id || null,
          contact_id: matchContact?.id || null,
          scope_of_work: sContract.scope_of_work
        }

        const { data: newContract, error: cErr } = await supabase.from('project_contracts').insert([newContractPayload]).select().single()

        if (cErr) continue

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
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100 pb-32">
      
      {showImportModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Clone Contracts & SOVs</h3>
                 <button onClick={() => setShowImportModal(false)} className="bg-slate-950 p-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
              </div>
              <p className="text-xs font-bold text-slate-400 mb-2">Select a past project to clone its contracts and schedule of values. Dollar amounts will be preserved.</p>
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-6">Note: Import your WBS and Directory first to auto-link trades.</p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
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

      <FinancialHeader id={id} active="contracts" />
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Awarded <span className="text-blue-500">Contracts</span></h2>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="bg-slate-900 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase border border-slate-800 hover:bg-slate-800 flex items-center gap-2 transition-all shadow-lg"><Copy size={16}/> Clone Prev Project</button>
          
          <button onClick={() => router.push(`/projects/${id}/financials/commitments/new`)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-xl hover:bg-blue-500 flex items-center gap-2 transition-all"><Plus size={16}/> Build Commitment</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Contract List */}
        <div className="lg:col-span-5 space-y-4">
          {contracts.length === 0 ? (
            <div className="text-center py-20 bg-slate-900 rounded-3xl border border-slate-800">
              <FileSignature size={48} className="mx-auto text-slate-700 mb-4"/>
              <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No active commitments.</p>
            </div>
          ) : (
            contracts.map(contract => {
              const total = calculateContractTotal(contract.sov_line_items)
              const isSelected = selectedContract?.id === contract.id
              const companyName = contract.project_contacts?.company || 'Unassigned Trade'
              
              return (
                <div key={contract.id} onClick={() => setSelectedContract(contract)} className={`p-0 rounded-[32px] border transition-all cursor-pointer group shadow-xl overflow-hidden ${isSelected ? 'bg-blue-950/20 border-blue-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}>
                  
                  <div className="p-6 flex justify-between items-start">
                    <div className="flex-1">
                      <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest mb-2 inline-block ${contract.status === 'Active' ? 'bg-emerald-950 text-emerald-500' : contract.status === 'Executed' ? 'bg-blue-950 text-blue-500' : 'bg-amber-950 text-amber-500'}`}>
                        {contract.status === 'Active' ? 'Locked SOV' : contract.status}
                      </span>
                      
                      {editingSub?.contractId === contract.id ? (
                        <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                          <select 
                            value={editingSub?.subId || ''} 
                            onChange={(e) => setEditingSub({ contractId: contract.id, subId: e.target.value })} 
                            className="bg-slate-950 border border-blue-500 p-2 rounded-lg text-xs font-bold text-white outline-none"
                          >
                            <option value="">Select Trade...</option>
                            {contacts.map((c) => (
                              <option key={c.id} value={c.id}>{c.company}</option>
                            ))}
                          </select>
                          <button onClick={() => handleUpdateContractor(contract.id)} className="bg-blue-600 px-3 py-2 rounded-lg text-xs font-black text-white hover:bg-blue-500">
                            <Save size={14}/>
                          </button>
                          <button onClick={() => setEditingSub(null)} className="text-slate-500 hover:text-white">
                            <X size={14}/>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-xl font-black uppercase italic leading-none ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                            {companyName}
                          </h4>
                          <button onClick={(e) => { e.stopPropagation(); setEditingSub({ contractId: contract.id, subId: contract.contact_id })}} className="text-slate-600 hover:text-blue-500 transition-colors">
                            <Edit3 size={14}/>
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{contract.title}</p>
                    </div>
                    
                    <div className="text-right ml-4 flex flex-col items-end">
                      <p className={`text-2xl font-black ${contract.status === 'Active' ? 'text-emerald-400' : 'text-slate-300'}`}>{formatMoney(total)}</p>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">{contract.project_cost_codes?.code}</p>
                    </div>
                  </div>

                  {/* EXPANDABLE ACTIONS BAR */}
                  <div className="px-6 py-3 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center" onClick={(e) => { e.stopPropagation(); setExpandedContract(expandedContract === contract.id ? null : contract.id) }}>
                     <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2">
                       <LayoutGrid size={12}/> {contract.sov_line_items?.length || 0} SOV Lines
                     </span>
                     <div className="flex items-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteContract(contract.id, companyName) }} className="text-slate-600 hover:text-red-500 transition-colors" title="Delete Contract">
                          <Trash2 size={16}/>
                        </button>
                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedContract === contract.id ? 'rotate-180' : ''}`}/>
                     </div>
                  </div>

                  {/* SCOPE OF WORK EDITOR PREVIEW */}
                  {expandedContract === contract.id && (
                    <div className="p-6 border-t border-slate-800 bg-slate-900 cursor-default" onClick={e => e.stopPropagation()}>
                      
                      <div className="mb-6 p-5 bg-slate-950 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <FileText size={12}/> Document Terms & Scope
                          </h4>
                          {editingScopeId === contract.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => setEditingScopeId(null)} className="text-slate-500 hover:text-white text-[10px] font-black uppercase">Cancel</button>
                              <button onClick={() => handleSaveScope(contract.id)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-500 text-[10px] font-black uppercase flex items-center gap-1 shadow-lg"><Save size={12}/> Save Update</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditableScope(contract.scope_of_work || ''); setEditingScopeId(contract.id) }} className="text-blue-500 hover:text-white text-[10px] font-black uppercase flex items-center gap-1"><Edit3 size={12}/> Edit Scope</button>
                          )}
                        </div>

                        {editingScopeId === contract.id ? (
                          <div className="border border-blue-900/50 rounded-2xl overflow-hidden bg-slate-950 focus-within:border-blue-500 transition-colors">
                            <ReactQuill theme="snow" value={editableScope} onChange={setEditableScope} className="text-white min-h-[300px]"/>
                          </div>
                        ) : (
                          contract.scope_of_work && contract.scope_of_work !== '<p><br></p>' ? (
                            <div className="text-sm text-slate-300 leading-relaxed quill-content" dangerouslySetInnerHTML={{ __html: contract.scope_of_work }} />
                          ) : (
                            <p className="text-sm text-slate-600 italic">No detailed scope provided. Click Edit to add terms.</p>
                          )
                        )}
                      </div>

                      <h4 className="text-[10px] font-black uppercase text-blue-500 mb-3 tracking-widest">Schedule of Values</h4>
                      <div className="space-y-2">
                        {contract.sov_line_items?.map((line: any) => (
                          <div key={line.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 truncate pr-4">{line.description}</span>
                            <span className="text-[10px] font-black text-white">{formatMoney(line.scheduled_value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* RIGHT COLUMN: Active Contract Editor */}
        <div className="lg:col-span-7">
          {selectedContract ? (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl sticky top-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-8 border-b border-slate-800 gap-4">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase italic leading-none mb-2">Schedule of Values</h2>
                  <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">{selectedContract.project_contacts?.company || 'Unassigned Trade'}</p>
                </div>
                
                <div className="flex gap-2">
                  <button onClick={() => generatePODocument(selectedContract)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all border border-slate-700">
                    <Printer size={14}/> PDF P.O.
                  </button>
                  
                  {selectedContract.status === 'Draft' || selectedContract.status === 'Issued' ? (
                    <button onClick={handleActivateContract} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-2">
                      <Lock size={14}/> Lock SOV & Commit
                    </button>
                  ) : (
                    <>
                      <button onClick={handleUnlockContract} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Unlock size={14}/> Unlock</button>
                      <button onClick={handleGenerateEmail} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Mail size={14}/> Onboarding</button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                {selectedContract.sov_line_items?.map((line: any, idx: number) => (
                  <div key={line.id} className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="font-bold text-white text-sm"><span className="text-slate-500 mr-4 text-[10px]">{String(idx + 1).padStart(2, '0')}</span>{line.description}</p>
                    <div className="flex items-center gap-6">
                      <p className="font-black text-emerald-400 text-lg">{formatMoney(line.scheduled_value)}</p>
                      {(selectedContract.status === 'Draft' || selectedContract.status === 'Issued') && (
                        <button onClick={() => handleDeleteSovLine(line.id)} className="text-slate-600 hover:text-red-500 transition-colors"><X size={16}/></button>
                      )}
                    </div>
                  </div>
                ))}
                {selectedContract.sov_line_items?.length === 0 && <p className="text-slate-500 text-sm italic py-4">No schedule of values lines added yet.</p>}
              </div>

              {(selectedContract.status === 'Draft' || selectedContract.status === 'Issued') && (
                <form onSubmit={handleAddSovLine} className="bg-blue-950/10 border border-blue-900/30 p-6 rounded-[24px]">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <input required placeholder="Line Description (e.g. Rough-in, Final)" className="md:col-span-7 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={newSovDesc} onChange={(e) => setNewSovDesc(e.target.value)} />
                    <input required type="number" step="0.01" placeholder="Value" className="md:col-span-3 bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-black text-emerald-500 outline-none focus:border-blue-500" value={newSovAmount} onChange={(e) => setNewSovAmount(e.target.value)} />
                    <button type="submit" className="md:col-span-2 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase hover:bg-blue-600 transition-colors">Add</button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] p-20 flex flex-col items-center justify-center text-center">
               <LayoutGrid size={48} className="text-slate-800 mb-6" />
               <h3 className="text-2xl font-black text-slate-600 uppercase italic">Select Contract</h3>
               <p className="text-xs font-bold text-slate-500 mt-2">Click a contract on the left to edit its Schedule of Values.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Editor Overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #1e293b !important; padding: 1rem !important; background: #020617 !important; }
        .ql-container.ql-snow { border: none !important; font-family: inherit !important; }
        .ql-editor { min-height: 250px !important; color: #cbd5e1 !important; padding: 2rem !important; font-size: 14px; line-height: 1.6; }
        .ql-editor strong { color: white !important; }
        .ql-snow .ql-stroke { stroke: #64748b !important; }
        .ql-snow .ql-fill { fill: #64748b !important; }
        .ql-snow .ql-picker { color: #64748b !important; font-weight: bold; }
        .ql-editor h2 { margin-bottom: 0.5rem; text-transform: uppercase; font-size: 1.2rem; }
        .ql-editor h3 { margin-bottom: 0.5rem; margin-top: 1.5rem; text-transform: uppercase; font-size: 0.875rem; font-weight: 900; }
        .ql-editor p { margin-bottom: 1rem; }
        .ql-editor ul { list-style-type: disc !important; margin-left: 1.5rem !important; margin-bottom: 1rem; }
        .ql-editor ol { list-style-type: decimal !important; margin-left: 1.5rem !important; margin-bottom: 1rem; }
        .ql-editor li { padding-left: 0.5rem; margin-bottom: 0.25rem; }
        .quill-content p { margin-bottom: 0.75rem; }
        .quill-content h2 { margin-bottom: 0.5rem; margin-top: 1rem; font-size: 1.2rem; text-transform: uppercase; }
        .quill-content h3 { margin-bottom: 0.5rem; margin-top: 1.5rem; font-weight: 900; text-transform: uppercase; }
        .quill-content ul { list-style-type: disc; margin-left: 1.5rem; margin-bottom: 1rem; }
        .quill-content ol { list-style-type: decimal; margin-left: 1.5rem; margin-bottom: 1rem; }
        .quill-content strong { color: white; }
      `}} />
    </div>
  )
}