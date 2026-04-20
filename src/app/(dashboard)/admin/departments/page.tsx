'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Trash2, Loader2, Search, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchDepts() }, [])

  const fetchDepts = async () => {
    setLoading(true)
    const { data } = await supabase.from('departments').select('*').order('name', { ascending: true })
    setDepartments(data || [])
    setLoading(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const { error } = await supabase.from('departments').insert({ name: newName.trim() })
    if (error) {
      alert(error.message.includes('duplicate') ? 'ชื่อแผนกนี้มีอยู่แล้ว' : error.message)
    } else {
      setNewName('')
      setIsModalOpen(false)
      fetchDepts()
    }
    setAdding(false)
  }

  const handleDelete = async () => {
    if (!deptToDelete) return
    setDeleting(true)
    const { error } = await supabase.from('departments').delete().eq('id', deptToDelete.id)
    if (error) {
      alert('ไม่สามารถลบได้ (อาจมีพนักงานหรือเอกสารผูกกับแผนกนี้อยู่)')
    } else {
      setIsDeleteModalOpen(false)
      setDeptToDelete(null)
      fetchDepts()
    }
    setDeleting(false)
  }

  const filtered = departments.filter((d) => 
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 max-w-[95vw] pb-10 mx-auto animate-in fade-in duration-500">
      {/* Excel Header Style */}
      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight text-center md:text-left">Department Registry</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center md:text-left">ระบบจัดการโครงสร้างแผนกและหน่วยงานอิเล็กทรอนิกส์</p>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative group w-full md:w-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อแผนก..."
                className="w-full md:w-80 h-11 pl-10 pr-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all font-sans"
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-gray-100 hover:bg-black active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              เพิ่มแผนกใหม่
            </button>
          </div>
        </div>
      </div>

      {/* Excel Style Data Grid */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/60 border-b border-gray-200 text-[10px] font-black text-gray-400 first:border-l-0 uppercase tracking-[0.15em]">
                <th className="px-8 py-4 border-r border-gray-100 text-center w-20">No.</th>
                <th className="px-8 py-4 border-r border-gray-100 min-w-[300px]">Department Name (TH/EN)</th>
                <th className="px-8 py-4 border-r border-gray-100 text-center">Creation Date</th>
                <th className="px-8 py-4 text-right w-32 bg-gray-50/30">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 font-sans">
              {loading ? (
                <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-200 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold italic tracking-wider">--- ไม่พบข้อมูลแผนก ---</td></tr>
              ) : filtered.map((dept, idx) => (
                <tr 
                  key={dept.id} 
                  className={`border-b border-gray-50 hover:bg-purple-50/20 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}
                >
                  <td className="px-8 py-4 border-r border-gray-50 text-center text-[10px] text-gray-300 font-black">
                    {String(idx + 1).padStart(2, '0')}
                  </td>
                  <td className="px-8 py-4 border-r border-gray-50">
                    <div className="flex items-center gap-5">
                      <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="font-black text-slate-800 text-base">{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 border-r border-gray-50 text-center text-[11px] text-slate-400 font-bold">
                    {new Date(dept.created_at).toLocaleDateString('th-TH', { 
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-8 py-4 text-right bg-gray-50/30 group-hover:bg-white transition-colors">
                    <button
                      onClick={() => {
                        setDeptToDelete(dept)
                        setIsDeleteModalOpen(true)
                      }}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                      title="ลบแผนก"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden transform animate-in slide-in-from-bottom-8">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><Plus className="w-6 h-6 stroke-[3px]" /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">เพิ่มแผนกใหม่</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1.5 font-sans">Create NEW Organizational Unit</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-all active:scale-90 text-slate-300"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-10 space-y-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] ml-1">ชื่อแผนกที่ต้องการเพิ่ม <span className="text-red-500">*</span></label>
                <input 
                  required 
                  autoFocus
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="เช่น ฝ่ายผลิต, บัญชี, จัดซื้อ..." 
                  className="w-full h-16 px-7 bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white focus:ring-8 focus:ring-purple-500/5 rounded-3xl outline-none transition-all font-black text-xl text-slate-800 placeholder:text-slate-300" 
                />
              </div>
              <div className="flex flex-col gap-4 pt-2">
                <button type="submit" disabled={adding || !newName.trim()} className="w-full h-15 bg-purple-600 hover:bg-purple-700 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.25em] shadow-xl shadow-purple-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                  {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 stroke-[4px]" />} บันทึกแผนกใหม่
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full h-15 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all font-sans">Cancel / Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deptToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden transform animate-in zoom-in-95">
            <div className="p-10 text-center space-y-8">
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner"><AlertTriangle className="w-12 h-12" /></div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">ลบรายการแผนก?</h3>
                <p className="text-sm font-bold text-slate-400 leading-relaxed px-6 font-sans">คุณกำลังจะลบแผนก <span className="text-red-500 font-black">"{deptToDelete.name}"</span> ออกจากระบบอย่างถาวร (หากมีพนักงานสังกัดอยู่ระบบจะไม่อนุญาต)</p>
              </div>
              <div className="flex flex-col gap-3 pt-6">
                <button onClick={handleDelete} disabled={deleting} className="w-full h-15 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-xl shadow-red-100 flex items-center justify-center gap-2 transition-all active:scale-95">{deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} ยืนยันการลบทิ้ง</button>
                <button onClick={() => setIsDeleteModalOpen(false)} disabled={deleting} className="w-full h-15 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-100 transition-all">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
