'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Search, ChevronLeft, Phone, Mail, UserCheck, HardHat, 
  Globe, Plus, X, Edit3, Building2, User, Save, StickyNote, Briefcase
} from 'lucide-react'

export default function MasterDirectory() {
  const router = useRouter()
  const [subs, setSubs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  
  // --- CONTACT CARD MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeSub, setActiveSub] = useState<any>(null)

  const emptySub = {
    company_name: '', trade_type: '', primary_contact: '', 
    phone: '', email: '', office_phone: '', office_email: '', notes: ''
  }

  const fetchSubs = async () => {
    setLoading(true)
    const { data } = await supabase.from('subcontractors').select('*').order('company_name')
    setSubs(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSubs() }, [])

  // Open Modal to ADD new
  const handleAddNew = () => {
    setActiveSub({ ...emptySub })
    setIsEditMode(true)
    setIsModalOpen(true)
  }

  // Open Modal to VIEW existing
  const handleViewSub = (sub: any) => {
    setActiveSub({ ...sub })
    setIsEditMode(false)
    setIsModalOpen(true)
  }

  // Save (Insert or Update)
  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeSub.company_name) return alert("Company Name is required.")

    const isNew = !activeSub.id
    
    if (isNew) {
      const { error } = await supabase.from('subcontractors').insert([activeSub])
      if (error) alert("Error adding trade: " + error.message)
    } else {
      const { error } = await supabase.from('subcontractors').update(activeSub).eq('id', activeSub.id)
      if (error) alert("Error updating trade: " + error.message)
    }

    setIsModalOpen(false)
    fetchSubs()
  }

  const filtered = subs.filter(s => 
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.trade_type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-black text-blue-500 uppercase tracking-[0.5em] animate-pulse">
      Syncing Global Rolodex...
    </div>
  )

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b-4 border-blue-600 pb-8 gap-6">
        <div>
          <button onClick={() => router.push('/projects')} className="text-[10px] font-black uppercase text-slate-500 mb-4 hover:text-white flex items-center gap-1 transition-all">
            <ChevronLeft size={12}/> Portfolio
          </button>
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-none">
            Master <span className="text-blue-500">Directory</span>
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2">
              <Globe size={14} className="text-blue-500" /> System-Wide Database
            </p>
            <button 
              onClick={handleAddNew}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Plus size={12}/> Register New Trade
            </button>
          </div>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Search all trades..." 
            className="w-full bg-slate-900 border border-slate-800 pl-12 p-4 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 shadow-2xl transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(sub => (
          <div 
            key={sub.id} 
            onClick={() => handleViewSub(sub)}
            className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 hover:border-blue-500/50 transition-all group shadow-xl relative overflow-hidden cursor-pointer flex flex-col"
          >
            <div className="flex justify-between items-start mb-6 relative">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-tight truncate pr-2">{sub.company_name}</h3>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1 truncate">{sub.trade_type || 'General Contractor'}</p>
              </div>
              <div className="bg-slate-800 p-3 rounded-2xl group-hover:text-blue-50 transition-colors shadow-lg shrink-0">
                <Building2 size={20} className="group-hover:text-blue-500 transition-colors" />
              </div>
            </div>
            
            <div className="space-y-3 mb-8 border-t border-slate-800/50 pt-6 flex-1">
               <div className="flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
                 <User size={14} className="text-slate-600 shrink-0"/> <span className="truncate">{sub.primary_contact || 'No Contact Listed'}</span>
               </div>
               <div className="flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
                 <Phone size={14} className="text-slate-600 shrink-0"/> {sub.phone || sub.office_phone || 'N/A'}
               </div>
            </div>

            <div className="w-full bg-slate-950 border border-slate-800 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white transition-all flex items-center justify-center gap-2 text-slate-500 shadow-inner">
              View Profile Card
            </div>
          </div>
        ))}
      </div>

      {/* --- CONTACT CARD MODAL (VIEW & EDIT) --- */}
      {isModalOpen && activeSub && (
        <div className="fixed inset-0 bg-slate-950/95 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-blue-600 rounded-[40px] max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex justify-between items-start shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
                  <Briefcase size={28} />
                </div>
                <div>
                  {isEditMode ? (
                    <input 
                      autoFocus
                      placeholder="Company Name" 
                      className="bg-transparent border-b border-blue-500 text-2xl font-black text-white uppercase italic tracking-tight outline-none placeholder:text-slate-700 w-full"
                      value={activeSub.company_name} 
                      onChange={e => setActiveSub({...activeSub, company_name: e.target.value})} 
                    />
                  ) : (
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight leading-none">{activeSub.company_name}</h2>
                  )}
                  
                  {isEditMode ? (
                    <input 
                      placeholder="Trade Type (e.g. Plumbing)" 
                      className="bg-transparent border-b border-slate-700 text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2 outline-none w-full"
                      value={activeSub.trade_type} 
                      onChange={e => setActiveSub({...activeSub, trade_type: e.target.value})} 
                    />
                  ) : (
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">{activeSub.trade_type || 'General Contractor'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button onClick={() => setIsEditMode(true)} className="p-3 bg-slate-800 text-slate-400 hover:text-white hover:bg-blue-600 rounded-xl transition-all">
                    <Edit3 size={16} />
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-950 text-slate-500 hover:text-red-500 rounded-xl transition-all border border-slate-800">
                  <X size={16}/>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
              
              {/* PRIMARY CONTACT (PM/Owner) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-800 pb-2">
                  <User size={14} className="text-blue-500"/> Primary Contact (PM / Owner)
                </h4>
                {isEditMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input placeholder="Name" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 md:col-span-2" value={activeSub.primary_contact} onChange={e => setActiveSub({...activeSub, primary_contact: e.target.value})} />
                    <input placeholder="Direct Phone" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={activeSub.phone} onChange={e => setActiveSub({...activeSub, phone: e.target.value})} />
                    <input placeholder="Direct Email" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={activeSub.email} onChange={e => setActiveSub({...activeSub, email: e.target.value})} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
                    <div className="md:col-span-2">
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Name</p>
                      <p className="text-base font-bold text-white">{activeSub.primary_contact || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Direct Phone</p>
                      <p className="text-sm font-bold text-slate-300">{activeSub.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Direct Email</p>
                      <p className="text-sm font-bold text-slate-300">{activeSub.email || '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* OFFICE / DISPATCH INFO */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Building2 size={14} className="text-blue-500"/> Office / General Info
                </h4>
                {isEditMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input placeholder="Office Phone" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={activeSub.office_phone || ''} onChange={e => setActiveSub({...activeSub, office_phone: e.target.value})} />
                    <input placeholder="Estimating/Office Email" className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500" value={activeSub.office_email || ''} onChange={e => setActiveSub({...activeSub, office_email: e.target.value})} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Office Phone</p>
                      <p className="text-sm font-bold text-slate-300">{activeSub.office_phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Office Email</p>
                      <p className="text-sm font-bold text-slate-300">{activeSub.office_email || '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* INTERNAL NOTES */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-slate-800 pb-2">
                  <StickyNote size={14} className="text-amber-500"/> Internal Notes
                </h4>
                {isEditMode ? (
                  <textarea 
                    placeholder="Add performance notes, specialties, or warnings here..." 
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 min-h-[100px] resize-none" 
                    value={activeSub.notes || ''} 
                    onChange={e => setActiveSub({...activeSub, notes: e.target.value})} 
                  />
                ) : (
                  <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/20">
                    <p className="text-sm text-slate-300 leading-relaxed italic">
                      {activeSub.notes || <span className="text-slate-600 not-italic">No internal notes added.</span>}
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer (Only shows in Edit Mode) */}
            {isEditMode && (
              <div className="p-6 border-t border-slate-800 bg-slate-950 flex gap-4 shrink-0">
                <button 
                  onClick={() => activeSub.id ? setIsEditMode(false) : setIsModalOpen(false)} 
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black text-white uppercase text-[10px] tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSub} 
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-900/30 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save Profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}