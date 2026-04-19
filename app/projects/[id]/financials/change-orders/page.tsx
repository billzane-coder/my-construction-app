'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FinancialHeader } from '../page'
import { Loader2, Plus, FileText, CheckCircle2, AlertCircle, UploadCloud, ExternalLink } from 'lucide-react'

export default function ChangeOrdersManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changeOrders, setChangeOrders] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  
  const [isAdding, setIsAdding] = useState(false)
  const [newCO, setNewCO] = useState<{ contract_id: string, title: string, description: string, amount: string, file: File | null }>({ contract_id: '', title: '', description: '', amount: '', file: null })
  
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetCoId, setTargetCoId] = useState<string | null>(null)

const fetchData = async () => {
    setLoading(true)
    try {
      const { data: activeContracts } = await supabase
        .from('project_contracts')
        .select('id, title, project_contacts!project_contracts_contact_id_fkey(company)')
        .eq('project_id', id)
        .eq('status', 'Active')
      
      const formattedContracts = activeContracts?.map(c => {
          const contactInfo: any = c.project_contacts;
          return { ...c, company: Array.isArray(contactInfo) ? contactInfo[0]?.company : contactInfo?.company }
      }) || []
      
      setContracts(formattedContracts)

      // FIXED: Removed '!inner' from project_contracts to prevent rows from disappearing
      const { data: cos } = await supabase
        .from('change_orders')
        .select('*, project_contracts(title, project_contacts!project_contracts_contact_id_fkey(company))')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      
      setChangeOrders(cos || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleSaveCO = async () => {
    if (!newCO.contract_id || !newCO.title) return alert("Contract and Title are required.")
    setSaving(true)
    
    let attachment_link = null;

    // 1. Upload the file first if one was selected in the form
    if (newCO.file) {
      const fileExt = newCO.file.name.split('.').pop()
      const fileName = `co_new_${Date.now()}.${fileExt}`
      const filePath = `${id}/${fileName}`
      
      const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, newCO.file)
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)
        attachment_link = publicUrl
      } else {
        console.error("File upload failed", uploadError)
        alert("Failed to upload document, but creating C.O. anyway.")
      }
    }

    // 2. Save the Change Order with the attachment link
    const { data: coData, error: coErr } = await supabase.from('change_orders').insert([{
      project_id: id,
      contract_id: newCO.contract_id,
      title: newCO.title,
      description: newCO.description,
      amount: parseFloat(newCO.amount) || 0,
      status: 'Pending',
      attachment_link: attachment_link
    }]).select().single()

    // FIXED: Bulletproof error handling that stops the form from erasing data if it fails
    if (coErr) {
      console.error("SUPABASE C.O. INSERT ERROR:", coErr);
      alert(`Database Error: ${coErr.message}`);
      setSaving(false);
      return; // Stop execution here so the form doesn't close
    } 
    
    if (coData) {
      const { data: contractRec } = await supabase.from('project_contracts').select('cost_code_id').eq('id', newCO.contract_id).single()
      
      if (contractRec) {
        const { error: sovErr } = await supabase.from('sov_line_items').insert([{
          contract_id: newCO.contract_id,
          cost_code_id: contractRec.cost_code_id,
          change_order_id: coData.id,
          description: `CO: ${newCO.title}`,
          scheduled_value: parseFloat(newCO.amount) || 0
        }])
        
        if (sovErr) console.error("SOV INSERT ERROR:", sovErr);
      }
    }
    
    // Only reset and close if everything succeeded
    setIsAdding(false)
    setNewCO({ contract_id: '', title: '', description: '', amount: '', file: null })
    setSaving(false)
    fetchData()
  }

  // Fallback inline uploader for existing rows
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !targetCoId) return
    
    setUploadingId(targetCoId)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `co_${targetCoId}_${Date.now()}.${fileExt}`
      const filePath = `${id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('project_documents').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath)

      await supabase.from('change_orders').update({ attachment_link: publicUrl }).eq('id', targetCoId)
      fetchData()
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`)
    }
    setUploadingId(null)
    setTargetCoId(null)
  }

  const triggerUpload = (coId: string) => {
    setTargetCoId(coId)
    setTimeout(() => fileInputRef.current?.click(), 100)
  }

  const handleUpdateStatus = async (coId: string, status: string) => {
    await supabase.from('change_orders').update({ status }).eq('id', coId)
    fetchData()
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      <FinancialHeader id={id} active="master" />
      
      <input type="file" accept=".pdf,.jpg,.png" onChange={handleUploadFile} ref={fileInputRef} className="hidden" />

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-amber-500">Change Orders</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Scope Revisions & Extras</p>
          </div>
          <button onClick={() => setIsAdding(!isAdding)} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
            <Plus size={16}/> New C.O.
          </button>
        </div>

        {isAdding && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] space-y-6 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Target Contract</label>
                <select value={newCO.contract_id} onChange={e => setNewCO({...newCO, contract_id: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl font-bold text-white outline-none focus:border-amber-500">
                  <option value="">Select an Active Contract...</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.company} - {c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">C.O. Amount (Pre-Tax)</label>
                <input type="number" placeholder="0.00" value={newCO.amount} onChange={e => setNewCO({...newCO, amount: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl font-bold text-amber-500 outline-none focus:border-amber-500" />
              </div>
              
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Title / Description</label>
                <input type="text" placeholder="e.g. Added 2 extra outlets in Kitchen" value={newCO.title} onChange={e => setNewCO({...newCO, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl font-bold text-white outline-none focus:border-amber-500" />
              </div>
              
              {/* NEW: ATTACHMENT UPLOAD IN THE FORM */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2">Backup Document (Optional)</label>
                <input 
                  type="file" 
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => setNewCO({...newCO, file: e.target.files?.[0] || null})}
                  className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-slate-400 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer transition-colors" 
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 border-t border-slate-800 pt-6">
              <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white text-[10px] font-black uppercase px-6 py-3">Cancel</button>
              <button onClick={handleSaveCO} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>} Create C.O.
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-800">
                <th className="p-6">Trade / Contract</th>
                <th className="p-6">Description</th>
                <th className="p-6 text-right">Amount</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-right">Backup Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {changeOrders.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold uppercase text-xs">No Change Orders Logged</td></tr>
              )}
{changeOrders.map(co => {
                // FIXED: Adjusted mapping to handle the relaxed LEFT JOIN
                const contractData: any = co.project_contracts;
                const contactData = contractData?.project_contacts;
                const companyName = Array.isArray(contactData) ? contactData[0]?.company : contactData?.company || 'Unknown Trade';
                
                return (
                  <tr key={co.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-6">
                      <p className="font-black text-white text-sm uppercase">{companyName}</p>
                      <p className="text-[10px] font-bold text-slate-500 truncate max-w-[200px]">{co.project_contracts?.title}</p>
                    </td>
                    <td className="p-6 text-slate-300 font-bold">{co.title}</td>
                    <td className="p-6 text-right font-black text-amber-500">{formatMoney(co.amount)}</td>
                    <td className="p-6 text-center">
                      <select 
                        value={co.status} 
                        onChange={(e) => handleUpdateStatus(co.id, e.target.value)}
                        className={`bg-slate-950 border p-2 rounded text-[10px] font-black uppercase outline-none cursor-pointer ${co.status === 'Approved' ? 'border-emerald-500 text-emerald-500' : co.status === 'Rejected' ? 'border-red-500 text-red-500' : 'border-amber-500 text-amber-500'}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="p-6 text-right">
                      {co.attachment_link ? (
                        <a href={co.attachment_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-blue-950/30 text-blue-400 hover:text-white px-3 py-2 rounded text-[10px] font-black uppercase transition-colors">
                          <ExternalLink size={14}/> View Backup
                        </a>
                      ) : (
                        <button onClick={() => triggerUpload(co.id)} disabled={uploadingId === co.id} className="inline-flex items-center gap-2 bg-slate-800 text-slate-400 hover:text-white px-3 py-2 rounded text-[10px] font-black uppercase transition-colors">
                          {uploadingId === co.id ? <Loader2 size={14} className="animate-spin"/> : <UploadCloud size={14}/>} Attach PDF
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}