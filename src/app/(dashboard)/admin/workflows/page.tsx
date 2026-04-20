'use client'

import { useState, useEffect } from 'react'
import { GitBranch, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Search, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/constants'

const APPROVER_ROLES = ['Manager', 'PurchasingManager', 'Executive']

export default function WorkflowsPage() {
  const [chains, setChains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PR' | 'PO'>('PR')

  // New step form
  const [newRole, setNewRole] = useState('Manager')
  const [newName, setNewName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => { fetchChains() }, [])

  const fetchChains = async () => {
    setLoading(true)
    const { data } = await supabase.from('approval_chains').select('*').order('step_order')
    setChains(data || [])
    setLoading(false)
  }

  const filteredChains = chains.filter((c) => c.document_type === activeTab)

  const handleAddStep = async () => {
    if (!newName.trim()) return alert('กรุณากรอกชื่อขั้นตอน')

    const maxOrder = filteredChains.reduce((max, c) => Math.max(max, c.step_order), 0)

    const { error } = await supabase.from('approval_chains').insert({
      document_type: activeTab,
      step_order: maxOrder + 1,
      approver_role: newRole,
      step_name: newName.trim(),
      is_active: true,
    })

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setNewName('')
      fetchChains()
    }
  }

  const handleToggle = async (id: string, currentValue: boolean) => {
    const { error } = await supabase.from('approval_chains').update({ is_active: !currentValue }).eq('id', id)
    if (error) {
      alert('ไม่สามารถเปลี่ยนสถานะได้: ' + error.message)
    } else {
      fetchChains()
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    const { error } = await supabase.from('approval_chains').delete().eq('id', id)
    if (error) {
      alert('ไม่สามารถลบได้: ' + error.message)
    } else {
      setConfirmDeleteId(null)
      fetchChains()
    }
  }

  return (
    <div className="space-y-4 max-w-[95vw] pb-10 mx-auto animate-in fade-in duration-500">
      {/* Excel Header Style & Tabs */}
      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-4 uppercase">
              <GitBranch className="w-8 h-8 text-purple-600" />
              Workflow Architect
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center md:text-left">กำหนดผังและลำดับขั้นตอนการพิจารณาอนุมัติเอกสาร</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
            {/* Nav Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              {(['PR', 'PO'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab 
                      ? tab === 'PR' ? 'bg-blue-600 text-white shadow-lg' : 'bg-emerald-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'PR' ? 'Purchase Request' : 'Purchase Order'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step List Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden min-h-[500px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/60 border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <th className="px-8 py-5 border-r border-gray-100 text-center w-20">Step</th>
                    <th className="px-8 py-5 border-r border-gray-100 min-w-[200px]">Approval Operation</th>
                    <th className="px-8 py-5 border-r border-gray-100 text-center w-40">Role Target</th>
                    <th className="px-8 py-5 border-r border-gray-100 text-center w-32">Visibility</th>
                    <th className="px-8 py-5 text-right w-32 bg-gray-50/30">Control</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700 font-sans">
                  {loading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-200 mx-auto" /></td></tr>
                  ) : filteredChains.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black italic uppercase tracking-widest">--- No Workflow configured ---</td></tr>
                  ) : filteredChains.map((step, idx) => (
                    <tr 
                      key={step.id} 
                      className={`border-b border-gray-50 transition-all group ${!step.is_active ? 'bg-slate-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'} hover:bg-purple-50/10`}
                    >
                      <td className="px-8 py-5 border-r border-gray-50 text-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-sm mx-auto ${
                          step.is_active
                            ? activeTab === 'PR' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-400'
                        }`}>
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-8 py-5 border-r border-gray-50">
                        <p className={`text-sm font-black ${!step.is_active ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{step.step_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Sequence ID: #{step.step_order}</p>
                      </td>
                      <td className="px-8 py-5 border-r border-gray-50 text-center">
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border ${
                          step.is_active ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          {ROLE_LABELS[step.approver_role] || step.approver_role}
                        </span>
                      </td>
                      <td className="px-8 py-5 border-r border-gray-50 text-center">
                        <button
                          onClick={() => handleToggle(step.id, step.is_active)}
                          className="transition-transform active:scale-90"
                        >
                          {step.is_active ? (
                            <ToggleRight className="w-9 h-9 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-9 h-9 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="px-8 py-5 text-right bg-gray-50/30 group-hover:bg-white transition-colors">
                        <div className="flex justify-end gap-1.5">
                          {confirmDeleteId === step.id ? (
                            <div className="flex items-center gap-1 animate-in slide-in-from-right-4">
                              <button onClick={() => handleDelete(step.id)} className="px-3 py-1.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-red-700 shadow-lg animate-pulse">Confirm Delete?</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><Plus className="w-4 h-4 rotate-45" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(step.id)}
                              className="p-2.5 text-slate-200 group-hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50/50 text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em] text-center italic">
              * ขั้นตอนจะถูกเรียกใช้ตามลำดับจากบนลงล่างระบบจะข้ามขั้นตอนที่ "ปิดการใช้งาน"
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-800">
            <div className="p-8 border-b border-white/5 bg-gradient-to-r from-purple-800/20 to-transparent">
              <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                <Plus className="w-4 h-4 text-purple-400" /> Append NEW Step
              </h3>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-2 font-sans italic">Adding to {activeTab} Workflow</p>
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Step Function Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ผจก. ตรวจเช็ค, จัดซื้ออนุมัติ..."
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-sans"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Responsible Role</label>
                <div className="relative group">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none appearance-none cursor-pointer focus:ring-4 focus:ring-purple-500/20 transition-all font-sans"
                  >
                    {APPROVER_ROLES.map((r) => (
                      <option key={r} value={r} className="bg-slate-900 text-white">{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-purple-400 transition-colors">
                     <Plus className="w-4 h-4 rotate-45" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddStep}
                disabled={!newName.trim()}
                className="w-full h-15 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.25em] hover:bg-purple-500 hover:text-white transition-all active:scale-95 shadow-xl shadow-black/40 flex items-center justify-center gap-3 disabled:opacity-20"
              >
                <Plus className="w-4 h-4 stroke-[4px]" /> Add to Chain
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 space-y-6 shadow-sm">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center">
                 <ClipboardList className="w-5 h-5 text-amber-500" />
               </div>
               <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">System Notes</h4>
             </div>
             <div className="space-y-4 text-[10px] font-bold text-slate-400 uppercase leading-relaxed tracking-wider">
               <p>• สามารถปรับเปลี่ยนลำดับการอนุมัติได้แบบ Real-time</p>
               <p>• หากลบขั้นตอนที่ใช้งานอยู่ อาจส่งผลต่อเอกสารที่ยังค้างอยู่ในระบบ</p>
               <p>• แนะนำให้ "ปิดใช้งาน" แทนการลบทิ้ง เพื่อรักษาคุณสมบัติของข้อมูลย้อนหลัง</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
