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
      setLoading(true)
      try {
        // STAGE 1: Try the full report with Project Join
        const { data, error } = await supabase
          .from('daily_logs')
          .select(`
            *, 
            projects(name, address), 
            site_incidents:linked_incident_id(*)
          `)
          .eq('id', id)
          .maybeSingle()

        if (data) {
          setLog(data)
        } else {
          // STAGE 2: Fallback - Get just the log if the link is broken
          const { data: fallback, error: fallbackError } = await supabase
            .from('daily_logs')
            .select('*')
            .eq('id', id)
            .single()
          
          if (fallback) setLog(fallback)
        }
      } catch (err) {
        console.error("Critical Sync Error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [id])

  if (loading) return (
    <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse bg-slate-950 min-h-screen flex items-center justify-center">
      Decrypting Field Record...
    </div>
  )
  
  if (!log) return (
    <div className="p-10 text-center font-black text-red-500 uppercase bg-slate-950 min-h-screen flex flex-col items-center justify-center">
      <p className="mb-4">Log Not Found in Archive</p>
      <button onClick={() => router.push('/logs')} className="text-[10px] bg-slate-900 px-4 py-2 rounded-full text-slate-400">Return to History</button>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-slate-950 min-h-screen font-sans text-slate-100 print:bg-white print:text-slate-900 print:p-0">
      
      {/* NAVIGATIONBAR */}
      <div className="flex justify-between items-center mb-10 pb-4 border-b border-slate-800 print:hidden">
        <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all tracking-widest">
          ← Back to Archive
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-500 transition-all">
          Print / Save PDF
        </button>
      </div>

      {/* --- REPORT BODY --- */}
      <div className="space-y-10 print:text-slate-900">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-end border-b-8 border-blue-600 pb-8 print:border-slate-900">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2 text-white print:text-slate-900 italic">Daily Site Report</h1>
            <p className="text-md font-bold text-blue-400 uppercase tracking-widest print:text-blue-600">{log.projects?.name || 'Unlinked Site'}</p>
            <p className="text-[10px] font-mono text-slate-500 uppercase mt-2 print:text-slate-400">
              {log.projects?.address || 'Location Data Restricted'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Field Date</p>
            <p className="text-lg font-bold text-white print:text-slate-900">
              {log.log_date 
                ? new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }) 
                : new Date(log.created_at).toLocaleDateString('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' })
              }
            </p>
          </div>
        </div>

        {/* TOP METRICS */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 print:bg-slate-50 print:border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Atmospheric Conditions</p>
            <p className="text-md font-bold text-slate-200 print:text-slate-900 uppercase italic">{log.weather}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-[32px] border border-slate-800 print:bg-slate-50 print:border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Reference Hash</p>
            <p className="text-[10px] font-mono text-blue-500 uppercase print:text-slate-400">{String(log.id).slice(0, 16)}</p>
          </div>
        </div>

        {/* NARRATIVE */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Work Narrative</h2>
          <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl print:bg-white print:border-slate-200 print:shadow-none">
            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-slate-300 print:text-slate-800">
              {log.work_performed}
            </p>
          </div>
        </div>

        {/* PERSONNEL COUNT */}
        {log.trades_detailed && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Personnel Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(log.trades_detailed).map(([trade, count]: [string, any]) => (
                <div key={trade} className="flex flex-col bg-slate-900 p-4 rounded-2xl border border-slate-800 print:bg-slate-50">
                  <span className="text-[9px] font-black text-slate-500 uppercase mb-1">{trade}</span>
                  <span className="font-black text-blue-500 text-xl print:text-blue-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHOTO EVIDENCE */}
        {log.photo_urls && log.photo_urls.length > 0 && (
          <div className="space-y-4 print:break-inside-avoid">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Progress Documentation</h2>
            <div className="grid grid-cols-2 gap-4">
              {log.photo_urls.map((url: string, i: number) => (
                <img key={i} src={url} className="w-full h-64 object-cover rounded-[32px] border border-slate-800 print:border-slate-200 shadow-2xl" />
              ))}
            </div>
          </div>
        )}

        {/* SIGNATURE AREA */}
        <div className="pt-16 border-t border-slate-800 flex flex-col items-center print:border-slate-200">
          {log.signature_url ? (
            <img src={log.signature_url} alt="Foreman Signature" className="max-h-24 mb-4 contrast-125 print:contrast-100 brightness-110 print:brightness-100" />
          ) : (
            <div className="h-24 flex items-center text-[10px] font-black text-red-950 bg-red-500/10 px-6 rounded-full border border-red-500/20 uppercase tracking-widest mb-4">Awaiting Digital Authorization</div>
          )}
          <div className="w-64 h-[2px] bg-slate-800 print:bg-slate-300"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-[0.4em]">Authorized Site Foreman</p>
        </div>
      </div>

      {/* --- INCIDENT OVERLAY --- */}
      {log.site_incidents && (
        <div className="mt-32 pt-20 border-t-8 border-red-600 print:break-before-page">
          <div className="mb-10">
            <h2 className="text-4xl font-black text-red-500 tracking-tighter uppercase leading-none mb-3 italic">Incident Appendix</h2>
            <p className="text-[10px] font-black bg-red-600 text-white px-4 py-1.5 rounded-full inline-block uppercase tracking-widest">
              Severity Level: {log.site_incidents.classification}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-red-950/10 p-8 rounded-[40px] border border-red-900/30">
              <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">Narrative</h3>
              <p className="text-sm font-bold text-slate-200 leading-relaxed italic">
                "{log.site_incidents.description}"
              </p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Log Timestamp</h3>
              <p className="text-sm font-bold text-slate-300">
                {new Date(log.site_incidents.created_at).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Toronto' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PRINT CSS OVERRIDES */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: #0f172a !important; }
          .print\:hidden { display: none !important; }
          .print\:break-before-page { break-before: page; }
          .print\:break-inside-avoid { break-inside: avoid; }
          p, h1, h2, h3, span { color: #0f172a !important; }
          .text-blue-400, .text-blue-500 { color: #2563eb !important; }
          .text-red-500 { color: #dc2626 !important; }
        }
      `}</style>
    </div>
  )
}