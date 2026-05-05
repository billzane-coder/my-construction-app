'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Printer, Users, HardHat, 
  Search, ShieldCheck, Loader2, Clock 
} from 'lucide-react'

export default function OrientationAdmin() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [orientations, setOrientations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      
      // Generate the dynamic URL for the public worker form
      const baseUrl = window.location.origin
      const publicOrientationLink = `${baseUrl}/orientation/${id}`
      // Use a free API to generate the QR code image
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(publicOrientationLink)}`)

      const [pRes, oRes] = await Promise.all([
        supabase.from('projects').select('name, address').eq('id', id).single(),
        supabase.from('site_orientations').select('*').eq('project_id', id).order('created_at', { ascending: false })
      ])
      
      if (pRes.data) setProject(pRes.data)
      if (oRes.data) setOrientations(oRes.data)
      
      setLoading(false)
    }
    fetchData()
  }, [id])

  const filtered = orientations.filter(o => 
    o.worker_name?.toLowerCase().includes(search.toLowerCase()) || 
    o.company?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Loading Roster...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 print:bg-white min-h-screen font-sans text-slate-100 print:text-black pb-32 print:p-0 print:pb-0">
      
      {/* --- PRINT STYLES --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0.5in; size: portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        }
      `}} />

      {/* --- 🖨️ THE PRINTABLE POSTER (Hidden on screen, visible on print) --- */}
      <div className="hidden print-only print-container">
        <ShieldCheck size={80} color="#3b82f6" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '48px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px' }}>Mandatory Site Orientation</h1>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '40px' }}>{project?.name}</h2>
        
        <div style={{ padding: '20px', border: '8px solid #0f172a', borderRadius: '40px', marginBottom: '40px' }}>
          <img src={qrUrl} alt="Scan to Sign In" style={{ width: '400px', height: '400px' }} />
        </div>
        
        <p style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase' }}>1. Open Camera App</p>
        <p style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase' }}>2. Scan QR Code</p>
        <p style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase' }}>3. Read Rules & Sign Digitally</p>
        <p style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444', marginTop: '30px', textTransform: 'uppercase' }}>No Entry Without Digital Sign-Off</p>
      </div>

      {/* --- 💻 THE SCREEN DASHBOARD (Visible on screen, hidden on print) --- */}
      <div className="no-print">
        <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
              <ChevronLeft size={14} /> War Room
            </button>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Site <span className="text-blue-500">Orientation</span></h1>
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 text-white text-[10px] font-black px-8 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
            <Printer size={16} /> Print Trailer Poster
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* QR CODE DISPLAY */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl flex flex-col items-center text-center">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Live QR Code</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Workers scan this to complete induction</p>
              
              <div className="bg-white p-4 rounded-3xl mb-6 shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
                <img src={qrUrl} alt="Orientation QR" className="w-full max-w-[250px] aspect-square object-contain" />
              </div>
              
              <div className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Direct Link</p>
                <p className="text-xs font-bold text-blue-400 truncate">{window.location.origin}/orientation/{id}</p>
              </div>
            </div>

            <div className="bg-blue-950/20 border border-blue-900/50 p-6 rounded-[32px] flex items-center gap-4">
              <div className="bg-blue-600/20 p-3 rounded-2xl"><Users size={24} className="text-blue-500" /></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Inducted</p>
                <p className="text-3xl font-black text-white">{orientations.length}</p>
              </div>
            </div>
          </div>

          {/* ACTIVE ROSTER */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 md:p-8 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Approved Roster</h3>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input 
                  type="text" placeholder="Search by name or trade..." 
                  className="w-full bg-slate-950 border border-slate-800 p-3 pl-10 rounded-xl text-base md:text-sm outline-none focus:border-blue-500 font-bold"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[600px] custom-scrollbar p-6">
              <div className="space-y-4">
                {filtered.map((o) => (
                  <div key={o.id} className="bg-slate-950 border border-slate-800 p-5 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-blue-900/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 shrink-0">
                        <HardHat size={20} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tight">{o.worker_name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{o.company} • {o.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                      <div className="text-left md:text-right">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={10}/> Completed</p>
                        <p className="text-[10px] font-bold text-slate-400">{new Date(o.created_at).toLocaleDateString()} {new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      {o.signature_url && (
                        <div className="bg-white p-1 rounded-xl shrink-0">
                          <img src={o.signature_url} crossOrigin="anonymous" className="h-8 w-16 object-contain mix-blend-multiply" alt="Sign" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No workers found in roster.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}