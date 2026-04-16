'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Plus, FileDown, ShieldAlert, 
  CheckCircle, AlertTriangle, X, Search, FileText, Save
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function SafetyHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [walks, setWalks] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([]) // NEW: State for trades
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  
  const [selectedWalk, setSelectedWalk] = useState<any>(null)
  const [showNewWalkModal, setShowNewWalkModal] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, w, c] = await Promise.all([
        supabase.from('projects').select('name').eq('id', id).single(),
        supabase.from('project_safety_walks').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('project_contacts').select('id, company, trade_role').eq('project_id', id).order('company') // NEW: Fetch Trades
      ])
      
      if (p.error) throw p.error
      if (w.error) throw w.error

      setProject(p.data)
      setWalks(w.data || [])
      setContacts(c.data || [])
    } catch (err: any) {
      console.error("Data fetch error:", err)
      alert("Failed to load data. Check console.")
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

  // --- AUTOMATED PDF & FILING LOGIC ---
  const handleCreateWalk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const fd = new FormData(e.currentTarget);
      const contactId = fd.get('contact_id') as string;
      
      // Determine the company name for the walk record
      const selectedContact = contacts.find(c => c.id === contactId);
      const companyName = selectedContact ? selectedContact.company : 'Site-Wide';

      const walkType = fd.get('walk_type') as string;
      const status = fd.get('status') as string;
      const inspectorName = fd.get('inspector_name') as string;
      const notes = fd.get('notes') as string;

      const payload = {
        project_id: id,
        walk_type: walkType,
        trade_company: companyName,
        inspector_name: inspectorName,
        status: status,
        notes: notes
      };

      // 1. Save the walk record
      const { data: walkData, error: walkError } = await supabase
        .from('project_safety_walks')
        .insert([payload])
        .select()
        .single();

      if (walkError) throw walkError;

      // 2. If a specific trade was selected, auto-generate and vault the PDF
      if (contactId) {
        // Build a clean background PDF using jsPDF
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text(`Official Site Safety Report`, 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Project: ${project?.name || 'Site'}`, 20, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 36);
        
        doc.setTextColor(0);
        doc.text(`Audit Type: ${walkType}`, 20, 50);
        doc.text(`Sub-Trade Inspected: ${companyName}`, 20, 56);
        doc.text(`Inspector: ${inspectorName}`, 20, 62);
        
        doc.setFontSize(14);
        doc.setTextColor(status === 'Pass' ? 0 : 200, status === 'Pass' ? 150 : 0, 0);
        doc.text(`Status: ${status === 'Pass' ? 'Compliant' : 'Action Required / Deficiencies'}`, 20, 72);
        
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text(`Findings & Notes:`, 20, 86);
        doc.setFontSize(10);
        doc.text(notes || 'No additional notes provided.', 20, 92, { maxWidth: 170 });

        // Convert to Blob and prepare for upload
        const pdfBlob = doc.output('blob');
        const fileName = `SafetyWalk_${companyName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const filePath = `${id}/trades/${contactId}/Safety/${fileName}`;

        // Upload to Storage
        const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, pdfBlob);
        
        if (!uploadError) {
          // Get public URL and save to submittals
          const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
          
          await supabase.from('project_submittals').insert([{
            project_id: id, 
            contact_id: contactId, 
            title: `${walkType} Audit`, 
            category: 'Safety', 
            url: urlData.publicUrl, 
            status: status === 'Pass' ? 'Approved' : 'Action Required'
          }]);
        } else {
          console.error("Failed to upload auto-PDF to vault:", uploadError);
          // We don't throw here, because the walk itself saved successfully
        }
      }

      setShowNewWalkModal(false);
      fetchData(); // Refresh the table

    } catch (err: any) {
      console.error("Crash during save:", err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- MANUAL PDF GENERATION ENGINE (For the View Button) ---
  const handleExportPDF = async () => {
    const reportElement = document.getElementById('pdf-report')
    if (!reportElement) return

    setIsGeneratingPDF(true)
    try {
      reportElement.style.padding = '40px'
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false })
      reportElement.style.padding = '0px'

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      const fileName = `Safety_Walk_${selectedWalk?.trade_company?.replace(/\s+/g, '_') || 'Site'}_${new Date(selectedWalk?.created_at).toLocaleDateString()}.pdf`
      pdf.save(fileName)

    } catch (err) {
      console.error("PDF Generation failed:", err)
      alert("Failed to generate PDF.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Loading Safety Data...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Safety <span className="text-emerald-500">Hub</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ShieldAlert size={14} className="text-emerald-500" /> {project?.name || 'Site Compliance'}
          </p>
        </div>
        <button 
          onClick={() => setShowNewWalkModal(true)}
          className="bg-emerald-600 text-white text-[10px] font-black px-10 py-5 rounded-3xl uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> New Walk
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 animate-in fade-in duration-500">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search by Trade, Type, or Inspector..."
            className="w-full bg-slate-900 border border-slate-800 rounded-3xl py-4 pl-14 pr-6 text-sm text-white font-bold placeholder:text-slate-600 focus:border-emerald-500 outline-none transition-all shadow-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl animate-in fade-in duration-700">
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
              {filteredWalks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-600 font-black uppercase tracking-widest text-sm">
                    No safety walks found.
                  </td>
                </tr>
              ) : (
                filteredWalks.map((walk) => (
                  <tr key={walk.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="p-6">
                      <span className="text-sm font-bold text-white">
                        {new Date(walk.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="bg-slate-950 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-emerald-500 border border-emerald-900/50">
                        {walk.walk_type || 'General'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-sm font-bold text-slate-300">
                        {walk.trade_company || 'Site-Wide'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className="text-sm font-bold text-slate-400">
                        {walk.inspector_name || 'Superintendent'}
                      </span>
                    </td>
                    <td className="p-6">
                      {walk.status === 'Pass' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                          <CheckCircle size={12} /> Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                          <AlertTriangle size={12} /> Action Req
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => setSelectedWalk(walk)}
                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                      >
                        <FileText size={14} /> View Report
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- UPDATED NEW WALK MODAL --- */}
      {showNewWalkModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleCreateWalk} className="bg-slate-900 border-2 border-emerald-600 p-8 md:p-10 rounded-[56px] max-w-2xl w-full space-y-6 shadow-2xl my-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white uppercase italic">Log Safety Walk</h2>
              <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-2">Official Site Record</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Inspection Type</label>
                <select name="walk_type" required className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer">
                  <option value="General Site Walk">General Site Walk</option>
                  <option value="Fall Protection">Fall Protection (Heights)</option>
                  <option value="Housekeeping">Housekeeping & Egress</option>
                  <option value="Scaffold Inspection">Scaffold Inspection</option>
                  <option value="Hot Work">Hot Work / Fire Safety</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Compliance Status</label>
                <select name="status" required className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer">
                  <option value="Pass">Pass / Compliant</option>
                  <option value="Fail">Action Required / Deficiencies</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* NEW: DYNAMIC TRADE DROPDOWN */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Sub-Trade Inspected</label>
                <select name="contact_id" className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer">
                  <option value="">Site-Wide (General)</option>
                  {contacts.map(trade => (
                    <option key={trade.id} value={trade.id}>
                      {trade.company} ({trade.trade_role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Inspector Name</label>
                <input name="inspector_name" defaultValue="Site Superintendent" required className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-bold text-slate-300 outline-none focus:border-emerald-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Findings & Notes</label>
              <textarea 
                name="notes" 
                placeholder="List any deficiencies, warnings given, or general observations..."
                rows={4} 
                className="w-full p-4 bg-slate-950 rounded-2xl border border-slate-800 font-medium text-white outline-none focus:border-emerald-500 resize-none"
              ></textarea>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowNewWalkModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest transition-all">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50">
                <Save size={16} /> {isSubmitting ? 'Saving & Filing...' : 'Save Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- PDF VIEW MODAL --- */}
      {selectedWalk && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-3xl w-full my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-2xl">
              <button onClick={() => setSelectedWalk(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white flex items-center gap-2 transition-all">
                <X size={16} /> Close
              </button>
              <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50">
                <FileDown size={16} /> {isGeneratingPDF ? 'Generating...' : 'Export to PDF'}
              </button>
            </div>

            <div id="pdf-report" className="bg-white text-slate-900 p-10 md:p-14 rounded-xl shadow-2xl relative">
              <div className="border-b-2 border-slate-200 pb-6 mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black uppercase italic tracking-tight">{project?.name}</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Official Site Safety Report</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 uppercase">Date of Inspection</p>
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
                  {selectedWalk.notes ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-medium">
                      {selectedWalk.notes}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-400">No additional notes or deficiencies recorded for this walk.</p>
                  )}
                </div>
              </div>

              <div className="mt-20 pt-8 border-t-2 border-slate-200 flex justify-between">
                <div className="w-64">
                  <div className="border-b border-slate-400 pb-1 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Constructor / Supervisor Signature</p>
                </div>
                <div className="w-64">
                  <div className="border-b border-slate-400 pb-1 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trade Representative (If applicable)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}