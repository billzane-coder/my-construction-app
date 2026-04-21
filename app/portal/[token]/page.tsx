'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ShieldCheck, Calculator, UploadCloud, CheckCircle2, 
  AlertTriangle, Loader2, Send, FileText, Trash2, Plus, 
  DollarSign, FileSpreadsheet, FileSignature, Clock, X
} from 'lucide-react'

export default function SubcontractorPortal() {
  const { token } = useParams()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<any>(null)
  
  // Trade & Contract State
  const [trade, setTrade] = useState<any>(null)
  const [contract, setContract] = useState<any>(null)
  const [sovLines, setSovLines] = useState<any[]>([])
  const [changeOrders, setChangeOrders] = useState<any[]>([]) // NEW: Change Orders State
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'precon' | 'billing' | 'cos'>('precon')

  // Form States
  const [uploading, setUploading] = useState<string | null>(null)
  const [newSov, setNewSov] = useState({ item_number: '', description: '', scheduled_value: '' })
  const [submitting, setSubmitting] = useState(false)
  const [drawInputs, setDrawInputs] = useState<Record<string, string>>({})
  
  // New CO Form State
  const [showCOForm, setShowCOForm] = useState(false)
  const [newCO, setNewCO] = useState({ title: '', description: '', requested_amount: '' })

  useEffect(() => {
    const authenticateAndFetch = async () => {
      try {
        const { data: brand } = await supabase.from('company_settings').select('*').eq('id', 1).single()
        if (brand) setSettings(brand)

        const { data: linkInfo } = await supabase.from('magic_links').select('email, expires_at').eq('token', token).single()
        if (!linkInfo) throw new Error("Invalid or expired access link.")
        if (new Date(linkInfo.expires_at) < new Date()) throw new Error("This link has expired. Please request a new one.")

        const { data: subData } = await supabase.from('subcontractors').select('*').eq('email', linkInfo.email).single()
        if (!subData) throw new Error("Trade profile not found.")
        setTrade(subData)

        const { data: contractData } = await supabase
          .from('project_contracts')
          .select('*, projects(name)')
          .neq('status', 'Completed')
          .limit(1)
          .single()

        if (contractData) {
          setContract({ ...contractData, documents: contractData.documents || {} })
          
          const [linesRes, coRes] = await Promise.all([
            supabase.from('sov_line_items').select('*').eq('contract_id', contractData.id).order('item_number'),
            supabase.from('change_orders').select('*').eq('contract_id', contractData.id).order('created_at', { ascending: false })
          ])
          
          setSovLines(linesRes.data || [])
          setChangeOrders(coRes.data || [])

          if (contractData.status === 'Active') {
            setActiveTab('billing')
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    authenticateAndFetch()
  }, [token])

  // --- PRE-CON & BILLING ACTIONS (Unchanged) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0]
    if (!file || !contract) return
    setUploading(docType)
    const filePath = `contracts/${contract.id}/${docType}-${Date.now()}.${file.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, file)
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(filePath)
      const updatedDocs = { ...contract.documents, [docType]: publicUrl }
      await supabase.from('project_contracts').update({ documents: updatedDocs }).eq('id', contract.id)
      setContract({ ...contract, documents: updatedDocs })
    }
    setUploading(null)
  }

  const handleAddSovLine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSov.description || !newSov.scheduled_value || !contract) return
    const payload = { contract_id: contract.id, item_number: newSov.item_number || (sovLines.length + 1).toString(), description: newSov.description, scheduled_value: parseFloat(newSov.scheduled_value) }
    const { data, error } = await supabase.from('sov_line_items').insert([payload]).select().single()
    if (!error && data) { setSovLines([...sovLines, data]); setNewSov({ item_number: '', description: '', scheduled_value: '' }) }
  }

  const handleDeleteSovLine = async (id: string) => {
    await supabase.from('sov_line_items').delete().eq('id', id)
    setSovLines(sovLines.filter(l => l.id !== id))
  }

  const handleSubmitToGC = async () => {
    if (!confirm("Are you ready to submit your Pre-Con package for approval?")) return
    setSubmitting(true)
    await supabase.from('project_contracts').update({ status: 'Pending Review' }).eq('id', contract.id)
    setContract({ ...contract, status: 'Pending Review' })
    setSubmitting(false)
  }

  const handleDrawInputChange = (lineId: string, value: string, maxLimit: number) => {
    const numericValue = Number(value)
    if (numericValue > maxLimit) setDrawInputs({ ...drawInputs, [lineId]: maxLimit.toString() })
    else setDrawInputs({ ...drawInputs, [lineId]: value })
  }

  const handleSubmitDraw = async () => {
    const drawTotal = Object.values(drawInputs).reduce((sum, val) => sum + Number(val || 0), 0)
    if (drawTotal <= 0) return alert("Please enter an amount to bill for this period.")
    if (!confirm(`Submit Invoice for $${drawTotal.toLocaleString()}?`)) return
    setSubmitting(true)
    try {
      const { data: drawData, error: drawError } = await supabase.from('project_draws').insert([{ project_id: contract.project_id, contract_id: contract.id, total_amount: drawTotal }]).select().single()
      if (drawError) throw drawError
      const linesToInsert = Object.entries(drawInputs).filter(([_, amount]) => Number(amount) > 0).map(([sovId, amount]) => ({ draw_id: drawData.id, sov_line_id: sovId, amount_this_period: Number(amount) }))
      await supabase.from('draw_line_items').insert(linesToInsert)
      alert("Invoice submitted successfully! The GC will review it shortly.")
      setDrawInputs({})
    } catch (err: any) { alert("Error submitting draw: " + err.message) }
    setSubmitting(false)
  }

  // --- NEW: CHANGE ORDER ACTIONS ---
  const handleSubmitCO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCO.title || !newCO.requested_amount) return alert("Title and Amount are required.")
    
    setSubmitting(true)
    const payload = {
      project_id: contract.project_id,
      contract_id: contract.id,
      title: newCO.title,
      description: newCO.description,
      requested_amount: parseFloat(newCO.requested_amount),
      status: 'Submitted'
    }

    const { data, error } = await supabase.from('change_orders').insert([payload]).select().single()
    
    if (error) {
      alert("Failed to submit Change Order: " + error.message)
    } else if (data) {
      setChangeOrders([data, ...changeOrders])
      setNewCO({ title: '', description: '', requested_amount: '' })
      setShowCOForm(false)
    }
    setSubmitting(false)
  }

  const totalSov = sovLines.reduce((sum, line) => sum + Number(line.scheduled_value), 0)
  const currentDrawTotal = Object.values(drawInputs).reduce((sum, val) => sum + Number(val || 0), 0)
  
  // CO Math
  const approvedCOTotal = changeOrders.filter(co => co.status === 'Approved').reduce((sum, co) => sum + Number(co.approved_amount || 0), 0)
  const pendingCOTotal = changeOrders.filter(co => co.status === 'Submitted' || co.status === 'Under Review').reduce((sum, co) => sum + Number(co.requested_amount || 0), 0)
  
  const isLocked = contract?.status === 'Active' || contract?.status === 'Pending Review'

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Securing Connection...</div>
  if (error) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle size={64} className="text-red-500 mb-6" />
      <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Access Denied</h1>
      <p className="text-slate-400 font-bold max-w-md">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 md:px-12 h-20 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="GC Logo" className="h-10 object-contain" />
          ) : (
            <ShieldCheck size={28} style={{ color: settings?.primary_color || '#3b82f6' }} />
          )}
          <div className="hidden md:block border-l border-slate-700 h-8 mx-2" />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-white leading-none">{trade?.company_name}</h1>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Subcontractor Portal</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Project</p>
          <p className="text-sm font-black text-white uppercase">{contract?.projects?.name || 'Unassigned'}</p>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8">
        
        {/* STATUS BANNER & TABS */}
        <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl gap-6 ${
          contract?.status === 'Draft' ? 'bg-blue-950/30 border-blue-900/50' :
          contract?.status === 'Pending Review' ? 'bg-amber-950/30 border-amber-900/50' :
          'bg-emerald-950/30 border-emerald-900/50'
        }`}>
          <div>
            <h2 className="text-xl font-black uppercase text-white mb-1">
              {contract?.status === 'Draft' ? 'Action Required: Pre-Con Setup' : 
               contract?.status === 'Pending Review' ? 'Under GC Review' : 
               'Contract Active'}
            </h2>
            <p className="text-xs font-bold text-slate-400">
              {contract?.status === 'Draft' ? 'Please upload your compliance documents and build your Schedule of Values below.' : 
               contract?.status === 'Pending Review' ? 'Your package has been submitted to the General Contractor for approval.' : 
               'Your contract is fully executed. You may submit progress draws against your approved SOV.'}
            </p>
          </div>
          
          <div className="flex flex-wrap bg-slate-900 p-1 border border-slate-800 rounded-xl w-full md:w-auto shrink-0">
            <button onClick={() => setActiveTab('precon')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'precon' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-white'}`}>
              Compliance & SOV
            </button>
            <button onClick={() => setActiveTab('billing')} disabled={contract?.status !== 'Active'} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'billing' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-white'} disabled:opacity-30 disabled:cursor-not-allowed`}>
              Submit Draw
            </button>
            <button onClick={() => setActiveTab('cos')} disabled={contract?.status !== 'Active'} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cos' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-white'} disabled:opacity-30 disabled:cursor-not-allowed`}>
              Change Orders
            </button>
          </div>
        </div>

        {/* --- TAB: PRE-CON SETUP --- */}
        {activeTab === 'precon' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
            <div className="lg:col-span-1 space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldCheck size={16} style={{ color: settings?.primary_color || '#3b82f6' }}/> Compliance Vault
              </h3>
              <div className="space-y-4">
                <DocUploader title="WSIB / Workers Comp" docKey="wsib" url={contract?.documents?.wsib} onUpload={handleFileUpload} uploading={uploading === 'wsib'} isLocked={isLocked} color={settings?.primary_color} />
                <DocUploader title="Liability Insurance" docKey="insurance" url={contract?.documents?.insurance} onUpload={handleFileUpload} uploading={uploading === 'insurance'} isLocked={isLocked} color={settings?.primary_color} />
                <DocUploader title="Signed Form 1000" docKey="form1000" url={contract?.documents?.form1000} onUpload={handleFileUpload} uploading={uploading === 'form1000'} isLocked={isLocked} color={settings?.primary_color} />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Calculator size={16} style={{ color: settings?.primary_color || '#3b82f6' }}/> Schedule of Values
                </h3>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Contract Value</p>
                  <p className="text-2xl font-black text-white">${totalSov.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                      <th className="p-4 w-20">Item</th>
                      <th className="p-4">Description of Work</th>
                      <th className="p-4 text-right">Value ($)</th>
                      {!isLocked && <th className="p-4 w-12"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sovLines.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-sm font-bold text-slate-600 uppercase">No line items added yet.</td></tr>
                    ) : (
                      sovLines.map(line => (
                        <tr key={line.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 text-xs font-black text-slate-400">{line.item_number}</td>
                          <td className="p-4 text-sm font-bold text-white">{line.description}</td>
                          <td className="p-4 text-sm font-black text-blue-400 text-right">${Number(line.scheduled_value).toLocaleString()}</td>
                          {!isLocked && (
                            <td className="p-4 text-right">
                              <button onClick={() => handleDeleteSovLine(line.id)} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                    
                    {!isLocked && (
                      <tr className="bg-slate-950/50">
                        <td className="p-3"><input className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none" placeholder="1.0" value={newSov.item_number} onChange={e => setNewSov({...newSov, item_number: e.target.value})} /></td>
                        <td className="p-3"><input className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none" placeholder="Description..." value={newSov.description} onChange={e => setNewSov({...newSov, description: e.target.value})} /></td>
                        <td className="p-3"><input type="number" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white text-right outline-none" placeholder="0.00" value={newSov.scheduled_value} onChange={e => setNewSov({...newSov, scheduled_value: e.target.value})} /></td>
                        <td className="p-3 text-center"><button onClick={handleAddSovLine} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-colors shadow-lg"><Plus size={16}/></button></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {contract?.status === 'Draft' && !isLocked && (
                <div className="pt-4 flex justify-end">
                  <button onClick={handleSubmitToGC} disabled={submitting} className="w-full md:w-auto bg-white text-black px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit Package to GC
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: MONTHLY BILLING / DRAWS --- */}
        {activeTab === 'billing' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-end border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <FileSpreadsheet size={16} style={{ color: settings?.primary_color || '#3b82f6' }}/> Application for Payment
              </h3>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                      <th className="p-5 w-16">Item</th>
                      <th className="p-5">Description of Work</th>
                      <th className="p-5 text-right w-40">Scheduled Value</th>
                      <th className="p-5 text-right w-48 bg-slate-900/50">Amount This Period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {sovLines.map(line => (
                      <tr key={line.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-5 text-xs font-black text-slate-400">{line.item_number}</td>
                        <td className="p-5 text-sm font-bold text-white">{line.description}</td>
                        <td className="p-5 text-sm font-black text-slate-300 text-right">${Number(line.scheduled_value).toLocaleString()}</td>
                        <td className="p-3 bg-slate-900/50 border-l border-slate-800/50">
                          <div className="relative">
                            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="number" 
                              placeholder="0.00"
                              value={drawInputs[line.id] || ''}
                              onChange={(e) => handleDrawInputChange(line.id, e.target.value, Number(line.scheduled_value))}
                              className="w-full bg-slate-950 border border-slate-700 pl-8 pr-4 py-3 rounded-xl text-sm font-bold text-white text-right outline-none focus:border-blue-500 transition-colors"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-950 border-t-2 border-slate-800">
                      <td colSpan={2} className="p-6 text-right text-xs font-black uppercase tracking-widest text-slate-500">Totals:</td>
                      <td className="p-6 text-right text-base font-black text-white">${totalSov.toLocaleString()}</td>
                      <td className="p-6 text-right text-xl font-black text-emerald-400 bg-emerald-950/20 border-l border-slate-800/50">${currentDrawTotal.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={handleSubmitDraw}
                disabled={submitting || currentDrawTotal <= 0}
                className="w-full md:w-auto text-white px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: settings?.primary_color || '#3b82f6' }}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Submit Invoice for ${currentDrawTotal.toLocaleString()}
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: CHANGE ORDERS --- */}
        {activeTab === 'cos' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <FileSignature size={16} style={{ color: settings?.primary_color || '#3b82f6' }}/> Change Order Log
                </h3>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex-1 md:flex-none text-center md:text-right">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Pending Review</p>
                  <p className="text-lg font-black text-amber-500">${pendingCOTotal.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex-1 md:flex-none text-center md:text-right">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Approved Total</p>
                  <p className="text-lg font-black text-emerald-500">${approvedCOTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Request New CO Form Toggle */}
            {!showCOForm ? (
              <button 
                onClick={() => setShowCOForm(true)}
                className="w-full border-2 border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-900 p-6 rounded-3xl text-slate-400 hover:text-white transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="bg-slate-800 group-hover:bg-blue-600 p-3 rounded-full transition-colors text-white">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">Submit New Change Order Request</span>
              </button>
            ) : (
              <div className="bg-slate-900 border border-blue-500/30 p-6 md:p-8 rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowCOForm(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white bg-slate-950 rounded-lg"><X size={16}/></button>
                <h4 className="text-lg font-black uppercase italic text-white mb-6">New Change Order Request</h4>
                <form onSubmit={handleSubmitCO} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-2">COR Title / Subject</label>
                      <input 
                        required placeholder="e.g. Additional Framing at Elevator Shaft"
                        value={newCO.title} onChange={e => setNewCO({...newCO, title: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-2">Requested Amount ($)</label>
                      <input 
                        required type="number" step="0.01" placeholder="0.00"
                        value={newCO.requested_amount} onChange={e => setNewCO({...newCO, requested_amount: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-blue-400 text-right outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-2">Detailed Scope of Work / Justification</label>
                    <textarea 
                      placeholder="Describe the out-of-scope work, materials, and labor required..."
                      value={newCO.description} onChange={e => setNewCO({...newCO, description: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 min-h-[100px] resize-none"
                    />
                  </div>
                  <div className="pt-4 flex justify-end">
                    <button 
                      type="submit" disabled={submitting}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit Request to GC
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CO Ledger */}
            <div className="space-y-4 pt-4">
              {changeOrders.length === 0 ? (
                <div className="text-center p-8 border border-slate-800 rounded-3xl bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No Change Orders Submitted</p>
                </div>
              ) : (
                changeOrders.map(co => (
                  <div key={co.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {co.status === 'Submitted' || co.status === 'Under Review' ? <Clock size={16} className="text-amber-500" /> : 
                         co.status === 'Approved' ? <CheckCircle2 size={16} className="text-emerald-500" /> : 
                         <AlertTriangle size={16} className="text-red-500" />}
                        <h4 className="text-sm font-black text-white uppercase">{co.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                          co.status === 'Approved' ? 'bg-emerald-950/50 text-emerald-500 border-emerald-900' :
                          co.status === 'Rejected' ? 'bg-red-950/50 text-red-500 border-red-900' :
                          'bg-amber-950/50 text-amber-500 border-amber-900'
                        }`}>
                          {co.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 line-clamp-2 pr-4">{co.description || 'No description provided.'}</p>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-3">
                        Submitted: {new Date(co.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right bg-slate-950 p-4 rounded-xl border border-slate-800 w-full md:w-48">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        {co.status === 'Approved' ? 'Approved Amount' : 'Requested Amount'}
                      </p>
                      <p className={`text-xl font-black ${co.status === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        ${Number(co.status === 'Approved' ? co.approved_amount : co.requested_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DocUploader({ title, docKey, url, onUpload, uploading, isLocked, color }: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between group">
      <div>
        <p className="text-xs font-black uppercase text-white mb-1 flex items-center gap-2">
          {url ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
          {title}
        </p>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          {url ? 'Verified & Stored' : 'Action Required'}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <FileText size={16} />
          </a>
        )}
        
        {!isLocked && (
          <div className="relative">
            <button className="p-3 rounded-xl text-white transition-all flex items-center justify-center shadow-lg" style={{ backgroundColor: color || '#3b82f6' }}>
              {uploading ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>}
            </button>
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={(e) => onUpload(e, docKey)}
              disabled={uploading || isLocked}
            />
          </div>
        )}
      </div>
    </div>
  )
}