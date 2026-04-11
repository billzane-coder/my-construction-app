'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function SubcontractorDirectory() {
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSubs = async () => {
    const { data } = await supabase.from('subcontractors').select('*').order('company_name')
    if (data) setSubs(data)
  }

  useEffect(() => { fetchSubs() }, [])

  const handleOnboard = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    
    // Helper to upload multiple different compliance docs
    const uploadDoc = async (fieldName: string) => {
      const file = formData.get(fieldName) as File
      if (!file || file.size === 0) return null
      const fileName = `sub-docs/${Date.now()}-${file.name}`
      const { data } = await supabase.storage.from('site-photos').upload(fileName, file)
      return data ? supabase.storage.from('site-photos').getPublicUrl(fileName).data.publicUrl : null
    }

    const [contract, quote, f1000, policy, others] = await Promise.all([
      uploadDoc('contract'),
      uploadDoc('quote'),
      uploadDoc('f1000'),
      uploadDoc('policy'),
      uploadDoc('others')
    ])

    await supabase.from('subcontractors').insert([{
      company_name: formData.get('company_name'),
      phone: formData.get('office_phone'),
      pm_name: formData.get('pm_name'),
      pm_phone: formData.get('pm_phone'),
      foreman_name: formData.get('foreman_name'),
      foreman_phone: formData.get('foreman_phone'),
      contract_url: contract,
      quote_url: quote,
      form_1000_url: f1000,
      safety_policy_url: policy,
      other_docs_url: others
    }])

    e.target.reset()
    setLoading(false)
    fetchSubs()
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      
      <div className="flex justify-between items-end mb-10 border-b-4 border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Subcontractor Directory</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-3">Compliance & Professional Chain of Command</p>
        </div>
        <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">← Dashboard</Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* 📋 EXPANDED ONBOARDING FORM */}
        <div className="xl:col-span-1">
          <form onSubmit={handleOnboard} className="bg-slate-900 p-6 rounded-[40px] shadow-2xl space-y-5 sticky top-6">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-2 text-center">Onboard New Sub</h2>
            
            <div>
              <input name="company_name" required placeholder="Company Name" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-blue-500" />
              <input name="office_phone" placeholder="Office Phone" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none mt-2" />
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase px-2">Project Manager</p>
              <input name="pm_name" placeholder="PM Name" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none" />
              <input name="pm_phone" placeholder="PM Direct Phone" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none" />
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase px-2">Site Foreman</p>
              <input name="foreman_name" placeholder="Foreman Name" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none" />
              <input name="foreman_phone" placeholder="Foreman Direct Phone" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 rounded-2xl text-sm font-bold outline-none" />
            </div>

            <div className="bg-white/5 p-4 rounded-3xl space-y-3">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest text-center border-b border-white/5 pb-2">Compliance Documents</p>
              <div className="space-y-3 text-[10px]">
                <div><p className="text-white/40 mb-1">Contract</p><input name="contract" type="file" className="text-slate-400 w-full" /></div>
                <div><p className="text-white/40 mb-1">Quote</p><input name="quote" type="file" className="text-slate-400 w-full" /></div>
                <div><p className="text-white/40 mb-1">Form 1000</p><input name="f1000" type="file" className="text-slate-400 w-full" /></div>
                <div><p className="text-white/40 mb-1">Safety Policy</p><input name="policy" type="file" className="text-slate-400 w-full" /></div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-[20px] shadow-lg active:scale-95 transition-all uppercase tracking-widest text-[10px]">
              {loading ? 'Processing Files...' : 'Initialize Subcontractor'}
            </button>
          </form>
        </div>

        {/* 🏢 ACTIVE DIRECTORY LIST */}
        <div className="xl:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subs.map(sub => (
              <Link href={`/directory/${sub.id}`} key={sub.id} className="group bg-white p-8 rounded-[40px] border-2 border-slate-200 shadow-sm hover:border-blue-500 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{sub.company_name}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sub.office_phone || 'Contact Missing'}</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase group-hover:text-blue-600">Open Profile →</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Site Foreman</p>
                      <p className="text-xs font-black text-slate-800">{sub.foreman_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Project Manager</p>
                      <p className="text-xs font-black text-slate-800">{sub.pm_name || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-2">
                  {[
                    { label: 'F1000', has: !!sub.form_1000_url },
                    { label: 'Policy', has: !!sub.safety_policy_url },
                    { label: 'Contract', has: !!sub.contract_url },
                    { label: 'Quote', has: !!sub.quote_url }
                  ].map(doc => (
                    <div key={doc.label} className={`text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                      doc.has ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-300'
                    }`}>
                      {doc.label}
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>

          {subs.length === 0 && (
            <div className="py-40 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Directory is Empty</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}