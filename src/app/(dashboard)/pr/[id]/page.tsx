'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Loader2, Printer, Trash2, ShoppingCart, Check, Download, ExternalLink, Paperclip, File, Image as ImageIcon, Archive, Edit3, ArrowRight } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS, STATUS_LABELS } from '@/lib/constants'
import { notifyByRole, notifyUser } from '@/lib/notifications'

export default function PRDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const isSubmitting = useRef(false)
  const [pr, setPr] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [chain, setChain] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canApprove, setCanApprove] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [po, setPo] = useState<any>(null)
  
  // New: Item Rejection States (for current session)
  const [rejectedItemIds, setRejectedItemIds] = useState<Set<string>>(new Set())
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({})
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    setUserRole(getCookie('user_role') || '')
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    // Fetch PR
    const { data: prData, error: prErr } = await supabase
      .from('purchase_requests')
      .select('*, users!purchase_requests_requester_id_fkey(first_name, last_name, signature), departments(name)')
      .eq('id', id)
      .single()

    if (prErr || !prData) {
      setError('ไม่พบข้อมูลใบขอซื้อ')
      setLoading(false)
      return
    }

    // Role-based access control check
    const userId = getCookie('user_id')
    const role = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let isAuthorized = false
    if (role === 'Admin' || role === 'Purchasing' || role === 'PurchasingManager') {
      isAuthorized = true
    } else if (role === 'Executive') {
      const { data: userLogs } = await supabase
        .from('approval_logs')
        .select('id')
        .eq('document_id', id)
        .eq('approver_id', userId)
        .limit(1)
      
      const hasSigned = !!(userLogs && userLogs.length > 0)
      isAuthorized = prData.current_step === 2 || hasSigned || prData.status === 'Approved'
    } else if (role === 'Manager') {
      isAuthorized = prData.department_id === userDept
    } else {
      isAuthorized = prData.requester_id === userId
    }

    if (!isAuthorized) {
      setError('คุณไม่มีสิทธิ์เข้าถึงเอกสารฉบับนี้')
      setLoading(false)
      return
    }

    setPr(prData)

    // Fetch items
    const { data: itemsData } = await supabase
      .from('pr_items')
      .select('*')
      .eq('pr_id', id)
      .order('created_at')
    setItems(itemsData || [])

    // Fetch approval chain for PR
    const { data: chainData } = await supabase
      .from('approval_chains')
      .select('*')
      .eq('document_type', 'PR')
      .eq('is_active', true)
      .order('step_order')
    setChain(chainData || [])

    // Fetch approval logs
    const { data: logsData } = await supabase
      .from('approval_logs')
      .select('*, users!approval_logs_approver_id_fkey(first_name, last_name, signature)')
      .eq('document_type', 'PR')
      .eq('document_id', id)
      .order('step_order')
    setLogs(logsData || [])

    // Reset approval status before check
    setCanApprove(false)

    // Check if current user can approve
    if (prData.status === 'Pending') {
      const currentStep = chainData?.find((c: any) => c.step_order === prData.current_step)
      if (role === 'Admin') {
        setCanApprove(true)
      } else if (currentStep && currentStep.approver_role === role) {
        if (role === 'Manager') {
          setCanApprove(userDept === prData.department_id)
        } else {
          setCanApprove(true)
        }
      }
    }

    // Fetch connected PO
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('pr_id', id)
      .maybeSingle()
    setPo(poData)

    setLoading(false)
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (isSubmitting.current || actionLoading) return
    isSubmitting.current = true
    setActionLoading(true)
    setCanApprove(false) // Disable button immediately to prevent double clicks

    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      const { error: logErr } = await supabase.from('approval_logs').insert({
        document_type: 'PR',
        document_id: id,
        step_order: pr.current_step,
        approver_id: userId,
        action,
        comment: comment.trim() || null,
      })

      // If it's a unique constraint violation, it means it's already approved/logged.
      // We should continue to update status/notify instead of throwing error.
      if (logErr && logErr.code !== '23505') {
        setCanApprove(true) // Re-enable if other error occurs
        throw logErr
      }
      
      // Update Item Rejection Status in DB
      if (action === 'approve') {
        const itemUpdates = items.map(item => ({
          id: item.id,
          pr_id: item.pr_id,
          item_code: item.item_code,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          is_rejected: rejectedItemIds.has(item.id) || item.is_rejected,
          reject_reason: itemReasons[item.id] || item.reject_reason || null
        }))

        for (const item of itemUpdates) {
          await supabase.from('pr_items').update({
            is_rejected: item.is_rejected,
            reject_reason: item.reject_reason
          }).eq('id', item.id)
        }
      }

      // Final status update bit for the PR (moved to after log insert)
      // Check if this was the last step
      const nextStep = chain.find((c) => c.step_order > pr.current_step)
      if (action === 'reject') {
        await supabase.from('purchase_requests').update({ 
          status: 'Rejected',
          updated_at: new Date().toISOString()
        }).eq('id', id)
      } else {
        if (!nextStep) {
          await supabase.from('purchase_requests').update({ 
            status: 'Approved',
            updated_at: new Date().toISOString()
          }).eq('id', id)
        } else {
          await supabase.from('purchase_requests').update({ 
            current_step: nextStep.step_order,
            updated_at: new Date().toISOString()
          }).eq('id', id)
        }
      }

      // Send LINE notification
      const actionText = action === 'approve' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      const baseMessage = `📢 อัปเดตสถานะ PR: ${pr.pr_number}\n` +
                          `--------------------------\n` +
                          `เรื่อง: ${pr.title}\n` +
                          `ผลการพิจารณา: ${actionText}\n` +
                          `โดย: ${getCookie('user_name')}\n` +
                          (comment.trim() ? `ความเห็น: "${comment.trim()}"` : '')

      if (action === 'reject') {
        await notifyUser(pr.requester_id, baseMessage + `\nสถานะ: ถูกตีกลับ (Rejected)`)
      } else {
        if (nextStep) {
          // Notify next approver
          try {
            await notifyByRole({ 
              role: nextStep.approver_role, 
              departmentId: nextStep.approver_role === 'Manager' ? pr.department_id : undefined,
              message: baseMessage + `\nสถานะ: รอ ${nextStep.step_name} ตรวจสอบ` 
            })
          } catch (notifErr) {
            console.warn('LINE Notification failed, but process continues:', notifErr)
          }
          await notifyUser(pr.requester_id, baseMessage + `\nสถานะ: ผ่านการพิจารณา และส่งต่อแล้ว`)
        } else {
          await notifyUser(pr.requester_id, baseMessage + `\nสถานะ: อนุมัติใบขอซื้อเสร็จสมบูรณ์!`)
        }
      }

      setComment('')
      setRejectedItemIds(new Set())
      setItemReasons({})
      await fetchData()
    } catch (err: any) {
      console.error('Approval Error:', err)
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง'))
      setCanApprove(true)
    } finally {
      setActionLoading(false)
      isSubmitting.current = false
    }
  }

  const currentUserId = getCookie('user_id')
  const currentUserRole = getCookie('user_role')
  const canSeeReason = pr && (pr.requester_id === currentUserId || currentUserRole === 'Admin')

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-gray-500 font-medium font-sans uppercase tracking-widest text-[10px]">กำลังเตรียมเอกสาร...</p>
    </div>
  )

  if (error) return (
    <div className="max-w-xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-gray-100 text-center font-sans">
      <h1 className="text-xl font-black text-gray-900 uppercase">Error</h1>
      <p className="text-gray-500 mt-1 font-bold">{error}</p>
      <Link href="/pr" className="inline-flex mt-6 items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
        Back to List
      </Link>
    </div>
  )

  return (
    <div className="bg-slate-100 min-h-screen p-2 sm:p-5 print:p-0 print:bg-white pb-32 font-sans font-medium text-gray-900">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Ms+Madi&family=Playfair+Display:ital,wght@1,900&display=swap');
        .font-signature { font-family: 'Ms Madi', cursive; }
        @media print {
          * { filter: none !important; box-shadow: none !important; }
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          @page { size: A4; margin: 0; }
          .paper-document { min-height: 297mm; padding: 10mm !important; }
          .signature-section { margin-top: auto; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          .rejected-item { text-decoration: line-through !important; color: #94a3b8 !important; }
          .reject-reason-print { font-size: 8px; color: #ef4444; font-style: italic; display: block; margin-top: 2px; }
        }
      `}</style>

      {/* Navigation (Screen Only) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link href="/pr" className="text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-1 group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> กลับ
        </Link>
        <div className="flex gap-2">
          {((getCookie('user_id') === pr.requester_id) || getCookie('user_role') === 'Admin') && pr.status !== 'Approved' && pr.current_step === 1 && (
            <Link href={`/pr/${id}/edit`} className="bg-white border border-gray-100 text-gray-500 hover:text-blue-600 px-6 py-3 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-gray-100">
              <Edit3 size={16} strokeWidth={3} /> แก้ไขข้อมูล
            </Link>
          )}
          <button onClick={() => window.print()} className="px-8 py-3 bg-blue-600 hover:bg-black text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-xl shadow-blue-200">
            <Printer size={16} /> พิมพ์ใบ PR (ISO)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[210mm_1fr] gap-6 max-w-[1300px] mx-auto items-start">
        {/* Paper Document */}
        <div className="paper-document bg-white shadow-2xl p-[8mm] min-h-[297mm] flex flex-col relative print:shadow-none print:p-0 print:max-w-full mx-auto w-full border border-gray-100 print:border-none animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
              <div>
                <h1 className="text-[17px] font-black leading-none">บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</h1>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight mt-1">328 ม.6 ต.คลองนิยมยาตรา อ.บางบ่อ จ.สมุทรปราการ 10560</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black border border-black px-2 py-0.5 uppercase tracking-widest mb-1 bg-gray-50 inline-block">ต้นฉบับ (Original)</div>
              <div className="text-[8px] text-gray-300 font-bold uppercase tracking-widest block">หน้า 1 จาก 1</div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-lg font-black border-2 border-black inline-block px-12 py-1.5 rounded-xl uppercase tracking-[0.2em] leading-none bg-white">
              ใบขอซื้อ (Purchase Request)
            </h2>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 border border-black mb-4 text-[11px] shadow-sm">
            <div className="p-2 border-r border-b border-black flex items-baseline gap-2">
               <span className="text-[8.5px] font-black uppercase text-gray-400 w-24">เลขที่เอกสาร:</span>
               <span className="font-black text-[15px] leading-none tracking-tight">{pr.pr_number}</span>
            </div>
            <div className="p-2 border-b border-black flex items-baseline gap-2">
               <span className="text-[8.5px] font-black uppercase text-gray-400 w-20">ผู้ขอซื้อ:</span>
               <span className="font-bold text-gray-800">{pr.users?.first_name} {pr.users?.last_name}</span>
            </div>
            <div className="p-2 border-r border-black flex items-baseline gap-2">
               <span className="text-[8.5px] font-black uppercase text-gray-400 w-24">วันที่ขอ:</span>
               <span className="font-bold text-gray-800">{new Date(pr.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="p-2 flex items-baseline gap-2">
               <span className="text-[8.5px] font-black uppercase text-gray-400 w-20">แผนก:</span>
               <span className="font-bold text-gray-800">{pr.departments?.name || '-'}</span>
            </div>
            <div className="p-2 col-span-2 border-t border-black bg-gray-50/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[8.5px] font-black uppercase text-gray-400">วันที่ต้องการสินค้า:</span>
                <span className="font-black text-red-600 text-[12px]">{pr.created_at ? new Date(new Date(pr.created_at).getTime() + 13*24*60*60*1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
              </div>
              <span className="text-[8px] text-gray-300 font-bold italic tracking-tighter uppercase">(ISO Standard Process Time: 14 Days)</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-4">
            <table className="w-full border-collapse border border-black font-sans">
              <thead>
                <tr className="bg-gray-100/50 text-[8.5px] font-black uppercase tracking-widest leading-none">
                  <th className="border border-black p-2 w-8 text-center">#</th>
                  <th className="border border-black p-2 w-24 text-center">รหัส</th>
                  <th className="border border-black p-2 text-left">รายละเอียดสินค้า (ITEM DESCRIPTION)</th>
                  <th className="border border-black p-2 w-16 text-center">จำนวน</th>
                  <th className="border border-black p-2 w-16 text-center">หน่วย</th>
                  <th className="border border-black p-2 w-20 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(item => {
                  if (!item.is_rejected) return true;
                  // If rejected, only original requester, admin, or purchasing can see it.
                  const uid = getCookie('user_id');
                  if (userRole === 'Admin' || userRole === 'Purchasing' || userRole === 'PurchasingManager' || uid === pr?.requester_id) return true;
                  // If current user is the one who rejected it, let them see it too (optional, but good for Manager who rejected it)
                  // We'll just strictly hide for next approver as requested
                  return false;
                }).map((item, i) => {
                  const isMarkedRejected = rejectedItemIds.has(item.id)
                  const isSavedRejected = item.is_rejected
                  const isRejected = isMarkedRejected || isSavedRejected
                  const reason = itemReasons[item.id] || item.reject_reason

                  return (
                    <tr key={item.id} className={`text-[11px] leading-tight ${isRejected ? 'bg-red-50/50' : ''}`}>
                      <td className={`border border-black py-1.5 text-center text-gray-300 font-bold ${isRejected ? 'rejected-item' : ''}`}>{i + 1}</td>
                      <td className={`border border-black py-1.5 text-center font-bold text-gray-400 uppercase ${isRejected ? 'rejected-item' : ''}`}>{item.item_code || '-'}</td>
                      <td className="border border-black px-4 py-1.5 align-top">
                        <div className="flex flex-col">
                          <span className={`font-bold text-gray-900 leading-none ${isRejected ? 'rejected-item' : ''}`}>{item.description}</span>
                          {reason && canSeeReason && <span className="text-[9px] text-red-500 font-bold italic mt-1 reject-reason-print">ไม่อนุมัติเนื่องจาก: {reason}</span>}
                        </div>
                      </td>
                      <td className={`border border-black py-1.5 text-center font-black text-blue-800 ${isRejected ? 'rejected-item' : ''}`}>{item.quantity}</td>
                      <td className={`border border-black py-1.5 text-center font-bold text-gray-600 ${isRejected ? 'rejected-item' : ''}`}>{item.unit}</td>
                      <td className="border border-black py-1.5 text-center align-middle px-1">
                        {canApprove && !isSavedRejected ? (
                          <div className="flex flex-col gap-1 items-center">
                            <button
                              onClick={() => {
                                const newSet = new Set(rejectedItemIds)
                                if (newSet.has(item.id)) newSet.delete(item.id)
                                else newSet.add(item.id)
                                setRejectedItemIds(newSet)
                              }}
                              className={`print:hidden w-full py-1 rounded text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                                isMarkedRejected 
                                ? 'bg-red-50 text-red-600 border border-red-200 shadow-inner' 
                                : 'bg-white text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                              }`}
                            >
                              <XCircle size={10} strokeWidth={isMarkedRejected ? 3 : 2} />
                              {isMarkedRejected ? 'ยกเลิก (Undo)' : 'ไม่อนุมัติ'}
                            </button>
                            <div className="hidden print:inline-flex items-center gap-1 text-[7.5px] font-black uppercase tracking-tighter">
                              {isMarkedRejected ? <XCircle size={10} className="text-red-500" strokeWidth={4} /> : <Check size={10} className="text-emerald-600" strokeWidth={4} />}
                              <span className={isMarkedRejected ? 'text-red-500' : 'text-emerald-600'}>{isMarkedRejected ? 'ไม่อนุมัติ' : 'อนุมัติ'}</span>
                            </div>
                            {isMarkedRejected && (
                              <input
                                type="text"
                                placeholder="ระบุเหตุผล..."
                                value={itemReasons[item.id] || ''}
                                onChange={(e) => setItemReasons({...itemReasons, [item.id]: e.target.value})}
                                className="print:hidden w-full text-[8.5px] px-2 py-1 border-b-2 border-red-200 outline-none focus:border-red-500 bg-transparent font-bold !text-red-600 placeholder:text-red-200"
                              />
                            )}
                          </div>
                        ) : (
                          <div className={`inline-flex items-center gap-1 text-[7.5px] font-black uppercase tracking-tighter ${
                            isRejected ? 'text-red-500' : (pr.status === 'Rejected' ? 'text-gray-400' : 'text-emerald-600')
                          }`}>
                            {isRejected ? <XCircle size={10} strokeWidth={4} /> : (pr.status === 'Rejected' ? <XCircle size={10} strokeWidth={4} /> : <Check size={10} strokeWidth={4} />)}
                            {isRejected ? 'ไม่อนุมัติ' : (pr.status === 'Rejected' ? 'ตกไป' : (pr.status === 'Pending' ? 'ผ่าน (รอดำเนินการ)' : 'อนุมัติผ่าน'))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                   <tr key={`filler-${i}`} className="h-7">
                     <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-l-4 border-black bg-gray-50/50 p-3 mb-6 flex gap-4 items-center rounded-r-lg">
            <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-widest shrink-0">หมายเหตุ:</span>
            <span className="text-[11px] font-bold text-gray-600 italic leading-none truncate">"{pr.description || 'รอดำเนินการตรวจสอบตามระบบ ISO ONLINE'}"</span>
          </div>

          <div className="signature-section mt-auto grid grid-cols-3 gap-10 pt-4 pb-10">
            <SignatureColumn title="ผู้ขอซื้อ" name={pr.users?.first_name + ' ' + pr.users?.last_name} signature={pr.users?.signature} date={pr.created_at} />
            <SignatureColumn title="ผู้จัดการฝ่าย" stepOrder={1} logs={logs} roleLabel={`ผจก.ฝ่าย ${pr.departments?.name || ''}`} />
            <SignatureColumn title="ผู้บริหารระดับสูง" stepOrder={2} logs={logs} roleLabel="CEO Approval" />
          </div>

          <div className="absolute bottom-6 right-8 text-[8.5px] font-black border-t border-gray-100 pt-1 uppercase tracking-[0.4em] text-gray-300">
            FQP-PUR-01:04 Rev.02
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6 print:hidden">
          {/* Action Box */}
          {canApprove && (
            <div className="w-full mt-2 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-20">
               <div className="bg-white border border-gray-200 shadow-sm rounded-[2rem] p-6 lg:p-8 flex flex-col gap-5 relative overflow-hidden">
                 <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                 
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={18} /></div>
                    <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">การพิจารณาอนุมัติเอกสาร</h3>
                 </div>
                 
                 <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็นประกอบการพิจารณา (ทางเลือก)..." rows={2} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium resize-none min-h-[50px] leading-relaxed" />
                 
                 <div className="flex flex-col gap-3 mt-2">
                    <button onClick={() => handleAction('approve')} disabled={actionLoading} className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"><CheckCircle2 size={18} strokeWidth={2.5} /> อนุมัติและลงนาม</button>
                    <button onClick={() => handleAction('reject')} disabled={actionLoading} className="py-3.5 bg-white text-red-500 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-red-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"><XCircle size={18} strokeWidth={2.5} /> ปฏิเสธ</button>
                 </div>
               </div>
            </div>
          )}

          {/* Attachments Sidebar */}
          {pr.attachments && pr.attachments.length > 0 && (
            <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-xl animate-in fade-in duration-700">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
                  <Paperclip size={20} />
                </div>
                <h3 className="font-black text-gray-900 text-[11px] uppercase tracking-widest">เอกสารแนบประกอบ ({pr.attachments.length})</h3>
              </div>
              
              <div className="space-y-3">
                {pr.attachments.map((file: any, index: number) => (
                  <a 
                    key={index}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-200 hover:bg-white transition-all group"
                  >
                    <div className="shrink-0 group-hover:scale-110 transition-transform">
                      {file.type?.includes('image') ? <ImageIcon size={18} className="text-blue-500" /> : 
                       file.type?.includes('pdf') ? <FileText size={18} className="text-red-500" /> : 
                       file.type?.includes('zip') ? <Archive size={18} className="text-amber-500" /> :
                       <File size={18} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-800 truncate pr-2">{file.name}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">
                        {file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'ดูไฟล์'}
                      </p>
                    </div>
                    <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                  </a>
                ))}
              </div>
              <p className="mt-4 text-[9px] text-gray-300 font-bold italic text-center uppercase tracking-widest">คลิกชื่อไฟล์เพื่อเปิดดูในแท็บใหม่</p>
            </div>
          )}

          {/* Connected Documents Link */}
          {po && (
            <Link href={`/po/${po.id}`} className="block group">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-[2rem] p-8 text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <ShoppingCart size={24} />
                  </div>
                  <ExternalLink size={20} className="opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-black text-[10px] uppercase tracking-[0.3em] opacity-50 mb-1">เอกสารที่สร้างขึ้น</h3>
                <p className="text-xl font-black mb-1">{po.po_number}</p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">ใบสั่งซื้อ (PO)</span>
                </div>
              </div>
            </Link>
          )}

          {/* Create PO Action (If PO isn't created yet) */}
          {!po && pr?.status === 'Approved' && (userRole === 'Purchasing' || userRole === 'PurchasingManager' || userRole === 'Admin') && (
            <Link href={`/po/create?pr_id=${pr?.id}`} className="block group">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2rem] p-8 text-white shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-inner border border-white/10 group-hover:bg-white/20 transition-colors">
                    <ShoppingCart size={24} className="text-emerald-50" />
                  </div>
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={20} className="text-white" />
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-emerald-100 mb-1">ขั้นตอนถัดไป</h3>
                  <p className="text-xl font-black mb-1 text-white leading-none">ออกใบสั่งซื้อ (PO)</p>
                  <p className="text-[11px] text-emerald-100/80 mt-2 font-medium">นำข้อมูลจากใบขอซื้อนี้ไปตั้งต้นเป็นใบสั่งซื้อ</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function SignatureColumn({ title, name, signature, date, stepOrder, logs, roleLabel }: any) {
  const log = stepOrder ? logs?.find((l: any) => l.step_order === stepOrder && l.action === 'approve') : null
  const dispSig = log ? log.users?.signature : signature
  const dispName = log ? `( ${log.users?.first_name} ${log.users?.last_name} )` : `( ${name || roleLabel} )`
  const dispDate = log ? new Date(log.created_at).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (date ? new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

  return (
    <div className="text-center space-y-2">
      <p className="text-[8.5px] font-black uppercase tracking-widest text-gray-300">{title}</p>
      <div className="h-12 flex flex-col items-center justify-end border-b-2 border-black border-dotted relative pb-1">
        {dispSig ? (
          <img src={dispSig} alt="Sig" className="max-h-12 object-contain mb-0.5 drop-shadow-sm scale-110" />
        ) : (
          (!stepOrder || log) && <span className="font-signature text-3xl opacity-60 text-emerald-950/60 leading-none">{log ? log.users?.first_name : name}</span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <p className="text-[12px] font-black text-gray-900 leading-none">{dispName}</p>
        {log ? (
          <div className="text-emerald-600 flex flex-col items-center leading-none mt-2">
            <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mb-0.5">อนุมัติออนไลน์</span>
            <span className="text-[7.5px] font-bold opacity-60 font-mono italic">{dispDate}</span>
          </div>
        ) : (
          <p className="text-[8px] text-gray-400 font-bold mt-1 uppercase leading-none">{dispDate ? `เมื่อ: ${dispDate}` : ''}</p>
        )}
      </div>
    </div>
  )
}
