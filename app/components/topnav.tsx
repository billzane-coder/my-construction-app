"use client";

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  HardHat, 
  Globe, 
  Users, 
  LayoutDashboard,
  Terminal,        
  ClipboardList,   
  CheckSquare      
} from 'lucide-react';

export default function TopNav() {
  const router = useRouter();
  const { id } = useParams(); 

  return (
    <nav className="sticky top-0 left-0 right-0 h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-[200] px-4 md:px-8 flex items-center justify-between shadow-xl">
      
      {/* Branding */}
      <div onClick={() => router.push('/projects')} className="flex items-center gap-3 cursor-pointer group shrink-0">
        <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-500 transition-colors">
          <HardHat size={18} className="text-white" />
        </div>
        <span className="font-black uppercase italic tracking-tighter text-lg text-white hidden md:block">
          SITEMASTER<span className="text-blue-500">QA</span>
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 md:gap-6 overflow-x-auto no-scrollbar">
        
        {/* Global Buttons */}
        <button onClick={() => router.push('/command-center')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap">
          <Terminal size={14} /> <span className="hidden lg:inline">Command Center</span>
        </button>

        <button onClick={() => router.push('/projects')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap">
          <LayoutDashboard size={14} /> <span className="hidden lg:inline">Portfolio</span>
        </button>

        <button onClick={() => router.push('/logs')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap">
          <ClipboardList size={14} /> <span className="hidden lg:inline">Daily Logs</span>
        </button>

        <button onClick={() => router.push('/punch')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap">
          <CheckSquare size={14} /> <span className="hidden lg:inline">Global Punch</span>
        </button>

        <button onClick={() => router.push('/directory')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-all whitespace-nowrap">
          <Globe size={14} className="text-blue-500" /> <span className="hidden lg:inline">Directory</span>
        </button>

        {/* Project Context Button */}
        {id && (
          <>
            <div className="h-6 w-[1px] bg-slate-800 mx-1 hidden md:block shrink-0" />
            <button 
              onClick={() => router.push(`/projects/${id}/trades`)}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap shrink-0"
            >
              <Users size={14} /> <span className="hidden sm:inline">Site File</span>
            </button>
          </>
        )}
        
        {/* User Profile */}
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 ml-1 shrink-0">
          BZ
        </div>
      </div>
    </nav>
  );
}