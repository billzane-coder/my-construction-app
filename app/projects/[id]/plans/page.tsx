'use client'

export const dynamic = 'force-dynamic' 

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, BookOpen } from 'lucide-react'

export default function BlueprintVault() {
  const { id } = useParams()
  const router = useRouter()
  
  const [project, setProject] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    const [p, dcs] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('project_documents').select('*').eq('project_id', id).eq('doc_type', 'Plan')
    ])
    setProject(p.data)
    setDocs(dcs.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest">Opening Vault...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen font-sans text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-blue-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white transition-all">
            <ChevronLeft size={14} /> Back to War Room
          </button>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Blueprint <span className="text-blue-500">Vault</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <BookOpen size={14} className="text-blue-500" /> {project?.name || 'Project Plans'}
          </p>
        </div>
      </div>

      {/* PLAN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
        <button onClick={() => setShowPlanModal(true)} className="aspect-[4/3] border-4 border-dashed border-slate-800 rounded-[48px] flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500/50 transition-all bg-slate-900/20">
          <Plus size={48} className="mb-4" />
          <span className="text-xs font-black uppercase tracking-widest">Vault New Drawing</span>
        </button>

        {docs.map(plan => (
          <div key={plan.id} className="bg-slate-900 p-8 rounded-[48px] border border-slate-800 shadow-2xl relative flex flex-col justify-between h-full group hover:border-blue-500/50 transition-all">
            <div>
              <span className="bg-blue-950 text-blue-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase mb-4 inline-block italic border border-blue-900/50">
                Rev: {plan.revision_number || 'IFC'}
              </span>
              <h4 className="text-2xl font-black text-white uppercase italic truncate mb-8 group-hover:text-blue-400 transition-colors">{plan.title}</h4>
            </div>
            <Link href={`/projects/${id}/viewer/${plan.id}`} className="block w-full text-center bg-slate-800 group-hover:bg-blue-600 py-6 rounded-3xl text-[11px] font-black uppercase text-white transition-all shadow-lg">
              Open Pro Viewer →
            </Link>
          </div>
        ))}
      </div>

      {/* UPLOAD MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <form onSubmit={async (e) => {
            e.preventDefault(); setUploading(true)
            const fd = new FormData(e.currentTarget)
            const file = (e.currentTarget.elements.namedItem('file') as HTMLInputElement).files?.[0]
            if(!file) return
            const path = `${id}/plans/${Date.now()}-${file.name}`
            const { error: sErr } = await supabase.storage.from('project-files').upload(path, file)
            if(!sErr) {
              const { data: u } = supabase.storage.from('project-files').getPublicUrl(path)
              await supabase.from('project_documents').insert([{ project_id: id, title: fd.get('title'), doc_type: 'Plan', revision_number: fd.get('revision') || 'IFC', file_url: u.publicUrl }])
              fetchData(); setShowPlanModal(false);
            }
            setUploading(false)
          }} className="bg-slate-900 border-2 border-blue-600 p-10 rounded-[56px] max-w-lg w-full space-y-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white uppercase italic text-center">Vault Drawing</h2>
            <input name="file" type="file" required accept=".pdf" className="w-full text-xs text-slate-500 file:bg-slate-800 file:text-white file:px-4 file:py-2 file:rounded-xl file:border-0 cursor-pointer" />
            <input name="title" required placeholder="Drawing Title (e.g. A101 Floor Plan)" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-white font-bold outline-none focus:border-blue-500" />
            <input name="revision" placeholder="Revision (e.g. Rev 3)" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-blue-500 uppercase font-black outline-none" />
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 bg-slate-800 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={uploading} className="flex-1 bg-blue-600 text-white py-5 rounded-3xl font-black uppercase text-xs shadow-xl disabled:opacity-50 hover:bg-blue-500">
                {uploading ? 'Processing...' : 'Upload Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}