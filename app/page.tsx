'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Lock, Mail, AlertCircle, CheckSquare, Square } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 1. On page load, check if we saved an email last time
  useEffect(() => {
    const savedEmail = localStorage.getItem('siteMasterEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // 2. Save or clear the email based on the checkbox
    if (rememberMe) {
      localStorage.setItem('siteMasterEmail', email)
    } else {
      localStorage.removeItem('siteMasterEmail')
    }

    // 3. Authenticate
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      // 4. Hard redirect
      window.location.href = '/projects' 
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[32px] p-8 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white">
            Site<span className="text-blue-500">Master</span>
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">
            Secure Portal Login
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={18} />
            <p className="text-xs font-bold text-red-400">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-12 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-colors"
                placeholder="superintendent@company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-12 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* THE FIX: Remember Me Checkbox */}
          <div className="flex items-center gap-2 cursor-pointer w-max" onClick={() => setRememberMe(!rememberMe)}>
            {rememberMe ? (
              <CheckSquare className="text-blue-500" size={18} />
            ) : (
              <Square className="text-slate-600" size={18} />
            )}
            <span className="text-xs font-bold text-slate-400 select-none">Remember my email</span>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-xl"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Authenticate'}
          </button>
        </form>

      </div>
    </div>
  )
}