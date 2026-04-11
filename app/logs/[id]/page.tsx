'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SingleLogPDF() {
  const { id } = useParams()
  const [log, setLog] = useState<any>(null)
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    async function getFullData() {
      // Fetch the log
      const { data: logData } = await supabase.from('daily_logs').select('*').eq('id', id).single()
      
      if (logData) {
        setLog(logData)
        // If the log is linked to a project, fetch those details too
        if (logData.project_id) {
          const { data: projData } = await supabase.from('projects').select('*').eq('id', logData.project_id).single()
          if (projData) setProject(projData)
        }
      }
    }
    getFullData()
  }, [id])

  if (!log) return <div className="p-20 text-center font-black text-slate-400">LOADING OFFICIAL RECORD...</div>

  // Safety fix for the .slice() error
  const reportNumber = String(log.id || '').substring(0, 8).toUpperCase()

  return (
    <div className="max-w-[8.5in] mx-auto p-12 bg-white min-h-screen font-serif" id="print-area">
      
      {/* 🏗️ CORPORATE HEADER */}
      <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
        <div>
          <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center font-black text-2xl mb-4">
            B
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
            Field Construction Report
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            {project?.name || 'Standard Interior Systems'} | Barrie, Ontario
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 text-right">Report ID</p>
          <p className="font-mono text-sm font-bold">#{reportNumber}</p>
          <button 
            onClick={() => window.print()} 
            className="mt-6 bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest print:hidden shadow-lg hover:bg-blue-600 transition-all"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* 📍 PROJECT DETAILS */}
      <div className="grid grid-cols-2 gap-12 mb-10 pb-10 border-b border-slate-100">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Project Site</p>
          <p className="text-sm font-bold text-slate-800">{project?.address || 'Site Address Not Specified'}</p>
          <p className="text-xs text-slate-500 mt-1">Client: {project?.client_name || 'General'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Date</p>
            <p className="text-sm font-bold text-slate-800">{new Date(log.created_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Weather</p>
            <p className="text-sm font-bold text-blue-600 uppercase">{log.weather}</p>
          </div>
        </div>
      </div>

      {/* 👥 PERSONNEL SUMMARY */}
      <div className="mb-10">
        <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-4 tracking-widest">Trades & Headcount</h3>
        <div className="grid grid-cols-3 gap-4">
          {log.trades_detailed && Object.entries(log.trades_detailed).map(([trade, count]) => (
            <div key={trade} className="border-l-2 border-slate-200 pl-4 py-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{trade}</p>
              <p className="text-sm font-black text-slate-800">{count as number} Men</p>
            </div>
          ))}
        </div>
      </div>

      {/* 📝 NARRATIVE */}
      <div className="mb-10">
        <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-4 tracking-widest">Daily Progress Narrative</h3>
        <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap italic pl-4 border-l-2 border-blue-500">
          "{log.work_performed}"
        </p>
      </div>

      {/* 📸 DOCUMENTATION */}
      {log.photo_urls && log.photo_urls.length > 0 && (
        <div className="mt-12">
          <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-6 tracking-widest">Site Photo Documentation</h3>
          <div className="grid grid-cols-2 gap-6">
            {log.photo_urls.map((url: string, i: number) => (
              <div key={i} className="break-inside-avoid">
                <img src={url} className="w-full h-72 object-cover rounded-sm grayscale-[20%] border border-slate-200" />
                <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold text-center">Reference Image {i + 1}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✍️ FOOTER */}
      <div className="mt-20 flex justify-between items-end border-t-2 border-slate-900 pt-8">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase mb-8 tracking-widest">Authorized Signature</p>
          <div className="w-48 h-px bg-slate-300"></div>
        </div>
        <div className="text-right text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">
          End of Document | System Generated Report
        </div>
      </div>
    </div>
  )
}