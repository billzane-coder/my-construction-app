'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ProjectReport() {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReportData() {
      const [proj, logs, inc, mat, time] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('daily_logs').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('site_incidents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('site_materials').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('site_timesheets').select('*').eq('project_id', id).order('date_worked', { ascending: false })
      ])

      setData({
        project: proj.data,
        logs: logs.data || [],
        incidents: inc.data || [],
        materials: mat.data || [],
        labor: time.data || []
      })
      setLoading(false)
    }
    fetchReportData()
  }, [id])

  if (loading) return <div className="p-20 text-center font-black animate-pulse uppercase">Compiling Project Data...</div>

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-4 md:p-12">
      
      {/* 🛠️ ACTION BAR (Hidden on Print) */}
      <div className="print:hidden max-w-4xl mx-auto mb-10 flex justify-between items-center bg-slate-900 p-4 rounded-2xl shadow-xl">
        <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">← Back</Link>
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white font-black py-3 px-8 rounded-xl uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-all"
        >
          🖨️ Print to PDF
        </button>
      </div>

      {/* 📄 THE REPORT DOCUMENT */}
      <div className="max-w-4xl mx-auto border border-slate-200 p-8 md:p-16 shadow-sm print:border-none print:p-0">
        
        {/* HEADER / LETTERHEAD */}
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2">Project Summary</h1>
            <p className="text-sm font-bold text-blue-600 uppercase tracking-[0.3em]">Site Audit & Compliance Report</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase">{data.project.name}</h2>
            <p className="text-xs font-bold text-slate-500 uppercase">{data.project.address}</p>
            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase">Report Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* SECTION 1: EXECUTIVE SUMMARY */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-50 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Daily Logs</p>
            <p className="text-2xl font-black">{data.logs.length}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Man Hours</p>
            <p className="text-2xl font-black">
              {data.labor.reduce((acc: any, curr: any) => acc + Number(curr.hours_regular) + Number(curr.hours_overtime), 0).toFixed(1)}
            </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Safety Record</p>
            <p className={`text-2xl font-black ${data.incidents.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.incidents.length === 0 ? 'CLEAN' : `${data.incidents.length} INCIDENTS`}
            </p>
          </div>
        </div>

        {/* SECTION 2: DAILY PROGRESS LOGS */}
        <div className="mb-12">
          <h3 className="text-xs font-black bg-slate-900 text-white py-2 px-4 inline-block uppercase tracking-widest mb-6 rounded-lg">Daily Progress Tracking</h3>
          <div className="space-y-6">
            {data.logs.map((log: any) => (
              <div key={log.id} className="border-l-2 border-slate-200 pl-6 py-2">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-black uppercase text-slate-900">
                    {new Date(log.created_at).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <span className="text-[9px] font-black text-slate-400 uppercase">{log.weather}</span>
                </div>
                <p className="text-sm text-slate-600 italic mb-4 leading-relaxed">"{log.work_performed}"</p>
                {/* LOG PHOTOS */}
                {log.photo_urls?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {log.photo_urls.map((url: string, i: number) => (
                      <img key={i} src={url} className="w-full h-32 object-cover rounded-xl border border-slate-100" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: SAFETY LEDGER */}
        {data.incidents.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xs font-black bg-red-600 text-white py-2 px-4 inline-block uppercase tracking-widest mb-6 rounded-lg">Safety & Incident Log</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-[10px] font-black uppercase text-slate-400">Date</th>
                  <th className="py-2 text-[10px] font-black uppercase text-slate-400">Severity</th>
                  <th className="py-2 text-[10px] font-black uppercase text-slate-400">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.incidents.map((inc: any) => (
                  <tr key={inc.id}>
                    <td className="py-4 text-xs font-bold">{new Date(inc.created_at).toLocaleDateString()}</td>
                    <td className="py-4"><span className="text-[9px] font-black bg-red-100 text-red-700 px-2 py-1 rounded uppercase">{inc.severity}</span></td>
                    <td className="py-4 text-xs text-slate-600">{inc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER: SIGNATURE AREA */}
        <div className="mt-20 pt-10 border-t border-slate-200 grid grid-cols-2 gap-20">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase mb-8">Contractor Signature</p>
            <div className="border-b border-slate-900 w-full h-10"></div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase mb-8">Owner / Representative Signature</p>
            <div className="border-b border-slate-900 w-full h-10"></div>
          </div>
        </div>

      </div>
    </div>
  )
}