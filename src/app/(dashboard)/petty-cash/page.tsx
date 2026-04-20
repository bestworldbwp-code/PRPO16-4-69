'use client'

import Link from 'next/link'
import { Plus, Search, Wallet, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'

export default function PettyCashListPage() {
  const [pcs, setPcs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
    setUserRole(getCookie('user_role'))
    fetchPCs()
  }, [])

  const fetchPCs = async () => {
    setLoading(true)
    const userId = getCookie('user_id')
    const role = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let query = supabase
      .from('petty_cash')
      .select('id, pc_number, title, status, created_at, requester_id, department_id, users!petty_cash_requester_id_fkey(first_name, last_name), departments(name)')
      .order('created_at', { ascending: false })

    // Role-based filtering standard for Petty Cash (Same as PR)
    if (role === 'Admin') {
      // Admin sees everything
    } else if (role === 'Executive') {
      // Executive sees PCs at their step (2) OR PCs they've already approved (Logs)
      const { data: logs } = await supabase
        .from('approval_logs')
        .select('document_id')
        .eq('approver_id', userId)
        .eq('document_type', 'PC')
      
      const logIds = logs?.map(l => l.document_id) || []
      
      if (logIds.length > 0) {
        query = query.or(`current_step.eq.2,id.in.(${logIds.map(id => `"${id}"`).join(',')})`)
      } else {
        query = query.eq('current_step', 2)
      }
    } else if (role === 'Accounting') {
      // Accounting (like Purchasing for PR) sees their own department OR any Approved PCs from all departments
      if (userDept) {
        query = query.or(`department_id.eq.${userDept},status.eq.Approved`)
      } else {
        query = query.eq('status', 'Approved')
      }
    } else if (role === 'Manager') {
      // Manager see only their own department's PCs
      if (userDept) {
        query = query.eq('department_id', userDept)
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Fallback to none
      }
    } else {
      // Requester see only their own PCs
      query = query.eq('requester_id', userId)
    }

    const { data } = await query
    setPcs(data || [])
    setLoading(false)
  }

  const filtered = search
    ? pcs.filter(
        (pc) =>
          pc.pc_number?.toLowerCase().includes(search.toLowerCase()) ||
          pc.title?.toLowerCase().includes(search.toLowerCase())
      )
    : pcs

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 border-l-4 border-amber-500 pl-4">เงินสดย่อย (Petty Cash)</h1>
          <p className="text-gray-500 text-sm mt-1 ml-5">จัดการและติดตามสถานะการเบิกเงินสดย่อย</p>
        </div>
        {isMounted && userRole && (
          <Link
            href="/petty-cash/create"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-100 text-sm active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            เบิกเงินสดย่อยใหม่
          </Link>
        )}
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {/* Search */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่เอกสาร หรือหัวข้อการเบิก..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all text-sm font-medium"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-[0.15em]">
                <th className="px-8 py-4">เลขที่เอกสาร</th>
                <th className="px-8 py-4">หัวข้อการเบิก</th>
                <th className="px-8 py-4">ผู้ขอเบิก</th>
                <th className="px-8 py-4">แผนก</th>
                <th className="px-8 py-4">สถานะ</th>
                <th className="px-8 py-4">วันที่ทำรายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
                    <p className="text-xs text-gray-400 mt-2 font-medium">กำลังค้นหาข้อมูล...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-300">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <Wallet className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="font-bold text-gray-400">ไม่พบรายการเงินสดย่อย</p>
                    <p className="text-xs mt-1">รายการที่คุณขอหรือต้องอนุมัติจะแสดงที่นี่</p>
                  </td>
                </tr>
              ) : (
                filtered.map((pc) => (
                  <tr key={pc.id} className="group hover:bg-amber-50/30 transition-all cursor-default">
                    <td className="px-8 py-4">
                      <Link href={`/petty-cash/${pc.id}`} className="text-sm font-black text-amber-600 hover:text-amber-700 transition-colors">
                        {pc.pc_number}
                      </Link>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors line-clamp-1">{pc.title}</p>
                    </td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {pc.users?.first_name?.charAt(0)}
                        </div>
                        <span className="text-sm text-gray-600 font-medium">
                          {pc.users?.first_name} {pc.users?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-sm text-gray-500 font-medium">{pc.departments?.name || '-'}</td>
                    <td className="px-8 py-4"><StatusBadge status={pc.status} /></td>
                    <td className="px-8 py-4 text-sm text-gray-400 font-medium">
                      {isMounted ? new Date(pc.created_at).toLocaleDateString('th-TH') : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
