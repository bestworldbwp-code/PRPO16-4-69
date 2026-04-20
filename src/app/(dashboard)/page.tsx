'use client'

import Link from 'next/link'
import { 
  FileText, ShoppingCart, Clock, AlertCircle, Plus, Loader2, CheckCircle, 
  Building2, Users, GitBranch, Settings, Wallet, Check, XCircle
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/constants'
import StatusBadge from '@/components/StatusBadge'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ prPending: 0, poPending: 0, prTotal: 0, poTotal: 0, pcPending: 0, prAwaitingPo: 0 })
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [myItems, setMyItems] = useState<any[]>([])
  const [awaitingPo, setAwaitingPo] = useState<any[]>([])
  const [chains, setChains] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    const userRole = getCookie('user_role') || ''
    const userName = getCookie('user_name') || ''
    setRole(userRole)
    setName(userName)
    fetchData(userRole)
  }, [])

  const fetchData = async (userRole: string) => {
    const userId = getCookie('user_id')
    if (!userId) { setLoading(false); return }

    // Get user profile including department
    const { data: profile } = await supabase
      .from('users')
      .select('department_id')
      .eq('id', userId)
      .single()

    // 1. Get all active approval chains to map roles to steps
    const { data: chainsData } = await supabase
      .from('approval_chains')
      .select('*')
      .eq('is_active', true)
      
    if (chainsData) setChains(chainsData)

    // Helper to find which steps this role is responsible for
    const getRoleSteps = (docType: string) => {
      return chainsData?.filter(c => c.document_type === docType && c.approver_role === userRole).map(c => c.step_order) || []
    }

    const prSteps = getRoleSteps('PR')
    const poSteps = getRoleSteps('PO')
    const pcSteps = getRoleSteps('PC')

    // 2. Fetch Pending items specifically for this user's role/step
    const pendingRequests = []

    const fetchPendingBySteps = async (table: string, type: string, steps: number[]) => {
      if (steps.length === 0 && userRole !== 'Admin') return []
      let query = supabase.from(table).select('*, departments(name)').eq('status', 'Pending')
      
      if (userRole !== 'Admin') {
         query = query.in('current_step', steps)
         // Filter by department only for 'Manager' (Regular Manager)
         if (userRole === 'Manager' && profile?.department_id) {
            query = query.eq('department_id', profile.department_id)
         }
         // Executives ('Executive') and Purchasing ('PurchasingManager') skip the department filter
         // because they act cross-departmentally (Executive for all, Purchasing for overall procurement).
      }
      
      const { data } = await query.order('created_at', { ascending: false }).limit(20)
      return data ? data.map(p => ({ ...p, type })) : []
    }

    const prData = await fetchPendingBySteps('purchase_requests', 'PR', prSteps)
    const poData = await fetchPendingBySteps('purchase_orders', 'PO', poSteps)
    const pcData = await fetchPendingBySteps('petty_cash', 'PC', pcSteps)

    pendingRequests.push(...prData, ...poData, ...pcData)

    // Sort combined list by date
    // @ts-ignore
    const sortedItems = pendingRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10)
    setPendingItems(sortedItems)

    // 3. Fetch My Requests (Items created by currentUser)
    const myRequests = []
    
    const fetchMyItems = async (table: string, type: string, userField: string, selectCols = '*, departments(name)') => {
      const { data } = await supabase.from(table).select(selectCols).eq(userField, userId).order('created_at', { ascending: false }).limit(10)
      return (data || []).map((p: any) => ({ ...p, type }))
    }
    
    // For PR, we want to know if it has been opened as PO yet
    const myPrData = await fetchMyItems('purchase_requests', 'PR', 'requester_id', '*, departments(name), purchase_orders(id)')
    const myPoData = await fetchMyItems('purchase_orders', 'PO', 'created_by')
    const myPcData = await fetchMyItems('petty_cash', 'PC', 'requester_id')
    
    myRequests.push(...myPrData, ...myPoData, ...myPcData)
    // @ts-ignore
    const sortedMyItems = myRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10)
    setMyItems(sortedMyItems)

    // 4. Fetch PRs awaiting PO (Only for Purchasing roles)
    let awaitingCount = 0;
    if (userRole === 'Purchasing' || userRole === 'PurchasingManager' || userRole === 'Admin') {
      const { data: approvedPrs } = await supabase
        .from('purchase_requests')
        .select('*, purchase_orders(pr_id), departments(name)')
        .eq('status', 'Approved')
      
      if (approvedPrs) {
        const awaiting = approvedPrs.filter(pr => !pr.purchase_orders || pr.purchase_orders.length === 0)
        awaitingCount = awaiting.length;
        setAwaitingPo(awaiting.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
      }
    }

    // 5. Stats logic (Summary counts)
    const { count: prTotal } = await supabase.from('purchase_requests').select('id', { count: 'exact', head: true })
    const { count: poTotal } = await supabase.from('purchase_orders').select('id', { count: 'exact', head: true })

    // Counts for things waiting for THIS user
    setStats({
      prPending: pendingRequests.filter(i => i.type === 'PR').length,
      poPending: pendingRequests.filter(i => i.type === 'PO').length,
      prTotal: prTotal || 0,
      poTotal: poTotal || 0,
      pcPending: pendingRequests.filter(i => i.type === 'PC').length,
      prAwaitingPo: awaitingCount,
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          สวัสดี, {name || 'User'} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          {ROLE_LABELS[role] || role} — นี่คือสรุปเอกสารที่เกี่ยวข้องกับคุณ
        </p>
      </div>

      {/* Stats */}
      {role === 'Requester' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
           <StatCard href="/pr" icon={FileText} label="PR ที่ฉันร้องขอ" value={myItems.filter(i => i.type === 'PR').length} color="blue" />
           <StatCard href="/petty-cash" icon={Wallet} label="PC ที่ฉันร้องขอ" value={myItems.filter(i => i.type === 'PC').length} color="amber" />
           <StatCard icon={Clock} label="กำลังรอดำเนินการ (Pending)" value={myItems.filter(i => i.status === 'Pending').length} color="slate" />
        </div>
      ) : role === 'Purchasing' ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
           <StatCard href="/pr" icon={FileText} label="PR รอการเปิด PO" value={stats.prAwaitingPo || 0} color="emerald" />
           <StatCard href="/po" icon={ShoppingCart} label="PO ที่ฉันสร้าง" value={myItems.filter(i => i.type === 'PO').length} color="blue" />
           <StatCard href="/petty-cash" icon={Wallet} label="PC ที่ฉันเบิก" value={myItems.filter(i => i.type === 'PC').length} color="amber" />
           <StatCard icon={Clock} label="รอการอนุมัติ (Pending)" value={myItems.filter(i => i.status === 'Pending').length} color="slate" />
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${(role === 'Purchasing' || role === 'PurchasingManager' || role === 'Admin') ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5`}>
          <StatCard href="/pr" icon={FileText} label="PR รอคุณอนุมัติ" value={stats.prPending} color="blue" />
          <StatCard href="/po" icon={ShoppingCart} label="PO รอคุณอนุมัติ" value={stats.poPending} color="emerald" />
          <StatCard href="/petty-cash" icon={Wallet} label="PC รอคุณอนุมัติ" value={stats.pcPending || 0} color="amber" />
          {(role === 'Purchasing' || role === 'PurchasingManager' || role === 'Admin') && (
             <StatCard href="/pr" icon={FileText} label="PR รอการเปิด PO" value={stats.prAwaitingPo || 0} color="emerald" />
          )}
          <StatCard icon={Clock} label="รอดำเนินการรวม" value={stats.prPending + stats.poPending + stats.pcPending} color="slate" />
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* PR Awaiting PO (Purchasing Only) - MOVED TO TOP */}
          {(role === 'Purchasing' || role === 'PurchasingManager' || role === 'Admin') && (
            <div className="bg-white rounded-3xl shadow-md border-2 border-orange-100 overflow-hidden flex flex-col relative">
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
              
              <div className="px-6 py-5 border-b border-orange-100 flex justify-between items-center bg-orange-50">
                <h3 className="font-bold text-orange-900 flex items-center gap-2 text-sm">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                  PR ที่รอการเปิดใบสั่งซื้อ (PO)
                </h3>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-200 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Action Required
                </span>
              </div>
              <div className="divide-y divide-gray-50 flex-1">
                {awaitingPo.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                     <p className="text-sm font-medium">ไม่มี PR ที่รอการเปิดเอกสารในขณะนี้</p>
                  </div>
                ) : (
                  awaitingPo.map((pr) => (
                    <Link
                      key={`awaiting-${pr.id}`}
                      href={`/pr/${pr.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/50 transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2.5 rounded-2xl shadow-sm group-hover:scale-110 transition-transform bg-orange-100 text-orange-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-orange-500 text-white bg-orange-500 shadow-sm shadow-orange-500/20">👉 ต้องสร้าง PO</span>
                            <p className="font-bold text-gray-900 text-sm truncate">{pr.pr_number}</p>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{pr.title} ({pr.departments?.name})</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-orange-600 bg-white border border-orange-200 px-3 py-1 rounded-full shadow-sm group-hover:bg-orange-500 group-hover:text-white transition-colors">เปิดใบสั่งซื้อเลย</span>
                        <p className="text-[9px] text-gray-400 font-medium mt-1">อนุมัติเมื่อ {new Date(pr.updated_at).toLocaleDateString('th-TH')}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Recent Items Waiting For Me (Hidden for Requesters & Purchasing Maker) */}
          {role !== 'Requester' && role !== 'Purchasing' && (
            <div className="bg-white rounded-3xl shadow-md border-2 border-blue-100 overflow-hidden flex flex-col relative">
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
              
              <div className="px-6 py-5 border-b border-blue-100 flex justify-between items-center bg-blue-50">
                <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                  เอกสารที่รออนุมัติจากคุณ
                </h3>
                <div className="flex gap-4 items-center">
                  <Link href="/pr" className="text-[10px] text-gray-400 hover:text-blue-600 font-bold uppercase tracking-wider">ใบขอซื้อ</Link>
                  <Link href="/po" className="text-[10px] text-gray-400 hover:text-emerald-600 font-bold uppercase tracking-wider">ใบสั่งซื้อ</Link>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-200 px-2 py-0.5 rounded-full uppercase tracking-widest hidden sm:block">Action Required</span>
                </div>
              </div>
            <div className="divide-y divide-gray-50 flex-1">
              {pendingItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">ไม่มีเอกสารที่รอคุณอนุมัติในขณะนี้</p>
                  <p className="text-[10px] uppercase tracking-widest mt-1">Great job! You're all caught up.</p>
                </div>
              ) : (
                pendingItems.map((item) => {
                  const isPR = item.type === 'PR'
                  const isPO = item.type === 'PO'
                  const isPC = item.type === 'PC'
                  
                  let link = `/pr/${item.id}`
                  if (isPO) link = `/po/${item.id}`
                  if (isPC) link = `/petty-cash/${item.id}`

                  const Icon = isPR ? FileText : isPO ? ShoppingCart : Wallet
                  const colorClass = isPR ? 'text-blue-600 bg-blue-50' : isPO ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                  const tagLabel = isPR ? 'PR' : isPO ? 'PO' : 'PC'

                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={link}
                      className="flex items-center justify-between px-6 py-4 hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2.5 rounded-2xl shadow-sm group-hover:scale-110 transition-transform ${colorClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-blue-500 text-white bg-blue-500 shadow-sm shadow-blue-500/20">👉 รออนุมัติ</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${colorClass} border-current`}>{tagLabel}</span>
                            <p className="font-bold text-gray-900 text-sm truncate">{item.pr_number || item.po_number || item.pc_number}</p>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{item.title || item.vendor_name || 'ไม่มีชื่อรายการ'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end gap-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">พิจารณาอนุมัติ</span>
                          <p className="text-[9px] text-gray-400 font-medium mt-1">รออนุมัติลำดับที่ {item.current_step}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
            </div>
          )}

          {/* My Requests */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-blue-50/30">
              <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-blue-500" />
                รายการเอกสารที่คุณร้องขอ
              </h3>
            </div>
            <div className="divide-y divide-gray-50 flex-1">
              {myItems.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                  <p className="text-sm font-medium">คุณยังไม่มีประวัติการส่งเอกสาร</p>
                </div>
              ) : (
                myItems.map((item) => {
                  const isPR = item.type === 'PR'
                  const isPO = item.type === 'PO'
                  const isPC = item.type === 'PC'
                  
                  let link = `/pr/${item.id}`
                  if (isPO) link = `/po/${item.id}`
                  if (isPC) link = `/petty-cash/${item.id}`

                  const Icon = isPR ? FileText : isPO ? ShoppingCart : Wallet
                  const colorClass = isPR ? 'text-blue-600 bg-blue-50' : isPO ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
                  const tagLabel = isPR ? 'PR' : isPO ? 'PO' : 'PC'
                  
                  // Helper to find who we are waiting for
                  const waitingForRole = chains.find(c => c.document_type === item.type && c.step_order === item.current_step)?.approver_role;
                  const waitingForLabel = waitingForRole ? ROLE_LABELS[waitingForRole] || waitingForRole : 'ดำเนินการ';

                  // Compile Stepper Data
                  const sortedChains = chains
                    .filter(c => c.document_type === item.type)
                    .sort((a,b) => a.step_order - b.step_order)
                  
                  const filteredChains = sortedChains.filter(c => {
                    if (item.type === 'PO' && !item.requires_exec2 && c.step_order === 3) return false
                    return true
                  })

                  const steps = [{ label: 'ผู้สร้าง', status: 'done' }]
                  let execCount = 0;
                  filteredChains.forEach(c => {
                    let s = 'waiting'
                    if (item.status === 'Approved' || item.current_step > c.step_order) s = 'done'
                    else if (item.status === 'Pending' && item.current_step === c.step_order) s = 'active'
                    else if (item.status === 'Rejected' && item.current_step === c.step_order) s = 'rejected'
                    
                    const roleName = ROLE_LABELS[c.approver_role as keyof typeof ROLE_LABELS] || c.approver_role
                    let shortName = roleName.replace('แผนก', '').trim()
                    
                    if (c.approver_role === 'Executive') {
                       execCount++
                       if (filteredChains.filter(x => x.approver_role === 'Executive').length > 1) {
                          shortName = execCount === 1 ? 'ผู้บริหาร 1' : 'ผู้บริหารสูงสุด'
                       }
                    }

                    steps.push({ label: shortName, status: s })
                  })

                  // Extra step for PR to see if PO has been opened
                  if (item.type === 'PR') {
                    const hasPO = item.purchase_orders && item.purchase_orders.length > 0;
                    steps.push({
                       label: 'เปิด PO',
                       status: hasPO ? 'done' : (item.status === 'Approved' ? 'active' : 'waiting')
                    })
                  }

                  return (
                    <div key={`my-${item.type}-${item.id}`} className="flex flex-col px-6 py-4 hover:bg-gray-50 transition-all group">
                      <div className="flex items-start justify-between w-full">
                        <Link href={link} className="flex items-center gap-4 min-w-0 flex-1 relative z-10 block">
                          <div className={`p-2.5 rounded-2xl shadow-sm group-hover:scale-110 transition-transform ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${colorClass} border-current`}>{tagLabel}</span>
                              <p className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">{item.pr_number || item.po_number || item.pc_number}</p>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{item.title || item.vendor_name || 'ไม่มีชื่อรายการ'}</p>
                          </div>
                        </Link>
                        
                        <div className="flex flex-col items-end gap-1.5 ml-4">
                          <div className="flex items-center gap-2">
                             {item.status === 'Pending' && item.current_step > 0 && (
                               <span className="text-[10px] text-gray-500 font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm whitespace-nowrap">
                                 รอ: {waitingForLabel}
                               </span>
                             )}
                             <StatusBadge status={item.status} className="text-[10px] px-2 py-0.5" />
                          </div>
                          <p className="text-[9px] text-gray-400 font-medium">เมื่อ {new Date(item.created_at).toLocaleDateString('th-TH')}</p>
                        </div>
                      </div>
                      
                      {/* Details Box for Horizontal Stepper */}
                      <details className="mt-3 group/stepper z-20" style={{ cursor: 'pointer' }}>
                        <summary className="text-[10px] font-bold text-gray-500 hover:text-blue-600 list-none flex items-center gap-1.5 w-max outline-none select-none bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm hover:shadow transition-all">
                          <GitBranch className="w-3 h-3 text-gray-400 group-hover/stepper:text-blue-500" /> 
                          ดูเส้นทางสถานะ
                        </summary>
                        <div className="mt-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                          <div className="flex items-center gap-1 w-max">
                            {steps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-1">
                                <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border shadow-sm ${
                                  step.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                  step.status === 'active' ? 'bg-blue-500 text-white border-blue-600 shadow-blue-200 animate-pulse' : 
                                  step.status === 'rejected' ? 'bg-red-500 text-white border-red-600' : 
                                  'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                                }`}>
                                  {step.status === 'done' && <Check className="w-2.5 h-2.5" />}
                                  {step.status === 'active' && <Clock className="w-2.5 h-2.5" />}
                                  {step.status === 'rejected' && <XCircle className="w-2.5 h-2.5" />}
                                  {step.label}
                                </div>
                                {idx < steps.length - 1 && (
                                  <div className={`w-2 h-0.5 rounded-full ${steps[idx].status === 'done' ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                  )
                })
              )}
            </div>
          </div>


        </div>

        {/* Quick Actions & Others */}
        <div className="space-y-6">
          {/* Admin Panel (Restored) */}
          {role === 'Admin' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl"></div>
              <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-500" /> แผงควบคุมผู้ดูแลระบบ
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/admin/vendors" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100 group">
                  <Building2 className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase text-center">ซัพพลายเออร์</span>
                </Link>
                <Link href="/admin/departments" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 group">
                  <Building2 className="w-6 h-6 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase text-center">จัดการแผนก</span>
                </Link>
                <Link href="/admin/users" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100 group">
                  <Users className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase text-center">ผู้ใช้งาน</span>
                </Link>
                <Link href="/admin/workflows" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-amber-50 transition-all border border-transparent hover:border-amber-100 group">
                  <GitBranch className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase text-center">สายอนุมัติ</span>
                </Link>
                <Link href="/admin/settings" className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 text-white hover:bg-black transition-all group">
                  <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                  <span className="text-xs font-bold uppercase tracking-widest">ตั้งค่าระบบส่วนกลาง</span>
                </Link>
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl shadow-gray-200 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
            <h3 className="text-sm font-bold mb-5 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" /> เมนูด่วน (Quick Actions)
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <Link href="/pr/create" className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold">สร้างใบขอซื้อ (PR)</span>
              </Link>
              
              <Link href="/petty-cash/create" className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold">เบิกเงินสดย่อย (PC)</span>
              </Link>

              {(role === 'Purchasing' || role === 'Admin' || role === 'PurchasingManager') && (
                <Link href="/po/create" className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold">สร้างใบสั่งซื้อ (PO)</span>
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
             <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-red-500" /> ข้อมูลระบบ
             </h3>
             <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                   <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">สถานะโครงการ</p>
                   <p className="text-sm font-bold text-gray-800">PR/PO System V2.0</p>
                   <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-blue-500 h-full w-[85%] rounded-full"></div>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-2">เสร็จสิ้นความต้องการพื้นฐาน (85%)</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, href }: { icon: any; label: string; value: number; color: string; href?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-gray-50 text-gray-500',
  }
  
  const content = (
    <div className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all ${href ? 'hover:shadow-md cursor-pointer hover:border-gray-200 group' : ''}`}>
      <div className={`p-3 rounded-xl ${colorMap[color]} ${href ? 'group-hover:scale-110 transition-transform' : ''}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className={`text-xs font-semibold text-gray-400 uppercase tracking-wide ${href ? 'group-hover:text-gray-600 transition-colors' : ''}`}>{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="flex-1 block">{content}</Link>
  }

  return content;
}

