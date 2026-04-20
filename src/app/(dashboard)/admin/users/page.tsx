'use client'

import { useState, useEffect } from 'react'
import { Users, CheckCircle2, XCircle, Loader2, Info, Plus, UserPlus, X, AlertTriangle, Trash2, Search, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_AUTO_DEPT, CROSS_DEPT_ROLES } from '@/lib/constants'

const ALL_ROLES = ['Admin', 'Requester', 'Manager', 'Purchasing', 'PurchasingManager', 'Executive', 'Accounting']

// 🎨 Refined Excel-style color mapping for departments
// We move to a more compact indicator (dots and text colors)
const DEPT_COLORS: Record<string, { ring: string, text: string, bg: string, dot: string }> = {
  'ฝ่ายผลิต': { ring: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50/30', dot: 'bg-emerald-500' },
  'จัดซื้อ': { ring: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50/30', dot: 'bg-blue-500' },
  'บัญชี': { ring: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50/30', dot: 'bg-amber-500' },
  'QC': { ring: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50/30', dot: 'bg-purple-500' },
  'R&D': { ring: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50/30', dot: 'bg-indigo-500' },
  'การตลาด': { ring: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50/30', dot: 'bg-rose-500' },
  'ขาย': { ring: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-50/30', dot: 'bg-pink-500' },
  'ซ่อมบำรุง': { ring: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50/30', dot: 'bg-orange-500' },
  'ขนส่ง': { ring: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50/30', dot: 'bg-sky-500' },
  'คลังสินค้า': { ring: 'bg-cyan-500', text: 'text-cyan-700', bg: 'bg-cyan-50/30', dot: 'bg-cyan-500' },
  'Safety': { ring: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50/30', dot: 'bg-yellow-500' },
  'ทรัพยากรบุคคล': { ring: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50/30', dot: 'bg-teal-500' },
  'Printing': { ring: 'bg-fuchsia-500', text: 'text-fuchsia-700', bg: 'bg-fuchsia-50/30', dot: 'bg-fuchsia-500' },
  'วางแผน': { ring: 'bg-lime-500', text: 'text-lime-700', bg: 'bg-lime-50/30', dot: 'bg-lime-500' },
  'TEST': { ring: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50/30', dot: 'bg-slate-400' },
}

const DEFAULT_COLOR = { ring: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50/30', dot: 'bg-gray-400' }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [search, setSearch] = useState('')
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    department_id: '',
    role: 'Requester',
    line_user_id: ''
  })

  // Delete Confirm Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [usersRes, deptsRes] = await Promise.all([
      supabase.from('users').select('*, departments(name)').order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
    ])
    setUsers(usersRes.data || [])
    setDepartments(deptsRes.data || [])
    setLoading(false)
  }

  // Smart department auto-fill when role changes
  const handleRoleChange = (role: string) => {
    const autoDeptName = ROLE_AUTO_DEPT[role]
    let deptId = ''
    if (autoDeptName) {
      const found = departments.find(d => d.name === autoDeptName)
      if (found) deptId = found.id
    }
    setNewUser(prev => ({ ...prev, role, department_id: deptId }))
  }

  const isCrossDeptRole = (role: string) => CROSS_DEPT_ROLES.includes(role)

  const getDeptColor = (deptName: string) => {
    return DEPT_COLORS[deptName] || DEFAULT_COLOR
  }

  const handleApprove = async (userId: string) => {
    await supabase.from('users').update({ is_approved: true }).eq('id', userId)
    fetchData()
  }

  const handleDelete = async () => {
    if (!userToDelete) return
    setDeletingUser(true)
    const { error } = await supabase.from('users').delete().eq('id', userToDelete.id)
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setIsDeleteModalOpen(false)
      setUserToDelete(null)
      fetchData()
    }
    setDeletingUser(false)
  }

  const handleUpdateRole = async (userId: string, role: string) => {
    await supabase.from('users').update({ role }).eq('id', userId)
    fetchData()
  }

  const handleUpdateDept = async (userId: string, departmentId: string) => {
    await supabase.from('users').update({ department_id: departmentId || null }).eq('id', userId)
    fetchData()
  }

  const handleUpdateLineId = async (userId: string, lineId: string) => {
    await supabase.from('users').update({ line_user_id: lineId.trim() || null }).eq('id', userId)
    fetchData()
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingUser(true)
    
    // Build insert payload — omit department_id if empty (cross-dept roles)
    const payload: any = {
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
      line_user_id: newUser.line_user_id || null,
      is_approved: true,
    }
    if (newUser.department_id) {
      payload.department_id = newUser.department_id
    }

    const { error } = await supabase.from('users').insert(payload)

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      setIsModalOpen(false)
      setNewUser({ first_name: '', last_name: '', username: '', password: '', department_id: '', role: 'Requester', line_user_id: '' })
      fetchData()
    }
    setSavingUser(false)
  }

  const filtered = users.filter((u) => {
    const matchesFilter = filter === 'pending' ? !u.is_approved : filter === 'approved' ? u.is_approved : true
    const matchesSearch = 
      String(u.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.username || '').toLowerCase().includes(search.toLowerCase()) ||
      String(u.departments?.name || '').toLowerCase().includes(search.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const pendingCount = users.filter((u) => !u.is_approved).length
  const activeDepts = Array.from(new Set(users.map(u => u.departments?.name).filter(Boolean)))

  return (
    <div className="space-y-4 max-w-[95vw] pb-10 mx-auto">
      {/* Excel Header Style */}
      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">User Directory (Excel Style)</h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">ระบบบริหารจัดการพนักงานและสิทธิ์การใช้งาน</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาพนักงาน / Username / แผนก..."
                className="w-full md:w-80 h-11 pl-10 pr-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all"
              />
            </div>
            {/* Action Group */}
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              {[
                { key: 'all', label: 'ทั้งหมด', count: users.length },
                { key: 'pending', label: 'รอตรวจ', count: pendingCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    filter === tab.key ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-[10px] rounded-md">{tab.count}</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-100 hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              เพิ่มพนักงาน
            </button>
          </div>
        </div>
      </div>

      {/* Excel Style Data Grid */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 first:border-l-0">
                <th className="px-5 py-3 border-r border-gray-200 text-center w-12 cursor-default">#</th>
                <th className="px-5 py-3 border-r border-gray-200 min-w-[200px]">พนักงาน (Employee Name)</th>
                <th className="px-5 py-3 border-r border-gray-200 min-w-[120px]">Username</th>
                <th className="px-5 py-3 border-r border-gray-200 min-w-[150px] text-center">แผนก (Department)</th>
                <th className="px-5 py-3 border-r border-gray-200 min-w-[150px] text-center">ระดับสิทธิ์ (Role)</th>
                <th className="px-5 py-3 border-r border-gray-200 min-w-[180px]">LINE User ID</th>
                <th className="px-5 py-3 border-r border-gray-200 text-center w-32">สถานะ</th>
                <th className="px-5 py-3 text-right w-32 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-200 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-20 text-center text-gray-300 font-bold italic tracking-wider">--- ไม่พบข้อมูล ---</td></tr>
              ) : filtered.map((user, idx) => {
                const deptColor = getDeptColor(user.departments?.name)
                const isPending = !user.is_approved
                
                return (
                  <tr 
                    key={user.id} 
                    className={`border-b border-gray-100 hover:bg-purple-50/30 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    {/* Index */}
                    <td className="px-5 py-2.5 border-r border-gray-50 text-center text-[11px] text-gray-400 font-bold">
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td className="px-5 py-2.5 border-r border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shadow-sm shrink-0 ${deptColor.dot}`} />
                        <span className="truncate">{user.first_name} {user.last_name}</span>
                        {isPending && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black tracking-tighter">NEW</span>}
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-5 py-2.5 border-r border-gray-50 font-mono text-xs text-gray-500">
                      @{user.username}
                    </td>

                    {/* Department Select (Excel Style) */}
                    <td className={`px-2 py-1.5 border-r border-gray-50 ${user.departments?.name ? deptColor.bg : ''}`}>
                      <select
                        value={user.department_id || ''}
                        onChange={(e) => handleUpdateDept(user.id, e.target.value)}
                        className={`w-full bg-transparent text-xs font-bold px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer appearance-none ${deptColor.text}`}
                      >
                        <option value="">-- เลือกแผนก --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id} className="text-gray-900">{d.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Role Select (Excel Style) */}
                    <td className="px-2 py-1.5 border-r border-gray-50">
                      <div className="space-y-0.5">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className="w-full bg-white border border-transparent group-hover:border-gray-200 text-xs font-bold px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer transition-all"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {isCrossDeptRole(user.role) && (
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider ml-1 opacity-0 group-hover:opacity-100 transition-opacity">ข้ามแผนก</span>
                        )}
                      </div>
                    </td>

                    {/* LINE ID (Excel Style) */}
                    <td className="px-2 py-1.5 border-r border-gray-50">
                      <input
                        type="text"
                        defaultValue={user.line_user_id || ''}
                        onBlur={(e) => handleUpdateLineId(user.id, e.target.value)}
                        placeholder="U12345..."
                        className="w-full bg-white border border-transparent group-hover:border-gray-200 text-[11px] font-mono px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-bold"
                      />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-2.5 border-r border-gray-50 text-center">
                      {user.is_approved ? (
                        <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">APPROVED</span>
                      ) : (
                        <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 animate-pulse">PENDING</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-2.5 text-right bg-gray-50/50 group-hover:bg-white transition-colors">
                      <div className="flex gap-2 justify-end items-center relative z-20">
                        {isPending && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="bg-emerald-600 text-white p-1.5 rounded-lg hover:bg-emerald-700 shadow-sm transition-all"
                            title="อนุมัติพนักงาน"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setUserToDelete(user)
                            setIsDeleteModalOpen(true)
                          }}
                          className="bg-red-50 text-red-100 group-hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          title="ลบบัญชี"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* Legacy Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden transform animate-in slide-in-from-bottom-8">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">เพิ่มพนักงานใหม่</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Create user manually</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input required type="text" value={newUser.first_name} onChange={(e) => setNewUser({...newUser, first_name: e.target.value})} placeholder="ชื่อจริง" className="w-full h-12 px-5 bg-gray-50 border border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold" />
                <input required type="text" value={newUser.last_name} onChange={(e) => setNewUser({...newUser, last_name: e.target.value})} placeholder="นามสกุล" className="w-full h-12 px-5 bg-gray-50 border border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold" />
              </div>
              <input required type="text" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} placeholder="Username" className="w-full h-12 px-5 bg-gray-50 border border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold lowercase" />
              <input required type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} placeholder="Password" className="w-full h-12 px-5 bg-gray-50 border border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold" />
              
              {/* Role selector first — drives department auto-fill */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ระดับสิทธิ์ (Role)</label>
                <select required value={newUser.role} onChange={(e) => handleRoleChange(e.target.value)} className="w-full h-12 px-5 bg-gray-50 rounded-2xl font-bold cursor-pointer outline-none border border-transparent focus:border-purple-500">
                  {ALL_ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABELS[r]}</option>))}
                </select>
                {ROLE_DESCRIPTIONS[newUser.role] && (
                  <div className="flex items-start gap-2 px-2 py-2 bg-blue-50/50 rounded-xl border border-blue-100">
                    <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold text-blue-700 leading-relaxed">{ROLE_DESCRIPTIONS[newUser.role]}</p>
                  </div>
                )}
              </div>

              {/* Department — auto-filled for Purchasing/Accounting, optional for cross-dept roles */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">แผนก (Department)</label>
                  {isCrossDeptRole(newUser.role) && (
                    <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">ไม่บังคับ — ข้ามแผนก</span>
                  )}
                </div>
                <select 
                  required={!isCrossDeptRole(newUser.role)}
                  value={newUser.department_id} 
                  onChange={(e) => setNewUser({...newUser, department_id: e.target.value})} 
                  className={`w-full h-12 px-5 rounded-2xl font-bold cursor-pointer outline-none border border-transparent focus:border-purple-500 ${
                    ROLE_AUTO_DEPT[newUser.role] && newUser.department_id ? 'bg-emerald-50/50 text-emerald-800' : 'bg-gray-50'
                  }`}
                >
                  <option value="">{isCrossDeptRole(newUser.role) ? '-- ไม่ระบุแผนก (ข้ามแผนก) --' : '-- เลือกแผนก --'}</option>
                  {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
                {ROLE_AUTO_DEPT[newUser.role] && newUser.department_id && (
                  <p className="text-[10px] font-bold text-emerald-600 ml-1">✓ ระบบเลือกแผนก "{departments.find(d => d.id === newUser.department_id)?.name}" ให้อัตโนมัติ</p>
                )}
              </div>

              <input type="text" value={newUser.line_user_id} onChange={(e) => setNewUser({...newUser, line_user_id: e.target.value})} placeholder="LINE User ID (เช่น U12345...)" className="w-full h-12 px-5 bg-gray-50 border border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold font-mono text-sm" />
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 bg-gray-100 text-gray-500 rounded-2xl font-bold">ยกเลิก</button>
                <button type="submit" disabled={savingUser} className="flex-[2] h-14 bg-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-purple-200">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden transform animate-in zoom-in-95">
            <div className="p-10 text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner"><AlertTriangle className="w-10 h-10" /></div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">ยืนยันการลบพนักงาน?</h3>
                <p className="text-sm font-bold text-gray-500 leading-relaxed px-4">คุณกำลังจะลบบัญชี <span className="text-red-500">"{userToDelete.first_name}"</span> ออกจากระบบอย่างถาวร</p>
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button onClick={handleDelete} disabled={deletingUser} className="w-full h-14 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 flex items-center justify-center gap-2">{deletingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} ยืนยันการลบ</button>
                <button onClick={() => setIsDeleteModalOpen(false)} disabled={deletingUser} className="w-full h-14 bg-gray-50 text-gray-400 rounded-xl font-bold">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
