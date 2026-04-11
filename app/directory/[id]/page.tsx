'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function DetailedSubProfile() {
  const { id } = useParams()
  const [sub, setSub] = useState<any>(null)
  const [workers, setWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const { data: subData } = await supabase.from('subcontractors').select('*').eq('id', id).single()
    const { data: workerData } = await supabase.from('sub_worker_docs').select('*').eq('sub_id', id)
    setSub(subData)
    setWorkers(workerData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  if (loading) return <div className="p-20 text-center font-black text-slate-400 uppercase animate-pulse">Loading Subcontractor Data...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans pb-20">
      
      {/* 1. TOP NAV & COMPANY BRANDING */}
      <div className="flex justify-between items-center mb-8">
        <Link href="/directory" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">← Back to Directory</Link>
        <div className="text-right">
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{sub.company_name}</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-2">Active Subcontractor Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. CONTACT HIERARCHY (The "Chain of Command") */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-slate-900 text-white p-6 rounded-[32px] shadow-xl">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Chain of Command</h2>
            
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Office / Admin</p>
                <p className="text-sm font-bold">{sub.phone || 'No Main Number'}</p>
                <p className="text-xs text-slate-400">{sub.email || 'No Main Email'}</p>
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Project Manager</p>
                <p className="text-sm font-bold">{sub.pm_name || 'Not Assigned'}</p>
                <p className="text-xs text-slate-400">{sub.pm_phone}</p>
              </div>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase mb-1">Site Foreman</p>
                <p className="text-sm font-bold">{sub.foreman_name || 'Not Assigned'}</p>
                <p className="text-xs text-slate-400">{sub.foreman_phone}</p>
              </div>
            </div>
          </section>

          {/* 3. MASTER DOCUMENT VAULT */}
          <section className="bg-white p-6 rounded-[32px] border-2 border-slate-200 shadow-sm">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Compliance Vault</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Contract', url: sub.contract_url },
                { label: 'Quote', url: sub.quote_url },
                { label: 'Form 1000', url: sub.form_1000_url },
                { label: 'Safety Policy', url: sub.safety_policy_url },
                { label: 'Other Docs', url: sub.other_docs_url },
              ].map(doc => (
                <div key={doc.label} className={`flex justify-between items-center p-3 rounded-2xl border ${doc.url ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{doc.label}</span>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" className="text-[9px] font-black text-green-700 uppercase underline">View</a>
                  ) : (
                    <span className="text-[9px] font-black text-slate-300 uppercase">Missing</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 4. WORKER ROSTER & SAFETY CARDS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Worker Roster</h2>
            <Link href={`/directory/${id}/add-worker`} className="text-[10px] font-black text-blue-600 uppercase">+ Add Worker</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workers.map(worker => (
              <div key={worker.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-none">{worker.worker_name}</h3>
                    {worker.orientation_signed && (
                      <span className="bg-blue-600 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase">Oriented</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Doc:</span>
                      <span className="text-blue-600 uppercase">{worker.doc_type}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">Expiry:</span>
                      <span className={new Date(worker.expiry_date) < new Date() ? 'text-red-600' : 'text-slate-900'}>
                        {worker.expiry_date || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  {worker.file_url && (
                    <a href={worker.file_url} target="_blank" className="flex-1 bg-slate-900 text-white text-[9px] font-black py-2 rounded-xl uppercase text-center tracking-widest">View Card</a>
                  )}
                  <button className="flex-1 bg-slate-100 text-slate-400 text-[9px] font-black py-2 rounded-xl uppercase tracking-widest">History</button>
                </div>
              </div>
            ))}
          </div>

          {workers.length === 0 && (
            <div className="py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No workers registered for this sub</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}