'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SubTradePortal() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<any>(null)
  
  const [trades, setTrades] = useState<string[]>([])
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null)
  
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase.from('projects').select('*').order('name')
      if (data) setProjects(data)
      setLoading(false)
    }
    fetchProjects()
  }, [])

  const loadTradesForProject = async (project: any) => {
    setLoading(true)
    setSelectedProject(project)
    
    const { data } = await supabase
      .from('punch_list')
      .select('assigned_to')
      .eq('project_id', project.id)
      .neq('status', 'Verified')

    if (data) {
      const uniqueTrades = [...new Set(data.map(d => d.assigned_to || 'General'))]
      setTrades(uniqueTrades as string[])
    }
    setLoading(false)
  }

  const loadTradeTickets = async (trade: string) => {
    setLoading(true)
    setSelectedTrade(trade)
    
    const { data } = await supabase
      .from('punch_list')
      .select('*')
      .eq('project_id', selectedProject.id)
      .eq('assigned_to', trade === 'General' ? null : trade)
      .neq('status', 'Verified')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) setTickets(data)
    setLoading(false)
  }

  const handleFixWithPhoto = async (ticketId: string, file: File) => {
    setUpdatingId(ticketId)
    
    const fileName = `resolutions/${Date.now()}-${file.name.replace(/\s/g, '_')}`
    const { data: uploadData, error: uploadError } = await supabase.storage.from('site-photos').upload(fileName, file)
    
    if (uploadError) {
      alert(`Photo upload failed: ${uploadError.message}`)
      setUpdatingId(null)
      return
    }

    const photoUrl = supabase.storage.from('site-photos').getPublicUrl(fileName).data.publicUrl

    const { error: dbError } = await supabase
      .from('punch_list')
      .update({ 
        status: 'Fixed',
        resolution_photo_url: photoUrl
      })
      .eq('id', ticketId)

    if (!dbError) {
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: 'Fixed', resolution_photo_url: photoUrl } : t))
    } else {
      alert("Failed to update ticket status.")
    }
    setUpdatingId(null)
  }

  if (!selectedProject) {
    return (
      <div className="max-w-md mx-auto p-6 bg-slate-950 min-h-screen font-sans flex flex-col justify-center">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Trade <span className="text-blue-500 underline decoration-4">Portal</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Select your job site to begin.</p>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-slate-500 animate-pulse font-bold uppercase text-xs">Locating Sites...</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-slate-500 font-bold uppercase text-xs">No projects found.</div>
          ) : (
            projects.map(proj => (
              <button key={proj.id} onClick={() => loadTradesForProject(proj)} className="w-full bg-slate-900 hover:bg-slate-800 transition-all text-white font-black py-6 rounded-[32px] border border-slate-800 text-lg shadow-xl uppercase tracking-widest">
                {proj.name}
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  if (!selectedTrade) {
    return (
      <div className="max-w-md mx-auto p-6 bg-slate-950 min-h-screen font-sans flex flex-col justify-center">
        <div className="mb-10 text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{selectedProject.name}</p>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">Select <span className="text-emerald-500 underline decoration-4">Trade</span></h1>
        </div>
        <div className="space-y-3">
          {loading ? (
             <div className="text-center text-slate-500 animate-pulse font-bold uppercase text-xs">Loading Trades...</div>
          ) : trades.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-800 rounded-[32px] text-emerald-500 font-bold uppercase text-xs">
              ✓ Site is 100% Clear.
            </div>
          ) : (
            trades.map(trade => (
              <button key={trade} onClick={() => loadTradeTickets(trade)} className="w-full bg-slate-900 hover:bg-slate-800 transition-all text-white font-black py-6 rounded-[32px] border border-slate-800 text-lg shadow-xl uppercase tracking-widest">
                {trade}
              </button>
            ))
          )}
        </div>
        <button onClick={() => setSelectedProject(null)} className="mt-8 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all text-center w-full">← Change Site</button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-950 min-h-screen pb-20 font-sans text-slate-100">
      
      <div className="flex flex-col mb-6 pt-2 pb-4 border-b border-slate-800">
        <div className="flex justify-between items-start mb-2">
          <button onClick={() => setSelectedTrade(null)} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all">← Back</button>
          <span className="text-[9px] font-bold text-slate-600 uppercase bg-slate-900 px-3 py-1 rounded-full">{selectedProject.name}</span>
        </div>
        <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">{selectedTrade} <span className="text-blue-500">Queue</span></h1>
      </div>

      {loading ? (
        <div className="p-10 text-center font-black text-slate-500 uppercase animate-pulse">Loading Tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed border-slate-800 rounded-[32px] text-emerald-500 font-black uppercase text-sm tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          ✓ Queue Cleared.
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map(ticket => (
            <div key={ticket.id} className={`bg-slate-900 p-5 rounded-[32px] border-2 shadow-xl transition-all flex flex-col ${
              ticket.status === 'Fixed' ? 'border-emerald-900/50 opacity-80' : 
              ticket.priority === 'Urgent' ? 'border-red-500/50' : 'border-slate-800'
            }`}>
              
              {ticket.photo_url && (
                <div className="mb-4">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Original Issue:</p>
                  <img src={ticket.photo_url} className="w-full h-40 object-cover rounded-2xl border border-slate-800" alt="Deficiency" />
                </div>
              )}

              <div className="flex-1">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                    ticket.status === 'Fixed' ? 'bg-emerald-900/40 text-emerald-400' :
                    ticket.priority === 'Urgent' ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-900/40 text-amber-400'
                  }`}>
                    {ticket.status === 'Fixed' ? 'Pending Super Review' : ticket.priority || 'Medium'}
                  </span>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter bg-blue-950/30 px-3 py-1 rounded-full border border-blue-900/30">
                    {ticket.location}
                  </span>
                </div>

                <h4 className={`text-lg font-black leading-tight mb-2 uppercase ${ticket.status === 'Fixed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {ticket.description}
                </h4>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-800">
                {ticket.status === 'Fixed' ? (
                  <div>
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">✓ Repair Submitted</p>
                    {ticket.resolution_photo_url && (
                      <img src={ticket.resolution_photo_url} className="w-24 h-24 object-cover rounded-xl border border-emerald-900/50" alt="Fixed proof" />
                    )}
                  </div>
                ) : (
                  <label className={`block w-full text-center text-[10px] font-black px-6 py-4 rounded-full uppercase tracking-widest transition-all cursor-pointer ${
                    updatingId === ticket.id ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                  }`}>
                    {updatingId === ticket.id ? 'UPLOADING...' : '📸 TAKE PHOTO TO FIX'}
                    
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      disabled={updatingId === ticket.id}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFixWithPhoto(ticket.id, e.target.files[0])
                        }
                      }} 
                    />
                  </label>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}