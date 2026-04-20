'use client'

import Link from 'next/link'
import { Plus, Search, FileText, Loader2, Check, Clock, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/lib/constants'

export default function PRListPage() {
  const [prs, setPrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [chains, setChains] = useState<any[]>([])

  useEffect(() => {
    setIsMounted(true)
    setUserRole(getCookie('user_role'))
    fetchPRs()
    fetchChains()
  }, [])

  const fetchChains = async () => {
    const { data } = await supabase.from('approval_chains').select('*').eq('document_type', 'PR').eq('is_active', true)
    if (data) setChains(data)
  }

  const fetchPRs = async () => {
    setLoading(true)
    const userId = getCookie('user_id')
    const role = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let query = supabase
      .from('purchase_requests')
      .select('id, pr_number, title, status, created_at, requester_id, department_id, current_step, users!purchase_requests_requester_id_fkey(first_name, last_name), departments(name), purchase_orders(id)')
      .order('created_at', { ascending: false })

    // Role-based filtering
    if (role === 'Admin') {
      // Admin sees everything
    } else if (role === 'Executive') {
      // Executive sees PRs at their step (2) OR PRs they've already approved (Logs)
      const { data: logs } = await supabase
        .from('approval_logs')
        .select('document_id')
        .eq('approver_id', userId)
        .eq('document_type', 'PR')
      
      const logIds = logs?.map(l => l.document_id) || []
      
      if (logIds.length > 0) {
        query = query.or(`current_step.eq.2,id.in.(${logIds.map(id => `"${id}"`).join(',')})`)
      } else {
        query = query.eq('current_step', 2)
      }
    } else if (role === 'Purchasing' || role === 'PurchasingManager') {
      // Purchasing sees their own department OR any Approved PRs from all departments
      if (userDept) {
        query = query.or(`department_id.eq.${userDept},status.eq.Approved`)
      } else {
        query = query.eq('status', 'Approved')
      }
    } else if (role === 'Manager') {
      // Manager see only their own department's PRs
      if (userDept) query = query.eq('department_id', userDept)
      else query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Fallback to none
    } else {
      // Requester see only their own PRs
      query = query.eq('requester_id', userId)
    }

    const { data } = await query
    setPrs(data || [])
    setLoading(false)
  }

  const filtered = search
    ? prs.filter(
        (pr) =>
          pr.pr_number?.toLowerCase().includes(search.toLowerCase()) ||
          pr.title?.toLowerCase().includes(search.toLowerCase())
      )
    : prs

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ใบขอซื้อ (PR)</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการและติดตามสถานะใบขอซื้อทั้งหมด</p>
        </div>
        {isMounted && userRole && (
          <Link
            href="/pr/create"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            สร้าง PR ใหม่
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ PR หรือหัวข้อ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">เลขที่ PR</th>
                <th className="px-6 py-3 font-semibold">หัวข้อ</th>
                <th className="px-6 py-3 font-semibold">ผู้ขอซื้อ</th>
                <th className="px-6 py-3 font-semibold">แผนก</th>
                <th className="px-6 py-3 font-semibold">สถานะ</th>
                <th className="px-6 py-3 font-semibold">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">ไม่พบข้อมูล</p>
                  </td>
                </tr>
              ) : (
                filtered.map((pr) => {
                  const sortedChains = [...chains].sort((a,b) => a.step_order - b.step_order)
                  const steps = [{ label: 'ผู้สร้าง', status: 'done' }]

                  let execCount = 0;
                  sortedChains.forEach(c => {
                    let s = 'waiting'
                    if (pr.status === 'Approved' || pr.current_step > c.step_order) s = 'done'
                    else if (pr.status === 'Pending' && pr.current_step === c.step_order) s = 'active'
                    else if (pr.status === 'Rejected' && pr.current_step === c.step_order) s = 'rejected'

                    const roleName = ROLE_LABELS[c.approver_role] || c.approver_role
                    let shortName = roleName.replace('แผนก', '').trim()

                    if (c.approver_role === 'Executive') {
                         execCount++
                         if (sortedChains.filter(x => x.approver_role === 'Executive').length > 1) {
                              shortName = execCount === 1 ? 'ผู้บริหาร 1' : 'ผู้บริหารสูงสุด'
                         }
                    }

                    steps.push({ label: shortName, status: s })
                  })

                  // Final step to check if PO is opened
                  const hasPO = pr.purchase_orders && pr.purchase_orders.length > 0;
                  steps.push({ 
                    label: 'เปิด PO', 
                    status: hasPO ? 'done' : (pr.status === 'Approved' ? 'active' : 'waiting') 
                  })

                  return (
                    <tr key={pr.id} className="hover:bg-blue-50/30 transition-colors border-b border-gray-50 last:border-0">
                      <td className="px-6 py-4">
                        <Link href={`/pr/${pr.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                          {pr.pr_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">{pr.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {pr.users?.first_name} {pr.users?.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{pr.departments?.name || '-'}</td>
                      <td className="px-6 py-4">
                        {/* Stepper Work Flow */}
                        <div className="flex items-center gap-1 w-max">
                          {steps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border shadow-sm ${
                                step.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                step.status === 'active' ? 'bg-blue-500 text-white border-blue-600 shadow-blue-200 animate-pulse' : 
                                step.status === 'rejected' ? 'bg-red-500 text-white border-red-600' : 
                                'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                              }`}>
                                {step.status === 'done' && <Check className="w-3 h-3" />}
                                {step.status === 'active' && <Clock className="w-3 h-3" />}
                                {step.status === 'rejected' && <XCircle className="w-3 h-3" />}
                                {step.label}
                                {step.status === 'done' && idx > 0 && <span className="opacity-70 ml-0.5">(อนุมัติ)</span>}
                              </div>
                              {idx < steps.length - 1 && (
                                <div className={`w-3 h-0.5 rounded-full ${steps[idx].status === 'done' ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                        {isMounted ? new Date(pr.created_at).toLocaleDateString('th-TH') : ''}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
