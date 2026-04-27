'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, FileDown, ShieldAlert, ShieldCheck,
  CheckCircle, AlertTriangle, X, Search, FileText, 
  Save, Zap, PenTool, AlertCircle, CheckCircle2, XCircle, 
  Info, ClipboardCheck, Loader2, Camera, Trash2
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// --- 🛠️ ROBUST ONTARIO-STANDARD SAFETY PROMPTS ---
const SAFETY_PROMPTS = {
  walkTypes: {
    'Fall Protection': [
      'Guardrails verified at 42" (+/- 3") with mid-rail and toe board', 
      'Travel restraint/Fall arrest system inspected and daily logs present', 
      'Floor openings securely covered, fastened and marked "DANGER HOLE"',
      'Ladders tied off/secured at top and bottom (extend 3ft past landing)',
      'Warning bump lines established minimum 2 meters from leading edge',
      'Lifeline anchor points verified by competent person (5000lb capacity)'
    ],
    'Housekeeping/MOL': [
      'Egress routes and stairwells 100% clear of debris/cables', 
      'Scrap lumber stripped of nails or nails bent over', 
      '4A:40BC Fire extinguishers inspected, tagged and accessible (every 3000sqft)',
      'Temporary lighting operational in all work areas and stairwells',
      'Combustible waste binned and actively removed from work area',
      'Material stacked securely and clear of public walkways/hoist areas'
    ],
    'Scaffold/Access': [
      'MOL Green Tag present and signed within last 24hrs by competent person', 
      'Base plates level on mudsills with no makeshift blocking/bricks', 
      'Work platforms fully planked (no gaps >1")',
      'Access ladder extends beyond platform / internal stairs clear',
      'All cross braces securely pinned and locked',
      'Toe boards installed on all open sides of platforms over 10ft'
    ]
  },
  trades: {
    interiors: [
      'Stilts used only on swept, level floors (max 36" height) with guardrails adjusted',
      'Baker scaffold locking pins engaged and wheels locked before mounting',
      'Dust control/N95 masks actively used during sanding operations',
      'Taping compound buckets stacked safely (max 3 high)',
      'Cutting stations equipped with localized ventilation or HEPA vacuums',
      'Acoustic ceiling tie-offs secure and tested before hanging grid'
    ],
    framing: [
      'Temporary truss bracing installed per engineered specs before loading', 
      'Fall arrest harnesses worn for all work over 10ft (or guardrails in place)', 
      'Power saws have functioning return-guards (none pinned back)',
      'Pneumatic nailers disconnected when clearing jams or walking',
      'Lumber stacks level, stable, and clear of public walkways',
      'Workers wearing appropriate eye and hearing protection during cuts'
    ],
    electrical: [
      'GFCI protection tested and active on all temp power panels/spiders', 
      'Live circuits Locked-Out/Tagged-Out (LOTO) with physical locks and tags', 
      'Non-conductive (fiberglass) ladders only for electrical work (no aluminum)',
      'Panels have dead-fronts installed (no exposed live busbars)',
      'Temporary power cables flown above head height (not in puddles)',
      'No daisy-chaining of extension cords across the site'
    ],
    mechanical: [
      'Hot Work Permit active and posted at brazing/welding station', 
      'Dedicated fire watch assigned for 60 mins post-work',
      'Gas cylinders stored upright, capped, chained, and separated (O2/Acetylene)', 
      'Trench shoring/sloping verified for exterior excavations >4ft deep',
      'Confined space entry permits signed, air tested, and rescue plan on-site',
      'Welding screens in place to protect nearby workers from flash'
    ],
    roofing: [
      'Roof anchors verified for 5000lb capacity before tie-off', 
      'Lanyards protected from sharp edge friction/cutting', 
      'Materials secured from wind drift (especially insulation board)',
      'Hoisting area cordoned off with danger tape on the ground level',
      'Propane kettles (if applicable) equipped with fully charged extinguisher',
      'Workers wearing high-traction footwear'
    ],
    concrete: [
      'Rebar caps (steel reinforced) installed to prevent impalement', 
      'Pump truck outriggers fully extended on proper dunnage pads', 
      'Silica dust wet-cut methods actively used for all cutting/grinding',
      'Formwork bracing verified by competent person before pour',
      'Concrete wash-out station utilized (no dumping in drains/soil)',
      'Workers wearing long sleeves and eye protection during pour'
    ]
  }
};

export default function SafetyHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [walks, setWalks] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [stats, setStats] = useState({ walks: 0, incidents: 0 })
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchQueryTrades, setSearchQueryTrades] = useState('')
  
  // --- UPGRADED: MULTI-SELECT TRADE STATE ---
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

  // Walk Modal & Photo State
  const [showNewWalkModal, setShowNewWalkModal] = useState(false)
  const [walkPhotos, setWalkPhotos] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeWalkType, setActiveWalkType] = useState('General Site Walk')
  const [activeTradeId, setActiveTradeId] = useState('')
  const [notes, setNotes] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [selectedWalk, setSelectedWalk] = useState<any>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, w, c, inc] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('project_safety_walks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_contacts').select('*').eq('project_id', id).order('company'),
        supabase.from('incidents').select('id').eq('project_id', id)
      ])
      setProject(p.data); setWalks(w.data || []); setContacts(c.data || []);
      setStats({ walks: w.data?.length || 0, incidents: inc.data?.length || 0 })
    } catch (err) {
      console.error("Data fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  // --- SMART PROMPTS & FILTER LOGIC ---
  const filteredTrades = contacts.filter((t: any) => 
    t.company?.toLowerCase().includes(searchQueryTrades.toLowerCase())
  )

  const filteredWalks = walks.filter(walk => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (walk.trade_company || '').toLowerCase().includes(searchLower) ||
      (walk.walk_type || '').toLowerCase().includes(searchLower) ||
      (walk.inspector_name || '').toLowerCase().includes(searchLower)
    )
  })

  const toggleTradeSelection = (tradeId: string) => {
    setSelectedTradeIds(prev => 
      prev.includes(tradeId) ? prev.filter(tid => tid !== tradeId) : [...prev, tradeId]
    )
  }

  const getSuggestions = () => {
    let suggestions: string[] = [];
    if (SAFETY_PROMPTS.walkTypes[activeWalkType as keyof typeof SAFETY_PROMPTS.walkTypes]) {
      suggestions.push(...SAFETY_PROMPTS.walkTypes[activeWalkType as keyof typeof SAFETY_PROMPTS.walkTypes]);
    }
    if (activeTradeId) {
      const trade = contacts.find(c => c.id === activeTradeId);
      if (trade && trade.trade_role) {
         const role = trade.trade_role.toLowerCase();
         if (role.includes('frame') || role.includes('carpenter')) suggestions.push(...SAFETY_PROMPTS.trades.framing);
         else if (role.includes('electric')) suggestions.push(...SAFETY_PROMPTS.trades.electrical);
         else if (role.includes('plumb') || role.includes('hvac') || role.includes('mechanical')) suggestions.push(...SAFETY_PROMPTS.trades.mechanical);
         else if (role.includes('drywall') || role.includes('acoustic') || role.includes('insulation') || role.includes('tape') || role.includes('interior')) suggestions.push(...SAFETY_PROMPTS.trades.interiors);
         else if (role.includes('roof')) suggestions.push(...SAFETY_PROMPTS.trades.roofing);
         else if (role.includes('concrete') || role.includes('form')) suggestions.push(...SAFETY_PROMPTS.trades.concrete);
      }
    }
    return Array.from(new Set(suggestions)).slice(0, 8);
  }

  const handleAppendPrompt = (text: string) => {
    setNotes(prev => {
      const cleanPrev = prev.trim();
      return cleanPrev ? `${cleanPrev}\n- [ ] ${text}` : `- [ ] ${text}`;
    });
  }

  // --- UPGRADED: ROBUST EXPORT ENGINE (DB + STORAGE BUCKET SCAN) ---
  const handleExportSafetyPackage = async () => {
    if (selectedTradeIds.length === 0) return alert("Select at least one trade first.")
    setExporting(true)
    
    const tradesToExport = contacts.filter(t => selectedTradeIds.includes(t.id))
    let allDocs: { url: string, name: string }[] = []

    for (const trade of tradesToExport) {
      // 1. Grab URLs stored in the Database Columns
      if (trade.wsib_url) allDocs.push({ url: trade.wsib_url, name: `${trade.company}_WSIB` })
      if (trade.insurance_url) allDocs.push({ url: trade.insurance_url, name: `${trade.company}_Insurance` })
      if (trade.form_1000_url) allDocs.push({ url: trade.form_1000_url, name: `${trade.company}_Form1000` })
      if (trade.safety_cards_url) allDocs.push({ url: trade.safety_cards_url, name: `${trade.company}_SafetyCards` })

      // 2. Scan the Storage Bucket Directory directly to catch unlinked files!
      const { data: folderFiles } = await supabase.storage.from('project-files').list(`${id}/trades/${trade.id}/Safety`)
      
      if (folderFiles && folderFiles.length > 0) {
         folderFiles.forEach(file => {
           // Ignore empty folder placeholders
           if (file.name !== '.emptyFolderPlaceholder') {
             const { data } = supabase.storage.from('project-files').getPublicUrl(`${id}/trades/${trade.id}/Safety/${file.name}`)
             // Check if we didn't already push this exact URL from the DB columns
             if (!allDocs.find(d => d.url === data.publicUrl)) {
               allDocs.push({ url: data.publicUrl, name: `${trade.company}_${file.name}` })
             }
           }
         })
      }
    }

    if (allDocs.length === 0) {
      alert("No safety documents were found in the database or the storage directory for the selected trades.")
    } else {
      // Sequentially open tabs with a delay to prevent pop-up blockers from killing the batch
      allDocs.forEach((doc, index) => {
        setTimeout(() => {
           window.open(doc.url, '_blank')
        }, index * 400) // 400ms delay between each opening
      })
    }
    
    setExporting(false)
    setSelectedTradeIds([]) // Clear selection after export
  }

  const handleCreateWalk = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const photoUrls: string[] = []
      for (const file of walkPhotos) {
        const path = `${id}/safety_walks/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('project-files').upload(path, file)
        if (!error) {
          const { data } = supabase.storage.from('project-files').getPublicUrl(path)
          photoUrls.push(data.publicUrl)
        }
      }

      let sigUrl = null
      if (signatureData) {
        const blob = await (await fetch(signatureData)).blob()
        const path = `${id}/signatures/sw-${Date.now()}.png`
        await supabase.storage.from('project-files').upload(path, blob)
        sigUrl = supabase.storage.from('project-files').getPublicUrl(path).data.publicUrl
      }

      const trade = contacts.find(c => c.id === activeTradeId)
      await supabase.from('project_safety_walks').insert([{
        project_id: id,
        walk_type: activeWalkType,
        trade_company: trade?.company || 'Site-Wide',
        notes: notes,
        status: (e.target as any).status.value,
        inspector_name: (e.target as any).inspector_name.value,
        signature_url: sigUrl,
        photo_urls: photoUrls 
      }])

      setShowNewWalkModal(false); setWalkPhotos([]); setNotes(''); setSignatureData(null); fetchData()
    } catch (err) { alert("Save failed.") }
    setIsSubmitting(false)
  }

  const handleExportPDF = async () => {
    const reportElement = document.getElementById('pdf-report');
    if (!reportElement) return;

    setIsGeneratingPDF(true);
    try {
      reportElement.style.padding = '40px';
      const canvas = await html2canvas(reportElement, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: false,
        logging: false,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight
      });
      
      reportElement.style.padding = '0px';
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const safeTradeName = (selectedWalk?.trade_company || 'Site_Wide').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date(selectedWalk?.created_at).toISOString().split('T')[0];
      const fileName = `Safety_Report_${safeTradeName}_${dateStr}.pdf`;
      
      pdf.save(fileName);

    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to export PDF. Ensure all images have fully loaded.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Securing Perimeter...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Safety <span className="text-emerald-500">Hub</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ShieldAlert size={14} className="text-emerald-500" /> {project?.name}
          </p>
        </div>
      </div>

      {/* TOP GRID: STATS & COMPLIANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] shadow-xl text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Audits</p>
              <p className="text-3xl font-black text-emerald-500">{stats.walks}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] shadow-xl text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Incidents</p>
              <p className="text-3xl font-black text-red-500">{stats.incidents}</p>
            </div>
          </div>

          <button onClick={() => setShowNewWalkModal(true)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 shadow-2xl transition-all border-b-[8px] border-emerald-800 active:translate-y-1 active:border-b-0">
            <ClipboardCheck size={32} />
            <span className="font-black uppercase italic tracking-tighter text-xl">Start Safety Walk</span>
          </button>

          <button onClick={() => router.push(`/projects/${id}/incidents`)} className="w-full bg-slate-900 hover:bg-red-950 border border-slate-800 hover:border-red-900 text-white p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 shadow-2xl transition-all group">
            <AlertCircle size={32} className="text-red-500 group-hover:animate-pulse" />
            <span className="font-black uppercase italic tracking-tighter text-xl">Report Incident</span>
          </button>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Trade Compliance</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Multi-Select trades to batch export safety docs</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input 
                  type="text" placeholder="Search trades..." 
                  className="w-full bg-slate-950 border border-slate-800 p-3 pl-10 rounded-xl text-base outline-none focus:border-emerald-500"
                  onChange={(e) => setSearchQueryTrades(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {filteredTrades.map((trade: any) => {
                const isSelected = selectedTradeIds.includes(trade.id)
                return (
                  <div 
                    key={trade.id} 
                    onClick={() => toggleTradeSelection(trade.id)}
                    className={`p-5 rounded-[28px] border transition-all cursor-pointer group flex flex-col justify-between min-h-[140px] ${isSelected ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black uppercase italic text-lg leading-tight text-white group-hover:text-emerald-400 transition-colors">{trade.company}</h4>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{trade.trade_role}</p>
                      </div>
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-700 text-transparent'}`}>
                         <CheckCircle2 size={14} className={isSelected ? 'block' : 'hidden'} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={`mt-8 p-6 rounded-3xl border transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${selectedTradeIds.length > 0 ? 'bg-emerald-600 border-emerald-500 shadow-2xl' : 'bg-slate-950 border-slate-800 opacity-50 grayscale pointer-events-none'}`}>
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="bg-white/20 p-3 rounded-2xl"><ShieldCheck size={24} className="text-white" /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-200 tracking-widest">{selectedTradeIds.length} Trades Selected</p>
                  <p className="text-sm font-black text-white uppercase italic tracking-tight">Export Compliance Files</p>
                </div>
              </div>
              <button onClick={handleExportSafetyPackage} disabled={exporting} className="bg-white text-emerald-600 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={18} />} Generate Batch
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Quality Control Log</h3>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input 
              type="text" 
              placeholder="Search reports..."
              className="w-full bg-slate-950 border border-slate-800 p-3 pl-10 rounded-xl text-base md:text-xs font-bold outline-none focus:border-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800">
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Date</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Walk Type</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Trade Inspected</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Inspector</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                <th className="p-6 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredWalks.map((walk) => (
                <tr key={walk.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="p-6 text-sm font-bold text-white">{new Date(walk.created_at).toLocaleDateString()}</td>
                  <td className="p-6"><span className="bg-slate-950 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-emerald-500 border border-emerald-900/50">{walk.walk_type}</span></td>
                  <td className="p-6 text-sm font-bold text-slate-300">{walk.trade_company}</td>
                  <td className="p-6 text-sm font-bold text-slate-400">{walk.inspector_name}</td>
                  <td className="p-6">
                    {walk.status === 'Pass' ? 
                      <span className="text-[10px] font-black uppercase text-emerald-500"><CheckCircle size={12} className="inline mr-1"/> Compliant</span> : 
                      <span className="text-[10px] font-black uppercase text-amber-500"><AlertTriangle size={12} className="inline mr-1"/> Action Req</span>
                    }
                  </td>
                  <td className="p-6 text-right">
                    <button onClick={() => setSelectedWalk(walk)} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95">
                      <FileText size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredWalks.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold text-sm">No safety walks recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- 📱 NEW WALK MODAL --- */}
      {showNewWalkModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[150] flex items-start justify-center p-4 backdrop-blur-md overflow-y-auto pt-safe">
          <form onSubmit={handleCreateWalk} className="bg-slate-900 border-2 border-emerald-600 p-6 md:p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl mt-12 mb-20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-white uppercase italic">Site Walk</h2>
              <button type="button" onClick={() => setShowNewWalkModal(false)} className="bg-slate-800 text-slate-400 p-3 rounded-full hover:text-white"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Type</label>
                <select name="walk_type" value={activeWalkType} onChange={(e) => setActiveWalkType(e.target.value)} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 text-base">
                  <option>General Site Walk</option>
                  <option>Fall Protection</option>
                  <option>Housekeeping/MOL</option>
                  <option>Scaffold/Access</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Trade</label>
                <select name="contact_id" value={activeTradeId} onChange={(e) => setActiveTradeId(e.target.value)} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 text-base">
                  <option value="">Site-Wide (General)</option>
                  {contacts.map(trade => (<option key={trade.id} value={trade.id}>{trade.company}</option>))}
                </select>
              </div>
            </div>

            {getSuggestions().length > 0 && (
              <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Zap size={12}/> Ontario Compliance Checks</p>
                <div className="flex flex-col gap-2">
                  {getSuggestions().map((suggestion: string, i: number) => (
                    <button key={i} type="button" onClick={() => handleAppendPrompt(suggestion)} className="bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[10px] font-bold px-4 py-3 rounded-xl text-left transition-colors">+ {suggestion}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 flex justify-between">Observations</label>
              <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Type or use smart checks above..." rows={5} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-medium text-white outline-none focus:border-emerald-500 text-base resize-none"></textarea>
            </div>

            {/* 📸 WALK PHOTO ATTACHMENTS */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
               <label className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Photo Evidence</span>
                 <label className="cursor-pointer bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-500 transition-colors">
                    <Camera size={18} />
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => setWalkPhotos([...walkPhotos, ...Array.from(e.target.files!)])} />
                 </label>
               </label>
               <div className="flex flex-wrap gap-3">
                 {walkPhotos.map((file, i) => (
                   <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setWalkPhotos(walkPhotos.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-600 p-1 rounded-md text-white"><X size={10}/></button>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 flex items-center gap-2 mb-2"><PenTool size={12} /> Digital Sign-Off</label>
               <SignaturePad onChange={(dataUrl) => setSignatureData(dataUrl)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <select name="status" className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white text-base">
                 <option value="Pass">Compliant</option>
                 <option value="Fail">Action Required</option>
               </select>
               <input name="inspector_name" defaultValue="Site Super" className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white text-base" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-xl flex justify-center items-center gap-2">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} Finalize Safety Walk
            </button>
          </form>
        </div>
      )}

      {/* --- UPGRADED PDF VIEW MODAL --- */}
      {selectedWalk && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl w-full my-8 flex flex-col gap-4">
            
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-2xl">
              <button onClick={() => setSelectedWalk(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 transition-all"><X size={16} /> Close</button>
              
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50">
                <FileDown size={16} /> {isGeneratingPDF ? 'Generating...' : 'Auto-Download PDF'}
              </button>
            </div>

            <div id="pdf-report" className="bg-white text-slate-900 p-10 md:p-14 rounded-xl shadow-2xl relative">
              <div className="border-b-2 border-slate-200 pb-6 mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tight">{project?.name}</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Official Site Safety Report</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Date</p>
                  <p className="text-lg font-black">{new Date(selectedWalk.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Type</p>
                  <p className="text-base font-bold text-slate-800">{selectedWalk.walk_type || 'General Site Walk'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sub-Trade Inspected</p>
                  <p className="text-base font-bold text-slate-800">{selectedWalk.trade_company || 'Site-Wide'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inspector Name</p>
                  <p className="text-base font-bold text-slate-800">{selectedWalk.inspector_name || 'Site Superintendent'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Compliance Status</p>
                  <p className={`text-base font-bold ${selectedWalk.status === 'Pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedWalk.status === 'Pass' ? 'Compliant / Pass' : 'Action Required / Deficiencies'}
                  </p>
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Inspector Findings & Notes</h3>
                <div className="bg-white p-6 rounded-xl border border-slate-200 min-h-[200px]">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{selectedWalk.notes || 'No additional notes.'}</p>
                </div>
              </div>

              {/* PDF RENDER SAVED PHOTOS */}
              {selectedWalk.photo_urls && selectedWalk.photo_urls.length > 0 && (
                <div className="mb-10">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Visual Evidence</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedWalk.photo_urls.map((url: string, idx: number) => (
                      <img key={idx} src={url} crossOrigin="anonymous" className="w-full aspect-square object-cover rounded-xl border border-slate-300" alt="Evidence" />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-20 pt-8 border-t-2 border-slate-200 flex justify-between items-end">
                <div className="w-64">
                  {selectedWalk.signature_url && (
                    <img 
                      src={selectedWalk.signature_url} 
                      crossOrigin="anonymous" 
                      alt="Signature" 
                      className="h-16 object-contain mb-2 mix-blend-multiply" 
                    />
                  )}
                  <div className="border-b border-slate-400 pb-1 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supervisor / Trade Sign-Off</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- NATIVE HTML5 SIGNATURE PAD COMPONENT ---
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#FFFFFF'; 
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault(); 
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full h-[120px] touch-none cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
}