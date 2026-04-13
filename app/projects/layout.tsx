'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const isViewer = pathname.includes('/viewer/')

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase
        .from('projects')
        .select('id, name, location, status')
        .order('name', { ascending: true })
      setProjects(data || [])
      setLoading(false)
    }
    fetchProjects()
  }, [])

  // Helper to map status to Procore-grade colors
  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return { color: 'bg-emerald-500', label: 'Active', pulse: true }
      case 'in prep': return { color: 'bg-amber-500', label: 'In Prep', pulse: false }
      case 'on hold': return { color: 'bg-red-500', label: 'On Hold', pulse: false }
      case 'completed': return { color: 'bg-slate-500', label: 'Closed', pulse: false }
      default: return { color: 'bg-slate-700', label: 'Unknown', pulse: false }
    }
  }

  if (isViewer) return <>{children}</>

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <Link href="/projects" className="group">
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1 group-hover:text-white transition-colors">SiteMaster Pro</h2>
            <p className="text-xs font-bold text-slate-500 uppercase italic">Ontario Portfolio</p>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-4 ml-2">Job Site Status</p>
          
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            projects.map((p) => {
              const status = getStatusConfig(p.status)
              return (
                <Link 
                  key={p.id} 
                  href={`/projects/${p.id}`}
                  className={`relative flex flex-col p-4 rounded-2xl transition-all border group ${
                    id === p.id 
                      ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20' 
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {/* Status Indicator Dot */}
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[11px] font-black uppercase italic truncate pr-4">{p.name}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[7px] font-black uppercase tracking-tighter ${id === p.id ? 'text-blue-200' : 'text-slate-500'}`}>
                        {status.label}
                      </span>
                      <div className="relative flex h-2 w-2">
                        {status.pulse && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.color} opacity-75`}></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${status.color}`}></span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-[8px] font-bold uppercase ${id === p.id ? 'text-blue-200' : 'text-slate-500'}`}>
                    📍 {p.location}
                  </span>
                </Link>
              )
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={() => router.push('/projects')} className="w-full py-3 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all">📂 Full Directory</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative bg-slate-950">
        <div className="min-h-full">
          {children}
        </div>
      </main>

    </div>
  )
}