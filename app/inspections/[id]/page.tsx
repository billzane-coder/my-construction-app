'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

export default function InspectionDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [log, setLog] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInspection() {
      const { data, error } = await supabase
        .from('site_inspections')
        .select('*, projects(name, address), inspection_templates(name)')
        .eq('id', id)
        .single()
      
      if (data) setLog(data)
      if (error) console.error("Fetch Error:", error)
      setLoading(false)
    }
    fetchInspection()
  }, [id])

  if (loading) return <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse bg-slate-950 min-h-screen">Opening Audit File...</div>
  if (!log) return <div className="p-10 text-center font-black text-red-500 uppercase bg-slate-950 min-h-screen">Audit Not Found</div>

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12 bg-slate-950 min-h-screen font-sans text-slate-100 print:bg-white print:text-slate-900 print:p-0">
      
      {/* NAVIGATION */}
      <div className="flex justify-between items-center mb-10 pb-4 border-b border-slate-800 print:hidden">
        <button onClick={() => router.push('/inspections')} className="text-[10px] font-black uppercase text-slate-500 hover:text-white tracking-widest transition-all">
          ← Back to Audits
        </button>
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-500 transition-all">
          Print / Save PDF
        </button>
      </div>

      {/* HEADER */}
      <div className="border-b-8 border-blue-600 pb-8 mb-10 print:border-slate-900">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white print:text-slate-900">Phase Audit Record</h1>
            <p className="text-blue-500 font-black uppercase tracking-widest text-sm mt-1">{log.inspection_templates?.name}</p>
          </div>
          <div className="text-right">
            <span className="bg-blue-900/40 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/20 font-black text-xl print:text-blue-700 print:bg-slate-100">
              UNIT {log.unit_number || 'GEN'}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end mt-8">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Project Site</p>
            <p className="font-bold text-white print:text-slate-800">{log.projects?.name}</p>
            <p className="text-[10px] font-mono text-slate-600 uppercase mt-1">{log.projects?.address}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Walk Date</p>
            <p className="font-bold text-white print:text-slate-800">{new Date(log.created_at).toLocaleDateString('en-CA', { dateStyle: 'long' })}</p>
          </div>
        </div>
      </div>

      {/* CHECKLIST RESULTS (Quotes and Italics Removed) */}
      <div className="space-y-4 mb-12">
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Line-Item Verification</h2>
        {Object.entries(log.results || {}).map(([item, score]: [string, any]) => (
          <div key={item} className={`flex justify-between items-center p-5 rounded-2xl border ${
            score === 'Pass' ? 'bg-slate-900 border-emerald-900/30 print:bg-slate-50' : 
            score === 'Fail' ? 'bg-red-950/20 border-red-900/40 print:bg-red-50' : 
            'bg-slate-900 border-slate-800'
          }`}>
            {/* TEXT FORMATTING UPDATED HERE */}
            <p className="text-sm font-bold text-slate-200 print:text-slate-800 pr-4 leading-relaxed">{item}</p>
            
            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex-shrink-0 ${
              score === 'Pass' ? 'bg-emerald-600 text-white' : 
              score === 'Fail' ? 'bg-red-600 text-white animate-pulse' : 
              'bg-slate-700 text-slate-400'
            }`}>
              {score}
            </span>
          </div>
        ))}
      </div>

      {/* NOTES */}
      {log.notes && (
        <div className="mb-12">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Builder Observations</h2>
          <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 print:bg-white print:border-slate-200 text-slate-300 print:text-slate-700 leading-relaxed">
            {log.notes}
          </div>
        </div>
      )}

      {/* PHOTO APPENDIX */}
      {log.photo_urls && log.photo_urls.length > 0 && (
        <div className="mb-12 print:break-inside-avoid">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Site Photo Appendix</h2>
          <div className="grid grid-cols-2 gap-4">
            {log.photo_urls.map((url: string, i: number) => (
              <img key={i} src={url} className="w-full h-64 object-cover rounded-[32px] border border-slate-800 shadow-xl print:border-slate-200" alt={`Site condition ${i + 1}`} />
            ))}
          </div>
        </div>
      )}

      {/* SIGNATURE */}
      <div className="pt-12 border-t border-slate-800 flex flex-col items-center print:border-slate-200">
        {log.signature_url ? (
          <img src={log.signature_url} alt="Signature" className="max-h-24 mb-4 contrast-125 print:contrast-100" />
        ) : (
          <p className="text-red-500 font-black uppercase text-[10px] mb-4 tracking-widest border border-red-500/30 px-4 py-2 rounded-full bg-red-950/20">Unsigned Record</p>
        )}
        <div className="w-64 h-[2px] bg-slate-800 print:bg-slate-300"></div>
        <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-[0.4em]">Site Authorization // Lead Builder</p>
      </div>

      {/* PRINT STYLES */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: #0f172a !important; }
          .print\:hidden { display: none !important; }
          .print\:break-inside-avoid { break-inside: avoid; }
          p, h1, h2, h3, span { color: #0f172a !important; }
          .text-blue-500, .text-blue-400 { color: #2563eb !important; }
          .bg-emerald-600 { background-color: #059669 !important; color: white !important; }
          .bg-red-600 { background-color: #dc2626 !important; color: white !important; }
          img { -webkit-print-color-adjust: exact; color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}