'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { Share2, Printer, CloudSun, HardHat, Plus, History, MapPin, Send } from 'lucide-react'

export default function DailyLogManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [proj, logData] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('daily_logs').select('*').eq('project_id', id).order('created_at', { ascending: false })
    ])
    setProject(proj.data)
    setLogs(logData.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAddLog = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    const fd = new FormData(e.currentTarget)
    
    const newLog = {
      project_id: id,
      work_performed: fd.get('work_performed'),
      weather: fd.get('weather') || 'Clear / Site Standard',
      crew_size: fd.get('crew_size'),
      notes: fd.get('notes'),
      location_name: project?.address || project?.location // Fallback to Project Address
    }

    const { error } = await supabase.from('daily_logs').insert([newLog])
    if (!error) {
      (e.target as HTMLFormElement).reset()
      fetchData()
    }
    setIsSaving(false)
  }

  const handleShare = async () => {
    // Generate a clean text summary for SMS/Email
    const latestLog = logs[0]
    if (!latestLog) return alert("No logs to share yet.")

    const shareBody = `
🏗️ DAILY REPORT: ${project?.name}
📅 Date: ${new Date(latestLog.created_at).toLocaleDateString()}
👷 Crew Size: ${latestLog.crew_size}
🌦️ Weather: ${latestLog.weather}

WORK PERFORMED:
${latestLog.work_performed}

NOTES:
${latestLog.notes || 'No additional notes.'}

📍 Location: ${latestLog.location_name}
    `.trim()

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Daily Report - ${project?.name}`,
          text: shareBody,
          url: window.location.href
        })
      } catch (e) { window.print() }
    } else {
      // Fallback: Copy to clipboard if share isn't supported
      navigator.clipboard.writeText(shareBody)
      alert("Report copied to clipboard! You can now paste it into a text or email.")
    }
  }

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Syncing Field Logs...</div>

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-12 bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 border-b border-slate-800 pb-8 print:hidden">
        <div>
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 mb-2 hover:text-white transition-all">← War Room</button>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Daily <span className="text-blue-500">Logs</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">Project: {project?.name}</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleShare} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
            <Send size={16} /> Share Latest
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* NEW LOG ENTRY FORM */}
      <div className="bg-slate-900/50 p-6 rounded-[32px] border border-slate-800 mb-12 shadow-2xl print:hidden">
        <form onSubmit={handleAddLog} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Weather Condition</label>
               <div className="relative">
                 <CloudSun className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                 <input name="weather" placeholder="e.g. Sunny / 18°C" className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-xl font-bold outline-none focus:border-blue-500 text-sm" />
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Total Crew On Site</label>
               <div className="relative">
                 <HardHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                 <input name="crew_size" type="number" placeholder="0" className="w-full bg-slate-950 border border-slate-800 p-4 pl-12 rounded-xl font-bold outline-none focus:border-blue-500 text-sm" />
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Location Context</label>
               <div className="relative opacity-50">
                 <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                 <input disabled value={project?.address || project?.location} className="w-full bg-slate-900 border border-slate-800 p-4 pl-12 rounded-xl font-bold text-sm cursor-not-allowed" />
               </div>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Work Performed Today</label>
            <textarea name="work_performed" required rows={3} placeholder="Describe the main tasks completed..." className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold outline-none focus:border-blue-500 text-sm" />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Internal Notes / Delays</label>
            <textarea name="notes" rows={2} placeholder="Any inspections, delays, or issues?" className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl font-bold outline-none focus:border-blue-500 text-sm" />
          </div>

          <button disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase text-xs transition-all shadow-xl shadow-blue-900/30 flex items-center justify-center gap-3">
            <Plus size={18} /> {isSaving ? 'Submitting to Cloud...' : 'Submit Daily Report'}
          </button>
        </form>
      </div>

      {/* LOG HISTORY */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4 opacity-50 print:hidden">
          <History size={18} />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em]">Project History</h2>
        </div>

        {logs.map((log) => (
          <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-xl print:border-b print:rounded-none print:shadow-none print:bg-white print:text-black mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-lg">
                  {new Date(log.created_at).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-2">📍 {log.location_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-white uppercase italic">{log.weather}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-1">Crew Size: {log.crew_size}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Work Performed</p>
                <p className="text-sm font-bold text-slate-200 leading-relaxed print:text-black">{log.work_performed}</p>
              </div>
              {log.notes && (
                <div className="pt-4 border-t border-slate-800/50">
                  <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Field Notes</p>
                  <p className="text-xs font-medium text-slate-400 italic leading-relaxed print:text-black">{log.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* PRINT STYLING */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-slate-950, .bg-slate-900 { background: white !important; color: black !important; }
          .text-slate-100, .text-white, .text-blue-500, .text-slate-400 { color: black !important; }
          .print\\:hidden { display: none !important; }
          .rounded-\\[32px\\] { border-radius: 0 !important; border-bottom: 2px solid #000 !important; padding: 20px 0 !important; }
        }
      `}</style>

    </div>
  )
}