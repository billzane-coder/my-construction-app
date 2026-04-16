'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, ChevronLeft, LayoutDashboard, FolderKanban } from 'lucide-react'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams()
  const pathname = usePathname()
  const router = useRouter()
  
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // UI States
  const [isCollapsed, setIsCollapsed] = useState(false) // Desktop fully hides
  const [isMobileOpen, setIsMobileOpen] = useState(false) 

  const isViewer = pathname.includes('/viewer/')

  useEffect(() => {
    async function fetchProjects() {
      const { data } = await supabase.from('projects').select('id, name, location, status').order('name', { ascending: true })
      setProjects(data || [])
      setLoading(false)
    }
    fetchProjects()
  }, [])

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
      
      {isMobileOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* SIDEBAR: Shrinks to w-0 on desktop when collapsed */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[70] bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-500 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-0 md:-translate-x-full md:opacity-0 md:border-none' : 'md:w-72 md:opacity-100'}
        `}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between min-h-[90px] whitespace-nowrap">
          <Link href="/projects" className="group">
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-1 group-hover:text-white transition-colors">SiteMaster Pro</h2>
            <p className="text-xs font-bold text-slate-500 uppercase italic">Ontario Portfolio</p>
          </Link>
          <button onClick={() => setIsCollapsed(true)} className="hidden md:flex p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-4 ml-2 whitespace-nowrap">Job Site Status</p>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : (
            projects.map((p) => {
              const status = getStatusConfig(p.status)
              const isActive = id === p.id
              return (
                <Link 
                  key={p.id} href={`/projects/${p.id}`} onClick={() => setIsMobileOpen(false)}
                  className={`relative flex items-center p-3 rounded-2xl transition-all border group overflow-hidden whitespace-nowrap ${isActive ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800'}`}
                >
                  <div className="flex flex-col w-full">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[11px] font-black uppercase italic truncate pr-4">{p.name}</span>
                      <div className="flex items-center gap-1.5 mt-1 shrink-0">
                        <div className="relative flex h-2 w-2">
                          {status.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status.color} opacity-75`}></span>}
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${status.color}`}></span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[8px] font-bold uppercase truncate ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>📍 {p.location}</span>
                  </div>
                </Link>
              )
            })
          )}
        </div>
        <div className="p-4 border-t border-slate-800 space-y-2 whitespace-nowrap">
           <button onClick={() => router.push('/projects')} className="w-full py-3 bg-slate-950 border border-slate-800 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:text-white transition-all flex items-center justify-center gap-2">
             <FolderKanban size={14} /> <span>Full Directory</span>
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-500 ${isCollapsed ? 'md:ml-0' : 'md:ml-72'}`}>
        
        {/* FLOATING MENU BUTTON (Appears when desktop sidebar is collapsed) */}
        {isCollapsed && (
          <button 
            onClick={() => setIsCollapsed(false)} 
            className="hidden md:flex absolute top-6 left-6 z-50 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white shadow-2xl transition-all animate-in fade-in zoom-in"
          >
            <Menu size={24} />
          </button>
        )}

        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 z-50">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-slate-400 hover:text-white"><Menu size={24} /></button>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">SiteMaster Pro</span>
          <div className="w-10" />
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-950 custom-scrollbar">
          {children}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  )
}