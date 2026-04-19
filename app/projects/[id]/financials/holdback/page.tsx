'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, ShieldCheck, Clock, Calendar, 
  AlertTriangle, CheckCircle2, Landmark, History,
  ExternalLink, FileBadge
} from 'lucide-react'

// --- MOCK DATA ---
const MOCK_HOLDBACK_DATA = [
  { id: 'h1', trade: 'Solid Foundations Ltd.', totalContract: 50000, retained: 5000, status: 'Eligible', publishedDate: '2026-02-10', daysRemaining: 0 },
  { id: 'h2', trade: 'ABC Framing Co.', totalContract: 100000, retained: 10000, status: 'Locked', publishedDate: '2026-04-01', daysRemaining: 45 },
  { id: 'h3', trade: 'Rooted Plumbing', totalContract: 45000, retained: 4500, status: 'Locked', publishedDate: null, daysRemaining: null }, // This null was the culprit
  { id: 'h4', trade: 'High Voltage Electric', totalContract: 40000, retained: 4000, status: 'Released', publishedDate: '2025-12-01', daysRemaining: 0 },
]

export default function HoldbackLedger() {
  const { id } = useParams()
  const router = useRouter()

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  // --- TOTALS MATH ---
  const totals = useMemo(() => {
    return MOCK_HOLDBACK_DATA.reduce((acc, row) => ({
      retained: acc.retained + (row.status !== 'Released' ? row.retained : 0),
      eligible: acc.eligible + (row.status === 'Eligible' ? row.retained : 0),
      released: acc.released + (row.status === 'Released' ? row.retained : 0),
    }), { retained: 0, eligible: 0, released: 0 })
  }, [])

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-emerald-600 pb-6">
        <button onClick={() => router.push(`/projects/${id}/financials`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> Master Budget</button>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Holdback <span className="text-emerald-500">Ledger</span></h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">Ontario Construction Act Compliance</p>
          </div>
          <button className="bg-slate-900 text-white border border-slate-800 px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl">
            <FileBadge size={14} className="text-emerald-500"/> Generate Form 9
          </button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
        
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px] relative overflow-hidden">
            <Landmark className="absolute right-[-10px] bottom-[-10px] text-white/5 w-32 h-32" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={14}/> Total Retained Pool</p>
            <p className="text-4xl font-black text-white">{formatMoney(totals.retained)}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Currently held in bank reserve</p>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/50 p-8 rounded-[32px] relative overflow-hidden">
            <ShieldCheck className="absolute right-[-10px] bottom-[-10px] text-emerald-500/10 w-32 h-32" />
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2"><CheckCircle2 size={14}/> Eligible for Release</p>
            <p className="text-4xl font-black text-emerald-400">{formatMoney(totals.eligible)}</p>
            <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase italic">Lien periods have expired</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[32px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><History size={14}/> Total Released</p>
            <p className="text-4xl font-black text-slate-400">{formatMoney(totals.released)}</p>
            <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase font-mono">YTD PROJECT TOTAL</p>
          </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Contractor Holdback Detail</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase">Lien Clock Active</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="p-6">Contractor</th>
                  <th className="p-6">CSP Published</th>
                  <th className="p-6">Lien Window</th>
                  <th className="p-6 text-right">Holdback Amount</th>
                  <th className="p-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {MOCK_HOLDBACK_DATA.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-6">
                      <p className="font-black text-white text-lg">{item.trade}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Contract: {formatMoney(item.totalContract)}</p>
                    </td>
                    <td className="p-6">
                      {item.publishedDate ? (
                        <div className="flex items-center gap-2 text-slate-300 font-bold">
                          <Calendar size={14} className="text-blue-500"/>
                          {new Date(item.publishedDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-600 uppercase italic">Not Certified</span>
                      )}
                    </td>
                    <td className="p-6">
                      {item.status === 'Locked' && (
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[9px] font-black uppercase text-amber-500 mb-1">
                            {/* FIXED: Added ?? 60 to handle null daysRemaining */}
                            <span>{item.daysRemaining ?? 60} Days Left</span>
                            <span>{Math.round(((60 - (item.daysRemaining ?? 60)) / 60) * 100)}%</span>
                          </div>
                          <div className="w-48 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            {/* FIXED: Added ?? 60 to style calculation */}
                            <div className="bg-amber-500 h-full" style={{ width: `${((60 - (item.daysRemaining ?? 60)) / 60) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {item.status === 'Eligible' && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-950/30 px-3 py-1 rounded-lg border border-emerald-900/50 uppercase tracking-widest w-fit">
                          <ShieldCheck size={12}/> Clear to Pay
                        </span>
                      )}
                      {item.status === 'Released' && (
                        <span className="text-[10px] font-black text-slate-500 uppercase">Released</span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <p className={`text-xl font-black ${item.status === 'Eligible' ? 'text-emerald-400' : 'text-white'}`}>
                        {formatMoney(item.retained)}
                      </p>
                    </td>
                    <td className="p-6 text-center">
                      {item.status === 'Eligible' ? (
                        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/20">
                          Release Funds
                        </button>
                      ) : (
                        <button className="text-slate-600 hover:text-white transition-colors">
                          <ExternalLink size={18}/>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* COMPLIANCE NOTE */}
        <div className="bg-blue-950/20 border border-blue-900/50 p-6 rounded-3xl flex items-start gap-4">
          <AlertTriangle className="text-blue-500 shrink-0" size={24} />
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight mb-1">Ontario Construction Act Notice</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Holdback funds must be retained for at least 60 days following the publication of the Certificate of Substantial Performance. Ensure a fresh Title Search is conducted before releasing any eligible funds to ensure no liens have been registered in the interim.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}