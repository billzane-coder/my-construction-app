'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Plus, Download, ShieldCheck, 
  Loader2, CheckCircle2, AlertCircle, FileText, Trash2
} from 'lucide-react'

// --- 1. UPDATED PHASE SEQUENCE ---
const INSPECTION_PHASES = [
  'Footings',
  'Backfill',
  'U/G Plumbing',
  'U/G Insulation',
  'Slab / Floor',
  'Rough Framing',
  'Air Barrier',
  'Plumbing Rough',
  'HVAC Rough',
  'Electrical (ESA)',
  'Insulation',
  'Drywall',
  'Final / Occupancy'
]

const STATUS_COLORS: Record<string, string> = {
  'Pending': 'bg-slate-900 border-slate-800 text-slate-600',
  'Requested': 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]',
  'Partial': 'bg-amber-500 border-amber-400 text-white',
  'Pass': 'bg-emerald-500 border-emerald-400 text-white',
  'Fail': 'bg-red-600 border-red-500 text-white',
  'N/A': 'bg-slate-950 border-slate-900 text-slate-700 line-through opacity-50' // --- 2. NEW N/A STATUS ---
}

export default function InspectionMatrix() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [inspections, setInspections] = useState<any[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal States
  const [exporting, setExporting] = useState(false)
  const [requestMode, setRequestMode] = useState(false)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([])
  const [activeCell, setActiveCell] = useState<{unit: string, phase: string, status: string} | null>(null)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [projData, insData] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('project_inspections').select('*').eq('project_id', id)
    ])

    if (projData.data) setProject(projData.data)
    if (insData.data) {
      setInspections(insData.data)
      const uniqueUnits = Array.from(new Set(insData.data.map((i: any) => i.unit_name)))
      // Custom sort to keep "Building/Overall" at the top if it exists
      uniqueUnits.sort((a: string, b: string) => {
        if (a.toLowerCase().includes('building') || a.toLowerCase().includes('overall')) return -1;
        if (b.toLowerCase().includes('building') || b.toLowerCase().includes('overall')) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      setUnits(uniqueUnits as string[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const getCellRecord = (unit: string, phase: string) => {
    return inspections.find(i => i.unit_name === unit && i.inspection_type === phase) || { status: 'Pending' }
  }

  const handleAddUnit = async () => {
    const name = prompt('Enter Unit/Lot Name (e.g. "Lot 12" or "Building A - Exterior"):')
    if (!name) return

    const newRecords = INSPECTION_PHASES.map(phase => ({
      project_id: id,
      unit_name: name,
      inspection_type: phase,
      status: 'Pending'
    }))

    await supabase.from('project_inspections').insert(newRecords)
    fetchData()
  }

  // --- 3. DELETE UNIT LOGIC ---
  const handleDeleteUnit = async (unitName: string) => {
    if (!confirm(`Are you sure you want to completely delete "${unitName}"? This will erase all inspection records for this row.`)) return
    
    await supabase.from('project_inspections').delete().eq('project_id', id).eq('unit_name', unitName)
    fetchData()
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!activeCell) return
    const { unit, phase } = activeCell
    
    // Optimistic UI update
    setInspections(prev => prev.map(i => i.unit_name === unit && i.inspection_type === phase ? { ...i, status: newStatus } : i))
    setActiveCell(null)

    // DB Update
    const existing = inspections.find(i => i.unit_name === unit && i.inspection_type === phase)
    if (existing?.id) {
      await supabase.from('project_inspections').update({ status: newStatus }).eq('id', existing.id)
    } else {
      await supabase.from('project_inspections').insert([{ project_id: id, unit_name: unit, inspection_type: phase, status: newStatus }])
    }
  }

  const toggleRequestSelection = (unit: string, phase: string) => {
    const key = `${unit}|${phase}`
    setSelectedRequests(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  // --- 4. MASTER PDF EXPORTER WITH AUTO-ARCHIVE ---
  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF(requestMode ? 'portrait' : 'landscape')

      // Header
      doc.setFontSize(22)
      doc.setTextColor(15, 23, 42)
      doc.setFont("helvetica", "bold")
      doc.text(requestMode ? "INSPECTION REQUEST" : "MASTER INSPECTION STATUS", 14, 22)

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text(`Project: ${project?.name || 'N/A'}`, 14, 30)
      doc.text(`Address: ${project?.address || 'N/A'}`, 14, 35)
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40)

      if (requestMode) {
        const tableData = selectedRequests.map(req => {
          const [unit, phase] = req.split('|')
          return [unit, phase, "REQUESTED", ""]
        })
        autoTable(doc, {
          startY: 55,
          head: [['Unit / Lot', 'Inspection Phase', 'Status', 'Inspector Sign-off']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          bodyStyles: { minCellHeight: 15, valign: 'middle' }
        })
      } else {
        const tableHead = ['Unit', ...INSPECTION_PHASES]
        const tableBody = units.map(unit => [unit, ...INSPECTION_PHASES.map(phase => getCellRecord(unit, phase).status)])
        autoTable(doc, {
          startY: 50, head: [tableHead], body: tableBody, theme: 'grid',
          styles: { fontSize: 7, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [15, 23, 42] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index > 0) {
              const s = data.cell.raw
              if (s === 'Pass') { data.cell.styles.fillColor = [16, 185, 129]; data.cell.styles.textColor = 255; }
              else if (s === 'Requested') { data.cell.styles.fillColor = [59, 130, 246]; data.cell.styles.textColor = 255; }
              else if (s === 'Partial') { data.cell.styles.fillColor = [245, 158, 11]; data.cell.styles.textColor = 255; }
              else if (s === 'Fail') { data.cell.styles.fillColor = [239, 68, 68]; data.cell.styles.textColor = 255; }
              else if (s === 'N/A') { data.cell.styles.textColor = 200; data.cell.styles.fontStyle = 'italic'; }
              else { data.cell.styles.textColor = 150; }
            }
          }
        })
      }

      const fileName = requestMode ? `Request_${project?.name}.pdf` : `Matrix_${project?.name}.pdf`
      doc.save(fileName.replace(/\s+/g, '_'))

      // --- AUTO ARCHIVE MAGIC ---
      if (requestMode && selectedRequests.length > 0) {
        const pdfBlob = doc.output('blob')
        const storagePath = `${id}/requests/Inspection_Req_${Date.now()}.pdf`
        
        const { error: uploadError } = await supabase.storage.from('project-files').upload(storagePath, pdfBlob, { contentType: 'application/pdf' })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('project-files').getPublicUrl(storagePath)
          
          const updates = selectedRequests.map(req => {
            const [unit, phase] = req.split('|')
            return supabase.from('project_inspections')
              .update({ status: 'Requested', document_url: publicUrl })
              .eq('project_id', id).eq('unit_name', unit).eq('inspection_type', phase)
          })
          
          await Promise.all(updates)
          setRequestMode(false)
          setSelectedRequests([])
          fetchData()
        }
      }
    } catch (err) { alert("PDF Export Error. Check console.") }
    setExporting(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Matrix...</div>

  return (
    <div className="p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-8 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Inspection <span className="text-blue-500">Matrix</span>
          </h1>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-blue-500" /> Municipal & ESA Tracking
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {requestMode ? (
            <>
              <button onClick={() => { setRequestMode(false); setSelectedRequests([]); }} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all border border-slate-700">
                Cancel
              </button>
              <button onClick={handleExportPDF} disabled={exporting || selectedRequests.length === 0} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/20">
                {exporting ? <Loader2 className="animate-spin" size={14}/> : <FileText size={14}/>} Generate & Archive Request
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportPDF} disabled={exporting} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2">
                {exporting ? <Loader2 className="animate-spin" size={14}/> : <Download size={14}/>} Export Full Matrix
              </button>
              <button onClick={() => setRequestMode(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20">
                <FileText size={14}/> Create Batch Request
              </button>
              <button onClick={handleAddUnit} className="bg-emerald-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                <Plus size={14}/> Add Unit / Line
              </button>
            </>
          )}
        </div>
      </div>

      {requestMode && (
        <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-2xl mb-6 flex items-center gap-4 text-blue-400 text-sm font-bold animate-in fade-in zoom-in-95">
          <AlertCircle size={20} />
          Tap cells to add them to your batch inspection request. A PDF will be generated and permanently linked to the selected lots.
        </div>
      )}

      {/* MATRIX TABLE */}
      <div className="overflow-x-auto bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-6 border-b border-slate-800 bg-slate-950/50 sticky left-0 z-20 min-w-[200px] shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit / Lot</span>
              </th>
              {INSPECTION_PHASES.map(phase => (
                <th key={phase} className="p-4 border-b border-slate-800 bg-slate-950/50 whitespace-nowrap min-w-[140px]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{phase}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit, rowIdx) => (
              <tr key={unit} className="group hover:bg-slate-800/20 transition-colors">
                {/* ROW HEADER WITH DELETE BUTTON */}
                <td className="p-4 border-b border-slate-800/50 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white uppercase tracking-tight">{unit}</span>
                    <button onClick={() => handleDeleteUnit(unit)} className="text-slate-600 hover:text-red-500 transition-colors p-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
                
                {INSPECTION_PHASES.map(phase => {
                  const record = getCellRecord(unit, phase)
                  const isSelected = selectedRequests.includes(`${unit}|${phase}`)
                  const hasDoc = !!record.document_url

                  return (
                    <td key={phase} className="p-2 border-b border-slate-800/50 relative">
                      <button 
                        onClick={() => requestMode ? toggleRequestSelection(unit, phase) : setActiveCell({unit, phase, status: record.status})}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                          requestMode 
                            ? isSelected ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'border-slate-800 bg-slate-950 opacity-50 hover:opacity-100 hover:border-blue-500/50'
                            : `${STATUS_COLORS[record.status]} hover:scale-105 active:scale-95`
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">{requestMode && isSelected ? 'Selected' : record.status}</span>
                      </button>
                      
                      {/* Document Indicator */}
                      {!requestMode && hasDoc && (
                        <a href={record.document_url} target="_blank" rel="noreferrer" className="absolute top-0 right-0 -mt-1 -mr-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border-2 border-slate-900 text-white shadow-lg hover:scale-110 transition-all z-10" title="View Request / Slip">
                          <FileText size={10} />
                        </a>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={INSPECTION_PHASES.length + 1} className="p-20 text-center text-slate-600 font-black uppercase tracking-widest text-[10px]">
                  No units added. Tap "Add Unit / Line" to start your matrix.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- 5. STATUS SELECTOR MODAL --- */}
      {activeCell && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setActiveCell(null)}>
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-[32px] shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-center text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Update Status:<br/><span className="text-white text-lg">{activeCell.phase}</span></h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleStatusChange('Requested')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-blue-600 text-white">Requested</button>
              <button onClick={() => handleStatusChange('Pass')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-emerald-500 text-white">Pass</button>
              <button onClick={() => handleStatusChange('Partial')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-amber-500 text-white">Partial</button>
              <button onClick={() => handleStatusChange('Fail')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-red-600 text-white">Fail</button>
              <button onClick={() => handleStatusChange('Pending')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-slate-800 text-slate-400">Pending</button>
              <button onClick={() => handleStatusChange('N/A')} className="p-4 rounded-xl font-black uppercase text-[10px] bg-slate-950 text-slate-600 border border-slate-800">N/A</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #020617; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; border: 3px solid #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}} />
    </div>
  )
}