'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, Plus, FileSignature, Building2, 
  FolderOpen, Settings2, Clock, CheckCircle2,
  Users, ArrowRight, Save, X, ListPlus, Copy,
  FileText, Map as MapIcon, Search, Loader2,
  ChevronRight, Database, Edit3
} from 'lucide-react'

const ONTARIO_MASTER_TEMPLATES = [
  {
    division: '03',
    title: 'Concrete Forming & Placement',
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
    title: 'Masonry',
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
    division: '14',
    title: 'Elevators',
    base_scope: 'Design, supply, and installation of traction passenger elevators including cab finishes and commissioning.',
    inclusions: [
      'TSSA compliance, registration, and final inspection coordination',
      'Provision for temporary use during construction (one car minimum)',
      'Custom cab finishes as per interior design schedule',
      'Hoistway sill angles and divider beams',
      '12-month comprehensive maintenance period post-turnover'
    ],
    exclusions: ['Hoistway lighting and 120v_pit receptacles (by Div 26)', 'Shaft masonry and grouting of frames (by Div 04)']
  },
  {
    division: '21',
    title: 'Fire Suppression',
    base_scope: 'Complete design-build installation of wet and dry fire sprinkler systems, fire pumps, and standpipes.',
    inclusions: [
      'Hydraulic calculations and engineered shop drawings',
      'NFPA 13/14 compliant installation and pressure testing',
      'Supply and installation of fire pump, jockey pump, and controllers',
      'Coordination with base building fire alarm system',
      'Dry heads at balconies and parking garage levels'
    ],
    exclusions: ['Fire alarm wiring and verification (by Div 26)']
  },
  {
    division: '22',
    title: 'Plumbing & Drainage',
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
    division: '23',
    title: 'HVAC',
    base_scope: 'Supply and installation of all heating, ventilation, air conditioning equipment, and ductwork distribution.',
    inclusions: [
      'Suite fan-coil units (FCU) and Energy Recovery Ventilators (ERV)',
      'Rooftop Make-Up Air (MUA) units and corridor pressurization ductwork',
      'Parking garage exhaust fans and CO/NO2 sensor systems',
      'All sheet metal ducting, fire dampers, and acoustic lining',
      'Complete air and water balancing (TAB) with certified reports'
    ],
    exclusions: ['Line voltage electrical connections to equipment (by Div 26)']
  },
  {
    division: '26',
    title: 'Electrical & Fire Alarm',
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
  
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    division_code: '', title: '', base_scope: '', inclusions: [''], exclusions: [''], due_date: '', linked_plans: [] as string[]
  })

  const [otherProjects, setOtherProjects] = useState<any[]>([])
  const [sourceProjectId, setSourceProjectId] = useState('')
  const [sourcePackages, setSourcePackages] = useState<any[]>([])

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    const [pkgRes, projRes, docsRes, otherProjRes] = await Promise.all([
      supabase.from('bid_packages').select('*, bid_invitations(id, status)').eq('project_id', id).order('division_code', { ascending: true }),
      supabase.from('projects').select('name, location').eq('id', id).single(),
      supabase.from('project_documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').neq('id', id)
    ])
    
    setPackages(pkgRes.data || [])
    setProject(projRes.data)
    setProjectPlans(docsRes.data || [])
    setOtherProjects(otherProjRes.data || [])
    setLoading(false)
  }

  const loadTemplate = (template: any) => {
    setSelectedTemplate(template)
    setEditingPackageId(null)
    if (template) {
      setFormData({
        division_code: template.division,
        title: template.title,
        base_scope: template.base_scope,
        inclusions: [...template.inclusions],
        exclusions: [...template.exclusions],
        due_date: '',
        linked_plans: []
      })
    } else {
      setFormData({ division_code: '', title: '', base_scope: '', inclusions: [''], exclusions: [''], due_date: '', linked_plans: [] })
    }
  }

  const handleEditExisting = (pkg: any) => {
    setEditingPackageId(pkg.id)
    
    // Safely handle linked_plans whether it's a string or array from DB
    let parsedPlans = []
    if (Array.isArray(pkg.linked_plans)) {
      parsedPlans = pkg.linked_plans
    } else if (typeof pkg.linked_plans === 'string') {
      try { parsedPlans = JSON.parse(pkg.linked_plans) } catch(e) {}
    }

    setFormData({
      division_code: pkg.division_code || '',
      title: pkg.title || '',
      base_scope: pkg.base_scope || '',
      inclusions: pkg.inclusions || [''],
      exclusions: pkg.exclusions || [''],
      due_date: pkg.due_date ? pkg.due_date.slice(0, 16) : '',
      linked_plans: parsedPlans
    })
    setShowModal(true)
  }

  const handleArrayChange = (type: 'inclusions' | 'exclusions', index: number, value: string) => {
    const newArray = [...formData[type]]
    newArray[index] = value
    setFormData({ ...formData, [type]: newArray })
  }

  const addArrayItem = (type: 'inclusions' | 'exclusions') => {
    setFormData({ ...formData, [type]: [...formData[type], ''] })
  }

  const removeArrayItem = (type: 'inclusions' | 'exclusions', index: number) => {
    const newArray = formData[type].filter((_, i) => i !== index)
    setFormData({ ...formData, [type]: newArray })
  }

  const togglePlanLink = (planId: string) => {
    setFormData(prev => ({
      ...prev,
      linked_plans: prev.linked_plans.includes(planId)
        ? prev.linked_plans.filter(pid => pid !== planId)
        : [...prev.linked_plans, planId]
    }))
  }

  const handleCreatePackage = async () => {
    setSaving(true)
    const cleanInclusions = formData.inclusions.filter(i => i.trim() !== '')
    const cleanExclusions = formData.exclusions.filter(i => i.trim() !== '')

    const payload: any = {
      project_id: id,
      division_code: formData.division_code,
      title: formData.title,
      base_scope: formData.base_scope,
      inclusions: cleanInclusions,
      exclusions: cleanExclusions,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      linked_plans: formData.linked_plans, // This is an array of UUID strings
      status: 'Draft'
    }

    let error;
    if (editingPackageId) {
      const { error: updateErr } = await supabase.from('bid_packages').update(payload).eq('id', editingPackageId)
      error = updateErr
    } else {
      const { error: insertErr } = await supabase.from('bid_packages').insert([payload])
      error = insertErr
    }

    if (error) {
      alert("Failed to save: " + error.message)
    } else {
      setShowModal(false)
      fetchData()
    }
    setSaving(false)
  }

  const fetchSourcePackages = async (sId: string) => {
    setSourceProjectId(sId)
    const { data } = await supabase.from('bid_packages').select('*').eq('project_id', sId)
    setSourcePackages(data || [])
  }

  const handleImportPackage = async (sourcePkg: any) => {
    setSaving(true)
    const payload = {
      project_id: id,
      division_code: sourcePkg.division_code,
      title: `${sourcePkg.title} (Imported)`,
      base_scope: sourcePkg.base_scope,
      inclusions: sourcePkg.inclusions,
      exclusions: sourcePkg.exclusions,
      linked_plans: [], 
      status: 'Draft'
    }
    const { error } = await supabase.from('bid_packages').insert([payload])
    if (error) alert(error.message)
    else {
      setShowImportModal(false)
      fetchData()
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse uppercase tracking-widest">Syncing Scopes...</div>

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-950 min-h-screen text-slate-100 pb-32">
      
      {/* HEADER */}
      <div className="mb-10 border-b-4 border-emerald-600 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <nav className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 mb-4">
            <button onClick={() => router.push(`/projects/${id}`)} className="hover:text-white transition-all flex items-center gap-1">
              <ChevronLeft size={12}/> {project?.name || 'Project'}
            </button>
            <span>/</span>
            <span className="text-emerald-500">Bid Management</span>
          </nav>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">Bid <span className="text-emerald-500">Manager</span></h1>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3 flex items-center gap-2">
            <Building2 size={14} className="text-emerald-500"/> {project?.name} • {project?.location}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowImportModal(true)} className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><Copy size={16}/> Clone From Project</button>
          <button onClick={() => { loadTemplate(null); setShowModal(true) }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20 flex items-center gap-2"><Plus size={16}/> New Scope</button>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[32px] p-16 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
          <FolderOpen size={48} className="text-slate-600 mb-4" />
          <h3 className="text-xl font-black text-white uppercase mb-2 italic">No Scopes Engineered</h3>
          <p className="text-slate-500 text-sm mb-6 max-w-md font-bold">You haven't drafted any bid packages for this project yet.</p>
          <button onClick={() => { loadTemplate(null); setShowModal(true) }} className="text-emerald-500 hover:text-emerald-400 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 bg-emerald-950/30 px-6 py-3 rounded-xl border border-emerald-900/30 transition-all"><ListPlus size={14}/> Engineering First Scope</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 hover:border-emerald-900/50 transition-colors group flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-emerald-950/30 text-emerald-500 font-black text-[8px] px-2 py-1 rounded border border-emerald-900/30 uppercase tracking-tighter">{project?.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditExisting(pkg)} className="text-slate-500 hover:text-white"><Edit3 size={14}/></button>
                    <span className={`font-black text-[9px] uppercase px-2 py-1 rounded ${pkg.status === 'Draft' ? 'bg-amber-950/50 text-amber-500' : 'bg-emerald-950/50 text-emerald-500'}`}>{pkg.status}</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-white leading-tight mb-2 truncate">Div {pkg.division_code}: {pkg.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-6 leading-relaxed">{pkg.base_scope}</p>
              </div>
              <div className="border-t border-slate-800 pt-4 mt-auto">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><Users size={12}/> {pkg.bid_invitations?.length || 0} Invited</span>
                  {pkg.due_date && <span className="flex items-center gap-1 text-blue-400"><Clock size={12}/> {new Date(pkg.due_date).toLocaleDateString()}</span>}
                </div>
                <button onClick={() => router.push(`/projects/${id}/bidding/${pkg.id}`)} className="w-full bg-slate-950 border border-slate-800 text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">Open Bid Matrix <ArrowRight size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                <FileSignature className="text-emerald-500"/> {editingPackageId ? 'Edit Scope' : 'Draft Bid Package'} • {project?.name}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar">
              <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800 pb-8 lg:pb-0 lg:pr-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2"><Building2 size={12}/> Templates</p>
                <div className="space-y-2">
                  {ONTARIO_MASTER_TEMPLATES.map(t => (
                    <button key={t.division + t.title} onClick={() => loadTemplate(t)} className={`w-full text-left p-3 rounded-xl border transition-all ${selectedTemplate?.title === t.title ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'}`}>
                      <p className="text-[8px] font-black uppercase mb-1 opacity-50">Div {t.division}</p>
                      <p className="font-bold text-xs truncate">{t.title}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-8">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block">Div</label>
                    <input type="text" value={formData.division_code} onChange={e => setFormData({...formData, division_code: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white text-xs outline-none focus:border-emerald-500" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block">Title</label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white text-xs outline-none focus:border-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block">Base Scope Description</label>
                  <textarea rows={3} value={formData.base_scope} onChange={e => setFormData({...formData, base_scope: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-xs text-white outline-none focus:border-emerald-500 leading-relaxed" />
                </div>

                <div>
                  <label className="text-[9px] font-black text-emerald-500 uppercase mb-3 flex items-center gap-1"><CheckCircle2 size={12}/> Inclusions</label>
                  <div className="space-y-2 mb-4">
                    {formData.inclusions.map((inc, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={inc} onChange={e => handleArrayChange('inclusions', i, e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs text-white outline-none focus:border-emerald-500" />
                        <button onClick={() => removeArrayItem('inclusions', i)} className="text-slate-600 hover:text-red-500 p-2"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addArrayItem('inclusions')} className="bg-emerald-950/30 text-emerald-500 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all">+ Add Inclusion Line</button>
                </div>

                <div>
                  <label className="text-[9px] font-black text-amber-500 uppercase mb-3 flex items-center gap-1"><X size={12}/> Exclusions</label>
                  <div className="space-y-2 mb-4">
                    {formData.exclusions.map((exc, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={exc} onChange={e => handleArrayChange('exclusions', i, e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs text-white outline-none focus:border-amber-500" />
                        <button onClick={() => removeArrayItem('exclusions', i)} className="text-slate-600 hover:text-red-500 p-2"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addArrayItem('exclusions')} className="bg-amber-950/30 text-amber-500 hover:bg-amber-600 hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all">+ Add Exclusion Line</button>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-6 lg:pl-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block">Bids Due Date</label>
                  <input type="datetime-local" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl font-bold text-white text-xs outline-none focus:border-emerald-500 [color-scheme:dark]" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1"><MapIcon size={12}/> Attach Master Plans</label>
                    <span className="text-[8px] font-black text-slate-500">{formData.linked_plans.length} Selected</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner">
                    {projectPlans.length === 0 ? (
                      <div className="p-8 text-center text-slate-600 text-[10px] italic font-bold uppercase">No docs in project_documents</div>
                    ) : (
                      <div className="space-y-1">
                        {projectPlans.map(plan => (
                          <label key={plan.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${formData.linked_plans.includes(plan.id) ? 'bg-blue-900/20 border-blue-500/50' : 'hover:bg-slate-900 border-transparent'}`}>
                            <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-900 text-blue-600" checked={formData.linked_plans.includes(plan.id)} onChange={() => togglePlanLink(plan.id)} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-bold text-white truncate leading-tight">
                                {plan.title || plan.name || "Unnamed Document"}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[8px] text-emerald-500 uppercase font-black px-1.5 py-0.5 bg-emerald-950/50 rounded">
                                  {plan.sheet_number || 'No Sheet #'}
                                </span>
                                <span className="text-[8px] text-slate-500 uppercase font-bold">
                                  {plan.category || 'General'}
                                </span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-4">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreatePackage} disabled={saving || !formData.title || !formData.division_code} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={18}/> {editingPackageId ? 'Update Scope' : 'Save Scope'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2"><Database className="text-blue-500"/> Clone from Building</h2>
              <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-white bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <select onChange={(e) => fetchSourcePackages(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white font-bold outline-none focus:border-blue-500">
                <option value="">Select Project to import from...</option>
                {otherProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="space-y-2">
                {sourcePackages.map(pkg => (
                  <div key={pkg.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-center group hover:border-blue-500/50 transition-all">
                    <div>
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Div {pkg.division_code}</p>
                      <p className="font-bold text-white">{pkg.title}</p>
                    </div>
                    <button onClick={() => handleImportPackage(pkg)} className="bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">Import <ChevronRight size={14}/></button>
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