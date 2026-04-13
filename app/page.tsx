"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, HardHat, ShieldCheck, ChevronRight } from 'lucide-react';

export default function Home() {
  const [betaKey, setBetaKey] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleBetaEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Deployment Key Check
    if (betaKey.toLowerCase() === 'ontario2026') {
      // Redirect to the new Project Portfolio we built
      router.push('/projects');
    } else {
      setIsError(true);
      setIsProcessing(false);
      setTimeout(() => setIsError(false), 2000);
    }
  };

  return (
    <main className="h-screen bg-slate-950 flex items-center justify-center p-6 text-center font-sans overflow-hidden">
      
      {/* Background Depth Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      <form 
        onSubmit={handleBetaEntry} 
        className="max-w-sm w-full space-y-12 z-10 animate-in fade-in zoom-in duration-700"
      >
        {/* BRANDING HUB */}
        <div className="space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center text-4xl font-black italic shadow-[0_0_60px_rgba(37,99,235,0.4)] text-white transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            S
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">
              SiteMaster <span className="text-blue-500">QA</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center justify-center gap-2">
              <ShieldCheck size={12} className="text-blue-500" /> Secure Beta Terminal
            </p>
          </div>
        </div>
        
        {/* ACCESS INPUT */}
        <div className="space-y-4 relative">
          <div className={`relative transition-all duration-300 ${isError ? 'animate-shake' : ''}`}>
            <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 size-4 transition-colors ${betaKey ? 'text-blue-500' : 'text-slate-700'}`} />
            <input 
              type="password" 
              placeholder="Enter Access Key" 
              autoFocus
              disabled={isProcessing}
              className={`w-full p-5 pl-14 bg-slate-900/50 border rounded-2xl text-center font-black uppercase tracking-[0.2em] outline-none transition-all shadow-inner placeholder:text-slate-800 ${
                isError 
                  ? 'border-red-500 text-red-500 shadow-red-900/10' 
                  : 'border-slate-800 text-blue-500 focus:border-blue-500 focus:bg-slate-900'
              }`}
              value={betaKey}
              onChange={(e) => setBetaKey(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            disabled={isProcessing}
            className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs text-white shadow-2xl shadow-blue-900/30 hover:bg-blue-500 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:bg-slate-800 disabled:text-slate-500 disabled:transform-none"
          >
            {isProcessing ? (
              <span className="animate-pulse">Loading Environment...</span>
            ) : (
              <>
                <HardHat size={16} className="group-hover:animate-bounce" /> 
                Initialize Deployment
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </>
            )}
          </button>
        </div>
        
        {/* FOOTER / ATTRIBUTION */}
        <div className="pt-8 border-t border-slate-900/50">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic leading-loose">
            Enterprise Quality Assurance Engine<br />
            &copy; 2026 Inzane Interiors | Ontario, CA
          </p>
        </div>
      </form>

      {/* Shake UI Logic */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>

    </main>
  );
}