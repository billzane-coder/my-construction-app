'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // 1. FIELD-READY LOGIC: Hide nav on reports and high-res drawing tools
  const isToolActive = pathname?.includes('/report') || 
                       pathname?.includes('/viewer/') || 
                       pathname?.includes('/photos/')

  if (isToolActive) return null

  // 2. MASTER NAV LINKS
  const links = [
    { name: 'Projects', href: '/projects' },       // Global Portfolio
    { name: 'Command Center', href: '/dashboard' },
    { name: 'Phase Audits', href: '/inspections' },
    { name: 'Punch Manager', href: '/punchlist' },
    { name: 'Trade Portal', href: '/portal' },
    { name: 'Daily Logs', href: '/logs' },
  ]

  return (
    <nav className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50 print:hidden shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          {/* BRANDING */}
          <div className="flex items-center">
            <Link href="/projects" className="flex-shrink-0 flex items-center gap-2" onClick={() => setIsOpen(false)}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-900/40">
                QA
              </div>
              <span className="text-white font-black italic tracking-tight uppercase text-sm">
                Site<span className="text-blue-500">Master</span>
              </span>
            </Link>
          </div>

          {/* DESKTOP TABS */}
          <div className="hidden md:flex items-center space-x-1">
            {links.map((link) => {
              const isActive = pathname?.startsWith(link.href)
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full transition-all hover:text-white ${
                    isActive 
                      ? 'text-blue-400 bg-blue-500/5 shadow-inner' 
                      : 'text-slate-500'
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>

          {/* MOBILE TOGGLE */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-400 hover:text-white p-2 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {isOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 w-full shadow-2xl animate-in slide-in-from-top duration-300">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {links.map((link) => {
              const isActive = pathname?.startsWith(link.href)
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}