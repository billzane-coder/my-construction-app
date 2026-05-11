'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  Save, ChevronLeft, ShieldCheck, DollarSign, 
  Loader2, UploadCloud, FileSignature, CheckCircle2, File
} from 'lucide-react'

export default function NewCommitment() {
  const { id } = useParams()
  const router = useRouter()
  
  // --- STATES ---
  const [type, setType] = useState('PO')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [formData, setFormData] = useState({
    sub_id: '',
    ref: '',
    value: 0,
    scope: '',
    terms: '',
    status: 'Draft',
    signed_by: ''
  })

  // --- HANDLERS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleSave = async () => {
    if (!formData.ref || formData.value <= 0) {
      return alert("Please provide a Reference # and Total Value.")
    }

    setLoading(true)
    let documentUrl = null

    try {
      // 1. Upload File if attached
      if (file) {
        const fileExt = file.name.split('.').pop()
        const path = `${id}/commitments/${Date.now()}-${formData.ref.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`
        
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file)
        if (uploadErr) throw new Error("Document upload failed: " + uploadErr.message)
        
        const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(path)
        documentUrl = publicUrl
      }

      // 2. Determine execution status
      const isExecuted = formData.status === 'Executed' || formData.signed_by.length > 0

      // 3. Save to Database
      const { error: dbError } = await supabase.from('project_commitments').insert([{
        project_id: id,
        contract_type: type,
        subcontractor_id: formData.sub_id || null, // Optional if just a generic PO
        reference_number: formData.ref,
        total_value: formData.value,
        scope_of_work: formData.scope,
        terms_conditions: type === 'CCDC-17' ? 'Standard CCDC-17 Statutory Terms Apply.' : formData.terms,
        status: isExecuted ? 'Executed' : formData.status,
        document_url: documentUrl,
        signed_by: formData.signed_by || null,
        signed_at: formData.signed_by ? new Date().toISOString() : null
      }])

      if (dbError) throw dbError

      alert(`${type} Issued Successfully!`)
      router.back()

    } catch (error: any) {
      console.error("Save Error:", error)
      alert(error.message || "Failed to issue commitment.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 overflow-x-hidden pb-32">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ChevronLeft size={20}/> Back to Financials
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-emerald-600 pb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">
              Issue <span className="text-emerald-500">Commitment</span>
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Financial Control Module</p>
          </div>
          
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
            {['PO', 'Simple', 'CCDC-17'].map((t) => (
              <button 
                key={t}
                onClick={() => setType(t)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${type === t ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN FORM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMN 1 & 2: Details & Scope */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Reference # <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder={type === 'PO' ? "PO-1001" : "CONT-202"}
                    value={formData.ref}
                    onChange={(e) => setFormData({...formData, ref: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Total Value (Excl. Tax) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18}/>
                    <input 
                      type="number" 
                      value={formData.value || ''}
                      onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 pl-12 p-4 rounded-2xl outline-none focus:border-emerald-500 font-black text-emerald-400 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Detailed Scope of Work</label>
                <textarea 
                  rows={6}
                  value={formData.scope}
                  onChange={(e) => setFormData({...formData, scope: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 p-6 rounded-[24px] outline-none focus:border-emerald-500 transition-all resize-none text-sm text-slate-300"
                  placeholder="Describe exactly what is being purchased or contracted..."
                />
              </div>
            </div>
          </div>

          {/* COLUMN 3: Execution & Documents */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-xl">
              <h3 className="text-[10px] font-black uppercase text-blue-500 mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                <FileSignature size={16}/> Execution & Documents
              </h3>

              <div className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Attach Signed PDF</label>
                  <label className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 p-6 cursor-pointer transition-all ${file ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-950 hover:border-blue-500'}`}>
                    {file ? (
                      <>
                        <File className="text-emerald-500" size={28}/>
                        <span className="text-xs font-bold text-emerald-500 truncate max-w-full px-4">{file.name}</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="text-slate-500" size={28}/>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upload Document</span>
                      </>
                    )}
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                {/* Digital Signature */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Digital Signature (Type Name)</label>
                  <input 
                    type="text" 
                    placeholder="Authorized Signatory Name..."
                    value={formData.signed_by}
                    onChange={(e) => setFormData({...formData, signed_by: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-blue-400 italic"
                  />
                  {formData.signed_by && (
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-1">
                      <CheckCircle2 size={10} className="text-emerald-500"/> Legally binding signature attached
                    </p>
                  )}
                </div>

                {/* Status Override */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Force Status</label>
                  <select 
                    value={formData.signed_by ? 'Executed' : formData.status}
                    disabled={formData.signed_by.length > 0}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-emerald-500 text-sm font-bold disabled:opacity-50"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Issued">Issued</option>
                    <option value="Executed">Executed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Legal Warning Panel */}
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-[32px] p-6">
              <h3 className="text-emerald-500 font-black uppercase text-[10px] mb-3 flex items-center gap-2">
                <ShieldCheck size={14}/> {type} Compliance
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                {type === 'CCDC-17' 
                  ? "By executing this CCDC-17 contract, you ensure standard statutory holdbacks and WSIB clearances are legally enforced." 
                  : "Standard material purchasing terms apply. Ensure total value matches trade quote."}
              </p>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="pt-8">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-5 rounded-[24px] transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
            {loading ? 'Processing Document...' : `Finalize & Issue ${type}`}
          </button>
        </div>

      </div>
    </div>
  )
}