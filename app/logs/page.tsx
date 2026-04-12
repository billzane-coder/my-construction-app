'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LogsList() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*, projects:project_id(name), site_incidents:linked_incident_id(description, classification)')
      .order('created_at', { ascending: false })
    
    if (error) {
      setErrorMsg("Connection issue. Showing cached records.")
      const { data: fallback } = await supabase.from('daily_logs').select('*').order('created_at', { ascending: false })
      if (fallback) setLogs(fallback)
    } else if (data) {
      setLogs(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLogs() }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault() 
    e.stopPropagation() 
    
    if (!confirm("Are you sure? This will permanently delete this daily log.")) return

    const { error } = await supabase.from('daily_logs').delete().eq('id', id)
    
    if (error) {
      alert("Error deleting log: " + error.message)
    } else {
      fetchLogs() 
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-950 min-h-screen pb-24 font-sans text-slate-100">
      
      {/* HEADER - RESTORED TO DAILY LOGS */}
      <div className="mb-6 pt-4 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
          Daily <span className="text-blue-500 underline decoration-blue-500 decoration-4 underline-offset-4">Logs</span>
        </h1>
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-2 font-mono">
          Project Archive // Field Records
        </p>
      </div>

      {/* CREATE BUTTON */}
      <Link href="/logs/new" className="block w-full bg-blue-600 text-white text-center font-black py-5 rounded-[32px] shadow-[0_0_20px_rgba(37,99,235,0.2)] active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px] mb-8 border border-blue-400/30">
        + Start New Daily Log
      </Link>

      {errorMsg && (
        <div className="bg-amber-900/20 border border-amber-500/30 text-amber-500 p-3 rounded-2xl mb-6 text-[9px] font-black uppercase text-center">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="uppercase font-black text-slate-500 text-[10px] animate-pulse font-mono">Scanning Archive...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Link 
              href={`/logs/${log.id}`} 
              key={log.id} 
              className="group block bg-slate-900 p-5 rounded-[24px] border border-slate-800 hover:border-blue-500 transition-all active:scale-[0.98] relative shadow-xl"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 font-mono">
                    {new Date(log.created_at).toLocaleDateString()}
                  </p>
                  <h2 className="text-sm font-black uppercase text-white leading-tight pr-10">
                    {log.projects?.name || 'Active Project'}
                  </h2>
                </div>
                
                <button 
                  onClick={(e) => handleDelete(e, log.id)}
                  className="absolute top-5 right-5 p-2 text-slate-700 hover:text-red-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                </button>
              </div>
              
              <p className="text-xs font-medium text-slate-400 line-clamp-2 italic mb-4 leading-relaxed">
                "{log.work_performed}"
              </p>

              <div className="flex gap-2 mb-4">
                {log.linked_incident_id && (
                  <span className="bg-red-900/30 text-red-400 text-[7px] font-black px-2 py-1 rounded border border-red-500/30 uppercase tracking-tighter">🚨 Incident Linked</span>
                )}
                {log.signature_url && (
                  <span className="bg-emerald-900/30 text-emerald-400 text-[7px] font-black px-2 py-1 rounded border border-emerald-500/30 uppercase tracking-tighter font-mono">Signed // Verified</span>
                )}
              </div>
              
              {log.photo_urls && log.photo_urls.length > 0 && (
                <div className="flex gap-2">
                  {log.photo_urls.slice(0, 4).map((url: string, i: number) => (
                    <img 
                      key={i} 
                      src={url} 
                      className="w-10 h-10 rounded-lg object-cover border border-slate-800 bg-slate-950" 
                      alt="Site capture"
                    />
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}