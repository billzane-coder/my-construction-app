'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ProjectsMaster() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    if (data) setProjects(data)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.target)
    await supabase.from('projects').insert([{
      name: formData.get('name'),
      client_name: formData.get('client_name'),
      address: formData.get('address')
    }])

    e.target.reset()
    setLoading(false)
    fetchProjects() // Instantly refresh the list
  }

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-100 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 pt-6 border-b-4 border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Job Sites</h1>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Active Project Roster</p>
        </div>
        <Link href="/dashboard" className="text-[10px] font-black text-slate-400 uppercase hover:text-blue-600">← Command Center</Link>
      </div>

      {/* QUICK SPIN-UP FORM */}
      <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-[32px] shadow-xl mb-10 space-y-4 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Initialize New Project</h2>
          
          <input name="name" required placeholder="Internal Project Name (e.g. Bayfield Reno)" className="w-full p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input name="client_name" placeholder="Client / GC Name" className="p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="address" placeholder="Site Address" className="p-4 bg-white/10 text-white placeholder-slate-400 border border-white/10 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-[10px]">
            {loading ? 'Initializing...' : 'Add Project to System'}
          </button>
        </div>
        
        {/* Visual Flair */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      </form>

      {/* ACTIVE ROSTER */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Current Sites</h2>
        
        {projects.map(project => (
          <div key={project.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-blue-300 transition-colors">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">{project.name}</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{project.address || 'No Address Provided'}</p>
            </div>
            
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
              <div className="text-left md:text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Client / GC</p>
                <p className="text-sm font-black text-slate-800">{project.client_name || 'N/A'}</p>
              </div>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="text-center py-12 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">No Active Projects</p>
          </div>
        )}
      </div>
    </div>
  )
}