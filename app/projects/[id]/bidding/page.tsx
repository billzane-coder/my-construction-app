'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, FileSignature, Building2, 
  FolderOpen, Settings2, Clock, CheckCircle2,
  Users, ArrowRight, Save, X, ListPlus, Copy,
  FileText, Map as MapIcon, Search, Loader2,
  ChevronRight, Database, Edit3, ChevronDown, BookmarkPlus,
  AlertCircle, XCircle, Layers, Trash2, ListTree
} from 'lucide-react'

// --- INITIAL CSC MASTERFORMAT DIVISION LABELS ---
const INITIAL_DIVISIONS: Record<string, string> = {
  '01': 'General Requirements',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics & Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '26': 'Electrical',
  '27': 'Communications',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities'
}

// --- FULL ONTARIO MASTER TEMPLATE REPOSITORY ---
const ONTARIO_MASTER_TEMPLATES = [
  {
    division: '03',
    title: 'Concrete Forming & Placement',
    category: 'Forming',
    base_scope: 'Supply all labour, materials, and equipment required for complete concrete forming, reinforcement, pouring, and finishing as per structural drawings.',
    inclusions: [
      'Supply and install of all rebar, wire mesh, and embedded hardware',
      'Winter heating, hoarding, and curing blankets as required by OBC',
      'Crane hoisting, concrete pumping, and staging',
      'Rubbing and patching of exposed concrete ceilings (Level 2 finish)',
      'Layout from general contractor provided grid lines and benchmarks',
      'Daily cleanup of slurry, washout, and stripping debris to CM bins'
    ],
    exclusions: ['Supply of anchor bolts (installation only)', 'Under-slab vapour barrier (by Div 07)']
  },
  {
    division: '04',
    title: 'Masonry Systems',
    category: 'Structural Masonry',
    base_scope: 'Complete installation of architectural brick veneer, block partitions, and elevator shaft masonry including mortar, ties, and flashing.',
    inclusions: [
      'Supply and install of through-wall flashing and weep vents',
      'Winter heating and hoarding for mortar mixing and curing',
      'Supply and erection of all scaffolding and elevated work platforms',
      'Block fill and rigid insulation within masonry cavities',
      'Acid washing and final cleaning of exterior veneer'
    ],
    exclusions: ['Structural steel lintels (by Div 05)', 'Supply of man-hoist (by CM)']
  },
  {
    division: '05',
    title: 'Structural Steel & Misc Metals',
    category: 'Structural',
    base_scope: 'Fabrication and erection of all structural steel framing, roof screens, steel stairs, and miscellaneous metal railings.',
    inclusions: [
      'Shop drawings bearing the seal of a structural engineer registered in Ontario',
      'Supply and installation of all metal pan stairs and landing gratings',
      'Prime painting of all interior steel; galvanizing for exterior steel',
      'Supply of loose lintels and embed plates to masonry/concrete trades',
      'Crane time and hoisting required for steel erection'
    ],
    exclusions: ['Concrete fill for metal pan stairs (by Div 03)']
  },
  {
    division: '07',
    title: 'Roofing & Waterproofing',
    category: 'Envelope',
    base_scope: 'Installation of complete SBS modified bitumen roof assembly, green roof components, and below-grade foundation waterproofing.',
    inclusions: [
      'Tapered rigid insulation to achieve minimum 2% slope to drains',
      'Supply and installation of all metal cap flashings and parapet covers',
      'Electronic leak detection testing prior to green roof/ballast installation',
      'Tarion Bulletin 19 compliant installation and warranty provisions',
      'Protection of membrane during installation of overburden'
    ],
    exclusions: ['Wood blocking at parapets (by Div 06)', 'Plumbing roof drains (supply and connect by Div 22)']
  },
  {
    division: '08',
    title: 'Windows & Glazing',
    category: 'Glazing',
    base_scope: 'Supply and installation of exterior aluminum window wall systems, curtain wall, and suite balcony sliding doors.',
    inclusions: [
      'Engineered shop drawings for wind load and thermal performance',
      'Perimeter caulking, backer rod, and weather-stripping',
      'Fall protection equipment and engineered tie-off plans for installers',
      'Site water-penetration testing mock-ups as required by consultant',
      'Supply and install of all Juliet balcony glass railings'
    ],
    exclusions: ['Interior suite doors and hardware (by Div 09)', 'Final construction clean of glass (by CM)']
  },
  {
    division: '09',
    title: 'Framing, Drywall & Taping',
    category: 'Finishes',
    base_scope: 'Supply and install all load-bearing and non-load-bearing steel stud framing, insulation, vapour barrier, and gypsum board.',
    inclusions: [
      'Acoustic sealant and resilient channel at all demising walls/ceilings',
      'Supply and installation of all hollow metal door frames',
      'Level 5 finish in main lobby; Level 4 in residential suites',
      'Firestopping at all drywall penetrations as per ULC assemblies',
      'Daily cleanup of offcuts and mud to central bins'
    ],
    exclusions: ['Painting and priming', 'Backing for washroom accessories (by Div 10)']
  },
  {
    division: '09',
    title: 'Flooring & Tile',
    category: 'Finishes',
    base_scope: 'Surface preparation and installation of luxury vinyl plank (LVP) in suites, porcelain tile in washrooms, and common area carpet tile.',
    inclusions: [
      'Supply and installation of acoustic underlayment to meet STC/IIC ratings',
      'Self-leveling compound/floor prep up to 1/4 inch variance over 10 feet',
      'Waterproofing membranes in all suite showers and wet areas',
      'Supply and install of Schluter trims and transition strips',
      'Protection of finished floors with RamBoard or equivalent'
    ],
    exclusions: ['Major concrete grinding/chipping beyond standard prep']
  },
  {
    division: '22',
    title: 'Plumbing & Drainage',
    category: 'Mechanical',
    base_scope: 'Complete installation of domestic hot/cold water distribution, sanitary drainage, storm drainage, and plumbing fixtures.',
    inclusions: [
      'City water service tie-in, water meter room setup, and backflow preventers',
      'Cast iron sanitary stacks and acoustic wrapping where required by OBC',
      'PEX in-suite distribution and individual suite shut-off valves',
      'Supply and installation of all suite and common area plumbing fixtures',
      'Chlorination and domestic water testing'
    ],
    exclusions: ['Core drilling over 6 inches (by CM)']
  },
  {
    division: '26',
    title: 'Electrical & Fire Alarm',
    category: 'Electrical',
    base_scope: 'Complete electrical rough-in and finishing, including main distribution, suite panels, lighting fixtures, and fire alarm system.',
    inclusions: [
      'ESA permitting, compliance, and final inspections',
      'EV charging conduit infrastructure to parking garage',
      'Supply and installation of all light fixtures as per schedule',
      'Complete fire alarm system wiring, devices, and 3rd-party verification',
      'Temporary power distribution and lighting during construction phase'
    ],
    exclusions: ['Low-voltage data/comms cabling (by Div 27)', 'Excavation and backfill for primary duct bank (by Div 31)']
  },
  {
    division: '31',
    title: 'Earthwork & Shoring',
    category: 'Civil',
    base_scope: 'Bulk excavation, detailed excavation, shoring, dewatering, and backfill for foundation construction.',
    inclusions: [
      'Design, installation, and removal of caisson wall / lagging shoring system',
      'MECP compliant ground water dewatering and sediment control',
      'Export and legal disposal of all excavated native materials',
      'Supply and compaction of engineered fill under slab-on-grade',
      'Clear stone layer for weeping tile and elevator pit drainage'
    ],
    exclusions: ['Phase 1/2 Environmental Site Assessments (by Owner)', 'Rock blasting or mechanical rock breaking']
  }
]

export default function BidManager() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [project, setProject] = useState<any>(null)
  const [projectPlans, setProjectPlans] = useState<any[]>([])
  
  // Library & Division States
  const [masterTemplates, setMasterTemplates] = useState<any[]>([])
  const [divisionMap, setDivisionMap] = useState(INITIAL_DIVISIONS)
  const [expandedDivs, setExpandedDivs] = useState<string[]>([])
  const [newDivCode, setNewDivCode] = useState('')
  const [newDivLabel, setNewDivLabel] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    division_code: '', category: '', title: '', base_scope: '', 
    inclusions: [''], exclusions: [''], due_date: '', linked_plans: [] as string[]
  })

  const [otherProjects, setOtherProjects] = useState<any[]>([])
  const [sourcePackages, setSourcePackages] = useState<any[]>([])

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pkgRes, projRes, docsRes, libRes, otherRes] = await Promise.all([
        supabase.from('bid_packages').select('*, bid_invitations(id, status)').eq('project_id', id).order('division_code'),
        supabase.from('projects').select('name, location').eq('id', id).single(),
        supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('master_scope_templates').select('*').order('division_code'),
        supabase.from('projects').select('id, name').neq('id', id)
      ])
      setPackages(pkgRes.data || [])
      setProject(projRes.data)
      setProjectPlans(docsRes.data || [])
      setMasterTemplates(libRes.data || [])
      setOtherProjects(otherRes.data || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const fetchSourcePackages = async (sId: string) => {
    if (!sId) { setSourcePackages([]); return; }
    const { data } = await supabase.from('bid_packages').select('*').eq('project_id', sId).order('division_code')
    setSourcePackages(data || [])
  }

  // --- GROUPING LOGIC FOR DASHBOARD ---
  const groupedPackages = useMemo(() => {
    return packages.reduce((acc: any, pkg) => {
      const div = pkg.division_code || '01'
      if (!acc[div]) acc[div] = []
      acc[div].push(pkg)
      return acc
    }, {})
  }, [packages])

  const libraryTree = useMemo(() => {
    const combined = [...ONTARIO_MASTER_TEMPLATES.map(t => ({ ...t, division_code: t.division, isHardcoded: true })), ...masterTemplates]
    return combined.reduce((acc: any, t) => {
      const div = t.division_code || t.division
      if (!acc[div]) acc[div] = {}
      const cat = t.category || 'General'
      if (!acc[div][cat]) acc[div][cat] = []
      acc[div][cat].push(t)
      return acc
    }, {})
  }, [masterTemplates])

  const handleAddDivision = () => {
    if (!newDivCode || !newDivLabel) return alert("Code and Label required.")
    setDivisionMap(prev => ({ ...prev, [newDivCode]: newDivLabel }))
    setNewDivCode(''); setNewDivLabel('')
  }

  const toggleDiv = (div: string) => {
    setExpandedDivs(prev => prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div])
  }

  const loadTemplate = (t: any) => {
    setFormData({
      division_code: t?.division_code || t?.division || '',
      category: t?.category || '',
      title: t?.title || '',
      base_scope: t?.base_scope || '',
      inclusions: t?.inclusions?.length ? [...t.inclusions] : [''],
      exclusions: t?.exclusions?.length ? [...t.exclusions] : [''],
      due_date: '',
      linked_plans: []
    })
  }

  // --- START SUB-ITEM ACTION ---
  const startSubItem = (div: string) => {
    setFormData({
      division_code: div, category: '', title: '', base_scope: '', 
      inclusions: [''], exclusions: [''], due_date: '', linked_plans: []
    })
    setEditingPackageId(null)
    setShowModal(true)
  }

  const handleEditExisting = (pkg: any) => {
    setEditingPackageId(pkg.id)
    setFormData({
      division_code: pkg.division_code || '',
      category: pkg.category || '',
      title: pkg.title || '',
      base_scope: pkg.base_scope || '',
      inclusions: pkg.inclusions || [''],
      exclusions: pkg.exclusions || [''],
      due_date: pkg.due_date ? pkg.due_date.slice(0, 16) : '',
      linked_plans: Array.isArray(pkg.linked_plans) ? pkg.linked_plans : []
    })
    setShowModal(true)
  }

  const handleDeletePackage = async (pkgId: string, pkgTitle: string) => {
    if (!window.confirm(`Delete "${pkgTitle}"?`)) return
    await supabase.from('bid_packages').delete().eq('id', pkgId)
    await fetchData()
  }

  const handleSave = async (toLibrary = false) => {
    setSaving(true)
    const baseData = {
      division_code: formData.division_code || '00',
      category: formData.category || 'General',
      title: formData.title,
      base_scope: formData.base_scope || '',
      inclusions: formData.inclusions.filter(i => i.trim() !== ''),
      exclusions: formData.exclusions.filter(i => i.trim() !== '')
    }

    if (toLibrary) {
      await supabase.from('master_scope_templates').insert([baseData])
      alert("Saved to Master Library!")
    } else {
      const projectData = { ...baseData, project_id: id, status: 'Draft', linked_plans: formData.linked_plans || [], due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null }
      editingPackageId 
        ? await supabase.from('bid_packages').update(projectData).eq('id', editingPackageId)
        : await supabase.from('bid_packages').insert([projectData])
      setShowModal(false); await fetchData()
    }
    setSaving(false)
  }

  const togglePlanLink = (planId: string) => {
    setFormData(prev => ({
      ...prev,
      linked_plans: prev.linked_plans.includes(planId) ? prev.linked_plans.filter(pid => pid !== planId) : [...prev.linked_plans, planId]
    }))
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Processing Data...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32">
      
      {/* PAGE HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
           <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4">
             <button onClick={() => router.push(`/projects/${id}`)} className="hover:text-white transition-all flex items-center gap-1"><ChevronLeft size={12}/> War Room</button>
             <span>/</span> <span className="text-emerald-500">Bidding Manager</span>
           </nav>
           <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Scope <span className="text-emerald-500">Engineer</span></h1>
           <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
             <Building2 size={14} className="text-emerald-500"/> {project?.name}
           </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><Copy size={16}/> Clone Scopes</button>
          <button onClick={() => { loadTemplate(null); setShowModal(true); setEditingPackageId(null); }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2"><Plus size={18}/> New Bid Package</button>
        </div>
      </div>

      {/* PACKAGES VIEW - GROUPED BY DIVISION */}
      {packages.length === 0 ? (
        <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[32px] p-16 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <FolderOpen size={48} className="text-slate-600 mb-4" />
          <h3 className="text-xl font-black text-white uppercase mb-2 italic">No Scopes Found</h3>
          <button onClick={() => { loadTemplate(null); setShowModal(true) }} className="text-emerald-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 bg-emerald-950/30 px-6 py-3 rounded-xl border border-emerald-900/30 hover:bg-emerald-600 hover:text-white mt-4 italic">Engage First Scope</button>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedPackages).sort().map(([div, items]: any) => (
            <div key={div} className="space-y-6">
              <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <div className="bg-emerald-600 text-white font-black px-4 py-1 rounded-lg text-sm">Div {div}</div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">{divisionMap[div] || 'Custom Specialty'}</h2>
                <div className="flex-1 h-[1px] bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((pkg: any) => (
                  <div key={pkg.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 hover:border-emerald-500/50 transition-all flex flex-col shadow-2xl relative group">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest">{pkg.category}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditExisting(pkg)} className="text-slate-600 hover:text-white"><Edit3 size={16}/></button>
                        <button onClick={() => handleDeletePackage(pkg.id, pkg.title)} className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 uppercase italic truncate">{pkg.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-6 font-bold">{pkg.base_scope}</p>
                    <button onClick={() => router.push(`/projects/${id}/bidding/${pkg.id}`)} className="mt-auto w-full bg-slate-950 border border-slate-800 text-white font-black text-[10px] uppercase py-3 rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 italic">Open Bid Matrix <ArrowRight size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* THE MAIN ENGINEER MODAL - FIXED HEADER/FOOTER SCROLLING FIX */}
      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-0 md:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-none md:rounded-[40px] w-full max-w-7xl h-full md:h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">
            
            {/* LOCKED MODAL HEADER */}
            <div className="p-6 md:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950/90 shrink-0 z-50">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg"><FileSignature size={20}/></div>
                  <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-white leading-none">Drafting Tender Scope</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{formData.title || 'New Package'}</p>
                  </div>
               </div>
               <button onClick={() => setShowModal(false)} className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
              
              {/* SIDEBAR WITH PLUS BUTTONS */}
              <div className="hidden lg:block w-80 border-r border-slate-800 bg-slate-950 overflow-y-auto p-6 custom-scrollbar shrink-0">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest flex items-center gap-2"><Database size={12}/> Master Library</p>
                <div className="space-y-3 pb-20">
                  {Object.keys(libraryTree).sort().map(div => (
                    <div key={div} className="space-y-1">
                      <div className="flex items-center gap-1 group">
                        <button onClick={() => toggleDiv(div)} className="flex-1 flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-all">
                          <div className="flex flex-col items-start text-left">
                             <span className="text-[9px] font-black uppercase text-emerald-500">Div {div}</span>
                             <span className="text-[10px] font-bold uppercase truncate max-w-[110px]">{divisionMap[div] || 'Specialties'}</span>
                          </div>
                          {expandedDivs.includes(div) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </button>
                        {/* PLUS BUTTON BESIDE DIVISION */}
                        <button 
                          onClick={() => startSubItem(div)}
                          title="New Sub-Item"
                          className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-600 hover:text-white hover:bg-emerald-600 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Plus size={14}/>
                        </button>
                      </div>

                      {expandedDivs.includes(div) && (
                        <div className="pl-3 space-y-4 pt-3 pb-2 border-l border-slate-800 ml-4 animate-in slide-in-from-top-2 duration-200">
                          {Object.keys(libraryTree[div]).map(cat => (
                            <div key={cat} className="space-y-1">
                              <p className="text-[8px] font-black text-slate-600 uppercase pl-2 mb-1">{cat}</p>
                              {libraryTree[div][cat].map((t: any) => (
                                <button key={t.id || t.title} onClick={() => loadTemplate(t)} className={`w-full text-left p-2.5 rounded-lg text-[10px] font-bold transition-all truncate ${t.isHardcoded ? 'text-slate-500 hover:text-white' : 'text-emerald-500 hover:text-emerald-400'} hover:bg-white/5`}>
                                  {t.title}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* EDITOR AREA - THIS SCROLLS INDEPENDENTLY */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 flex flex-col relative">
                
                {/* STICKY SUB-HEADER */}
                <div className="sticky top-0 bg-slate-950 border-b border-slate-800 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start z-40 shrink-0">
                   <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block flex items-center gap-2"><Clock size={12} className="text-blue-500"/> Bid Deadline</label>
                      <input type="datetime-local" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl font-bold text-white text-xs outline-none focus:border-blue-500 [color-scheme:dark]" />
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block flex justify-between items-center">
                         <span className="flex items-center gap-2"><FileText size={12} className="text-emerald-500"/> Linked Plans</span>
                         <span className="text-blue-500 font-black">{formData.linked_plans.length} SELECTED</span>
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                         {projectPlans.map(plan => (
                            <button key={plan.id} onClick={() => togglePlanLink(plan.id)} className={`shrink-0 px-3 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${formData.linked_plans.includes(plan.id) ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{plan.sheet_number || plan.title.slice(0, 5)}</button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="p-8 pt-12 max-w-4xl mx-auto w-full space-y-12 pb-64">
                   <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block pl-2 tracking-widest">Div</label>
                        <input value={formData.division_code} onChange={e => setFormData({...formData, division_code: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black text-emerald-500 text-center" placeholder="09" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block pl-2 tracking-widest">Category</label>
                        <input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black text-white" placeholder="E.G. Forming" />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block pl-2 tracking-widest">Package Title</label>
                        <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl font-black text-white" placeholder="Scope Title" />
                      </div>
                   </div>
                   
                   <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block pl-2 tracking-widest italic">Base Scope Summary</label>
                      <textarea rows={6} value={formData.base_scope} onChange={e => setFormData({...formData, base_scope: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-8 rounded-[40px] text-sm text-slate-200 font-bold outline-none focus:border-emerald-500 leading-relaxed shadow-inner italic" />
                   </div>

                   {/* INCLUSIONS */}
                   <div className="space-y-4">
                      <div className="flex items-center justify-between pl-2">
                         <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 italic"><CheckCircle2 size={14}/> Tender Inclusions</label>
                         <button onClick={() => setFormData({...formData, inclusions: [...formData.inclusions, '']})} className="text-[9px] font-black uppercase text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-900/50 px-4 py-2 rounded-xl transition-all shadow-lg">+ Add line</button>
                      </div>
                      <div className="space-y-2">
                        {formData.inclusions.map((inc, i) => (
                          <div key={i} className="flex gap-2 group">
                            <div className="w-10 flex items-center justify-center text-[10px] font-black text-emerald-900 bg-emerald-500 rounded-xl">{i + 1}</div>
                            <input value={inc} onChange={e => { const arr = [...formData.inclusions]; arr[i] = e.target.value; setFormData({...formData, inclusions: arr}) }} className="flex-1 bg-slate-950 border border-slate-800 p-4 text-xs text-white font-bold rounded-xl outline-none focus:border-emerald-500 shadow-md" placeholder="Include..." />
                            <button onClick={() => setFormData({...formData, inclusions: formData.inclusions.filter((_, idx) => idx !== i)})} className="w-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl text-slate-700 hover:text-red-500 transition-colors shadow-lg"><X size={18}/></button>
                          </div>
                        ))}
                      </div>
                   </div>

                   {/* EXCLUSIONS */}
                   <div className="space-y-4 pt-6">
                      <div className="flex items-center justify-between pl-2">
                         <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2 italic"><XCircle size={14}/> Trade Exclusions</label>
                         <button onClick={() => setFormData({...formData, exclusions: [...formData.exclusions, '']})} className="text-[9px] font-black uppercase text-amber-500 hover:bg-amber-600 hover:text-white border border-amber-900/50 px-4 py-2 rounded-xl transition-all shadow-lg">+ Add line</button>
                      </div>
                      <div className="space-y-2">
                        {formData.exclusions.map((exc, i) => (
                          <div key={i} className="flex gap-2 group">
                             <div className="w-10 flex items-center justify-center text-[10px] font-black text-amber-900 bg-amber-500 rounded-xl">{i + 1}</div>
                            <input value={exc} onChange={e => { const arr = [...formData.exclusions]; arr[i] = e.target.value; setFormData({...formData, exclusions: arr}) }} className="flex-1 bg-slate-950 border border-slate-800 p-4 text-xs text-white font-bold rounded-xl outline-none focus:border-amber-500 shadow-md" placeholder="Exclude..." />
                            <button onClick={() => setFormData({...formData, exclusions: formData.exclusions.filter((_, idx) => idx !== i)})} className="w-12 flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl text-slate-700 hover:text-red-500 transition-colors shadow-lg"><X size={18}/></button>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
            </div>

            {/* LOCKED MODAL FOOTER */}
            <div className="p-8 border-t border-slate-800 bg-slate-950 flex flex-col md:flex-row justify-between items-center shrink-0 z-50 gap-4">
               <button onClick={() => handleSave(true)} disabled={saving || !formData.title} className="flex items-center gap-3 text-[10px] font-black uppercase text-blue-400 hover:text-white transition-all bg-blue-950/20 px-8 py-5 rounded-2xl border border-blue-900/30 shadow-lg italic w-full md:w-auto justify-center">
                 <BookmarkPlus size={22}/> Save to Matt's Library
               </button>
               <div className="flex gap-6 w-full md:w-auto">
                 <button onClick={() => setShowModal(false)} className="px-8 py-4 text-xs font-black uppercase text-slate-500 hover:text-white tracking-widest italic flex-1 md:flex-none">Discard</button>
                 <button onClick={() => handleSave(false)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-16 py-5 rounded-2xl text-sm font-black uppercase tracking-[0.3em] shadow-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 italic flex-1 md:flex-none justify-center">
                    {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Push to Tenders
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* CLONE MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-white"><Database className="text-blue-500"/> Clone Project Scopes</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              <select onChange={(e) => fetchSourcePackages(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white font-bold outline-none focus:border-blue-500 appearance-none shadow-inner">
                <option value="">Choose Historical Project...</option>
                {otherProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="space-y-2">
                {sourcePackages.map(pkg => (
                  <div key={pkg.id} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex justify-between items-center hover:border-blue-500/50 transition-all shadow-md">
                    <div className="text-left leading-tight">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Div {pkg.division_code}</p>
                      <p className="font-bold text-white uppercase italic">{pkg.title}</p>
                    </div>
                    <button onClick={() => { loadTemplate(pkg); setShowModal(true); setShowImportModal(false); }} className="bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg italic">Import</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}