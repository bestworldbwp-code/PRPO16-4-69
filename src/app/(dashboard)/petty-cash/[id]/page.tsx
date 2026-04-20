'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Clock, Wallet, Loader2, Printer, Trash2, Paperclip, ExternalLink, Image as ImageIcon, File, Archive, Download, FileText, Edit3 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/lib/constants'
import { notifyByRole, notifyUser } from '@/lib/notifications'
import { bahttext } from '@/lib/utils'

export default function PettyCashDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const isSubmitting = useRef(false)
  const [pc, setPc] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [chain, setChain] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canApprove, setCanApprove] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  
  // New: Item Rejection States
  const [rejectedItemIds, setRejectedItemIds] = useState<Set<string>>(new Set())
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    // Fetch PC
    const { data: pcData, error: pcErr } = await supabase
      .from('petty_cash')
      .select('*, users!petty_cash_requester_id_fkey(first_name, last_name, signature), departments(name)')
      .eq('id', id)
      .single()

    if (pcErr || !pcData) {
      setError('ไม่พบข้อมูลใบเบิกเงินสดย่อย')
      setLoading(false)
      return
    }

    // Role-based access control check
    const userId = getCookie('user_id')
    const role = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let isAuthorized = false
    if (role === 'Admin' || role === 'Accounting') {
      isAuthorized = true
    } else if (role === 'Executive') {
      // Check if PC is at Executive step (2) Or if user has already signed it
      const { data: userLogs } = await supabase
        .from('approval_logs')
        .select('id')
        .eq('document_id', id)
        .eq('approver_id', userId)
        .limit(1)
      
      const hasSigned = !!(userLogs && userLogs.length > 0)
      isAuthorized = pcData.current_step === 2 || hasSigned || pcData.status === 'Approved'
    } else if (role === 'Manager') {
      isAuthorized = pcData.department_id === userDept
    } else {
      isAuthorized = pcData.requester_id === userId
    }

    if (!isAuthorized) {
      setError('คุณไม่มีสิทธิ์เข้าถึงเอกสารฉบับนี้')
      setLoading(false)
      return
    }

    setPc(pcData)

    // Fetch items
    const { data: itemsData } = await supabase
      .from('pc_items')
      .select('*')
      .eq('pc_id', id)
      .order('created_at')
    setItems(itemsData || [])

    // Fetch approval chain for PC
    const { data: chainData } = await supabase
      .from('approval_chains')
      .select('*')
      .eq('document_type', 'PC')
      .eq('is_active', true)
      .order('step_order')
    setChain(chainData || [])

    // Fetch approval logs
    const { data: logsData } = await supabase
      .from('approval_logs')
      .select('*, users!approval_logs_approver_id_fkey(first_name, last_name, signature)')
      .eq('document_type', 'PC')
      .eq('document_id', id)
      .order('step_order')
    setLogs(logsData || [])

    // Check if current user can approve
    setCanApprove(false)
    if (pcData.status === 'Pending') {
      const currentStep = chainData?.find((c: any) => c.step_order === pcData.current_step)
      if (role === 'Admin') {
        setCanApprove(true)
      } else if (currentStep && currentStep.approver_role === role) {
        if (role === 'Manager') {
          setCanApprove(userDept === pcData.department_id)
        } else {
          setCanApprove(true)
        }
      }
    }

    setLoading(false)
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setActionLoading(true)
    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      // Log the approval
      const { error: logErr } = await supabase.from('approval_logs').insert({
        document_type: 'PC',
        document_id: id,
        step_order: pc.current_step,
        approver_id: userId,
        action,
        comment: comment.trim() || null,
      })

      if (logErr && logErr.code !== '23505') throw logErr

      // Update Item Rejection Status in DB
      if (action === 'approve') {
        const itemUpdates = items.map(item => ({
          id: item.id,
          pc_id: item.pc_id,
          description: item.description,
          amount: item.amount,
          is_rejected: rejectedItemIds.has(item.id) || item.is_rejected,
          reject_reason: itemReasons[item.id] || item.reject_reason || null
        }))

        for (const item of itemUpdates) {
          await supabase.from('pc_items').update({
            is_rejected: item.is_rejected,
            reject_reason: item.reject_reason
          }).eq('id', item.id)
        }
      }

      if (action === 'reject') {
        const { error: pcErr } = await supabase.from('petty_cash').update({ 
          status: 'Rejected', 
          updated_at: new Date().toISOString() 
        }).eq('id', id)
        if (pcErr) throw pcErr
      } else {
        const nextStep = chain.find((c) => c.step_order > pc.current_step)
        if (nextStep) {
          const { error: pcErr } = await supabase.from('petty_cash').update({ 
            current_step: nextStep.step_order, 
            updated_at: new Date().toISOString() 
          }).eq('id', id)
          if (pcErr) throw pcErr
        } else {
          const { error: pcErr } = await supabase.from('petty_cash').update({ 
            status: 'Approved', 
            updated_at: new Date().toISOString() 
          }).eq('id', id)
          if (pcErr) throw pcErr
        }
      }

      // Send Directed LINE notification
      const actionText = action === 'approve' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      const nextStep = chain.find(c => c.step_order > pc.current_step)
      
      const message = `📢 อัปเดตสถานะเงินสดย่อย: ${pc.pc_number}\n` +
                      `--------------------------\n` +
                      `เรื่อง: ${pc.title}\n` +
                      `ผลการพิจารณา: ${actionText}\n` +
                      `โดย: ${getCookie('user_name')}\n` +
                      (comment.trim() ? `ความเห็น: "${comment.trim()}"` : '')

      if (action === 'reject') {
        // Notify Requester
        await notifyUser(pc.requester_id, message + `\nสถานะ: ถูกตีกลับ (Rejected)`)
      } else {
        if (!nextStep) {
          // Final Step - Notify Requester
          await notifyUser(pc.requester_id, message + `\nสถานะ: อนุมัติเสร็จสมบูรณ์ - รอดำเนินการจ่ายเงิน`)
          // Also notify Accounting for payment
          await notifyByRole({
            role: 'Accounting',
            message: message + `\nสถานะ: อนุมัติครบถ้วนแล้ว โปรดเตรียมดำเนินการจ่ายเงิน`
          })
        } else {
          // Next Step - Notify Next Approver
          await notifyByRole({
            role: nextStep.approver_role,
            message: message + `\nสถานะ: รอคุณพิจารณาอนุมัติ`
          })
          // CC Requester
          await notifyUser(pc.requester_id, message + `\nสถานะ: ผ่านการพิจารณา และส่งต่อแล้ว`)
        }
      }

      setComment('')
      setRejectedItemIds(new Set())
      setItemReasons({})
      await fetchData()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(false)
      isSubmitting.current = false
    }
  }

  const handleDelete = async () => {
    if (!confirm('ยืนยันการลบใบเบิกเงินสดย่อยนี้?')) return
    try {
      await supabase.from('petty_cash').delete().eq('id', id)
      router.push('/petty-cash')
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      <p className="text-gray-400 font-medium text-xs">กำลังเตรียมเอกสาร...</p>
    </div>
  )

  if (error) return (
    <div className="max-w-xl mx-auto mt-12 p-10 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm text-center space-y-6">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
        <XCircle className="w-10 h-10" />
      </div>
      <div>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">เกิดข้อผิดพลาด</h1>
        <p className="text-gray-400 mt-2 font-medium">{error}</p>
      </div>
      <Link href="/petty-cash" className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
        กลับสู่รายการ PC
      </Link>
    </div>
  )

  const totalAmount = items.reduce((sum, i) => {
    const isRejected = i.is_rejected || rejectedItemIds.has(i.id)
    return isRejected ? sum : sum + (Number(i.amount) || 0)
  }, 0)

  const currentUserId = getCookie('user_id')
  const currentUserRole = getCookie('user_role')
  const canSeeReason = pc && (pc.requester_id === currentUserId || currentUserRole === 'Admin')

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 print:p-0">
      {/* 1. Main Dashboard UI (Hidden in Print) */}
      <div className="print:hidden space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/petty-cash" className="p-3 rounded-2xl hover:bg-white hover:shadow-md text-gray-400 transition-all active:scale-90">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{pc.pc_number}</h1>
              <StatusBadge status={pc.status} />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
              {pc.title} • สร้างเมื่อ {new Date(pc.created_at).toLocaleDateString('th-TH')}
            </p>
          </div>
          <div className="flex gap-3">
            {((getCookie('user_id') === pc.requester_id) || getCookie('user_role') === 'Admin') && pc.status !== 'Approved' && pc.current_step === 1 && (
              <Link 
                href={`/petty-cash/${id}/edit`} 
                className="px-6 py-3 bg-white border border-gray-100 text-gray-500 hover:text-amber-600 rounded-2xl hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                title="แก้ไขข้อมูล"
              >
                <Edit3 className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest pt-0.5">แก้ไข</span>
              </Link>
            )}
            <button 
              onClick={() => window.print()}
              className="px-6 py-3 bg-white border border-gray-100 text-gray-500 hover:text-indigo-600 rounded-2xl hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Printer className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest pt-0.5">พิมพ์</span>
            </button>
            {getCookie('user_role') === 'Admin' && (
              <button 
                onClick={handleDelete}
                className="p-3 bg-white border border-gray-100 text-gray-300 hover:text-red-500 rounded-2xl hover:shadow-lg transition-all active:scale-95"
                title="ลบเอกสาร"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Info Card - Main Content */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
                 <Wallet className="w-5 h-5 text-amber-500" />
                 <h2 className="font-black text-gray-900 text-xs uppercase tracking-widest">รายละเอียดการเบิกเงินสดย่อย</h2>
               </div>
               <div className="p-8 grid grid-cols-2 gap-8">
                 <div>
                   <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5">ผู้ขอเบิก</p>
                   <p className="text-sm text-gray-900 font-bold">{pc.users?.first_name} {pc.users?.last_name}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5">แผนกที่สังกัด</p>
                   <p className="text-sm text-gray-900 font-bold">{pc.departments?.name || '-'}</p>
                 </div>
                 {pc.description && (
                   <div className="col-span-2">
                     <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1.5">หมายเหตุประกอบรายการ</p>
                     <p className="text-sm text-gray-600 bg-gray-50/80 p-5 rounded-3xl italic leading-relaxed font-medium">"{pc.description}"</p>
                   </div>
                 )}
               </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">#</th>
                    <th className="px-8 py-5">รายการค่าใช้จ่าย</th>
                    <th className="px-8 py-5 text-right font-sans">จำนวนเงิน (THB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.filter(item => !item.is_rejected || canSeeReason).map((item, i) => {
                    const isRejected = rejectedItemIds.has(item.id) || item.is_rejected
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isRejected ? 'bg-red-50/50' : ''}`}>
                        <td className={`px-8 py-5 text-[10px] font-black text-gray-300 ${isRejected ? 'line-through opacity-30 text-gray-400' : ''}`}>{i + 1}</td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isRejected ? 'line-through opacity-40 text-gray-400' : 'text-gray-800'}`}>{item.description}</span>
                            {item.is_rejected && canSeeReason && <span className="text-[10px] text-red-500 font-bold italic mt-1">ไม่อนุมัติ: {item.reject_reason}</span>}
                          </div>
                        </td>
                        <td className={`px-8 py-5 text-sm font-black text-right font-sans ${isRejected ? 'line-through opacity-30 text-gray-400 italic' : 'text-gray-900'}`}>
                          {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          {canApprove && !item.is_rejected && (
                             <div className="mt-2 flex flex-col gap-2 items-end">
                                <button
                                  onClick={() => {
                                    const newSet = new Set(rejectedItemIds)
                                    if (newSet.has(item.id)) newSet.delete(item.id)
                                    else newSet.add(item.id)
                                    setRejectedItemIds(newSet)
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${rejectedItemIds.has(item.id) ? 'bg-red-500 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'}`}
                                >
                                  {rejectedItemIds.has(item.id) ? 'ยกเลิกการปฏิเสธ' : 'ไม่อนุมัติรายการ'}
                                </button>
                                {rejectedItemIds.has(item.id) && (
                                  <input
                                    type="text"
                                    placeholder="ระบุเหตุผล..."
                                    value={itemReasons[item.id] || ''}
                                    onChange={(e) => setItemReasons({...itemReasons, [item.id]: e.target.value})}
                                    className="w-40 px-3 py-1.5 rounded-xl border-2 border-red-100 bg-white text-[10px] font-bold text-red-600 outline-none focus:border-red-500"
                                  />
                                )}
                             </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-500 text-white font-sans">
                    <td colSpan={2} className="px-8 py-6 text-right text-xs font-black uppercase tracking-widest">ยอดรวมทั้งสิ้น (Grand Total)</td>
                    <td className="px-8 py-6 text-right text-2xl font-black tracking-tight">
                      <span className="text-sm mr-1 opacity-60">฿</span>
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Approvals / Signatures Display */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-10">
              <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-12 border-b border-gray-50 pb-6 text-center">หลักฐานการอนุมัติ (E-Signatures)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                <div className="text-center space-y-4">
                  <div className="h-16 flex items-end justify-center">
                    {pc.users?.signature ? (
                      <img src={pc.users.signature} alt="Requester" className="max-h-full object-contain" />
                    ) : (
                      <span className="font-signature text-3xl text-amber-950 border-b border-gray-200 w-full pb-2 leading-none uppercase">{pc.users?.first_name}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 leading-none">{pc.users?.first_name} {pc.users?.last_name}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold mt-1.5 tracking-tighter">ผู้ขอเบิก</p>
                  </div>
                </div>
                {chain.map((step) => {
                  const log = logs.find((l) => l.step_order === step.step_order && l.action === 'approve')
                  return (
                    <div key={step.id} className="text-center space-y-4">
                      <div className="h-16 flex items-end justify-center">
                        {log ? (
                          log.users?.signature ? <img src={log.users.signature} alt="Signature" className="max-h-full object-contain" /> :
                          <span className="font-signature text-3xl text-emerald-800 border-b border-gray-200 w-full pb-2 leading-none uppercase">{log.users?.first_name}</span>
                        ) : (
                          <div className="border-b border-dashed border-gray-100 w-full pb-2 text-[10px] text-gray-300 italic font-black uppercase tracking-widest">รออนุมัติ</div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900 leading-none">{log ? `${log.users?.first_name} ${log.users?.last_name}` : '..........................'}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-1.5 tracking-tighter">{step.step_name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Action Box */}
            {canApprove && (
              <div className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-900/5 border border-indigo-100 overflow-hidden">
                <div className="p-8 border-b border-indigo-50 bg-indigo-50/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500 rounded-xl text-white"><CheckCircle2 size={18} /></div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest">พิจารณาอนุมัติ</h3>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleAction('approve')} disabled={actionLoading} className="py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">อนุมัติ</button>
                    <button onClick={() => handleAction('reject')} disabled={actionLoading} className="py-4 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">ปฏิเสธ</button>
                  </div>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็นประกอบ..." className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-gray-700 outline-none h-24" />
                </div>
              </div>
            )}

            {/* Attachments */}
            {pc.attachments?.length > 0 && (
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Paperclip size={16} /></div>
                  <h3 className="font-black text-gray-900 text-[11px] uppercase tracking-widest">ไฟล์แนบ ({pc.attachments.length})</h3>
                </div>
                <div className="space-y-2">
                  {pc.attachments.map((file: any, index: number) => (
                    <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-50 hover:bg-white transition-all">
                      {file.type?.includes('image') ? <ImageIcon size={18} className="text-blue-500" /> : <FileText size={18} className="text-red-500" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-gray-800 truncate">{file.name}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5 uppercase tracking-tighter">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center gap-3">
                <Clock className="w-4 h-4 text-purple-500" />
                <h3 className="font-black text-gray-900 text-xs uppercase tracking-widest">ความคืบหน้า</h3>
              </div>
              <div className="p-8">
                <div className="relative ml-2 space-y-8">
                  <TimelineItem label="เริ่มต้นการเบิก" by={`${pc.users?.first_name || ''} ${pc.users?.last_name || ''}`} date={new Date(pc.created_at).toLocaleString('th-TH')} status="completed" />
                  {chain.map((step) => {
                    const log = logs.find((l) => l.step_order === step.step_order)
                    let status: 'completed' | 'current' | 'upcoming' | 'rejected' = 'upcoming'
                    if (log) status = log.action === 'reject' ? 'rejected' : 'completed'
                    else if (pc.status === 'Pending' && step.step_order === pc.current_step) status = 'current'
                    return <TimelineItem key={step.id} label={step.step_name} by={log ? `${log.users?.first_name || ''} ${log.users?.last_name || ''}` : ROLE_LABELS[step.approver_role] || step.approver_role} date={log ? new Date(log.created_at).toLocaleString('th-TH') : undefined} comment={log?.comment} status={status} showComment={canSeeReason} />
                  })}
                  <TimelineItem label="เสร็จสิ้น" by={pc.status === 'Approved' ? 'ฝ่ายบัญชี' : 'รอการอนุมัติ'} status={pc.status === 'Approved' ? 'completed' : 'upcoming'} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PrintVoucher pc={pc} items={items} logs={logs} totalAmount={totalAmount} />
    </div>
  )
}

function TimelineItem({ label, by, date, comment, status, showComment }: {
  label: string; by: string; date?: string; comment?: string;
  status: 'completed' | 'current' | 'upcoming' | 'rejected';
  showComment?: boolean;
}) {
  const dotColor = {
    completed: 'bg-emerald-500', current: 'bg-amber-400 ring-8 ring-amber-100',
    upcoming: 'bg-gray-200', rejected: 'bg-red-500',
  }[status]
  return (
    <div className="relative pl-8 border-l-2 border-gray-100 pb-0 last:border-transparent">
      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${dotColor} transition-all`} />
      <h4 className={`text-xs font-black uppercase tracking-widest ${status === 'upcoming' ? 'text-gray-300' : 'text-gray-900'}`}>{label}</h4>
      <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase tracking-tight">{by}</p>
      {date && <p className="text-[10px] text-gray-300 font-bold mt-1">{date}</p>}
      {comment && showComment && <p className="text-xs text-gray-500 mt-3 bg-gray-50 px-4 py-3 rounded-2xl italic border border-gray-100 font-medium">"{comment}"</p>}
    </div>
  )
}

function PrintVoucher({ pc, items, logs, totalAmount }: any) {
  const maxRows = Math.max(items.length, 6)
  const emptyRows = maxRows - items.length
  const dots = (n: number) => '.'.repeat(n)

  return (
    <div className="hidden print:block print-voucher-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; }
          .print-voucher-container { 
            display: block !important; 
            width: 100%;
            padding-top: 15mm; 
          }
          .pc-voucher * { margin: 0; padding: 0; box-sizing: border-box; }
          .pc-voucher table { border-collapse: collapse; }
          .pc-voucher td, .pc-voucher th { border: 1px solid #000; }
        }
      `}} />
      <div className="pc-voucher" style={{ width: '148mm', margin: '0 auto', padding: '8mm 6mm', fontFamily: "'Sarabun', 'Noto Sans Thai', serif", fontSize: '10px', color: '#000', lineHeight: 1.4, border: '1px solid #eee' }}>

        {/* ===== HEADER ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', borderBottom: '2px solid #000', paddingBottom: '5px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <img src="/logo.png" style={{ width: '48px', height: '48px', objectFit: 'contain' } as any} alt="" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: '14px', lineHeight: 1.1 }}>บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</div>
              <div style={{ fontSize: '8.5px', fontWeight: 700, marginTop: '2px' }}>328 ม.6 ต.คลองนิยมยาตรา อ.บางบ่อ จ.สมุทรปราการ 10560</div>
              <div style={{ fontSize: '8.5px', fontWeight: 700 }}>โทร : 02-3175470-3 FAX : 02-317-5474</div>
              <div style={{ fontSize: '8.5px', fontWeight: 700 }}>เลขประจำตัวผู้เสียภาษี 0115545001637 (สำนักงานใหญ่)</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
             <div style={{ border: '1px solid #000', padding: '1px 4px', fontWeight: 900, fontSize: '8px' }}>ISO 9001</div>
             <div style={{ fontSize: '7px', fontWeight: 900, opacity: 0.7, textTransform: 'uppercase' }}>Certified</div>
             <div style={{ border: '2px solid #000', padding: '2px 8px', fontWeight: 900, fontSize: '16px', marginTop: '2px' }}>PC</div>
          </div>
        </div>

        {/* ===== TITLE ===== */}
        <div style={{ textAlign: 'center', margin: '4px 0 3px' }}>
          <div style={{ fontWeight: 900, fontSize: '13px', textDecoration: 'underline' }}>ใบเบิกเงินสดย่อย</div>
          <div style={{ fontSize: '8.5px', fontWeight: 600, marginTop: '1px' }}>ขอเบิกเงินสดย่อยตามรายการ ดังต่อไปนี้</div>
        </div>

        {/* ===== INFO FIELDS (dotted lines like real form) ===== */}
        <div style={{ fontSize: '9px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
            <span>จ่ายให้ <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '140px', textAlign: 'center', fontWeight: 700 }}>{pc.users?.first_name} {pc.users?.last_name}</span></span>
            <span style={{ marginLeft: 'auto' }}>เลขที่ <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '120px', textAlign: 'center', fontWeight: 700 }}>{pc.pc_number}</span></span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span>ฝ่าย / แผนก <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '120px', textAlign: 'center', fontWeight: 700 }}>{pc.departments?.name || '-'}</span></span>
            <span style={{ marginLeft: 'auto' }}>วันที่ <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '120px', textAlign: 'center', fontWeight: 700 }}>{new Date(pc.created_at).toLocaleDateString('th-TH')}</span></span>
          </div>
        </div>

        {/* ===== MAIN TABLE ===== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', fontSize: '9px', marginBottom: '2px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '2px', width: '30px', textAlign: 'center', fontWeight: 900, fontSize: '8px' }}>ลำดับ</th>
              <th style={{ border: '1px solid #000', padding: '2px 4px', textAlign: 'center', fontWeight: 900, fontSize: '8px' }}>รายละเอียด Description</th>
              <th style={{ border: '1px solid #000', padding: '2px', width: '90px', textAlign: 'center', fontWeight: 900, fontSize: '8px' }}>จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #000', textAlign: 'center', padding: '1px 2px', height: '16px' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '1px 4px' }}>
                  <span style={item.is_rejected ? { textDecoration: 'line-through', color: '#aaa' } : { fontWeight: 600 }}>{item.description}</span>
                </td>
                <td style={{ border: '1px solid #000', textAlign: 'right', padding: '1px 4px', fontWeight: 600 }}>
                  {item.is_rejected ? '-' : Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {Array(emptyRows).fill(null).map((_, idx) => (
              <tr key={`e${idx}`}>
                <td style={{ border: '1px solid #000', height: '16px' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000' }}>&nbsp;</td>
              </tr>
            ))}

            {/* Deduction rows */}
            <tr>
              <td style={{ border: '1px solid #000', height: '14px' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '1px 4px', fontSize: '8px', fontWeight: 700 }}>หัก เงินยืมทดรอง อื่นๆ</td>
              <td style={{ border: '1px solid #000' }}>&nbsp;</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', height: '14px' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '1px 4px', fontSize: '8px', fontWeight: 700 }}>หัก ภาษีเงินได้หัก ณ ที่จ่าย</td>
              <td style={{ border: '1px solid #000' }}>&nbsp;</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', height: '14px' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '1px 4px', fontSize: '8px', fontWeight: 700 }}>ส่วนขาด(เกิน) จากการปิดเศษสตางค์</td>
              <td style={{ border: '1px solid #000' }}>&nbsp;</td>
            </tr>

            {/* TOTAL */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', textAlign: 'right', padding: '2px 6px', fontWeight: 900, fontSize: '10px' }}>รวม / Total</td>
              <td style={{ border: '1px solid #000', textAlign: 'right', padding: '2px 4px', fontWeight: 900, fontSize: '11px' }}>
                {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ===== AMOUNT IN WORDS ===== */}
        <div style={{ fontSize: '9px', marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontWeight: 700 }}>จำนวนเงิน (ตัวหนังสือ):</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #000', textAlign: 'center', fontWeight: 700, paddingBottom: '1px', fontSize: '10px' }}>{bahttext(totalAmount)}</span>
        </div>

        {/* ===== SIGNATURES (5 slots, dotted lines like real form) ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '8px' }}>
          {/* 1. ผู้ขอเบิก */}
          <div style={{ textAlign: 'center', fontSize: '8px' }}>
            <div style={{ height: '30px', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {pc.users?.signature && <img src={pc.users.signature} style={{ maxHeight: '24px', position: 'absolute', top: 0 }} alt="" />}
            </div>
            <div style={{ borderBottom: '1px dotted #000', marginBottom: '2px', paddingBottom: '1px', fontWeight: 600 }}>
              {pc.users?.first_name} {pc.users?.last_name}
            </div>
            <div style={{ fontWeight: 900 }}>ผู้ขอเบิก</div>
          </div>

          {/* 2. ผู้ตรวจสอบ */}
          <div style={{ textAlign: 'center', fontSize: '8px' }}>
            <div style={{ height: '30px', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {(() => {
                const log = logs.find((l: any) => l.step_order === 1 && l.action === 'approve')
                return log?.users?.signature ? <img src={log.users.signature} style={{ maxHeight: '24px', position: 'absolute', top: 0 }} alt="" /> : null
              })()}
            </div>
            <div style={{ borderBottom: '1px dotted #000', marginBottom: '2px', paddingBottom: '1px', fontWeight: 600 }}>
              {(() => {
                const log = logs.find((l: any) => l.step_order === 1 && l.action === 'approve')
                return log ? `${log.users?.first_name || ''} ${log.users?.last_name || ''}` : dots(20)
              })()}
            </div>
            <div style={{ fontWeight: 900 }}>ผู้ตรวจสอบ</div>
          </div>

          {/* 3. ผู้อนุมัติ */}
          <div style={{ textAlign: 'center', fontSize: '8px' }}>
            <div style={{ height: '30px', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {(() => {
                const log = logs.find((l: any) => l.step_order >= 2 && l.action === 'approve')
                return log?.users?.signature ? <img src={log.users.signature} style={{ maxHeight: '24px', position: 'absolute', top: 0 }} alt="" /> : null
              })()}
            </div>
            <div style={{ borderBottom: '1px dotted #000', marginBottom: '2px', paddingBottom: '1px', fontWeight: 600 }}>
              {(() => {
                const log = logs.find((l: any) => l.step_order >= 2 && l.action === 'approve')
                return log ? `${log.users?.first_name || ''} ${log.users?.last_name || ''}` : dots(20)
              })()}
            </div>
            <div style={{ fontWeight: 900 }}>ผู้อนุมัติ</div>
          </div>

          {/* 4. ผู้จ่ายเงิน */}
          <div style={{ textAlign: 'center', fontSize: '8px' }}>
            <div style={{ height: '30px' }}></div>
            <div style={{ borderBottom: '1px dotted #000', marginBottom: '2px', paddingBottom: '1px' }}>{dots(20)}</div>
            <div style={{ fontWeight: 900 }}>ผู้จ่ายเงิน</div>
          </div>

          {/* 5. ผู้รับเงิน */}
          <div style={{ textAlign: 'center', fontSize: '8px' }}>
            <div style={{ height: '30px' }}></div>
            <div style={{ borderBottom: '1px dotted #000', marginBottom: '2px', paddingBottom: '1px' }}>{dots(20)}</div>
            <div style={{ fontWeight: 900 }}>ผู้รับเงิน</div>
          </div>
        </div>

      </div>
    </div>
  )
}
