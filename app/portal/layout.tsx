'use client'
import React from 'react'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-emerald-500/30">
      {/* This layout prevents the global nav from rendering 
          and stops the 'pull-to-refresh' leak 
      */}
      <style jsx global>{`
        /* Kill the standard app navigation for this folder */
        nav, aside, .top-nav, .sidebar { display: none !important; }
        body { overscroll-behavior-y: contain; overflow-x: hidden; }
      `}</style>
      {children}
    </div>
  )
}