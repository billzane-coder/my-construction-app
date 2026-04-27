'use client'
import { SpeedInsights } from "@vercel/speed-insights/next"
export default function ProjectsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <main className="w-full h-screen overflow-y-auto custom-scrollbar">
        {children}
      </main>
    </div>
  )
}