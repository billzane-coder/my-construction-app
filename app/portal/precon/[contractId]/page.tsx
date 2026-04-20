'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Building2, ShieldCheck, Upload, Plus, Trash2, 
  FileSignature, AlertCircle, Send, CheckCircle2,
  DollarSign, Calculator, Loader2
} from 'lucide-react'

export default function PreConPortal() {
  const { contractId } = useParams()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [contract, setContract] = useState<any>(null)
  
  // SOV State
  const [sovLines, setSovLines] = useState([{ id: Date.now(), description: '', amount: '' }])
  
  // Documents State
  const [files, setFiles] = useState<{ wsib: File | null, insurance: File | null, form1000: File | null }>({
    wsib: null, insurance: null, form1000: null
  })

  useEffect(() => {
    const fetchContract = async () => {
      const { data, error } = await supabase
        .from('project_contracts')
        .select(`
          *,
          trade:project_contacts(company, primary_contact, email),
          project:projects(name, location)
        `)
        .eq('id', contractId)
        .single()

      if (error || !data) {
        alert("Invalid or expired Pre-Con link.")
      } else {
        // Handle Supabase array flattening
        setContract({
          ...data,
          trade: Array.isArray(data.trade) ? data.trade[0] : data.trade,
          project: Array.isArray(data.project) ? data.project[0] : data.project
        })
      }
      setLoading(false)
    }

    if (contractId) fetchContract()
  }, [contractId])

  // --- SOV Math Engine ---
  const contractTotal = contract?.total_value || 0
  const allocatedTotal = sovLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0)
  const remaining = contractTotal - allocatedTotal
  const isBalanced = Math.abs(remaining) < 0.01 // Account for float rounding

  const handleSovChange = (id: number, field: string, value: string) => {
    setSovLines(lines => lines.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const addSovLine = () => {
    setSovLines([...sovLines, { id: Date.now(), description: '', amount: '' }])
  }

  const removeSovLine = (id: number) => {
    if (sovLines.length > 1) {
      setSovLines(lines => lines.filter(l => l.id !== id))
    }
  }

  const handleFileChange = (type: 'wsib' | 'insurance' | 'form1000', file: File | null) => {
    setFiles(prev => ({ ...prev, [type]: file }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 1. Strict Validation
    if (!isBalanced) return alert("Your Schedule of Values must perfectly match the Awarded Contract Total.")
    if (!files.wsib || !files.insurance || !files.form1000) return alert("All compliance documents are strictly required.")
    
    const hasEmptyLines = sovLines.some(l => !l.description.trim() || !parseFloat(l.amount))
    if (hasEmptyLines) return alert("Please fill out all descriptions and amounts in your SOV.")

    setSubmitting(true)

    try {
      const uploadPromises = []
      const docUrls: Record<string, string> = {}

      // 2. Upload Documents to Supabase
      for (const [key, file] of Object.entries(files)) {
        if (file) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${contract.trade.company.replace(/[^a-zA-Z0-9]/g, '')}-${key}-${Date.now()}.${fileExt}`
          const filePath = `${contract.project.name}/compliance/${fileName}`
          
          const uploadTask = supabase.storage.from('project-files').upload(filePath, file).then(({ error }) => {
            if (error) throw error
            const { data } = supabase.storage.from('project-files').getPublicUrl(filePath)
            docUrls[key] = data.publicUrl
          })
          uploadPromises.push(uploadTask)
        }
      }

      await Promise.all(uploadPromises)

      // 3. Save SOV Lines to the Database (This feeds your GC War Room!)
      const sovPayload = sovLines.map(line => ({
        contract_id: contract.id,
        item_number: line.id.toString().slice(-4), // Simple unique ref
        description: line.description,
        scheduled_value: parseFloat(line.amount),
        completed_value: 0
      }))

      const { error: sovError } = await supabase.from('sov_line_items').insert(sovPayload)
      if (sovError) throw sovError

      // 4. Update Contract Status & Attach Document Links
      const { error: contractError } = await supabase
        .from('project_contracts')
        .update({
          status: 'Pending Review', // Flips the status for the GC to approve
          documents: docUrls // Assuming you add a JSONB 'documents' column, or map to specific fields
        })
        .eq('id', contract.id)

      if (contractError) throw contractError

      // 5. Update UI state
      setContract({ ...contract, status: 'Pending Review' })

    } catch (err: any) {
      alert("Submission failed: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600 font-black animate-pulse uppercase tracking-widest">Loading Pre-Con Portal...</div>
  if (!contract) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Invalid Link. Please contact the General Contractor.</div>

  const isSubmitted = contract.status !== 'Draft'

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-2xl text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileSignature size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Pre-Con Package Submitted</h2>
          <p className="text-slate-500 text-sm mb-6">Your compliance documents and Schedule of Values are currently under review by the GC. You will be notified once approved.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      
      {/* HEADER */}
      <div className="bg-slate-950 text-white pt-12 pb-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-4 flex items-center gap-2">
            <Building2 size={14}/> {contract.project.name}
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4">
            Pre-Con <span className="text-slate-300">Onboarding</span>
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-sm font-bold">
            <span className="bg-white/10 px-4 py-2 rounded-lg">{contract.trade.company}</span>
            <span className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/30 flex items-center gap-2">
              <ShieldCheck size={16}/> Awarded: ${contractTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COL: COMPLIANCE UPLOADS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl border border-slate-100">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 mb-6"><ShieldCheck className="text-blue-600"/> Compliance Docs</h2>
            <p className="text-xs text-slate-500 mb-6">MOL and GC policy require all active documents before site access is granted.</p>

            <div className="space-y-4">
              <DocUploader label="WSIB Clearance Certificate" file={files.wsib} onChange={(f) => handleFileChange('wsib', f)} />
              <DocUploader label="Certificate of Insurance (Liability)" file={files.insurance} onChange={(f) => handleFileChange('insurance', f)} />
              <DocUploader label="Form 1000 (Notice of Project)" file={files.form1000} onChange={(f) => handleFileChange('form1000', f)} />
            </div>
          </div>
        </div>

        {/* RIGHT COL: SOV BUILDER */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-2xl border border-slate-100">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2"><Calculator className="text-blue-600"/> Schedule of Values</h2>
                <p className="text-xs text-slate-500 mt-1">Break down your awarded total. This will dictate your monthly progress billing.</p>
              </div>
              
              {/* Financial Balance Indicator */}
              <div className={`text-right p-3 rounded-xl border ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Variance</p>
                <p className={`text-lg font-black ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                  {remaining === 0 ? 'Balanced' : `${remaining > 0 ? '+' : '-'}$${Math.abs(remaining).toLocaleString()}`}
                </p>
              </div>
            </div>

            {/* SOV Grid */}
            <div className="space-y-3 mb-6">
              <div className="flex gap-4 px-2 hidden md:flex">
                <span className="text-[10px] font-black uppercase text-slate-400 flex-[3]">Line Description</span>
                <span className="text-[10px] font-black uppercase text-slate-400 flex-1">Value ($)</span>
                <span className="w-10"></span>
              </div>
              
              {sovLines.map((line, index) => (
                <div key={line.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="flex-[3] w-full">
                    <input 
                      type="text" 
                      value={line.description}
                      onChange={(e) => handleSovChange(line.id, 'description', e.target.value)}
                      placeholder={`e.g. Level ${index + 1} Rough-in`}
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1 w-full relative">
                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      value={line.amount}
                      onChange={(e) => handleSovChange(line.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 pl-8 p-3 rounded-xl text-sm font-black outline-none focus:border-blue-500"
                    />
                  </div>
                  <button 
                    onClick={() => removeSovLine(line.id)}
                    disabled={sovLines.length === 1}
                    className="w-10 h-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={addSovLine}
              className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-all mb-8 flex items-center justify-center gap-2"
            >
              <Plus size={14}/> Add Schedule Line
            </button>

            {/* Submission Footer */}
            <div className="border-t border-slate-100 pt-8 flex items-center justify-between">
              {!isBalanced && (
                <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={14}/> SOV must equal exactly ${contractTotal.toLocaleString()}
                </p>
              )}
              <button 
                onClick={handleSubmit}
                disabled={submitting || !isBalanced || !files.wsib || !files.insurance || !files.form1000}
                className="ml-auto bg-slate-950 hover:bg-blue-600 disabled:opacity-50 text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all flex items-center gap-2 shadow-xl"
              >
                {submitting ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                Submit Pre-Con Package
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

// Helper Component for Document Uploads
function DocUploader({ label, file, onChange }: { label: string, file: File | null, onChange: (f: File | null) => void }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">{label}</label>
      <label className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {file ? <CheckCircle2 className="text-blue-600 shrink-0" size={18}/> : <Upload className="text-slate-400 shrink-0" size={18}/>}
          <span className={`text-xs font-bold truncate ${file ? 'text-blue-900' : 'text-slate-500'}`}>
            {file ? file.name : 'Upload PDF...'}
          </span>
        </div>
        <input type="file" accept=".pdf" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
    </div>
  )
}