'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SingleIncidentPDF() {
  const { id } = useParams()
  const [incident, setIncident] = useState<any>(null)
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    async function getFullData() {
      const { data: incData } = await supabase.from('site_incidents').select('*').eq('id', id).single()
      
      if (incData) {
        setIncident(incData)
        if (incData.project_id) {
          const { data: projData } = await supabase.from('projects').select('*').eq('id', incData.project_id).single()
          if (projData) setProject(projData)
        }
      }
    }
    getFullData()
  }, [id])

  if (!incident) return <div className="p-20 text-center font-black text-slate-400">RETRIEVING SECURE RECORD...</div>

  const reportNumber = String(incident.id || '').substring(0, 8).toUpperCase()
  const isCritical = incident.severity === 'Critical' || incident.classification === 'Fatality'

  return (
    <div className="max-w-[8.5in] mx-auto p-12 bg-white min-h-screen font-serif" id="print-area">
      
      {/* 🚨 CONFIDENTIAL HEADER */}
      <div className={`flex justify-between items-start border-b-4 pb-8 mb-8 ${isCritical ? 'border-red-600' : 'border-slate-900'}`}>
        <div>
          <div className={`w-16 h-16 text-white flex items-center justify-center font-black text-2xl mb-4 ${isCritical ? 'bg-red-600' : 'bg-slate-900'}`}>
            B
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">
            Official Incident Report
          </h1>
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mt-1">
            Confidential Legal Record | Barrie, ON
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Incident ID</p>
          <p className="font-mono text-sm font-bold">#{reportNumber}</p>
          <button 
            onClick={() => window.print()} 
            className="mt-6 bg-red-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest print:hidden shadow-lg hover:bg-red-700 transition-all"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* 📍 SITE & TIMING DETAILS */}
      <div className="grid grid-cols-2 gap-12 mb-10 pb-10 border-b border-slate-100">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Project Location</p>
          <p className="text-sm font-bold text-slate-800">{project?.name || 'Unspecified Site'}</p>
          <p className="text-xs text-slate-500 mt-1">{project?.address || 'Address Not Provided'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Date & Time Logged</p>
            <p className="text-sm font-bold text-slate-800">
              {new Date(incident.created_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(incident.created_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Severity Level</p>
            <p className={`text-sm font-black uppercase ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
              {incident.severity}
            </p>
          </div>
        </div>
      </div>

      {/* 📋 CLASSIFICATION & PARTIES */}
      <div className="grid grid-cols-2 gap-12 mb-10 pb-10 border-b border-slate-100">
        <div>
          <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-4 tracking-widest">Incident Classification</h3>
          <p className="text-sm font-bold uppercase text-slate-800 pl-2">{incident.classification || 'General Incident'}</p>
        </div>
        <div>
          <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-4 tracking-widest">Personnel Involved</h3>
          <p className="text-sm font-bold text-slate-800 pl-2">{incident.involved_parties}</p>
        </div>
      </div>

      {/* 📝 NARRATIVE */}
      <div className="mb-10">
        <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-4 tracking-widest">Official Narrative & Corrective Actions</h3>
        <p className="text-slate-800 leading-loose text-sm whitespace-pre-wrap pl-4 border-l-4 border-slate-200">
          {incident.description}
        </p>
      </div>

      {/* 📸 EVIDENCE */}
      {incident.evidence_urls && incident.evidence_urls.length > 0 && (
        <div className="mt-12 break-inside-avoid">
          <h3 className="text-[10px] font-black text-slate-900 uppercase bg-slate-50 p-2 mb-6 tracking-widest">Attached Evidence</h3>
          <div className="grid grid-cols-2 gap-6">
            {incident.evidence_urls.map((url: string, i: number) => {
              if (url.includes('.pdf')) {
                return (
                   <div key={i} className="p-4 border-2 border-slate-200 rounded-lg text-center bg-slate-50">
                     <p className="text-[10px] font-bold text-slate-500 uppercase">External PDF Document Attached</p>
                     <a href={url} target="_blank" className="text-blue-600 text-xs font-bold print:hidden">View File</a>
                   </div>
                )
              }
              return (
                <div key={i} className="break-inside-avoid">
                  <img src={url} className="w-full h-72 object-cover rounded-sm border-2 border-slate-300" />
                  <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold text-center">Exhibit {i + 1}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ✍️ SIGN-OFF */}
      <div className="mt-24 flex justify-between items-end border-t-2 border-slate-900 pt-8 break-inside-avoid">
        <div className="w-64">
          <p className="text-[9px] font-black text-slate-400 uppercase mb-12 tracking-widest">Authorized Safety Officer Sign-Off</p>
          <div className="w-full h-px bg-slate-400 mb-2"></div>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Signature / Date</p>
        </div>
        <div className="text-right text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">
          End of Document | System Generated Report
        </div>
      </div>
    </div>
  )
}