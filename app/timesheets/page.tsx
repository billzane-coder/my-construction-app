'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Timesheets() {
  const [projects, setProjects] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    const { data: projData } = await supabase.from('projects').select('*').order('name')
    const { data: timeData } = await supabase.from('site_timesheets').select('*').order('date_worked', { ascending: false })
    if (projData) setProjects(projData)
    if (timeData) setTimesheets(timeData)
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)
    
    await supabase.from('site_timesheets').insert([{
      project_id: formData.get('project_id'),
      worker_name: formData.get('worker_name'),
      trade_type: formData.get('trade_type'),
      date_worked: formData.get('date_worked'),
      hours_regular: formData.get('hours_regular') || 0,
      hours_overtime: formData.get('hours_overtime') || 0,
      notes: formData.get('notes'),
      status: 'Pending'
    }])

    e.target.reset()
    // Set the date back to today automatically for faster entry
    e.target.date_worked.valueAsDate = new Date()
    setLoading(false)
    fetchData()
  }

  const markApproved = async (id: string) => {
    await supabase.from('site_timesheets').update({ status: 'Approved' }).eq('id', id)
    fetchData()
  }

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown Site'

  // Calculate quick totals for the active view
  const pendingHours = timesheets.filter(t => t.status === 'Pending').reduce((acc, curr) => acc + Number(curr.hours_regular) + Number(curr.hours_overtime), 0)

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 pt-6 border-b-4 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Payroll</h1>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Site Hours & Timesheets</p>
        </div>
        <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase hover:text-blue-600">← Command Center</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: ENTRY FORM */}
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-[32px] shadow-xl space-y-4 sticky top-6">
            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Log Worker Hours</h2>
            
            <input type="date" name="date_worked" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-4 bg-white/10 text-white border border-white/10 rounded-2xl text-sm font-bold outline-none [color-scheme:dark]" />

            <select name="project_id" required className="w-full p-4 bg-white/10 text-white border border-white/10 rounded-2xl text-sm font-bold outline-none">
              <option value="" className="text-slate-900">Select Job Site...</option>
              {projects.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}
            </select>

            <div className="space-y-3">
              <input name="worker_name" required placeholder="Worker Name" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none" />
              <input name="trade_type" placeholder="Trade (e.g. Taper)" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Regular</label>
                <input name="hours_regular" type="number" step="0.5" placeholder="8.0" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 border border-white/10 rounded-2xl text-sm font-bold outline-none text-center" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Overtime</label>
                <input name="hours_overtime" type="number" step="0.5" placeholder="0.0" className="w-full p-4 bg-white/10 text-white placeholder-slate-500 border border-white/10 rounded-2xl text-sm font-bold outline-none text-center" />
              </div>
            </div>

            <input name="notes" placeholder="Notes (optional)" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none mt-2" />

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-[10px] mt-4">
              {loading ? 'Logging...' : 'Submit Hours'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: PENDING PAYROLL LEDGER */}
        <div className="md:col-span-2 space-y-4">
          
          <div className="flex justify-between items-end px-2 mb-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Timesheet Ledger</h3>
            <div className="text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase mr-2">Pending Hours:</span>
              <span className="text-sm font-black text-slate-900 bg-amber-100 px-3 py-1 rounded-xl">{pendingHours.toFixed(1)}</span>
            </div>
          </div>

          {timesheets.length === 0 ? (
            <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No timesheets on file</p>
            </div>
          ) : (
            timesheets.map(t => (
              <div key={t.id} className={`p-6 rounded-[32px] border-2 transition-all flex flex-col md:flex-row justify-between md:items-center gap-4 ${
                t.status === 'Approved' ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                
                {/* Left side: Worker & Date */}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{t.worker_name}</h4>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                      t.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {t.trade_type || 'Worker'} | {new Date(t.date_worked).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[10px] font-black text-blue-600 uppercase">{getProjectName(t.project_id)}</p>
                </div>

                {/* Right side: Hours & Actions */}
                <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                  <div className="text-left md:text-right flex gap-4 md:gap-2">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase">Reg</p>
                      <p className="text-lg font-black text-slate-700">{Number(t.hours_regular).toFixed(1)}</p>
                    </div>
                    {Number(t.hours_overtime) > 0 && (
                      <div>
                        <p className="text-[8px] font-black text-red-400 uppercase">OT</p>
                        <p className="text-lg font-black text-red-600">{Number(t.hours_overtime).toFixed(1)}</p>
                      </div>
                    )}
                  </div>

                  {t.status === 'Pending' && (
                    <button 
                      onClick={() => markApproved(t.id)}
                      className="bg-slate-100 text-slate-900 border border-slate-200 font-black px-4 py-2 rounded-xl uppercase tracking-widest text-[9px] hover:bg-green-100 hover:text-green-700 hover:border-green-300 transition-colors"
                    >
                      ✓ Approve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}