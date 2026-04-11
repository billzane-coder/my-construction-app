'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LogFeed() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setLogs(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this site record?")) return
    const { error } = await supabase.from('daily_logs').delete().eq('id', id)
    if (!error) setLogs(prev => prev.filter(log => log.id !== id))
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Accessing Barrie Site Records...</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-100 min-h-screen font-sans pb-20">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end mb-8 pt-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SITE FEED</h1>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Active Projects | Barrie, ON</p>
        </div>
        <Link 
          href="/logs/new" 
          className="bg-slate-900 text-white px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          + Create Log
        </Link>
      </div>

      <div className="space-y-6">
        {logs.map((log) => (
          <div key={log.id} className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden relative group transition-all hover:shadow-md">
            
            {/* DELETE BUTTON (Floating) */}
            <button 
              onClick={() => handleDelete(log.id)}
              className="absolute top-6 right-6 w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-10"
            >
              <span className="text-xl font-light">×</span>
            </button>

            <div className="p-8">
              {/* TOP ROW: Date & Conditions */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Date</p>
                  <p className="text-xl font-black text-slate-900 leading-none">
                    {new Date(log.created_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-blue-100">
                    {log.weather}
                  </span>
                </div>
              </div>

              {/* CREW BADGES */}
              <div className="flex flex-wrap gap-2 mb-6">
                {log.trades_detailed && Object.entries(log.trades_detailed).map(([trade, count]) => (
                  <div key={trade} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{trade}</span>
                    <span className="bg-slate-900 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">{count as any}</span>
                  </div>
                ))}
              </div>

              {/* WORK SUMMARY */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Work Progress</h3>
                <p className="text-slate-700 text-sm font-medium leading-relaxed line-clamp-3">
                  {log.work_performed}
                </p>
              </div>

              {/* PHOTO THUMBNAILS */}
              {log.photo_urls && log.photo_urls.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {log.photo_urls.slice(0, 4).map((url: string, index: number) => (
                    <div key={index} className="aspect-square rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative">
                      <img src={url} alt="Site" className="w-full h-full object-cover" />
                      {index === 3 && log.photo_urls.length > 4 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-black text-xs">
                          +{log.photo_urls.length - 4}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ACTION: VIEW FULL PDF */}
              <Link 
                href={`/logs/${log.id}`} 
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                📄 View & Generate PDF Report
              </Link>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">Site database is empty</p>
          </div>
        )}
      </div>
    </div>
  )
}