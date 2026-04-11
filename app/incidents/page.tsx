'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function IncidentFeed() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    // Fetch both tables so we can match the project IDs to their real names
    const { data: incData } = await supabase.from('site_incidents').select('*').order('created_at', { ascending: false })
    const { data: projData } = await supabase.from('projects').select('*')
    
    if (incData) setIncidents(incData)
    if (projData) setProjects(projData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown Project'

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Accessing Secure Safety Records...</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-100 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 pt-6 border-b-4 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Safety Ledger</h1>
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Incident Master File</p>
        </div>
        <Link 
          href="/incidents/new" 
          className="bg-red-600 text-white px-6 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all"
        >
          + File Report
        </Link>
      </div>

      <div className="space-y-6">
        {incidents.map((incident) => (
          <div key={incident.id} className="bg-white rounded-[40px] shadow-sm border-2 border-slate-200 overflow-hidden relative">
            
            {/* COLOR BAR BASED ON SEVERITY */}
            <div className={`h-3 w-full ${
              incident.severity === 'Critical' || incident.classification === 'Fatality' ? 'bg-red-600' :
              incident.severity === 'Major' ? 'bg-orange-500' : 'bg-amber-400'
            }`} />

            <div className="p-8">
              {/* TOP ROW: Date & Location */}
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Logged</p>
                  <p className="text-lg font-black text-slate-900 leading-none">
                    {new Date(incident.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Site Location</p>
                  <p className="text-sm font-bold text-slate-800 uppercase">{getProjectName(incident.project_id)}</p>
                </div>
              </div>

              {/* BADGES: Classification & Severity */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  {incident.classification || 'Incident'}
                </span>
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  incident.severity === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                  incident.severity === 'Major' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Severity: {incident.severity}
                </span>
              </div>

              {/* NARRATIVE */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Incident Narrative</h3>
                <p className="text-slate-700 text-sm font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-wrap">
                  {incident.description}
                </p>
              </div>

              {/* PARTIES INVOLVED */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Personnel Involved</h3>
                <p className="text-slate-900 text-sm font-bold uppercase">{incident.involved_parties}</p>
              </div>

              {/* EVIDENCE GRID */}
              {incident.evidence_urls && incident.evidence_urls.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Attached Evidence</h3>
                  <div className="flex flex-wrap gap-3">
                    {incident.evidence_urls.map((url: string, index: number) => (
                      <a key={index} href={url} target="_blank" rel="noreferrer" className="w-20 h-20 relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center hover:border-blue-400 transition-colors">
                        {url.includes('.pdf') ? (
                          <div className="text-center p-2">
                            <div className="text-2xl mb-1">📄</div>
                            <div className="text-[8px] font-bold text-slate-500 uppercase">PDF Form</div>
                          </div>
                        ) : (
                          <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* OFFICIAL PDF BUTTON */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link 
                  href={`/incidents/${incident.id}`} 
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                >
                  📄 View & Generate Official PDF
                </Link>
              </div>

            </div>
          </div>
        ))}

        {incidents.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
            <div className="text-4xl mb-4">🛡️</div>
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Zero Incidents on File</p>
          </div>
        )}
      </div>
    </div>
  )
}