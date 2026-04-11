'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function OpportunitiesPipeline() {
  const [opps, setOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOpps = async () => {
    const { data } = await supabase.from('opportunities').select('*').order('bid_due_date', { ascending: true })
    if (data) setOpps(data)
  }

  useEffect(() => { fetchOpps() }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    
    await supabase.from('opportunities').insert([{
      name: formData.get('name'),
      client_name: formData.get('client_name'),
      estimated_value: formData.get('value'),
      bid_due_date: formData.get('due_date'),
      status: 'Bidding'
    }])

    e.target.reset()
    setLoading(false)
    fetchOpps()
  }

  // "Single Click" conversion to Project
  const convertToProject = async (opp: any) => {
    const confirm = window.confirm(`Convert "${opp.name}" to an active project?`)
    if (!confirm) return

    // 1. Add to Projects table
    const { error: projError } = await supabase.from('projects').insert([{
      name: opp.name,
      client_name: opp.client_name,
      address: 'Update Address' // Placeholder for the new site
    }])

    if (!projError) {
      // 2. Mark Opportunity as Won
      await supabase.from('opportunities').update({ status: 'Won' }).eq('id', opp.id)
      alert("Project initialized! It's now in your active roster.")
      fetchOpps()
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen font-sans pb-20">
      
      <div className="flex justify-between items-end mb-8 pt-6 border-b-4 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Opportunities</h1>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Bidding & Estimates Pipeline</p>
        </div>
        <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">← Dashboard</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ADD NEW BID FORM */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 sticky top-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Log New Opportunity</h2>
            
            <div className="space-y-4">
              <input name="name" required placeholder="Project Name" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-blue-500" />
              <input name="client_name" placeholder="GC / Client" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-blue-500" />
              
              <div className="grid grid-cols-2 gap-3">
                <input name="value" type="number" placeholder="Est. Value $" className="p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none" />
                <input name="due_date" type="date" required className="p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none text-slate-500" />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[10px]">
                {loading ? 'Logging...' : 'Add to Pipeline'}
              </button>
            </div>
          </form>
        </div>

        {/* THE PIPELINE VIEW */}
        <div className="lg:col-span-2 space-y-6">
          {['Bidding', 'Won', 'Lost'].map(status => (
            <section key={status} className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{status}</h3>
              
              <div className="space-y-3">
                {opps.filter(o => o.status === status).map(opp => (
                  <div key={opp.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:border-blue-200">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 leading-tight uppercase mb-1">{opp.name}</h4>
                      <div className="flex gap-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{opp.client_name || 'No Client'}</p>
                        <p className="text-[10px] font-black text-blue-600 uppercase">Due: {new Date(opp.bid_due_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Est. Value</p>
                        <p className="text-sm font-black text-slate-800">${Number(opp.estimated_value).toLocaleString()}</p>
                      </div>

                      {status === 'Bidding' && (
                        <button 
                          onClick={() => convertToProject(opp)}
                          className="bg-blue-600 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-md hover:bg-blue-700 transition-colors"
                        >
                          Win & Convert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {opps.filter(o => o.status === status).length === 0 && (
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-[32px] text-center">
                    <p className="text-[9px] font-black text-slate-300 uppercase italic">Empty</p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}