'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { 
  Save, ChevronLeft, DollarSign, 
  Loader2, UploadCloud, FileSignature, CheckCircle2,
  UserPlus, FileText
} from 'lucide-react'

// Dynamic import for ReactQuill to prevent Next.js SSR crashes
const ReactQuill = dynamicImport(() => import('react-quill-new'), { 
  ssr: false,
  loading: () => <div className="h-64 w-full bg-slate-950 animate-pulse rounded-[32px] border border-slate-800" />
})
import 'react-quill-new/dist/quill.snow.css'

export default function NewCommitment() {
  const { id } = useParams()
  const router = useRouter()
  
  const [type, setType] = useState('PO')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [roster, setRoster] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])
  const [showNewSub, setShowNewSub] = useState(false)
  const [newSubName, setNewSubName] = useState('')
  
  const [formData, setFormData] = useState({
    subcontractor_id: '',
    cost_code_id: '',
    ref: '',
    value: 0,
    scope: '',
    status: 'Issued',
    signed_by: ''
  })

  const ccdc17Template = `
    <h2 style="color: #10b981; font-family: sans-serif; text-transform: uppercase;">Articles of Agreement</h2>
    <p>This agreement is made to reflect the standard terms of the <strong>CCDC-17 Stipulated Price Trade Contract</strong>.</p>
    
    <br/>
    <h3 style="color: #3b82f6;">ARTICLE A-1: THE WORK</h3>
    <p>The Trade Contractor shall perform the Work required by the Trade Contract Documents for the following detailed scope:</p>
    <ul>
      <li><strong>Inclusions:</strong> [Type specific inclusions here...]</li>
      <li><strong>Exclusions:</strong> [Type specific exclusions here...]</li>
      <li><strong>Schedule:</strong> Work must commence on [Start Date] and be substantially performed by [End Date].</li>
    </ul>

    <br/>
    <h3 style="color: #3b82f6;">ARTICLE A-4: TRADE CONTRACT PRICE</h3>
    <p>The Trade Contract Price, which excludes Value Added Taxes, is: <strong>$[Insert Numeric Value]</strong>.</p>
    <p>This price is firm and stipulated. No variations will be accepted without a formally executed Change Order (CCDC-10).</p>

    <br/>
    <h3 style="color: #3b82f6;">ARTICLE A-5: PAYMENT & HOLDBACKS</h3>
    <p><strong>5.1</strong> Subject to the provisions of the Trade Contract Documents, and in accordance with the provincial Construction Act respecting holdback percentages, the Contractor shall pay the Trade Contractor.</p>
    <p><strong>5.2</strong> The statutory holdback shall be <strong>10%</strong>.</p>
    <p><strong>5.3</strong> Payment applications must be submitted by the 25th of the month. Payment is due within 30 days of the Contractor receiving payment from the Owner (Pay-when-Paid).</p>

    <br/>
    <h3 style="color: #3b82f6;">SUPPLEMENTARY CONDITIONS</h3>
    <p>By executing this agreement, the Trade Contractor agrees to provide the following prior to mobilization:</p>
    <ol>
      <li>Current WSIB Clearance Certificate.</li>
      <li>Certificate of Commercial General Liability Insurance (Min $2,000,000).</li>
      <li>Signed Form 1000 and Corporate Health & Safety Policy.</li>
    </ol>
  `

  useEffect(() => {
    async function fetchData() {
      const [subRes, codeRes] = await Promise.all([
        supabase.from('project_contacts').select('*').eq('project_id', id).order('company'),
        supabase.from('project_cost_codes').select('*').eq('project_id', id).order('code')
      ])
      if (subRes.data) setRoster(subRes.data)
      if (codeRes.data) setCostCodes(codeRes.data)
    }
    fetchData()
  }, [id])

  useEffect(() => {
    if (type === 'CCDC-17' && (!formData.scope || formData.scope === '<p><br></p>')) {
      setFormData(prev => ({ ...prev, scope: ccdc17Template }))
    } 
    else if (type === 'PO' && formData.scope === ccdc17Template) {
      setFormData(prev => ({ ...prev, scope: '' }))
    }
  }, [type])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0])
  }

  const handleQuickAddSub = async () => {
    if (!newSubName) return
    setLoading(true)
    const { data, error } = await supabase.from('project_contacts')
      .insert([{ project_id: id, company: newSubName }])
      .select().single()
    
    if (!error && data) {
      setRoster([...roster, data])
      setFormData(prev => ({ ...prev, subcontractor_id: data.id }))
      setShowNewSub(false)
      setNewSubName('')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!formData.ref || formData.value <= 0 || !formData.subcontractor_id || !formData.cost_code_id) {
      return alert("Missing requirements: Contractor, Cost Code, Reference #, and Value are required.")
    }

    setLoading(true)
    let documentUrl = null

    try {
      if (file) {
        const fileExt = file.name.split('.').pop()
        const path = `${id}/commitments/${Date.now()}-${formData.ref.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path)
          documentUrl = publicUrl
        }
      }

      const isExecuted = formData.status === 'Executed' || formData.signed_by.length > 0

      const { data: contract, error: dbError } = await supabase.from('project_contracts').insert([{
        project_id: id,
        contact_id: formData.subcontractor_id,
        cost_code_id: formData.cost_code_id,
        status: isExecuted ? 'Executed' : formData.status,
        total_value: formData.value,
        scope_of_work: formData.scope,
        title: formData.ref,
        document_url: documentUrl,
        signed_by: formData.signed_by || null,
        signed_at: formData.signed_by ? new Date().toISOString() : null
      }]).select().single()

      if (dbError) throw dbError

      await supabase.from('sov_line_items').insert([{
        contract_id: contract.id,
        description: `Original ${type}: ${formData.ref}`,
        scheduled_value: formData.value,
        cost_code_id: formData.cost_code_id
      }])

      router.push(`/projects/${id}/financials/contracts`)
    } catch (error: any) {
      alert("Failed to issue commitment. " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 overflow-x-hidden pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ChevronLeft size={20}/> Cancel
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-emerald-600 pb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Issue <span className="text-emerald-500">Commitment</span>
            </h1>
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            {['PO', 'Simple', 'CCDC-17'].map((t) => (
              <button key={t} onClick={() => setType(t)} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-950 p-6 rounded-3xl border border-blue-900/30">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 flex justify-between">
                    Contractor <span className="text-red-500">*</span>
                    <button onClick={() => setShowNewSub(!showNewSub)} className="text-blue-500 hover:text-white flex items-center gap-1"><UserPlus size={10}/> New</button>
                  </label>
                  {showNewSub ? (
                    <div className="flex gap-2">
                      <input autoFocus type="text" placeholder="Company Name..." value={newSubName} onChange={e => setNewSubName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-sm outline-none" />
                      <button onClick={handleQuickAddSub} className="bg-blue-600 px-4 rounded-xl text-xs font-bold hover:bg-blue-500">Add</button>
                    </div>
                  ) : (
                    <select value={formData.subcontractor_id} onChange={(e) => setFormData(prev => ({ ...prev, subcontractor_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-sm font-bold">
                      <option value="">Select Contractor...</option>
                      {roster.map(sub => <option key={sub.id} value={sub.id}>{sub.company}</option>)}
                    </select>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 block flex items-center gap-1">
                    Cost Code (Ledger Tie-In) <span className="text-red-500">*</span>
                  </label>
                  <select value={formData.cost_code_id} onChange={(e) => setFormData(prev => ({ ...prev, cost_code_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-bold">
                    <option value="">Select WBS Category...</option>
                    {costCodes.map(code => <option key={code.id} value={code.id}>{code.code} - {code.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Reference # <span className="text-red-500">*</span></label>
                  <input type="text" placeholder={type === 'PO' ? "PO-1001" : "CONT-202"} value={formData.ref} onChange={(e) => setFormData(prev => ({ ...prev, ref: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 font-bold text-white"/>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Total Value <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18}/>
                    <input type="number" value={formData.value || ''} onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) }))} className="w-full bg-slate-950 border border-slate-800 pl-12 p-4 rounded-2xl outline-none focus:border-emerald-500 font-black text-emerald-400 text-lg"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-500 block flex items-center gap-2">
                  <FileText size={14}/> Contract Document Editor
                </label>
                <div className="bg-slate-950 rounded-[32px] overflow-hidden border border-slate-800 focus-within:border-emerald-500 transition-all">
                  <ReactQuill theme="snow" value={formData.scope} onChange={(val) => setFormData(prev => ({ ...prev, scope: val }))} className="text-white min-h-[350px]"/>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-6 shadow-2xl sticky top-8">
              <h3 className="text-[10px] font-black uppercase text-blue-500 mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                <FileSignature size={16}/> Execution Hub
              </h3>
              
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block">Attach Signed PDF</label>
                  <label className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center p-8 cursor-pointer transition-all ${file ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 bg-slate-950 hover:border-blue-500'}`}>
                    {file ? <CheckCircle2 className="text-emerald-500" size={32}/> : <UploadCloud className="text-slate-500" size={32}/>}
                    <span className="text-[10px] font-black uppercase mt-2 text-slate-500 text-center max-w-full truncate px-2">{file ? file.name : 'Upload PDF'}</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Digital Signature</label>
                  <input type="text" placeholder="Type Name to Sign..." value={formData.signed_by} onChange={(e) => setFormData(prev => ({ ...prev, signed_by: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-blue-400 font-serif italic text-lg shadow-inner"/>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 block">Force Status</label>
                  <select value={formData.signed_by ? 'Executed' : formData.status} disabled={formData.signed_by.length > 0} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-bold disabled:opacity-50">
                    <option value="Draft">Draft</option>
                    <option value="Issued">Issued</option>
                    <option value="Executed">Executed</option>
                  </select>
                </div>

                <button onClick={handleSave} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] py-6 rounded-[32px] transition-all flex items-center justify-center gap-4 shadow-2xl disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" size={24}/> : <Save size={24} />}
                  {loading ? 'Processing...' : `Issue ${type}`}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #1e293b !important; padding: 1rem !important; background: #020617 !important; }
        .ql-container.ql-snow { border: none !important; font-family: inherit !important; }
        .ql-editor { min-height: 350px !important; color: #cbd5e1 !important; padding: 2rem !important; font-size: 14px; line-height: 1.6; }
        .ql-editor strong { color: #fff !important; }
        .ql-snow .ql-stroke { stroke: #64748b !important; }
        .ql-snow .ql-fill { fill: #64748b !important; }
        .ql-snow .ql-picker { color: #64748b !important; font-weight: bold; }
        .ql-editor h2 { color: #10b981 !important; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 1rem; tracking: 0.1em; }
        .ql-editor h3 { color: #3b82f6 !important; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.875rem; tracking: 0.1em; }
        .ql-editor p { margin-bottom: 1rem; }
        .ql-editor ul, .ql-editor ol { margin-bottom: 1rem; padding-left: 1.5rem; }
      `}} />
    </div>
  )
}