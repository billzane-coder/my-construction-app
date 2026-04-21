'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { HardHat, Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

export default function PortalLogin() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [settings, setSettings] = useState<any>(null)

  // Pull your brand settings
  useEffect(() => {
    const fetchBrand = async () => {
      const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single()
      if (data) setSettings(data)
    }
    fetchBrand()
  }, [])

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)

    try {
      // 1. Check if this email actually belongs to an active trade in your Master Directory
      const { data: validTrade } = await supabase
        .from('subcontractors')
        .select('id')
        .eq('email', email)
        .single()

      if (!validTrade) {
        alert("This email is not registered in our Trade Directory. Contact the Site Super.")
        setLoading(false)
        return
      }

      // 2. Hit our API to generate the token and send the email
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const err = await res.json()
        alert(err.message || "Failed to send link.")
      }
    } catch (error) {
      alert("Network error. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Accent based on your brand color */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 blur-[120px] rounded-full pointer-events-none"
        style={{ backgroundColor: settings?.primary_color || '#3b82f6' }}
      />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl p-8 relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-10">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-16 object-contain mb-6" />
          ) : (
            <div className="p-4 rounded-2xl mb-6" style={{ backgroundColor: settings?.primary_color || '#3b82f6' }}>
              <HardHat size={32} className="text-white" />
            </div>
          )}
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
            Trade <span style={{ color: settings?.primary_color || '#3b82f6' }}>Portal</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
            Secure Document & Billing Access
          </p>
        </div>

        {success ? (
          <div className="text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-950/50 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-wide mb-2">Check Your Inbox</h2>
            <p className="text-sm font-bold text-slate-400">
              We sent a secure login link to <br/><span className="text-white">{email}</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestLink} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Registered Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="email" 
                  required
                  placeholder="dispatch@tradecompany.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 pl-12 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-slate-500 transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 hover:opacity-80"
              style={{ backgroundColor: settings?.primary_color || '#3b82f6' }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>Send Secure Link <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}