'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Save, Building2, Palette, Image as ImageIcon, 
  MapPin, Phone, FileText, Loader2, UploadCloud
} from 'lucide-react'

export default function CompanySettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [settings, setSettings] = useState({
    company_name: '',
    logo_url: '',
    primary_color: '#2563eb',
    address: '',
    phone: '',
    tax_id: ''
  })

  // Fetch the single settings row (ID 1)
  const fetchSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()
      
    if (data) setSettings(data)
    setLoading(false)
  }

  useEffect(() => { fetchSettings() }, [])

  // Handle Logo Upload to Supabase Storage
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `logo-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      alert('Error uploading logo: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(filePath)

    setSettings(prev => ({ ...prev, logo_url: publicUrlData.publicUrl }))
    setUploading(false)
  }

  // 🚨 FIX: Changed to UPSERT and added Success feedback
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const { error } = await supabase
      .from('company_settings')
      .upsert({
        id: 1, // Force it to always use ID 1
        company_name: settings.company_name,
        logo_url: settings.logo_url,
        primary_color: settings.primary_color,
        address: settings.address,
        phone: settings.phone,
        tax_id: settings.tax_id,
        updated_at: new Date().toISOString()
      })

    if (error) {
      alert("Save failed: " + error.message)
    } else {
      alert("Brand settings saved successfully!")
    }
    
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-black text-blue-500 uppercase tracking-[0.5em] animate-pulse">
      Loading Brand Settings...
    </div>
  )

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b-4 pb-8 gap-6" style={{ borderBottomColor: settings.primary_color }}>
        <div>
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
            <ChevronLeft size={12}/> Back to App
          </button>
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
            Brand <span style={{ color: settings.primary_color }}>Settings</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
            <Building2 size={14} style={{ color: settings.primary_color }} /> Global Configuration
          </p>
        </div>
        
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl hover:opacity-80"
          style={{ backgroundColor: settings.primary_color }}
        >
          {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
          Save Configuration
        </button>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Visual Identity */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] shadow-2xl">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
              <ImageIcon size={14} style={{ color: settings.primary_color }} /> Visual Identity
            </h3>
            
            {/* Logo Upload */}
            <div className="space-y-4 mb-8">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Company Logo</label>
              
              <div className="border-2 border-dashed border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative hover:border-slate-600 transition-colors bg-slate-950/50 group overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="max-h-32 object-contain z-10" />
                ) : (
                  <div className="text-center flex flex-col items-center gap-2 text-slate-600 z-10">
                    <Building2 size={32} />
                    <span className="text-[9px] font-black uppercase">No Logo Uploaded</span>
                  </div>
                )}
                
                {/* Upload Overlay */}
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center z-20 cursor-pointer">
                  <UploadCloud size={24} className="text-white mb-2" />
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">
                    {uploading ? 'Uploading...' : 'Replace Logo'}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Palette size={14}/> Brand Accent Color
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-slate-700 shrink-0">
                  <input 
                    type="color" 
                    value={settings.primary_color}
                    onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                    className="absolute inset-[-10px] w-20 h-20 cursor-pointer"
                  />
                </div>
                <input 
                  type="text" 
                  value={settings.primary_color}
                  onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                  className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-white outline-none focus:border-slate-600 w-full uppercase"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Business Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 md:p-12 rounded-[40px] shadow-2xl">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-8 flex items-center gap-2 border-b border-slate-800 pb-4">
              <FileText size={14} style={{ color: settings.primary_color }} /> Official Documentation Details
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Legal Company Name</label>
                <input 
                  type="text" 
                  value={settings.company_name}
                  onChange={e => setSettings({...settings, company_name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xl font-black text-white outline-none focus:border-slate-600 transition-colors"
                  placeholder="e.g. SITEMASTER QA LTD."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 flex items-center gap-2"><MapPin size={12}/> Corporate Address</label>
                <textarea 
                  value={settings.address}
                  onChange={e => setSettings({...settings, address: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-slate-600 min-h-[100px] resize-none transition-colors"
                  placeholder="123 Main Street&#10;Suite 100&#10;City, State, ZIP"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 flex items-center gap-2"><Phone size={12}/> Main Phone</label>
                  <input 
                    type="text" 
                    value={settings.phone}
                    onChange={e => setSettings({...settings, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-slate-600 transition-colors"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 flex items-center gap-2"><FileText size={12}/> Tax ID / EIN</label>
                  <input 
                    type="text" 
                    value={settings.tax_id}
                    onChange={e => setSettings({...settings, tax_id: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-slate-600 transition-colors"
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}