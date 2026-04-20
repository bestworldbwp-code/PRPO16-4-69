'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, ShoppingCart, Loader2, Check, Clock, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/lib/constants'

export default function POListPage() {
  const router = useRouter()
  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [chains, setChains] = useState<any[]>([])

  useEffect(() => { 
    setIsMounted(true)
    const role = getCookie('user_role')
    setUserRole(role)
    if (role === 'Requester') {
      router.push('/')
      return
    }
    fetchPOs() 
    fetchChains()
  }, [])

  const fetchChains = async () => {
    const { data } = await supabase.from('approval_chains').select('*').eq('document_type', 'PO').eq('is_active', true)
    if (data) setChains(data)
  }

  const fetchPOs = async () => {
    setLoading(true)
    const userId = getCookie('user_id')
    const role = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let query = supabase
      .from('purchase_orders')
      .select('*, users!purchase_orders_created_by_fkey(first_name, last_name), purchase_requests(pr_number, department_id)')
      .order('created_at', { ascending: false })

    // Role-based filtering
    if (role === 'Admin' || role === 'Executive') {
      // Admin and Executive see all departments
      // (Note: we don't need additional filters here, just get all)
    } else if (role === 'Purchasing' || role === 'PurchasingManager') {
      // Purchasing see all POs (as they manage all procurement/orders)
    } else {
      // Manager see POs related to their department
      if (role === 'Manager' && userDept) {
        query = query.eq('department_id', userDept)
      } else {
        query = query.eq('created_by', userId)
      }
    }

    const { data } = await query
    setPos(data || [])
    setLoading(false)
  }

  const filtered = search
    ? pos.filter((po) =>
        po.po_number?.toLowerCase().includes(search.toLowerCase()) ||
        po.vendor_name?.toLowerCase().includes(search.toLowerCase())
      )
    : pos

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ใบสั่งซื้อ (PO)</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการและติดตามใบสั่งซื้อทั้งหมด</p>
        </div>
        {isMounted && (userRole === 'Purchasing' || userRole === 'Admin') && (
          <Link
            href="/po/create"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> สร้าง PO ใหม่
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ PO หรือ Vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-semibold">เลขที่ PO</th>
                <th className="px-6 py-3 font-semibold">อ้างอิง PR</th>
                <th className="px-6 py-3 font-semibold">Vendor</th>
                <th className="px-6 py-3 font-semibold">ผู้สร้าง</th>
                <th className="px-6 py-3 font-semibold">สถานะ</th>
                <th className="px-6 py-3 font-semibold">วันที่</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">ไม่พบข้อมูล</p>
                  </td>
                </tr>
              ) : (
                filtered.map((po) => {
                  let sortedChains = [...chains].sort((a,b) => a.step_order - b.step_order)
                  
                  // Handle Dynamic Routing: Remove Exec 2 (Step 3) if not required
                  if (po.requires_exec2 === false || po.requires_exec2 === null) {
                    sortedChains = sortedChains.filter(c => c.step_order !== 3)
                  }

                  const steps = [{ label: 'ผู้สร้าง', status: 'done' }]

                  let execCount = 0;
                  sortedChains.forEach(c => {
                    let s = 'waiting'
                    if (po.status === 'Approved' || po.current_step > c.step_order) s = 'done'
                    else if (po.status === 'Pending' && po.current_step === c.step_order) s = 'active'
                    else if (po.status === 'Rejected' && po.current_step === c.step_order) s = 'rejected'

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

                  return (
                    <tr key={po.id} className="hover:bg-emerald-50/30 transition-colors border-b border-gray-50 last:border-0">
                      <td className="px-6 py-4">
                        <Link href={`/po/${po.id}`} className="text-sm font-semibold text-emerald-600 hover:text-emerald-800">
                          {po.po_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {po.purchase_requests?.pr_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">{po.vendor_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {po.users?.first_name} {po.users?.last_name}
                      </td>
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
                        {isMounted ? new Date(po.created_at).toLocaleDateString('th-TH') : ''}
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
