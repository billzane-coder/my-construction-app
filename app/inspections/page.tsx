'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function InspectionsHub() {
  const [inspections, setInspections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInspections() {
      const { data } = await supabase
        .from('site_inspections')
        .select('*, projects(name), inspection_templates(name)')
        .order('created_at', { ascending: false })
      
      if (data) setInspections(data)
      setLoading(false)
    }
    fetchInspections()
  }, [])

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-950 min-h-screen pb-24 font-sans text-slate-100">
      
      {/* HEADER */}
      <div className="mb-6 pt-4 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic leading-none">
          Phase <span className="text-blue-500 underline decoration-blue-500 decoration-4 underline-offset-4">Audits</span>
        </h1>
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-3 font-mono">
          Master Building Records // Multi-Unit
        </p>
      </div>

      {/* ACTION BUTTON */}
      <Link href="/inspections/new" className="block w-full bg-blue-600 text-white text-center font-black py-5 rounded-[32px] shadow-[0_0_20px_rgba(37,99,235,0.2)] active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px] mb-8 border border-blue-400/30">
        + Run New Site Inspection
      </Link>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="uppercase font-black text-slate-500 text-[10px] animate-pulse font-mono">Scanning Audit Logs...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-[32px]">
              <p className="text-[10px] font-black text-slate-600 uppercase">No Inspections Recorded Yet</p>
            </div>
          ) : (
            inspections.map((ins) => (
              <Link 
                href={`/inspections/${ins.id}`} 
                key={ins.id} 
                className="group block bg-slate-900 p-6 rounded-[32px] border border-slate-800 hover:border-blue-500 transition-all active:scale-[0.98] relative shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[9px] font-black bg-blue-900/40 text-blue-400 px-2 py-1 rounded border border-blue-500/20 uppercase tracking-tighter mb-2 inline-block font-mono">
                      UNIT {ins.unit_number || 'GEN'}
                    </span>
                    <h2 className="text-sm font-black uppercase text-white leading-tight">
                      {ins.inspection_templates?.name || 'Site Audit'}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      {new Date(ins.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase">
                    Project: <span className="text-blue-500">{ins.projects?.name}</span>
                  </p>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                    ID: {ins.id.slice(0,8)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}