'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { 
  ChevronLeft, Printer, Plus, Paperclip,
  CheckCircle2, AlertTriangle, Clock, XCircle, Send, Loader2, Upload, FileText, Trash2
} from 'lucide-react'

// --- RESTORED & EXPANDED PHASES ---
const INSPECTION_PHASES = [
  'Locates',
  'Footing / Foundation',
  'Backfill', 
  'Underground Plumbing',
  'Underground Insulation', 
  'Framing',
  'Air Barrier',
  'Rough Plumbing',
  'Rough HVAC',
  'ESA Rough-In',
  'Firestopping',
  'Insulation / Vapor',
  'Final Plumbing',
  'Final HVAC',
  'ESA Final',
  'Occupancy'
]

const STATUS_COLORS = {
  'Not Ready': 'bg-slate-950 text-slate-600 border-slate-800',
  'Requested': 'bg-blue-950/40 text-blue-500 border-blue-900/50',
  'Partial': 'bg-amber-950/40 text-amber-500 border-amber-900/50',
  'Fail': 'bg-red-950/40 text-red-500 border-red-900/50',
  'Pass': 'bg-emerald-950/30 text-emerald-500 border-emerald-900/50',
  'N/A': 'bg-slate-950/50 text-slate-700 line-through opacity-50 border-slate-900' 
}

type CellData = { unit: string, phase: string, status: string, notes: string, document_url: string | null }

export default function InspectionMatrix() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [project, setProject] = useState<any>(null)
  
  const [units, setUnits] = useState<string[]>([])
  const [inspections, setInspections] = useState<any[]>([])

  const [requestMode, setRequestMode] = useState(false)
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]) 
  
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [activeCell, setActiveCell] = useState<CellData | null>(null)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [projData, insData] = await Promise.all([
      supabase.from('projects').select('name, address').eq('id', id).single(),
      supabase.from('project_inspections').select('*').eq('project_id', id)
    ])
    
    if (projData.data) setProject(projData.data)
    
    if (insData.data) {
      setInspections(insData.data)
      const uniqueUnits = Array.from(new Set(insData.data.map(i => i.unit_name))).sort((a: any, b: any) => {
        if (a.toLowerCase().includes('building') || a.toLowerCase().includes('overall')) return -1;
        if (b.toLowerCase().includes('building') || b.toLowerCase().includes('overall')) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      setUnits(uniqueUnits as string[])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAddUnit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const unitName = fd.get('unit_name') as string
    
    setSaving(true)
    const newRecords = INSPECTION_PHASES.map(phase => ({
      project_id: id,
      unit_name: unitName,
      inspection_type: phase,
      status: 'Not Ready'
    }))
    
    await supabase.from('project_inspections').insert(newRecords)
    setShowAddUnit(false)
    fetchData()
    setSaving(false)
  }

  const handleDeleteUnit = async (unitName: string) => {
    if (!confirm(`Delete "${unitName}"? This will erase all inspection records for this row.`)) return
    await supabase.from('project_inspections').delete().eq('project_id', id).eq('unit_name', unitName)
    fetchData()
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeCell) return
    setSaving(true)
    
    const existingRecord = inspections.find(
      i => i.unit_name === activeCell.unit && i.inspection_type === activeCell.phase
    )

    let actionError = null;

    if (existingRecord?.id) {
      const { error } = await supabase.from('project_inspections')
        .update({ status: newStatus, notes: activeCell.notes })
        .eq('id', existingRecord.id)
      actionError = error
    } else {
      const { error } = await supabase.from('project_inspections')
        .insert([{ 
          project_id: id, 
          unit_name: activeCell.unit, 
          inspection_type: activeCell.phase, 
          status: newStatus, 
          notes: activeCell.notes 
        }])
      actionError = error
    }

    if (actionError) {
      alert(`Save Failed: ${actionError.message}`)
      setSaving(false)
      return
    }
      
    // Auto-Log Generation (with Timezone Fix)
    if (newStatus === 'Pass' || newStatus === 'Fail') {
      const offset = new Date().getTimezoneOffset() * 60000
      const localToday = new Date(Date.now() - offset).toISOString().split('T')[0]
      const autoNote = `📋 INSPECTION ${newStatus.toUpperCase()}: ${activeCell.unit} - ${activeCell.phase} ${activeCell.notes ? `(${activeCell.notes})` : ''}`

      const { data: existingLog } = await supabase.from('daily_logs').select('id, work_performed').eq('project_id', id).eq('log_date', localToday).maybeSingle()

      if (existingLog) {
        const updatedNotes = existingLog.work_performed ? `${existingLog.work_performed}\n${autoNote}` : autoNote
        await supabase.from('daily_logs').update({ work_performed: updatedNotes }).eq('id', existingLog.id)
      } else {
        await supabase.from('daily_logs').insert([{ project_id: id, log_date: localToday, work_performed: autoNote, status: 'Draft' }])
      }
    }

    setActiveCell(null)
    fetchData()
    setSaving(false)
  }

  const handleUploadSlip = async (file: File) => {
    if (!activeCell) return
    setUploading(true)
    
    const safeUnit = activeCell.unit.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const safePhase = activeCell.phase.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    
    const path = `${id}/inspections/${safeUnit}_${safePhase}_${Date.now()}.pdf`
    const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
    
    if (!sErr) {
      const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
      await supabase.from('project_inspections').update({ document_url: u.publicUrl }).eq('project_id', id).eq('unit_name', activeCell.unit).eq('inspection_type', activeCell.phase)
      setActiveCell({ ...activeCell, document_url: u.publicUrl })
      fetchData() 
    } else {
      alert(`Upload failed: ${sErr.message}`)
    }
    setUploading(false)
  }

  const handleCellClick = (unit: string, phase: string) => {
    if (requestMode) {
      const key = `${unit}|${phase}`
      setSelectedRequests(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
      return
    }

    const record = inspections.find(i => i.unit_name === unit && i.inspection_type === phase)
    setActiveCell({
      unit, phase, 
      status: record?.status || 'Not Ready', 
      notes: record?.notes || '',
      document_url: record?.document_url || null
    })
  }

  const getCellRecord = (unit: string, phase: string) => {
    return inspections.find(i => i.unit_name === unit && i.inspection_type === phase) || { status: 'Not Ready', document_url: null }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF(requestMode ? 'portrait' : 'landscape')

      doc.setFontSize(22)
      doc.setTextColor(15, 23, 42)
      doc.setFont("helvetica", "bold")
      doc.text(requestMode ? "INSPECTION REQUEST" : "MASTER INSPECTION STATUS", 14, 22)

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 116, 139)
      doc.text(`Project: ${project?.name || 'N/A'}`, 14, 30)
      doc.text(`Address: ${project?.address || 'N/A'}`, 14, 35)
      doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 40)
      doc.text(`Generated By: Site Superintendent`, 14, 45)

      if (requestMode) {
        const tableData = selectedRequests.map(req => {
          const [unit, phase] = req.split('|')
          return [unit, phase, "REQUESTED", ""]
        })

        autoTable(doc, {
          startY: 55,
          head: [['Unit / Lot', 'Inspection Phase', 'Status', 'Inspector Notes / Sign-off']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          bodyStyles: { minCellHeight: 15, valign: 'middle' },
          columnStyles: { 0: { fontStyle: 'bold' }, 3: { cellWidth: 80 } }
        })

        const finalY = (doc as any).lastAutoTable.finalY || 100
        doc.setFontSize(10)
        doc.text("Authorized Site Signature: ___________________________", 14, finalY + 30)
        doc.text("Date: ________________", 120, finalY + 30)

      } else {
        const tableHead = ['Unit', ...INSPECTION_PHASES]
        const tableBody = units.map(unit => [unit, ...INSPECTION_PHASES.map(phase => getCellRecord(unit, phase).status)])
        autoTable(doc, {
          startY: 55, head: [tableHead], body: tableBody, theme: 'grid',
          styles: { fontSize: 7, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [15, 23, 42], textColor: 255 },
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

      const fileName = requestMode ? `Inspection_Request_${project?.name}.pdf` : `Matrix_Status_${project?.name}.pdf`
      doc.save(fileName.replace(/\s+/g, '_'))

      if (requestMode && selectedRequests.length > 0) {
        const pdfBlob = doc.output('blob')
        const storagePath = `${id}/requests/Request_${Date.now()}.pdf`
        
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
        } else {
          console.error("Archive Failed:", uploadError)
        }
      }
      
    } catch (err) {
      console.error("PDF Export Error:", err)
      alert("Export failed. Check console.")
    }
    
    setExporting(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Rendering Matrix...</div>

  const totalInspections = units.length * INSPECTION_PHASES.length
  const passedInspections = inspections.filter(i => i.status === 'Pass').length
  const progressPercent = totalInspections === 0 ? 0 : Math.round((passedInspections / totalInspections) * 100)

  return (
    <div className="max-w-[1800px] mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">

      <div className="mb-8 border-b-4 border-blue-600 pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all"><ChevronLeft size={12}/> War Room</button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Inspection <span className="text-blue-500">Matrix</span></h1>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-2">{project?.name}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {requestMode ? (
            <>
              <button onClick={() => { setRequestMode(false); setSelectedRequests([]); }} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase transition-all">Cancel</button>
              <button onClick={handleExportPDF} disabled={selectedRequests.length === 0 || exporting} className="bg-amber-500 text-slate-950 text-[10px] font-black px-6 py-4 rounded-2xl uppercase transition-all shadow-xl shadow-amber-900/20 flex items-center gap-2 disabled:opacity-50">
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16}/>} 
                Generate Request Form ({selectedRequests.length})
              </button>
            </>
          ) : (
            <>
              <div className="bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl flex items-center gap-4 mr-4">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Building Pass Rate</p>
                  <p className="text-sm font-black text-emerald-500">{progressPercent}%</p>
                </div>
              </div>
              <button onClick={handleExportPDF} disabled={exporting} className="bg-slate-800 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-slate-700 transition-all flex items-center gap-2 shadow-xl disabled:opacity-50">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14}/>} 
                Export Matrix
              </button>
              <button onClick={() => setRequestMode(true)} className="bg-amber-600/10 text-amber-500 border border-amber-900/50 text-[10px] font-black px-6 py-4 rounded-2xl uppercase hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 shadow-xl">
                <Send size={14}/> Batch Request
              </button>
              <button onClick={() => setShowAddUnit(true)} className="bg-blue-600 text-white text-[10px] font-black px-6 py-4 rounded-2xl uppercase shadow-lg shadow-blue-900/20 hover:bg-blue-500 transition-all flex items-center gap-2">
                <Plus size={16}/> Add Unit/Lot
              </button>
            </>
          )}
        </div>
      </div>

      {requestMode && (
        <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl mb-8 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest shadow-xl">
          <AlertTriangle size={16} /> Select cells, then hit "Generate Request Form" for the City/ESA.
        </div>
      )}

      <div className="bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl w-full relative z-0">
        <div className="w-full overflow-x-auto custom-scrollbar p-1 pb-6 bg-slate-950 rounded-[32px]">
          <div className="min-w-[1400px]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm border-b border-slate-800">
                <tr>
                  {/* --- RESPONSIVE FIX FOR THE LOT COLUMN --- */}
                  <th className="p-3 md:p-5 font-black text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest border-r border-slate-800 w-24 min-w-[96px] md:w-auto md:min-w-[150px] sticky left-0 bg-slate-950 z-20 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)]">
                    Unit / Lot
                  </th>
                  {INSPECTION_PHASES.map((phase, i) => (
                    <th key={i} className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-wider border-r border-slate-800 min-w-[140px] text-center">
                      {phase}
                    </th>
                  ))}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-800/50">
                {units.length === 0 && (
                  <tr>
                    <td colSpan={INSPECTION_PHASES.length + 1} className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">
                      No units added to matrix.
                    </td>
                  </tr>
                )}
                
                {units.map((unit) => (
                  <tr key={unit} className="hover:bg-slate-800/20 transition-colors group">
                    {/* --- RESPONSIVE FIX FOR THE LOT COLUMN --- */}
                    <td className="p-3 md:p-5 font-black text-white text-xs md:text-sm uppercase tracking-widest border-r border-slate-800 sticky left-0 bg-slate-900 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)] w-24 min-w-[96px] md:w-auto md:min-w-[150px] break-words">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                        <span className="whitespace-normal leading-tight">{unit}</span>
                        <button onClick={() => handleDeleteUnit(unit)} className="text-slate-600 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all p-1 md:p-2">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                    
                    {INSPECTION_PHASES.map((phase, cIdx) => {
                      const record = getCellRecord(unit, phase)
                      const isSelected = selectedRequests.includes(`${unit}|${phase}`)
                      const isDimmed = requestMode && !isSelected

                      return (
                        <td key={cIdx} className="p-2 border-r border-slate-800 align-middle">
                          <button 
                            onClick={() => handleCellClick(unit, phase)}
                            className={`relative w-full p-3 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                              isSelected ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-900' :
                              STATUS_COLORS[record.status as keyof typeof STATUS_COLORS] || STATUS_COLORS['Not Ready']
                            } ${requestMode ? 'cursor-pointer hover:scale-95' : 'hover:opacity-80'} ${isDimmed ? 'opacity-20 grayscale' : ''}`}
                          >
                            <span className="text-[9px] font-black uppercase tracking-widest">
                              {isSelected ? 'SELECTED' : record.status}
                            </span>
                            
                            {record.document_url && !isSelected && (
                              <Paperclip size={10} className="absolute top-1 right-1 opacity-60" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddUnit && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={handleAddUnit} className="bg-slate-900 border-2 border-blue-600 p-8 rounded-[40px] max-w-md w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Add Unit to Matrix</h2>
            <input name="unit_name" required placeholder="Unit / Lot Number (e.g. Unit 101)" className="w-full p-5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white outline-none focus:border-blue-500 text-center text-xl uppercase" />
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={() => setShowAddUnit(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-white uppercase text-[10px] disabled:opacity-50 flex justify-center items-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Add Row
              </button>
            </div>
          </form>
        </div>
      )}

      {activeCell && !requestMode && (
        <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[40px] max-w-md w-full space-y-6 shadow-2xl">
            
            <div className="text-center border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black text-white uppercase italic leading-none">{activeCell.unit}</h2>
              <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-2">{activeCell.phase}</p>
            </div>
            
            <textarea 
              value={activeCell.notes} 
              onChange={e => setActiveCell({...activeCell, notes: e.target.value})}
              placeholder="Inspector notes or deficiencies..." 
              className="w-full h-24 bg-slate-950 border border-slate-800 p-4 rounded-xl font-medium text-white outline-none resize-none" 
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleUpdateStatus('Requested')} className="p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-blue-950/40 text-blue-500 border border-blue-900/50 hover:bg-blue-900/50 transition-colors"><Clock size={14}/> Requested</button>
              <button onClick={() => handleUpdateStatus('Partial')} className="p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-amber-950/40 text-amber-500 border border-amber-900/50 hover:bg-amber-900/50 transition-colors"><AlertTriangle size={14}/> Partial</button>
              <button onClick={() => handleUpdateStatus('Pass')} className="p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-emerald-950/30 text-emerald-500 border border-emerald-900/50 hover:bg-emerald-900/50 transition-colors"><CheckCircle2 size={14}/> Pass</button>
              <button onClick={() => handleUpdateStatus('Fail')} className="p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-red-950/40 text-red-500 border border-red-900/50 hover:bg-red-900/50 transition-colors"><XCircle size={14}/> Fail</button>
            </div>

            <button onClick={() => handleUpdateStatus('N/A')} className="w-full p-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-950 text-slate-500 border border-slate-800 hover:bg-slate-800 transition-colors">Mark as N/A (Not Applicable)</button>

            <div className="border-t border-slate-800 pt-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-blue-500"/> Official Slip</p>
                <label className="bg-slate-800 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase cursor-pointer hover:bg-slate-700 transition-all flex items-center gap-2">
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12}/>} Upload Slip
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if(f) handleUploadSlip(f) }} />
                </label>
              </div>

              {activeCell.document_url ? (
                <a href={activeCell.document_url} target="_blank" rel="noreferrer" className="block w-full bg-blue-950/30 border border-blue-900/50 text-blue-400 text-center py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-900/50 transition-all">
                  View Attached Document
                </a>
              ) : (
                <div className="p-6 border-2 border-dashed border-slate-800 rounded-xl text-center">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">No paperwork attached</p>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-4">
              <button onClick={() => setActiveCell(null)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-white uppercase text-[10px]">Close</button>
              <button onClick={() => handleUpdateStatus('Not Ready')} className="flex-1 bg-slate-950 border border-slate-800 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-800 transition-colors">Clear Cell</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #020617; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 3px solid #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
      `}</style>
    </div>
  )
}