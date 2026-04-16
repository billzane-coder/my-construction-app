'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, FileDown, ShieldAlert, 
  CheckCircle, AlertTriangle, X, Search, FileText, Save, Zap, PenTool
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// --- SMART PROMPTS DICTIONARY ---
const SAFETY_PROMPTS = {
  walkTypes: {
    'Fall Protection': [
      'Guardrails verified at 42" with mid-rail and toe board', 
      'Workers tied off with zero free-fall slack', 
      'Floor openings securely covered and marked "DANGER HOLE"',
      'Ladders tied off at top and bottom (3ft past landing)'
    ],
    'Housekeeping': [
      'Egress routes 100% clear of trip hazards', 
      'Scrap lumber stripped of nails / nails bent', 
      'Combustible waste binned and removed from floor',
      'Extension cords flown above head height'
    ],
    'Hot Work': [
      '4A:40BC Fire extinguisher within 10ft', 
      'Dedicated fire watch assigned for 60 mins post-work', 
      'Combustibles cleared within 35ft radius'
    ],
    'Scaffold Inspection': [
      'Base plates level on mudsills', 
      'All cross braces securely pinned', 
      'Work platforms fully planked with no gaps',
      'Guardrails installed on all open sides'
    ]
  },
  trades: {
    framing: [
      'Truss bracing installed per engineered drawings', 
      'Pneumatic nailers disconnected when clearing jams', 
      'Leading edge fall protection in place'
    ],
    electrical: [
      'GFCI functioning on temporary power panels', 
      'Lockout/Tagout applied to live circuits', 
      'No aluminum ladders in use near live panels'
    ],
    plumbing: [
      'Trench shoring installed (excavations >4ft)', 
      'Gas cylinders stored upright and chained', 
      'Hot work permit active for brazing'
    ],
    interiors: [
      'Baker scaffold locking pins fully engaged', 
      'Acoustic lathing tie-offs secure and tested', 
      'Insulation fiber control / N95 respirators worn',
      'Stilts used only on swept, flat floors'
    ],
    roofing: [
      'Anchors verified for 5000lb capacity', 
      'Lanyards protected from sharp edges', 
      'Materials secured from wind drift'
    ],
    concrete: [
      'Rebar caps installed to prevent impalement', 
      'Pump truck outriggers fully extended on pads', 
      'Silica dust wet-cut methods actively used'
    ]
  }
};

export default function SafetyHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [walks, setWalks] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [selectedWalk, setSelectedWalk] = useState<any>(null)
  const [showNewWalkModal, setShowNewWalkModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Smart Prompts & Form State
  const [activeWalkType, setActiveWalkType] = useState('General Site Walk')
  const [activeTradeId, setActiveTradeId] = useState('')
  const [notes, setNotes] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, w, c] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('project_safety_walks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id).order('company')
      ])
      if (p.error) throw p.error
      if (w.error) throw w.error
      setProject(p.data)
      setWalks(w.data || [])
      setContacts(c.data || [])
    } catch (err) {
      console.error("Data fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const filteredWalks = walks.filter(walk => {
    const searchLower = searchTerm.toLowerCase()
    return (
      (walk.trade_company || '').toLowerCase().includes(searchLower) ||
      (walk.walk_type || '').toLowerCase().includes(searchLower) ||
      (walk.inspector_name || '').toLowerCase().includes(searchLower)
    )
  })

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
         else if (role.includes('plumb') || role.includes('hvac') || role.includes('mechanical')) suggestions.push(...SAFETY_PROMPTS.trades.plumbing);
         else if (role.includes('drywall') || role.includes('acoustic') || role.includes('insulation') || role.includes('tape')) suggestions.push(...SAFETY_PROMPTS.trades.interiors);
         else if (role.includes('roof')) suggestions.push(...SAFETY_PROMPTS.trades.roofing);
         else if (role.includes('concrete') || role.includes('form')) suggestions.push(...SAFETY_PROMPTS.trades.concrete);
      }
    }
    return Array.from(new Set(suggestions)).slice(0, 6);
  }

  const handleAppendPrompt = (text: string) => {
    setNotes(prev => {
      const cleanPrev = prev.trim();
      return cleanPrev ? `${cleanPrev}\n- [ ] ${text}` : `- [ ] ${text}`;
    });
  }

  const handleCreateWalk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const fd = new FormData(e.currentTarget);
      const contactId = activeTradeId;
      const selectedContact = contacts.find(c => c.id === contactId);
      const companyName = selectedContact ? selectedContact.company : 'Site-Wide';
      const status = fd.get('status') as string;
      const inspectorName = fd.get('inspector_name') as string;

      let finalSignatureUrl = null;

      if (signatureData) {
        const res = await fetch(signatureData);
        const blob = await res.blob();
        const filePath = `${id}/signatures/${Date.now()}_sig.png`;
        
        const { error: sigError } = await supabase.storage.from('project-files').upload(filePath, blob);
        if (!sigError) {
          const { data: publicUrlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
          finalSignatureUrl = publicUrlData.publicUrl;
        }
      }

      const payload = {
        project_id: id,
        walk_type: activeWalkType,
        trade_company: companyName,
        inspector_name: inspectorName,
        status: status,
        notes: notes,
        signature_url: finalSignatureUrl
      };

      const { data: walkData, error: walkError } = await supabase
        .from('project_safety_walks')
        .insert([payload])
        .select()
        .single();

      if (walkError) throw walkError;

      if (contactId) {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text(`Official Site Safety Report`, 20, 20);
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Project: ${project?.name || 'Site'}`, 20, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 36);
        doc.setTextColor(0);
        doc.text(`Audit Type: ${activeWalkType}`, 20, 50);
        doc.text(`Sub-Trade Inspected: ${companyName}`, 20, 56);
        doc.text(`Inspector: ${inspectorName}`, 20, 62);
        doc.setFontSize(14);
        doc.setTextColor(status === 'Pass' ? 0 : 200, status === 'Pass' ? 150 : 0, 0);
        doc.text(`Status: ${status === 'Pass' ? 'Compliant' : 'Action Required'}`, 20, 72);
        
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text(`Findings & Notes:`, 20, 86);
        doc.setFontSize(10);
        const splitNotes = doc.splitTextToSize(notes || 'No additional notes provided.', 170);
        doc.text(splitNotes, 20, 92);

        if (signatureData) {
          const finalY = 92 + (splitNotes.length * 5) + 20;
          doc.addImage(signatureData, 'PNG', 20, finalY, 60, 20);
          doc.setFontSize(10);
          doc.setTextColor(150);
          doc.text("Signed & Acknowledged", 20, finalY + 25);
        }

        const pdfBlob = doc.output('blob');
        const fileName = `SafetyWalk_${companyName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const filePath = `${id}/trades/${contactId}/Safety/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, pdfBlob);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
          await supabase.from('project_submittals').insert([{
            project_id: id, contact_id: contactId, title: `${activeWalkType} Audit`, 
            category: 'Safety', url: urlData.publicUrl, status: status === 'Pass' ? 'Approved' : 'Action Required'
          }]);
        }
      }

      setShowNewWalkModal(false);
      setNotes('');
      setSignatureData(null);
      fetchData(); 

    } catch (err: any) {
      console.error("Save failed:", err);
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- UPGRADED PDF EXPORT ENGINE ---
  const handleExportPDF = async () => {
    const reportElement = document.getElementById('pdf-report');
    if (!reportElement) return;

    setIsGeneratingPDF(true);
    try {
      // Temporarily inject padding so the edges don't get cropped by the canvas
      reportElement.style.padding = '40px';
      
      const canvas = await html2canvas(reportElement, { 
        scale: 2, // High resolution for crisp text
        useCORS: true, // Absolutely required to render the Supabase signature image
        allowTaint: false,
        logging: false,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight
      });
      
      // Reset padding immediately
      reportElement.style.padding = '0px';

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // A4 Paper Dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Clean up the file name to prevent download errors
      const safeTradeName = (selectedWalk?.trade_company || 'Site_Wide').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date(selectedWalk?.created_at).toISOString().split('T')[0];
      const fileName = `Safety_Report_${safeTradeName}_${dateStr}.pdf`;
      
      // This forces the browser to download the file directly
      pdf.save(fileName);

    } catch (err) {
      console.error("PDF Generation failed:", err);
      alert("Failed to export PDF. Ensure all images have fully loaded.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Loading...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Safety <span className="text-emerald-500">Hub</span></h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ShieldAlert size={14} className="text-emerald-500" /> {project?.name}
          </p>
        </div>
        <button 
          onClick={() => {
            setNotes('');
            setActiveTradeId('');
            setSignatureData(null);
            setShowNewWalkModal(true);
          }}
          className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> New Walk
        </button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl">
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
            </tbody>
          </table>
        </div>
      </div>

      {/* --- NEW WALK MODAL WITH SIGNATURE PAD --- */}
      {showNewWalkModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleCreateWalk} className="bg-slate-900 border-2 border-emerald-600 p-8 md:p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl my-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-black text-white uppercase italic">Log Safety Walk</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Inspection Type</label>
                <select name="walk_type" value={activeWalkType} onChange={(e) => setActiveWalkType(e.target.value)} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  <option>General Site Walk</option>
                  <option>Fall Protection</option>
                  <option>Housekeeping</option>
                  <option>Scaffold Inspection</option>
                  <option>Hot Work</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Sub-Trade Inspected</label>
                <select name="contact_id" value={activeTradeId} onChange={(e) => setActiveTradeId(e.target.value)} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  <option value="">Site-Wide (General)</option>
                  {contacts.map(trade => (<option key={trade.id} value={trade.id}>{trade.company}</option>))}
                </select>
              </div>
            </div>

            {getSuggestions().length > 0 && (
              <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800/50">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Zap size={12}/> Smart Checks</p>
                <div className="flex flex-wrap gap-2">
                  {getSuggestions().map((suggestion, i) => (
                    <button key={i} type="button" onClick={() => handleAppendPrompt(suggestion)} className="bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[10px] font-bold px-3 py-2 rounded-xl text-left">+ {suggestion}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 flex justify-between">
                <span>Findings & Notes</span>
                {notes.length > 0 && <button type="button" onClick={() => setNotes('')} className="text-slate-600 hover:text-amber-500">Clear</button>}
              </label>
              <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="List deficiencies..." rows={4} className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-medium text-white outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>

            {/* SIGNATURE PAD INTEGRATION */}
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 flex items-center gap-2">
                 <PenTool size={12} /> Sign-Off
               </label>
               <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <SignaturePad onChange={(dataUrl) => setSignatureData(dataUrl)} />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Status</label>
                <select name="status" className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none">
                  <option value="Pass">Pass / Compliant</option>
                  <option value="Fail">Action Required</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Inspector</label>
                <input name="inspector_name" defaultValue="Site Superintendent" required className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-slate-300 outline-none focus:border-emerald-500" />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowNewWalkModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex justify-center items-center gap-2 disabled:opacity-50">
                <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- UPGRADED PDF VIEW MODAL --- */}
      {selectedWalk && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl w-full my-8 flex flex-col gap-4">
            
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-2xl">
              <button onClick={() => setSelectedWalk(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 transition-all"><X size={16} /> Close</button>
              
              {/* This button triggers the new bulletproof export */}
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50">
                <FileDown size={16} /> {isGeneratingPDF ? 'Generating...' : 'Auto-Download PDF'}
              </button>
            </div>

            {/* This specific ID is what html2canvas captures */}
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

              {/* RENDER SAVED SIGNATURE IN THE PDF VIEW */}
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
        ctx.strokeStyle = '#020617'; // Dark ink
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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <div className="bg-white rounded-xl overflow-hidden border-2 border-slate-200">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[150px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={clearCanvas} className="text-[10px] font-black uppercase text-slate-500 hover:text-amber-500 tracking-widest transition-all">
          Clear Signature
        </button>
      </div>
    </div>
  );
}