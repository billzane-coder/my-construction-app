"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  HardHat, 
  Globe, 
  Users, 
  LayoutDashboard,
  Terminal,        
  ClipboardList,   
  CheckSquare,
  Settings // Added Settings Icon
} from 'lucide-react';

export default function TopNav() {
  const router = useRouter();
  const { id } = useParams(); 
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
      if (data) setSettings(data);
    };
    fetchSettings();
  }, []);

  return (
    <nav className="sticky top-0 left-0 right-0 h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-[200] px-4 md:px-8 flex items-center justify-between shadow-xl">
      
      {/* BRANDING */}
      <div onClick={() => router.push('/projects')} className="flex items-center gap-3 cursor-pointer group shrink-0">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="Company Logo" className="h-8 w-auto object-contain" />
        ) : (
          <div 
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: settings?.primary_color || '#2563eb' }}
          >
            <HardHat size={18} className="text-white" />
          </div>
        )}
        <span className="font-black uppercase italic tracking-tighter text-lg text-white hidden md:block">
          {settings?.company_name ? (
            settings.company_name
          ) : (
            <>SITEMASTER<span style={{ color: settings?.primary_color || '#3b82f6' }}>QA</span></>
          )}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 md:gap-6 overflow-x-auto no-scrollbar">
        
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

        <button onClick={() => router.push('/directory')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap">
          <Globe size={14} style={{ color: settings?.primary_color || '#3b82f6' }} /> <span className="hidden lg:inline">Directory</span>
        </button>

        {id && (
          <>
            <div className="h-6 w-[1px] bg-slate-800 mx-1 hidden md:block shrink-0" />
            <button 
              onClick={() => router.push(`/projects/${id}/trades`)}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-900 border border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all whitespace-nowrap shrink-0"
              style={{ borderColor: settings?.primary_color || '#3b82f6' }}
            >
              <Users size={14} style={{ color: settings?.primary_color || '#3b82f6' }} /> <span className="hidden sm:inline">Site File</span>
            </button>
          </>
        )}
        
        <div className="h-6 w-[1px] bg-slate-800 mx-1 shrink-0" />

        {/* NEW SETTINGS BUTTON */}
        <button onClick={() => router.push('/settings')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all whitespace-nowrap shrink-0">
          <Settings size={14} style={{ color: settings?.primary_color || '#3b82f6' }} /> <span className="hidden lg:inline">Settings</span>
        </button>

        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
          BZ
        </div>
      </div>
    </nav>
  );
}