'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Building2, CheckCircle2, XCircle, FileText, 
  Upload, DollarSign, Calendar, Send, 
  CheckSquare, ShieldCheck, Clock, Loader2
} from 'lucide-react'

export default function TradeBidPortal() {
  const { inviteId } = useParams()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invite, setInvite] = useState<any>(null)
  
  // Form State
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  // UI State
  const [checkedInclusions, setCheckedInclusions] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const fetchPortalData = async () => {
      const { data, error } = await supabase
        .from('bid_invitations')
        .select(`
          *,
          trade:project_contacts(company, primary_contact),
          pkg:bid_packages(
            title, division_code, base_scope, inclusions, exclusions, due_date, status,
            project:projects(name, location)
          )
        `)
        .eq('id', inviteId)
        .single()

      if (error || !data) {
        alert("Invalid or expired bid link.")
      } else {
        // Flatten the Supabase array returns just like we did in the API
        const formattedData = {
          ...data,
          trade: Array.isArray(data.trade) ? data.trade[0] : data.trade,
          pkg: {
            ...(Array.isArray(data.pkg) ? data.pkg[0] : data.pkg),
            project: Array.isArray((Array.isArray(data.pkg) ? data.pkg[0] : data.pkg)?.project) 
              ? (Array.isArray(data.pkg) ? data.pkg[0] : data.pkg).project[0] 
              : (Array.isArray(data.pkg) ? data.pkg[0] : data.pkg)?.project
          }
        }
        setInvite(formattedData)
      }
      setLoading(false)
    }

    if (inviteId) fetchPortalData()
  }, [inviteId])

  const toggleInclusion = (index: number) => {
    setCheckedInclusions(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !file) return alert("Please provide a price and upload your quote PDF.")
    setSubmitting(true)

    try {
      // 1. Upload the PDF Quote to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${invite.pkg.division_code}-${invite.trade.company.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}.${fileExt}`
      const filePath = `${invite.pkg.project.name}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('trade-quotes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('trade-quotes')
        .getPublicUrl(filePath)

      // 2. Update the Invitation Record
      const { error: updateError } = await supabase
        .from('bid_invitations')
        .update({
          submitted_amount: parseFloat(amount),
          schedule_impact_days: parseInt(days) || 0,
          trade_notes: notes,
          quote_link: publicUrlData.publicUrl,
          status: 'Submitted'
        })
        .eq('id', inviteId)

      if (updateError) throw updateError

      // 3. Update Local State to show success screen
      setInvite({ ...invite, status: 'Submitted' })
      
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-emerald-600 font-black animate-pulse uppercase tracking-widest">Loading Secure Portal...</div>
  if (!invite) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Invalid Link. Please contact the General Contractor.</div>

  const isClosed = invite.pkg.status === 'Closed' || invite.pkg.status === 'Awarded'
  const isSubmitted = invite.status === 'Submitted' || invite.status === 'Awarded'
  const pkg = invite.pkg
  const dueDate = pkg.due_date ? new Date(pkg.due_date) : null
  const isPastDue = dueDate ? dueDate < new Date() : false

  // SUCCESS SCREEN
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-2xl text-center border border-slate-100">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Quote Received</h2>
          <p className="text-slate-500 text-sm mb-6">Thank you, {invite.trade.primary_contact}. Your bid for <strong>{pkg.title}</strong> has been securely submitted to the project team.</p>
          <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Confirmation Details</p>
            <p className="text-sm font-bold text-slate-700">Project: {pkg.project.name}</p>
            <p className="text-sm font-bold text-slate-700">Amount: ${parseFloat(invite.submitted_amount || amount).toLocaleString()}</p>
          </div>
        </div>
      </div>
    )
  }

  // BIDDING PORTAL
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      
      {/* HEADER */}
      <div className="bg-slate-950 text-white pt-12 pb-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
            <Building2 size={14}/> {pkg.project.name} • {pkg.project.location}
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4">
            Div {pkg.division_code}: <span className="text-slate-300">{pkg.title}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-sm font-bold">
            <span className="bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2">
              Trade: {invite.trade.company}
            </span>
            {dueDate && (
              <span className={`${isPastDue ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-slate-300'} px-4 py-2 rounded-lg flex items-center gap-2`}>
                <Clock size={16}/> Due: {dueDate.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COL: SCOPE OF WORK */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl border border-slate-100">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 mb-4"><FileText className="text-emerald-600"/> Base Scope</h2>
            <p className="text-slate-600 leading-relaxed text-sm">{pkg.base_scope}</p>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl border border-slate-100">
            <h2 className="text-lg font-black uppercase flex items-center gap-2 mb-6 text-emerald-700"><CheckCircle2/> Specific Inclusions</h2>
            <p className="text-xs text-slate-400 font-bold uppercase mb-4">Please check off items to acknowledge inclusion in your price:</p>
            <div className="space-y-3">
              {(pkg.inclusions || []).map((inc: string, i: number) => (
                <label key={i} className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-colors border ${checkedInclusions[i] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-emerald-300'}`}>
                  <div className="mt-0.5">
                    {checkedInclusions[i] ? <CheckSquare className="text-emerald-600" size={20}/> : <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white" />}
                  </div>
                  <span className={`text-sm ${checkedInclusions[i] ? 'text-emerald-900 font-medium' : 'text-slate-600'}`}>{inc}</span>
                </label>
              ))}
            </div>
          </div>

          {(pkg.exclusions?.length > 0) && (
            <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-xl border border-slate-100">
              <h2 className="text-lg font-black uppercase flex items-center gap-2 mb-6 text-amber-600"><XCircle/> Explicit Exclusions</h2>
              <ul className="space-y-3">
                {pkg.exclusions.map((exc: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-amber-500 font-black shrink-0">EXC</span> {exc}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT COL: SUBMISSION FORM */}
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[32px] shadow-2xl border border-slate-100 sticky top-8">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-8">Submit Quote</h2>
            
            {isClosed ? (
              <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl text-center border border-amber-200">
                <ShieldCheck size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-bold">Bidding is closed for this package.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Total Base Bid (Excluding HST)</label>
                  <div className="relative">
                    <DollarSign size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 pl-12 p-4 rounded-2xl font-black text-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Schedule Duration / Impact (Days)</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="number" 
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      placeholder="Estimated days on site"
                      className="w-full bg-slate-50 border border-slate-200 pl-12 p-4 rounded-2xl font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Upload Official Quote (PDF)</label>
                  <label className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all ${file ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-50 text-slate-500 hover:border-emerald-400 hover:bg-slate-100'}`}>
                    <Upload size={24} className="mb-2" />
                    <span className="text-sm font-bold truncate max-w-full px-4">{file ? file.name : 'Click to browse files'}</span>
                    <input type="file" accept=".pdf" required className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Qualifications / Notes</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="List any alternations, material substitutions, or specific notes..."
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all min-h-[120px] resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={submitting || isPastDue}
                  className="w-full bg-slate-950 hover:bg-emerald-600 disabled:opacity-50 text-white font-black uppercase tracking-widest p-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-emerald-900/20"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  {isPastDue ? 'Deadline Passed' : 'Submit Formal Bid'}
                </button>

              </div>
            )}
          </form>
        </div>

      </div>
    </div>
  )
}