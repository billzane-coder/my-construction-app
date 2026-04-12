'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

export default function LogDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [log, setLog] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLog() {
      const { data, error } = await supabase
        .from('daily_logs')
        .select(`
          *, 
          projects(name, address), // Pulling the address here
          site_incidents:linked_incident_id(*)
        `)
        .eq('id', id)
        .single()
      
      if (data) setLog(data)
      setLoading(false)
    }
    fetchLog()
  }, [id])

  if (loading) return <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse tracking-widest bg-slate-950 min-h-screen">Opening Secure Report...</div>
  if (!log) return <div className="p-10 text-center font-black text-red-500 uppercase bg-slate-950 min-h-screen">Report Not Found</div>

  return (
    <div className="max-w-4xl mx-auto p-8 bg-slate-950 min-h-screen font-sans text-slate-100 print:bg-white print:text-slate-900 print:p-0">
      
      {/* NAVIGATION - HIDDEN ON PRINT */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800 print:hidden">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">
          ← Back to History
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-95 transition-all">
          Print / Save PDF
        </button>
      </div>

      {/* --- PAGE 1: DAILY LOG --- */}
      <div className="space-y-8 mb-20 print:text-slate-900">
        
        {/* HEADER WITH ADDRESS */}
        <div className="flex justify-between items-end border-b-4 border-blue-600 pb-6 print:border-slate-900">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none mb-1 text-white print:text-slate-900">Daily Project Log</h1>
            <p className="text-sm font-bold text-blue-400 uppercase tracking-widest print:text-blue-600">{log.projects?.name || 'Project Site'}</p>
            {/* ADDED ADDRESS FIELD */}
            <p className="text-[10px] font-mono text-slate-500 uppercase mt-1 print:text-slate-400">
              {log.projects?.address || 'Location Data Restricted'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase text-slate-500">Date Issued</p>
            <p className="text-sm font-bold text-white print:text-slate-900">{new Date(log.created_at).toLocaleDateString('en-CA', { dateStyle: 'long' })}</p>
          </div>
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 print:bg-slate-50 print:border-slate-100">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Site Weather</p>
            <p className="text-sm font-bold text-slate-200 print:text-slate-900">{log.weather}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 print:bg-slate-50 print:border-slate-100">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 font-mono">Log ID Hash</p>
            <p className="text-[10px] font-mono text-blue-400 uppercase print:text-slate-500">{log.id ? String(log.id).slice(0, 12) : 'N/A'}</p>
          </div>
        </div>

        {/* WORK NARRATIVE */}
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Work Performed Today</h2>
          <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 shadow-xl print:bg-white print:border-slate-200 print:shadow-none">
            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-slate-300 print:text-slate-800 italic">
              "{log.work_performed}"
            </p>
          </div>
        </div>

        {/* PERSONNEL */}
        {log.trades_detailed && (
          <div>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Site Personnel Detail</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(log.trades_detailed).map(([trade, count]: [string, any]) => (
                <div key={trade} className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800 print:bg-slate-50 print:border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{trade}</span>
                  <span className="font-black text-blue-400 text-sm print:text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROGRESS PHOTOS */}
        {log.photo_urls && log.photo_urls.length > 0 && (
          <div className="print:break-inside-avoid">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Site Photo Evidence</h2>
            <div className="grid grid-cols-2 gap-4">
              {log.photo_urls.map((url: string, i: number) => (
                <img key={i} src={url} className="w-full h-48 object-cover rounded-2xl border border-slate-800 print:border-slate-200 shadow-lg" />
              ))}
            </div>
          </div>
        )}

        {/* AUTHORIZATION SIGNATURE */}
        <div className="pt-12 border-t border-slate-800 flex flex-col items-center print:border-slate-200">
          {log.signature_url ? (
            <img src={log.signature_url} alt="Signature" className="max-h-24 mb-2 contrast-125 print:contrast-100" />
          ) : (
            <p className="text-[10px] font-black text-red-500 uppercase mb-4 tracking-widest">Digital Signature Missing</p>
          )}
          <div className="w-48 h-[1px] bg-slate-800 print:bg-slate-300"></div>
          <p className="text-[9px] font-black text-slate-500 uppercase mt-2 tracking-[0.2em]">Authorized Site Foreman</p>
        </div>
      </div>

      {/* --- PAGE 2: INCIDENT ATTACHMENT --- */}
      {log.site_incidents && (
        <div className="pt-20 border-t-8 border-red-600 print:break-before-page print:border-red-600">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-3xl font-black text-red-500 tracking-tighter uppercase leading-none mb-2 print:text-red-600">Attachment: Incident Report</h2>
              <p className="text-[10px] font-black bg-red-600 text-white px-3 py-1 rounded inline-block uppercase tracking-widest">
                Priority: {log.site_incidents.classification}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-red-950/20 p-6 rounded-[32px] border border-red-900/30 print:bg-red-50 print:border-red-100">
                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Detailed Narrative</h3>
                <p className="text-sm font-bold text-slate-200 leading-relaxed italic print:text-red-900">
                  "{log.site_incidents.description}"
                </p>
              </div>
              <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 print:bg-slate-50 print:border-slate-200">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Occurrence Timeline</h3>
                <p className="text-sm font-bold text-slate-200 print:text-slate-700">
                  {new Date(log.site_incidents.created_at).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            <div className="p-8 border-2 border-dashed border-red-900/30 rounded-[32px] text-center print:border-red-200">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Secure Field Record Attachment // End of Document</p>
            </div>
          </div>
        </div>
      )}

      {/* CRITICAL PRINT STYLES */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: #0f172a !important; }
          .print\:hidden { display: none !important; }
          .print\:break-before-page { break-before: page; }
          .print\:break-inside-avoid { break-inside: avoid; }
          /* Ensures images like signatures show up clearly */
          img { color-adjust: exact; -webkit-print-color-adjust: exact; }
          /* Force standard font colors for readability on paper */
          p, h1, h2, h3, span { color: #0f172a !important; }
          .text-blue-400, .text-blue-500, .text-blue-600 { color: #2563eb !important; }
          .text-red-500, .text-red-600 { color: #dc2626 !important; }
        }
      `}</style>
    </div>
  )
}