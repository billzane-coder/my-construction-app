'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Inbox, Bot, FileText, CheckCircle2, Trash2, ArrowRight, Loader2, ExternalLink } from 'lucide-react'

export default function TradeHub() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  
  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_documents')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
    
    setDocuments(data || [])
    if (data && data.length > 0 && !selectedDocId) {
      setSelectedDocId(data[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const selectedDoc = documents.find(d => d.id === selectedDocId)

  // --- TESTING ACTION: Simulate an AI-Parsed Email ---
  const handleSimulateInbound = async () => {
    const dummyDocs = [
      { type: 'Invoice', trade: 'Pro-Line Drywall', amount: 14500.00, file: 'INV-2026-04.pdf' },
      { type: 'Quote', trade: 'Apex Electrical', amount: 2200.50, file: 'Quote_Extra_Outlets.pdf' },
      { type: 'Stat Dec', trade: 'Empire Framing', amount: 0, file: 'StatDec_April.pdf' }
    ]
    const random = dummyDocs[Math.floor(Math.random() * dummyDocs.length)]
    
    await supabase.from('inbound_documents').insert([{
      project_id: id,
      file_name: random.file,
      file_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Standard safe test PDF
      document_type: random.type,
      trade_name: random.trade,
      extracted_amount: random.amount,
      status: 'Pending Review'
    }])
    fetchData()
  }

  const handleProcess = async (docId: string, newStatus: string) => {
    await supabase.from('inbound_documents').update({ status: newStatus }).eq('id', docId)
    fetchData()
  }

  const handleDelete = async (docId: string) => {
    await supabase.from('inbound_documents').delete().eq('id', docId)
    if (selectedDocId === docId) setSelectedDocId(null)
    fetchData()
  }

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0)

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>

  return (
    <div className="w-full bg-slate-950 min-h-screen p-6 md:p-12 text-slate-100">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none flex items-center gap-4">
            <Inbox size={40} className="text-blue-500" /> Trade <span className="text-emerald-500">Hub</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">AI Document Processing Queue</p>
        </div>
        <button onClick={handleSimulateInbound} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-2 transition-all shadow-lg">
          <Bot size={16} className="text-blue-400" /> Simulate Inbound Email
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: INBOX LIST */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Pending Documents ({documents.filter(d => d.status === 'Pending Review').length})</h3>
          
          {documents.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 p-12 rounded-[32px] text-center">
              <p className="text-slate-400 font-bold text-xs uppercase mb-2">Inbox is Zero</p>
              <p className="text-slate-600 text-[10px] uppercase">No incoming trade documents.</p>
            </div>
          ) : (
            documents.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDocId(doc.id)} 
                className={`p-6 rounded-[28px] border transition-all cursor-pointer group ${selectedDocId === doc.id ? 'bg-blue-950/20 border-blue-500 shadow-xl' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${doc.document_type === 'Invoice' ? 'bg-amber-950 text-amber-500 border-amber-900/50' : doc.document_type === 'Quote' ? 'bg-blue-950 text-blue-500 border-blue-900/50' : 'bg-emerald-950 text-emerald-500 border-emerald-900/50'}`}>
                    {doc.document_type}
                  </span>
                  {doc.status === 'Pending Review' ? (
                    <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  )}
                </div>
                <h4 className="text-lg font-black text-white uppercase italic leading-tight truncate">{doc.trade_name || 'Unknown Sender'}</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 truncate">{doc.file_name}</p>
                <div className="mt-4 flex justify-between items-end">
                  <p className="text-xl font-black text-white">{doc.extracted_amount > 0 ? formatMoney(doc.extracted_amount) : '-'}</p>
                  <span className="text-[9px] font-bold text-slate-600 uppercase">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT: AI EXTRACTION PANEL */}
        <div className="lg:col-span-8">
          {selectedDoc ? (
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden sticky top-8 flex flex-col xl:flex-row h-[800px]">
              
              {/* PDF VIEWER */}
              <div className="w-full xl:w-7/12 bg-slate-950 border-r border-slate-800 p-2 flex flex-col">
                <div className="flex justify-between items-center p-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Original Document</h3>
                  <a href={selectedDoc.file_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400"><ExternalLink size={16}/></a>
                </div>
                <div className="flex-1 rounded-3xl overflow-hidden bg-slate-900/50 border border-slate-800/50 relative">
                   <iframe src={`${selectedDoc.file_link}#view=FitH`} className="absolute inset-0 w-full h-full" title="PDF Viewer" />
                </div>
              </div>

              {/* DATA EXTRACTION & ROUTING */}
              <div className="w-full xl:w-5/12 p-8 flex flex-col justify-between">
                <div className="space-y-8">
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">{selectedDoc.trade_name}</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI Extraction Summary</p>
                  </div>

                  <div className="bg-blue-950/10 border border-blue-900/30 p-6 rounded-3xl space-y-6">
                    <div>
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter mb-1">Detected Type</p>
                      <p className="text-xl font-black text-white">{selectedDoc.document_type}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-tighter mb-1">Financial Claim</p>
                      <p className="text-4xl font-black text-white tracking-tighter">{formatMoney(selectedDoc.extracted_amount)}</p>
                    </div>
                  </div>
                  
                  {/* Future Routing Logic Area */}
                  {selectedDoc.status === 'Pending Review' && (
                    <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Route Document To:</p>
                      <select className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl font-bold text-white outline-none mb-4">
                        <option value="">Select Destination...</option>
                        {selectedDoc.document_type === 'Invoice' && <option value="draw">Current Monthly Draw</option>}
                        {selectedDoc.document_type === 'Quote' && <option value="co">New Change Order</option>}
                        <option value="files">General Files</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-8 space-y-3">
                  {selectedDoc.status === 'Pending Review' ? (
                    <button onClick={() => handleProcess(selectedDoc.id, 'Processed')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                      <CheckCircle2 size={18}/> Approve & Route Data
                    </button>
                  ) : (
                    <div className="w-full bg-slate-950 border border-emerald-900/50 text-emerald-500 p-5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                      <CheckCircle2 size={18}/> Document Processed
                    </div>
                  )}
                  <button onClick={() => handleDelete(selectedDoc.id)} className="w-full bg-transparent hover:bg-red-950/30 text-slate-500 hover:text-red-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex justify-center items-center gap-2">
                    <Trash2 size={14}/> Delete from Inbox
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-[40px] h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12">
              <Bot size={64} className="text-slate-800 mb-6" />
              <h3 className="text-2xl font-black text-slate-600 uppercase italic mb-2">Awaiting Instructions</h3>
              <p className="text-slate-500 text-sm font-bold max-w-md">Select a document from the queue to review the AI extraction and route it to your financials.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}