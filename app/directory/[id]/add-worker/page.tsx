'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddWorker() {
  const { id } = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.target)

    const uploadFile = async (fieldName: string, prefix: string) => {
      const file = formData.get(fieldName) as File
      if (!file || file.size === 0) return null
      const fileName = `${prefix}-${Date.now()}-${file.name}`
      const { data } = await supabase.storage.from('site-photos').upload(fileName, file)
      return data ? supabase.storage.from('site-photos').getPublicUrl(fileName).data.publicUrl : null
    }

    // Concurrent uploads for speed
    const [cardUrl, orientationUrl] = await Promise.all([
      uploadFile('card_photo', 'card'),
      uploadFile('orientation_photo', 'orient')
    ])

    const { error } = await supabase.from('sub_worker_docs').insert([{
      sub_id: id,
      worker_name: formData.get('worker_name'),
      doc_type: formData.get('doc_type'),
      expiry_date: formData.get('expiry_date'),
      file_url: cardUrl,
      orientation_url: orientationUrl,
      orientation_signed: !!orientationUrl
    }])

    if (!error) {
      router.push(`/directory/${id}`)
    } else {
      alert("Error saving worker. Check connection.")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      
      <div className="mb-8">
        <Link href={`/directory/${id}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">← Cancel & Return</Link>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mt-4">Worker Onboarding</h1>
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Site Safety & Compliance Entry</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] shadow-xl border-2 border-slate-200 space-y-6">
        
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Worker Identification</h2>
          <input name="worker_name" required placeholder="Worker Full Name" className="w-full p-4 bg-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Primary Safety Card</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select name="doc_type" required className="p-4 bg-slate-100 rounded-2xl text-sm font-bold outline-none">
              <option value="">Select Certificate...</option>
              <option value="Working at Heights">Working at Heights</option>
              <option value="WHMIS 2015">WHMIS 2015</option>
              <option value="Elevated Platform">Elevated Platform</option>
              <option value="Basics of Supervise">Supervisor 4-Step</option>
            </select>
            <input name="expiry_date" type="date" className="p-4 bg-slate-100 rounded-2xl text-sm font-bold outline-none text-slate-500" />
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Photo of Safety Card</p>
            <input name="card_photo" type="file" accept="image/*" capture="environment" className="text-[10px]" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Site Orientation</h2>
          <div className="bg-blue-50 p-4 rounded-2xl border-2 border-dashed border-blue-200">
            <p className="text-[9px] font-black text-blue-600 uppercase mb-2">Photo of Signed Orientation</p>
            <input name="orientation_photo" type="file" accept="image/*" capture="environment" className="text-[10px]" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-[11px]">
          {loading ? 'Syncing Worker Records...' : 'Finalize & Add to Roster'}
        </button>
      </form>
    </div>
  )
}