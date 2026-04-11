'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function NewLog() {
  const [projects, setProjects] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTrades, setSelectedTrades] = useState<Record<string, number>>({})
  const [weather, setWeather] = useState('Fetching Barrie Weather...')
  const [photos, setPhotos] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function getData() {
      const { data: projData } = await supabase.from('projects').select('*').order('name')
      const { data: tradeData } = await supabase.from('trades').select('*').order('name')
      if (projData) setProjects(projData)
      if (tradeData) setTrades(tradeData)
      
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=44.3894&longitude=-79.6903&current=temperature_2m,weather_code&timezone=auto')
        const wData = await res.json()
        setWeather(`${wData.current.weather_code < 3 ? '☀️ Sunny' : '☁️ Overcast'}, ${Math.round(wData.current.temperature_2m)}°C`)
      } catch (e) { setWeather('6°C, Sunny (Barrie)') }
    }
    getData()
  }, [])

  // Check for Incidents when project changes
  useEffect(() => {
    async function checkIncidents() {
      if (!selectedProjectId) return
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

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!selectedProjectId) return setStatus('⚠️ Select a Project')
    setLoading(true)
    
    const uploadedUrls: string[] = []
    for (const file of photos) {
      const fileName = `${Date.now()}-${file.name}`
      const { data } = await supabase.storage.from('site-photos').upload(`logs/${fileName}`, file)
      if (data) {
        const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(`logs/${fileName}`)
        uploadedUrls.push(urlData.publicUrl)
      }
    }

    const { error } = await supabase.from('daily_logs').insert([{
      project_id: selectedProjectId,
      work_performed: new FormData(e.target).get('work'),
      weather,
      trades_detailed: selectedTrades,
      photo_urls: uploadedUrls,
      roadblocks: new FormData(e.target).get('blocks')
    }])

    setLoading(false)
    if (error) setStatus('❌ Error')
    else {
      setStatus('✅ Submitted!')
      setPhotos([]); setSelectedTrades({}); e.target.reset()
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-slate-100 min-h-screen pb-20 font-sans">
      <div className="flex justify-between items-center mb-6 pt-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight underline decoration-blue-500 decoration-4 uppercase">Daily Log</h1>
        <p className="text-xs font-black text-blue-600 uppercase">{weather}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* PROJECT SELECTOR */}
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Active Site</label>
          <select 
            required value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* SAFETY ALERTS */}
        {incidents.length > 0 && (
          <div className="bg-red-50 p-5 rounded-[32px] border-2 border-red-200">
            <label className="block text-[10px] font-black text-red-600 uppercase mb-2 tracking-widest">🚨 Site Incidents (Last 48h)</label>
            <ul className="space-y-1">
              {incidents.map(i => <li key={i.id} className="text-xs font-bold text-red-800">• {i.description}</li>)}
            </ul>
          </div>
        )}

        {/* PERSONNEL SECTION (RESTORED COUNTERS) */}
        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Trades On-Site</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {trades.map(t => (
              <button key={t.id} type="button" 
                onClick={() => setSelectedTrades(prev => {
                  const n = { ...prev }; if (n[t.name]) delete n[t.name]; else n[t.name] = 1; return n;
                })}
                className={`p-3 text-[10px] font-black rounded-xl border transition-all uppercase ${selectedTrades[t.name] ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {t.name}
              </button>
            ))}
          </div>

          {/* This is the part that was missing! */}
          {Object.entries(selectedTrades).map(([name, count]) => (
            <div key={name} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-2">
              <span className="text-[10px] font-black text-slate-600 uppercase ml-2">{name}</span>
              <div className="flex items-center gap-4">
                <button type="button" 
                  onClick={() => setSelectedTrades(prev => ({...prev, [name]: Math.max(1, prev[name] - 1)}))} 
                  className="w-10 h-10 bg-white border border-slate-200 rounded-full font-black text-slate-900 shadow-sm active:bg-slate-100">-</button>
                <span className="font-black text-blue-600 w-4 text-center text-lg">{count}</span>
                <button type="button" 
                  onClick={() => setSelectedTrades(prev => ({...prev, [name]: prev[name] + 1}))} 
                  className="w-10 h-10 bg-white border border-slate-200 rounded-full font-black text-slate-900 shadow-sm active:bg-slate-100">+</button>
              </div>
            </div>
          ))}
        </div>

        {/* NARRATIVE & PHOTOS */}
        <textarea name="work" required placeholder="Describe work performed today..." className="w-full p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm min-h-[140px] outline-none text-sm font-medium" />

        <div className="bg-white p-5 rounded-[32px] shadow-sm border border-slate-200">
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Site Photos</label>
          <div className="flex flex-wrap gap-2">
            <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center cursor-pointer hover:border-blue-400">
              <span className="text-2xl text-slate-400">+</span>
              <input type="file" multiple accept="image/*" capture="environment" onChange={(e) => setPhotos(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" />
            </label>
            {photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} className="w-20 h-20 object-cover rounded-2xl border-2 border-blue-200 shadow-sm" />)}
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-6 rounded-[32px] shadow-2xl active:scale-95 transition-all uppercase tracking-[0.25em] text-[10px]">
          {loading ? 'Transmitting Data...' : 'Submit Official Report'}
        </button>
        {status && <div className="text-center p-3 text-[10px] font-black text-blue-600 tracking-widest uppercase animate-pulse">{status}</div>}
      </form>
    </div>
  )
}