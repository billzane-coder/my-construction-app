'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, ShieldCheck, Clock, Calendar, 
  AlertTriangle, CheckCircle2, Landmark, History,
  ExternalLink, FileBadge, Loader2
} from 'lucide-react'

export default function HoldbackLedger() {
  const { id } = useParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [holdbackData, setHoldbackData] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch all active/completed contracts for this project
      const { data: contracts } = await supabase
        .from('project_contracts')
        .select('id, title, csp_published_date, holdback_released, project_contacts!project_contracts_contact_id_fkey(company)')
        .eq('project_id', id)

      if (!contracts) return;

      // 2. Fetch the Master SOV budgets for those contracts
      const { data: sovs } = await supabase
        .from('sov_line_items')
        .select('id, contract_id, scheduled_value')
        .in('contract_id', contracts.map(c => c.id))

      // 3. Fetch every draw line item ever billed to calculate exact held funds
      const { data: draws } = await supabase
        .from('draw_line_items')
        .select('sov_line_id, current_gross_billed, holdback_rate')

      // 4. Mash the data together
      const mappedData = contracts.map(c => {
        const mySovs = sovs?.filter(s => s.contract_id === c.id) || []
        const mySovIds = mySovs.map(s => s.id)
        const myDraws = draws?.filter(d => mySovIds.includes(d.sov_line_id)) || []

        const totalContract = mySovs.reduce((sum, s) => sum + Number(s.scheduled_value || 0), 0)
        
        // Calculate exact retainage: (Gross Billed * Holdback Rate)
        const totalRetained = myDraws.reduce((sum, d) => sum + (Number(d.current_gross_billed || 0) * Number(d.holdback_rate || 0)), 0)

        let status = 'Locked'
        let daysRemaining: number | null = null

        // 60-Day Lien Clock Logic
        if (c.holdback_released) {
          status = 'Released'
          daysRemaining = 0
        } else if (c.csp_published_date) {
          const cspDate = new Date(c.csp_published_date)
          const today = new Date()
          
          // Force timezone normalization to prevent weird midnight offsets
          cspDate.setUTCHours(0,0,0,0)
          today.setUTCHours(0,0,0,0)

          const diffTime = today.getTime() - cspDate.getTime()
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          
          daysRemaining = Math.max(0, 60 - diffDays)
          if (daysRemaining === 0) status = 'Eligible'
        }

        const contactInfo: any = c.project_contacts
        const companyName = Array.isArray(contactInfo) ? contactInfo[0]?.company : contactInfo?.company || 'Unknown Trade'

        return {
          id: c.id,
          trade: companyName,
          contractTitle: c.title,
          totalContract,
          retained: totalRetained,
          status,
          publishedDate: c.csp_published_date,
          daysRemaining
        }
      })

      // Only show trades that actually have funds retained (ignore $0 holdbacks)
      setHoldbackData(mappedData.filter(d => d.retained > 0 || d.status === 'Released'))

    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleUpdateCSP = async (contractId: string, date: string) => {
    await supabase.from('project_contracts').update({ csp_published_date: date || null }).eq('id', contractId)
    fetchData()
  }

  const handleReleaseFunds = async (contractId: string) => {
    if (!window.confirm("Confirm releasing these funds? This will mark the holdback as officially paid out to the trade.")) return;
    await supabase.from('project_contracts').update({ holdback_released: true }).eq('id', contractId)
    fetchData()
  }

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const totals = useMemo(() => {
    return holdbackData.reduce((acc, row) => ({
      retained: acc.retained + (row.status !== 'Released' ? row.retained : 0),
      eligible: acc.eligible + (row.status === 'Eligible' ? row.retained : 0),
      released: acc.released + (row.status === 'Released' ? row.retained : 0),
    }), { retained: 0, eligible: 0, released: 0 })
  }, [holdbackData])

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>

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
                {holdbackData.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-bold uppercase text-xs">No Holdbacks retained on this project yet.</td></tr>
                )}
                {holdbackData.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-6">
                      <p className="font-black text-white text-lg">{item.trade}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Contract: {formatMoney(item.totalContract)}</p>
                    </td>
                    
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-500"/>
                        <input 
                          type="date" 
                          value={item.publishedDate || ''}
                          onChange={(e) => handleUpdateCSP(item.id, e.target.value)}
                          disabled={item.status === 'Released'}
                          className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-lg outline-none focus:border-blue-500 disabled:opacity-50"
                        />
                      </div>
                    </td>
                    
                    <td className="p-6">
                      {item.status === 'Locked' && item.publishedDate && (
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[9px] font-black uppercase text-amber-500 mb-1 w-48">
                            <span>{item.daysRemaining ?? 60} Days Left</span>
                            <span>{Math.round(((60 - (item.daysRemaining ?? 60)) / 60) * 100)}%</span>
                          </div>
                          <div className="w-48 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div className="bg-amber-500 h-full transition-all duration-1000" style={{ width: `${((60 - (item.daysRemaining ?? 60)) / 60) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {item.status === 'Locked' && !item.publishedDate && (
                        <span className="text-[10px] font-black text-slate-600 uppercase italic">Awaiting CSP</span>
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
                        <button onClick={() => handleReleaseFunds(item.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/20">
                          Release Funds
                        </button>
                      ) : (
                        <button disabled className="text-slate-600 cursor-not-allowed">
                          <CheckCircle2 size={18}/>
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