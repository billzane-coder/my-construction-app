'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewDailyLog() {
  const router = useRouter()
  
  const [projects, setProjects] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [selectedTrades, setSelectedTrades] = useState<Record<string, number>>({})
  const [weather, setWeather] = useState('FETCHING BARRIE WEATHER...')
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  useEffect(() => {
    async function getData() {
      const { data: projData } = await supabase.from('projects').select('*').order('name')
      const { data: tradeData } = await supabase.from('trades').select('*').order('name')
      if (projData) setProjects(projData)
      if (tradeData) setTrades(tradeData)
      
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=44.3894&longitude=-79.6903&current=temperature_2m,weather_code&timezone=auto')
        const wData = await res.json()
        setWeather(`${wData.current.weather_code < 3 ? '☀️ SUNNY' : '☁️ OVERCAST'}, ${Math.round(wData.current.temperature_2m)}°C`)
      } catch (e) { setWeather('6°C, SUNNY (BARRIE)') }
    }
    getData()
  }, [])

  useEffect(() => {
    async function checkIncidents() {
      if (!selectedProjectId) {
        setIncidents([])
        setSelectedIncidentId(null)
        return
      }
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('site_incidents')
        .select('*')
        .eq('project_id', selectedProjectId)
        .gte('created_at', fortyEightHoursAgo)
      setIncidents(data || [])
    }
    checkIncidents()
  }, [selectedProjectId])

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId);
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b82f6'; 
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSigned(true);
  }

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId);
  }

  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!selectedProjectId) return setStatus('⚠️ SELECT PROJECT')
    if (!hasSigned) return setStatus('⚠️ SIGNATURE REQUIRED')
    setLoading(true)
    
    try {
      const uploadedUrls: string[] = []
      for (const file of photos) {
        const fileName = `${Date.now()}-${file.name}`
        const { data } = await supabase.storage.from('site-photos').upload(`logs/${fileName}`, file)
        if (data) {
          const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(`logs/${fileName}`)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      let finalSignatureUrl = null
      if (canvasRef.current && hasSigned) {
        const sigDataUrl = canvasRef.current.toDataURL('image/png')
        const res = await fetch(sigDataUrl)
        const blob = await res.blob()
        const sigFileName = `signatures/${Date.now()}-sig.png`
        const { data: sigData } = await supabase.storage.from('site-photos').upload(sigFileName, blob)
        if (sigData) {
          finalSignatureUrl = supabase.storage.from('site-photos').getPublicUrl(sigFileName).data.publicUrl
        }
      }

      const { error } = await supabase.from('daily_logs').insert([{
        project_id: selectedProjectId,
        work_performed: new FormData(e.target).get('work'),
        weather,
        trades_detailed: selectedTrades,
        photo_urls: uploadedUrls,
        linked_incident_id: selectedIncidentId,
        signature_url: finalSignatureUrl
      }])

      if (error) throw error
      router.push('/logs')
    } catch (err) {
      setLoading(false)
      setStatus('❌ ERROR SAVING LOG')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-950 min-h-screen pb-20 font-sans text-slate-100">
      
      {/* HEADER - UPDATED TO NEW DAILY LOG */}
      <div className="mb-6 pt-4 border-b border-slate-800 pb-4">
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">
            NEW <span className="text-blue-500 underline decoration-blue-500 decoration-4 underline-offset-4">DAILY LOG</span>
          </h1>
          <Link href="/logs" className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
            ← CANCEL
          </Link>
        </div>
        <p className="text-[10px] font-black text-blue-400 font-mono tracking-widest uppercase">{weather}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* PROJECT SELECT */}
        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Active Site</label>
          <select 
            required value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="text-white">Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id} className="text-white">{p.name}</option>)}
          </select>
        </div>

        {/* INCIDENT ALERT SECTION */}
        {incidents.length > 0 && (
          <div className="bg-red-950/20 p-5 rounded-[32px] border-2 border-red-900/50 shadow-lg">
            <label className="block text-[10px] font-black text-red-500 uppercase mb-3 tracking-widest animate-pulse">🚨 Link Recent Incidents</label>
            <div className="space-y-2">
              {incidents.map(inc => (
                <label key={inc.id} className={`flex gap-3 items-center p-3 rounded-2xl border-2 transition-all cursor-pointer ${selectedIncidentId === inc.id ? 'bg-slate-900 border-red-600 shadow-md' : 'bg-slate-900/50 border-transparent'}`}>
                  <input 
                    type="radio" name="incident"
                    checked={selectedIncidentId === inc.id}
                    onChange={() => setSelectedIncidentId(inc.id)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <div>
                    <p className="text-[10px] font-black text-red-400 uppercase">{inc.classification}</p>
                    <p className="text-xs font-bold text-slate-300 line-clamp-1 italic">"{inc.description}"</p>
                  </div>
                </label>
              ))}
              {selectedIncidentId && (
                 <button type="button" onClick={() => setSelectedIncidentId(null)} className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2 w-full text-center">Clear Selection</button>
              )}
            </div>
          </div>
        )}

        {/* TRADES GRID */}
        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Trades On-Site</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {trades.map(t => (
              <button key={t.id} type="button" 
                onClick={() => setSelectedTrades(prev => {
                  const n = { ...prev }; if (n[t.name]) delete n[t.name]; else n[t.name] = 1; return n;
                })}
                className={`p-3 text-[10px] font-black rounded-xl border transition-all uppercase ${selectedTrades[t.name] ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-800 text-slate-50 text-slate-500 border-slate-700'}`}>
                {t.name}
              </button>
            ))}
          </div>

          {Object.entries(selectedTrades).map(([name, count]) => (
            <div key={name} className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 mt-2">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2">{name}</span>
              <div className="flex items-center gap-4">
                <button type="button" 
                  onClick={() => setSelectedTrades(prev => ({...prev, [name]: Math.max(1, prev[name] - 1)}))} 
                  className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full font-black text-white shadow-sm active:bg-slate-700">-</button>
                <span className="font-black text-blue-500 w-4 text-center text-lg">{count}</span>
                <button type="button" 
                  onClick={() => setSelectedTrades(prev => ({...prev, [name]: prev[name] + 1}))} 
                  className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full font-black text-white shadow-sm active:bg-slate-700">+</button>
              </div>
            </div>
          ))}
        </div>

        {/* WORK NARRATIVE */}
        <textarea name="work" required placeholder="Describe work performed today..." className="w-full p-6 bg-slate-900 border border-slate-800 rounded-[32px] shadow-xl min-h-[140px] outline-none text-sm font-medium text-white focus:ring-2 focus:ring-blue-500 placeholder-slate-600" />

        {/* PHOTO CAPTURE */}
        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Site Photo Evidence</label>
          <div className="flex flex-wrap gap-2">
            <label className="w-20 h-20 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-500 bg-slate-950">
              <span className="text-2xl text-slate-700">+</span>
              <input type="file" multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
            </label>
            {photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} className="w-20 h-20 object-cover rounded-2xl border-2 border-blue-900 shadow-sm" />)}
          </div>
        </div>

        {/* SIGNATURE SECTION */}
        <div className="bg-slate-900 p-5 rounded-[32px] border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Foreman Signature</label>
            {hasSigned && <button type="button" onClick={clearSignature} className="text-[9px] font-black text-red-500 uppercase bg-red-950/20 px-2 py-1 rounded border border-red-500/30">Clear</button>}
          </div>
          <div className="border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
            <canvas 
              ref={canvasRef}
              width={350} 
              height={150}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerOut={stopDrawing}
              className="w-full h-[150px] cursor-crosshair touch-none" 
            />
          </div>
          {!hasSigned && <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-3 text-center animate-pulse">Sign above to authorize field record</p>}
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-6 rounded-[32px] shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 transition-all uppercase tracking-[0.25em] text-[10px] disabled:opacity-50 border border-blue-400/30">
          {loading ? 'TRANSMITTING RECORD...' : 'SUBMIT OFFICIAL REPORT'}
        </button>
        {status && <div className="text-center p-3 text-[10px] font-black text-red-500 tracking-widest uppercase animate-pulse">{status}</div>}
      </form>
    </div>
  )
}