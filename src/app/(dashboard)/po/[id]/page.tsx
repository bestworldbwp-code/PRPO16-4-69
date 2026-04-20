'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Clock, ShoppingCart, Loader2, Printer, Trash2, Paperclip, ExternalLink, Image as ImageIcon, File, Archive, Download, FileText, Edit3, Image } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import StatusBadge from '@/components/StatusBadge'
import { ROLE_LABELS } from '@/lib/constants'
import { notifyByRole, notifyUser } from '@/lib/notifications'
import { bahttext } from '@/lib/utils'

export default function PODetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [po, setPo] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [chain, setChain] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canApprove, setCanApprove] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [requiresExec2, setRequiresExec2] = useState(false)
  const [role, setRole] = useState('')
  const [userId, setUserId] = useState('')
  
  // New: Item Rejection States
  const [rejectedItemIds, setRejectedItemIds] = useState<Set<string>>(new Set())
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({})

  useEffect(() => { 
    const role = getCookie('user_role')
    if (role === 'Requester') {
      router.push('/')
      return
    }
    setRole(role || '')
    setUserId(getCookie('user_id') || '')
    fetchData() 
  }, [id])

  const fetchData = async () => {
    setLoading(true)

    const { data: poData, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*, users!purchase_orders_created_by_fkey(first_name, last_name, signature), purchase_requests(pr_number, title, department_id, departments(name))')
      .eq('id', id)
      .single()

    if (poErr || !poData) {
      setError('ไม่พบข้อมูลใบสั่งซื้อ')
      setLoading(false)
      return
    }

    // Role-based access control check
    const userId = getCookie('user_id')
    const roleValue = getCookie('user_role')
    const userDept = getCookie('user_dept_id')

    let isAuthorized = false
    if (roleValue === 'Admin' || roleValue === 'Purchasing' || roleValue === 'PurchasingManager') {
      isAuthorized = true
    } else if (roleValue === 'Executive') {
      const { data: userLogs } = await supabase
        .from('approval_logs')
        .select('id')
        .eq('document_id', id)
        .eq('approver_id', userId)
        .limit(1)
      
      const hasSigned = !!(userLogs && userLogs.length > 0)
      isAuthorized = poData.current_step > 1 || hasSigned || poData.status === 'Approved'
    } else {
      // Manager see POs related to their department
      isAuthorized = poData.department_id === userDept || poData.created_by === userId
    }

    if (!isAuthorized) {
      setError('คุณไม่มีสิทธิ์เข้าถึงเอกสารฉบับนี้')
      setLoading(false)
      return
    }

    setPo(poData)
    setRequiresExec2(poData.requires_exec2 || false)

    const { data: itemsData } = await supabase.from('po_items').select('*').eq('po_id', id).order('created_at')
    setItems(itemsData || [])

    const { data: chainData } = await supabase
      .from('approval_chains')
      .select('*')
      .eq('document_type', 'PO')
      .eq('is_active', true)
      .order('step_order')
    setChain(chainData || [])

    const { data: logsData } = await supabase
      .from('approval_logs')
      .select('*, users!approval_logs_approver_id_fkey(first_name, last_name, signature, role)')
      .eq('document_type', 'PO')
      .eq('document_id', id)
      .order('step_order')
    setLogs(logsData || [])

    setCanApprove(false)
    if (poData.status === 'Pending') {
      const currentStepObj = chainData?.find((c: any) => c.step_order === poData.current_step)
      if (roleValue === 'Admin') {
        setCanApprove(true)
      } else if (currentStepObj && currentStepObj.approver_role === roleValue) {
        if (roleValue === 'Manager') {
          setCanApprove(userDept === poData.department_id)
        } else {
          setCanApprove(true)
        }
      }
    }
    setLoading(false)
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    setActionLoading(true)
    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      const { error: logErr } = await supabase.from('approval_logs').insert({
        document_type: 'PO',
        document_id: id,
        step_order: po.current_step,
        approver_id: userId,
        action,
        comment: comment.trim() || null,
      })

      if (logErr) throw logErr
      
      if (action === 'approve') {
        for (const item of items) {
          const isMarked = rejectedItemIds.has(item.id)
          const newReason = itemReasons[item.id]
          if (isMarked || newReason) {
            await supabase.from('po_items').update({
              is_rejected: isMarked || item.is_rejected,
              reject_reason: newReason || item.reject_reason || null
            }).eq('id', item.id)
          }
        }
      }

      let nextStep = chain.find((c) => c.step_order > po.current_step)

      if (action === 'approve') {
        // Dynamic Executive Routing (Phase 4): If at step 2 and exec 2 is not required, skip step 3
        if (po.current_step === 2 && !po.requires_exec2) {
          nextStep = undefined
        }
      }

      if (action === 'reject') {
        await supabase.from('purchase_orders').update({ 
          status: 'Rejected', 
          updated_at: new Date().toISOString() 
        }).eq('id', id)
      } else {
        if (nextStep) {
          await supabase.from('purchase_orders').update({ 
            current_step: nextStep.step_order, 
            // Save the toggle choice only on step 1
            ...(po.current_step === 1 ? { requires_exec2: requiresExec2 } : {}),
            updated_at: new Date().toISOString() 
          }).eq('id', id)
        } else {
          await supabase.from('purchase_orders').update({ 
            status: 'Approved', 
            // Mark as approved overrides step selection
            ...(po.current_step === 1 ? { requires_exec2: requiresExec2 } : {}),
            updated_at: new Date().toISOString() 
          }).eq('id', id)
        }
      }

      // Send LINE notification
      const actionText = action === 'approve' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติ'
      const baseMessage = `📢 อัปเดตสถานะ PO: ${po.po_number}\n` +
                          `--------------------------\n` +
                          `ผู้ขาย: ${po.vendor_name}\n` +
                          `ผลการพิจารณา: ${actionText}\n` +
                          `โดย: ${getCookie('user_name')}\n` +
                          (comment.trim() ? `ความเห็น: "${comment.trim()}"` : '')

      if (action === 'reject') {
        await notifyUser(po.created_by, baseMessage + `\nสถานะ: ถูกตีกลับ (Rejected)`)
      } else {
        if (nextStep) {
          // Notify next approver
          await notifyByRole({ 
            role: nextStep.approver_role, 
            departmentId: nextStep.approver_role === 'Manager' ? po.department_id : undefined,
            message: baseMessage + `\nสถานะ: รอ ${nextStep.step_name} ตรวจสอบ` 
          })
          await notifyUser(po.created_by, baseMessage + `\nสถานะ: ผ่านการพิจารณา และส่งต่อแล้ว`)
        } else {
          await notifyUser(po.created_by, baseMessage + `\nสถานะ: อนุมัติสั่งซื้อเสร็จสมบูรณ์!`)
        }
      }

      setComment('')
      setRejectedItemIds(new Set())
      setItemReasons({})
      fetchData()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('ยืนยันการลบ PO นี้?')) return
    try {
      await supabase.from('purchase_orders').delete().eq('id', id)
      router.push('/po')
    } catch (err: any) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  const handlePrint = () => { window.print() }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">กำลังโหลดข้อมูล PO...</p>
    </div>
  )

  if (error || !po) return (
    <div className="max-w-xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-gray-100 shadow-sm text-center space-y-6">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto"><XCircle className="w-8 h-8" /></div>
      <div><h1 className="text-xl font-bold text-gray-900">ไม่พบข้อมูล</h1><p className="text-gray-500 mt-1">{error || 'ไม่พบเอกสารใบสั่งซื้อที่คุณต้องการ'}</p></div>
      <Link href="/po" className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-medium transition-colors">กลับสู่รายการ PO</Link>
    </div>
  )

  const canSeeReason = role === 'Admin' || po.created_by === userId
  const subtotal = items.filter(item => !item.is_rejected || canSeeReason).reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0)
  const afterDiscount = subtotal - (po.discount || 0)
  const vatAmount = (afterDiscount * (po.vat_percent || 7)) / 100
  const grandTotal = afterDiscount + vatAmount

  return (
    <div className="max-w-[1000px] mx-auto pb-12 font-sans px-4 sm:px-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/po" className="p-2.5 bg-white rounded-xl border border-gray-100 text-gray-400 hover:text-gray-700 transition-all shadow-sm active:scale-95"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight italic">ใบสั่งซื้อ PO</h1>
            <StatusBadge status={po.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all shadow-sm font-bold text-[10px] uppercase tracking-widest"><Printer size={18} /> พิมพ์</button>
          {((getCookie('user_id') === po.created_by) || role === 'Admin') && po.status !== 'Approved' && (
            <Link href={`/po/${id}/edit`} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 border border-emerald-500 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-bold text-[10px] uppercase tracking-widest"><Edit3 size={18} /> แก้ไข</Link>
          )}
        </div>
      </div>

      <div className="bg-white shadow-2xl print:shadow-none border border-gray-200 print:border-none rounded-none overflow-hidden font-sans text-[11px] text-black leading-tight p-0 print:min-h-[297mm] min-h-[297mm] flex flex-col relative print:h-[297mm]">
        <div className="px-[10mm] pt-[10mm] pb-[20mm] flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex gap-4">
              <div className="w-24 h-24 shrink-0 flex items-start justify-center">
                <img src="/logo.png" alt="BWP Logo" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg font-black leading-none mb-1">บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</h2>
                <p>328 ม.6 ต.คลองนิยมยาตรา อ.บางบ่อ จ.สมุทรปราการ 10560</p>
                <p>02-317-5470-3 FAX 02-317-5474</p>
                <p>เลขประจำตัวผู้เสียภาษี 0115545001637</p>
                <div className="pt-2">สำนักงานใหญ่</div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex justify-end gap-2 items-center mb-1">
                 <div className="text-[10px] space-y-0.5 mr-4 text-center">
                    <div className="border border-black px-2 py-0.5 font-bold">ISO 9001</div>
                    <div className="text-[8px] opacity-70">CERTIFIED</div>
                 </div>
                 <h1 className="text-2xl font-black border-b-4 border-black pb-1 uppercase italic">ใบสั่งซื้อ</h1>
              </div>
              <p className="font-bold text-[13px] tracking-widest">(PURCHASE ORDER)</p>
              <p className="mt-1 font-bold">(ต้นฉบับ / ORIGINAL)</p>
            </div>
          </div>
          <div className="h-[2px] bg-black w-full mb-6" />

          <div className="grid grid-cols-2 gap-0 border-[1.5px] border-black">
            <div className="p-4 border-r-[1.5px] border-black space-y-2.5">
              <div className="flex gap-2"><span className="font-bold min-w-[70px]">ผู้จำหน่าย :</span><span className="font-bold text-[12px]">{po.vendor_name}</span></div>
              {po.vendor_address && <div className="flex gap-2 pl-[78px] text-[11px] leading-relaxed font-medium">{po.vendor_address}</div>}
              <div className="flex gap-2"><span className="font-bold min-w-[70px]">โทร :</span><span>{po.vendor_tel || '-'}</span></div>
              {po.tax_id && <div className="flex gap-2"><span className="font-bold min-w-[70px]">Tax ID :</span><span>{po.tax_id}</span></div>}
              <div className="flex gap-2 border-t border-gray-100 pt-2"><span className="font-bold min-w-[70px]">หมายเหตุ :</span><span className="font-bold text-gray-600">{po.purchase_requests?.pr_number ? `อ้างอิง PR: ${po.purchase_requests.pr_number}` : 'PO อิสระ'} / {po.purchase_requests?.departments?.name || ''}</span></div>
            </div>
            <div className="grid grid-cols-1 divide-y divide-black h-full">
              <div className="grid grid-cols-2 h-full">
                <div className="p-3 border-r border-black flex flex-col justify-center"><span className="font-bold text-[10px] uppercase text-gray-500">เลขที่ใบสั่งซื้อ</span><p className="text-[15px] font-black mt-1 uppercase tracking-wider">{po.po_number}</p></div>
                <div className="p-3 flex flex-col justify-center"><span className="font-bold text-[10px] uppercase text-gray-500 text-center">วันที่ (Date)</span><p className="text-center font-bold text-sm mt-1">{new Date(po.created_at).toLocaleDateString('th-TH')}</p></div>
              </div>
              <div className="grid grid-cols-3 h-full bg-gray-50/50">
                <div className="p-3 border-r border-black col-span-1"><div className="font-bold text-[9px] uppercase text-gray-500">วันที่รับของ</div><p className="mt-1 font-bold text-sm">{po.receipt_date ? new Date(po.receipt_date).toLocaleDateString('th-TH') : '-'}</p></div>
                <div className="p-3 border-r border-black col-span-1"><div className="font-bold text-[9px] uppercase text-gray-500">เครดิต</div><p className="mt-1 text-center font-black text-sm">{po.credit_days || 0} วัน</p></div>
                <div className="p-3 col-span-1"><div className="font-bold text-[9px] uppercase text-gray-500">ติดต่อ</div><p className="mt-1 font-bold text-xs truncate" title={po.contact_person}>{po.contact_person || '-'}</p></div>
              </div>
            </div>
          </div>

          <div className="mt-4 border-[1.5px] border-black min-h-[240px] relative">
            <table className="w-full text-[12px] border-collapse relative z-10">
              <thead>
                <tr className="border-b-[1.5px] border-black font-black text-center bg-gray-100 uppercase tracking-tighter">
                  <th className="py-1.5 border-r-[1.5px] border-black w-[50px]">No.</th>
                  <th className="py-1.5 border-r-[1.5px] border-black px-4">รหัสสินค้า / รายละเอียดสินค้า</th>
                  <th className="py-1.5 border-r-[1.5px] border-black w-[110px]">จำนวน</th>
                  <th className="py-1.5 border-r-[1.5px] border-black w-[110px]">หน่วยละ</th>
                  <th className="py-1.5 w-[140px]">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(item => !item.is_rejected || canSeeReason).map((item, i) => {
                  const isRejected = item.is_rejected
                  return (
                    <tr key={item.id} className="align-top border-b border-gray-100 last:border-0 h-6">
                      <td className="py-1.5 text-center border-r-[1.5px] border-black font-medium">{i + 1}</td>
                      <td className="py-1.5 px-4 border-r-[1.5px] border-black leading-relaxed">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-bold ${isRejected ? 'text-red-500 line-through' : 'text-black'}`}>{item.item_code ? `[${item.item_code}] ` : ''}{item.description}</span>
                          {isRejected && canSeeReason && <span className="text-[9px] text-red-600 font-bold italic px-2 bg-red-50/80 mt-1 inline-block w-fit">REJECTED: {item.reject_reason || 'ไม่มีระบุเหตุผล'}</span>}
                        </div>
                      </td>
                      <td className="py-1.5 text-center border-r-[1.5px] border-black font-bold">{item.quantity.toLocaleString()} {item.unit}</td>
                      <td className="py-1.5 text-right px-4 border-r-[1.5px] border-black font-semibold">{item.unit_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-1.5 text-right px-4 font-black">{ (item.quantity * (item.unit_price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 }) }</td>
                    </tr>
                  )
                })}
                {Array.from({ length: Math.max(0, 10 - items.filter(item => !item.is_rejected || canSeeReason).length) }).map((_, i) => (
                  <tr key={`filler-${i}`} className="h-6 shadow-none border-none">
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td className="border-r-[1.5px] border-black"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-[50px] w-[1.5px] bg-black" />
              <div className="absolute top-0 bottom-0 right-[360px] w-[1.5px] bg-black" />
              <div className="absolute top-0 bottom-0 right-[250px] w-[1.5px] bg-black" />
              <div className="absolute top-0 bottom-0 right-[140px] w-[1.5px] bg-black" />
            </div>
          </div>

          <div className="grid grid-cols-12 border-x-[1.5px] border-b-[1.5px] border-black">
            <div className="col-span-8 p-5 border-r-[1.5px] border-black flex flex-col justify-end min-h-[140px]">
               {po.memo && <div className="mb-6"><span className="font-bold underline decoration-[1.5px] underline-offset-4 text-sm uppercase">เงื่อนไขเพิ่มเติม (MEMO)</span><p className="mt-2 text-[11px] whitespace-pre-line text-black/70 leading-normal font-medium italic">"{po.memo}"</p></div>}
               <div className="border-[2px] border-black p-4 bg-gray-50/50 flex items-center justify-center min-h-[50px] shadow-sm"><span className="font-black text-[14px] italic underline underline-offset-4 tracking-tight">*( {bahttext(grandTotal)} )*</span></div>
            </div>
            <div className="col-span-4 divide-y-[1.5px] divide-black font-bold bg-gray-50/20">
               <div className="grid grid-cols-2 p-3"><span className="text-[10px] uppercase">รวมเป็นเงิน/GROSS</span><span className="text-right text-[13px]">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
               <div className="grid grid-cols-2 p-3"><span className="text-[10px] uppercase">หักส่วนลด/DISCOUNT</span><span className="text-right text-[13px] text-red-600">{(po.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
               <div className="grid grid-cols-2 p-3 bg-white/50"><span className="text-[10px] uppercase font-black">ยอดรวมหลังส่วนลด</span><span className="text-right text-[13px] font-black">{afterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
               <div className="grid grid-cols-2 p-3"><div className="flex flex-col"><span className="text-[10px] uppercase">VAT</span><span className="text-[9px] font-normal opacity-60">Calculated at {po.vat_percent || 7}%</span></div><span className="text-right text-[13px] h-full flex items-center justify-end">{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
               <div className="grid grid-cols-2 p-4 bg-black text-white"><span className="font-black h-full flex items-center uppercase text-[11px] tracking-wide italic">จำนวนเงินรวมทั้งสิ้น</span><span className="text-right font-black text-xl h-full flex items-center justify-end">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          <div className={`mt-auto border-[1.5px] border-black grid ${po.requires_exec2 ? 'grid-cols-4' : 'grid-cols-3'} overflow-hidden rounded-sm text-black break-inside-avoid`}>
             <div className="border-r-[1.5px] border-black text-center p-6 min-h-[180px] flex flex-col justify-between bg-white">
                <div className="flex flex-col items-center justify-center flex-1">
                   <div className="h-24 flex items-end justify-center pb-3">
                    {po.users?.signature ? (<img src={po.users.signature} alt="Buyer" className="max-h-full drop-shadow-sm" />) : (<span className="font-signature text-5xl opacity-40 italic text-emerald-950/40">{po.users?.first_name}</span>)}
                   </div>
                   <div className="w-[80%] h-0.5 bg-black/80" />
                </div>
                <div className="pt-3"><span className="font-black text-[12px] uppercase tracking-[0.2em] italic">ผู้สั่งซื้อ (OFFICER)</span><div className="text-[9px] mt-1 text-gray-500 font-bold">วันที่: {new Date(po.created_at).toLocaleDateString('th-TH')}</div></div>
             </div>
             <div className="border-r-[1.5px] border-black text-center p-6 min-h-[180px] flex flex-col justify-between bg-white">
                <div className="flex flex-col items-center justify-center flex-1">
                   <div className="h-24 flex items-end justify-center pb-3">
                    {(() => { const log = logs.find(l => l.step_order === 1 && l.action === 'approve'); return log?.users?.signature ? (<img src={log.users.signature} className="max-h-full drop-shadow-sm" />) : log ? (<span className="font-signature text-5xl opacity-40 italic text-emerald-950/40">{log.users?.first_name}</span>) : (<div className="w-16 h-16 border-2 border-dashed border-gray-100 rounded-full flex items-center justify-center"><Clock size={20} className="text-gray-100" /></div>) })()}
                   </div>
                   <div className="w-[80%] h-0.5 bg-black/80" />
                </div>
                <div className="pt-3"><span className="font-black text-[12px] uppercase tracking-[0.2em]">ผู้ตรวจสอบ (MANAGER)</span><div className="text-[9px] mt-1 text-gray-400 font-bold">{(() => { const log = logs.find(l => l.step_order === 1 && l.action === 'approve'); return log ? `วันที่: ${new Date(log.created_at).toLocaleDateString('th-TH')}` : '(รอลายเซ็นต์)' })()}</div></div>
             </div>
             <div className={`${po.requires_exec2 ? 'border-r-[1.5px] border-black bg-white' : 'bg-black/[0.02]'} text-center p-6 min-h-[180px] flex flex-col justify-between relative`}>
                <div className="flex flex-col items-center justify-center flex-1">
                   <div className="h-24 flex items-end justify-center pb-3">
                    {(() => { 
                      const log = logs.find(l => l.step_order === 2 && l.action === 'approve');
                      return log?.users?.signature ? (<img src={log.users.signature} className="max-h-full drop-shadow-sm" />) : log ? (<span className="font-signature text-5xl opacity-40 italic text-emerald-950/40">{log.users?.first_name}</span>) : (<div className="w-16 h-16 border-2 border-dashed border-gray-100 rounded-full flex items-center justify-center"><Clock size={20} className="text-gray-100" /></div>) 
                    })()}
                   </div>
                   <div className="w-[80%] h-0.5 bg-black" />
                </div>
                <div className="pt-3"><span className={`font-black uppercase tracking-[0.2em] ${!po.requires_exec2 ? 'text-[13px] bg-black text-white px-3 py-1 skew-x-[-12deg] inline-block' : 'text-[12px]'}`}>ผู้อนุมัติ (DIRECTOR)</span><div className="text-[9px] mt-2 font-black uppercase tracking-widest opacity-60">AUTHORIZED SIGNATURE</div></div>
             </div>
             {po.requires_exec2 && (
               <div className="text-center p-6 min-h-[180px] flex flex-col justify-between bg-black/[0.02] relative">
                  <div className="flex flex-col items-center justify-center flex-1">
                     <div className="h-24 flex items-end justify-center pb-3">
                      {(() => { 
                        const log = logs.find(l => l.step_order === 3 && l.action === 'approve');
                        return log?.users?.signature ? (<img src={log.users.signature} className="max-h-full drop-shadow-sm" />) : log ? (<span className="font-signature text-5xl opacity-40 italic text-emerald-950/40">{log.users?.first_name}</span>) : (<div className="w-16 h-16 border-2 border-dashed border-gray-100 rounded-full flex items-center justify-center"><Clock size={20} className="text-gray-100" /></div>) 
                      })()}
                     </div>
                     <div className="w-[80%] h-0.5 bg-black" />
                  </div>
                  <div className="pt-3"><span className="font-black text-[13px] uppercase tracking-[0.2em] bg-black text-white px-3 py-1 skew-x-[-12deg] inline-block">ผู้อนุมัติสูงสุด (EXECUTIVE)</span><div className="text-[9px] mt-2 font-black uppercase tracking-widest opacity-60">FINAL AUTHORIZED SIGNATURE</div></div>
               </div>
             )}
          </div>

          <div className="mt-6 flex justify-between items-end text-[10px] font-black tracking-widest text-gray-400 border-t border-gray-100 pt-3 break-inside-avoid">
             <div className="flex flex-col gap-1"><div className="flex gap-4"><span>DOC NO: FQP-PUR-01:05</span><span>REV NO: 03</span></div><div>EFFECTIVE DATE : 13/09/24</div></div>
             <div className="text-right italic text-[9px]">Powered by BWP ERP v2.0</div>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-10 print:hidden">
        {po.description && (
          <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
            <h3 className="font-black text-amber-900 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={14} className="text-amber-500" /> หมายเหตุภายใน (Internal Remarks)</h3>
            <p className="text-sm text-amber-800 font-medium leading-relaxed italic">" {po.description} "</p>
          </div>
        )}

        {canApprove && (
          <div className="w-full mt-8 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-20">
             <div className="bg-white border border-gray-200 shadow-sm rounded-[2rem] p-6 lg:p-8 flex flex-col gap-5 relative overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
               
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={18} /></div>
                  <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">การพิจารณาอนุมัติเอกสาร</h3>
               </div>

               {role === 'PurchasingManager' && po.current_step === 1 && (
                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl flex items-center gap-4 hover:border-amber-300 transition-colors cursor-pointer" onClick={() => setRequiresExec2(!requiresExec2)}>
                     <div className="relative flex shrink-0">
                       <input type="checkbox" checked={requiresExec2} onChange={() => {}} className="peer sr-only" />
                       <div className="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors">
                         <CheckCircle2 className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                       </div>
                     </div>
                     <div>
                       <p className="font-black text-[11px] text-amber-800 uppercase tracking-widest leading-none">ต้องการผู้บริหารระดับสูง 2 ท่าน</p>
                       <p className="text-[10px] text-amber-600/70 font-medium mt-1">ใช้ในกรณีมูลค่าสั่งซื้อสูงและต้องการ Executive เพิ่มเติม (ขั้นที่ 3)</p>
                     </div>
                  </div>
               )}
               
               <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็นประกอบการพิจารณา (ทางเลือก)..." rows={2} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium resize-none min-h-[50px] leading-relaxed" />
               
               <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={() => handleAction('approve')} disabled={actionLoading} className="py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 disabled:opacity-50"><CheckCircle2 size={18} strokeWidth={2.5} /> อนุมัติและลงนาม</button>
                  <button onClick={() => handleAction('reject')} disabled={actionLoading} className="py-3.5 bg-white text-red-500 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-red-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"><XCircle size={18} strokeWidth={2.5} /> ปฏิเสธ</button>
               </div>
             </div>
          </div>
        )}

        <div className="bg-white rounded-[3.5rem] border border-gray-100 p-12 shadow-sm overflow-hidden group relative">
          <div className="flex items-center gap-5 mb-12"><div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" /><h3 className="font-black text-gray-400 text-xs uppercase tracking-[0.3em]">Workflows (Logs)</h3></div>
          <div className="space-y-10">
            {chain.filter(c => po.requires_exec2 ? true : c.step_order !== 3).map((step, idx, arr) => {
              const log = logs.find(l => l.step_order === step.step_order)
              const isCurrent = po.status === 'Pending' && po.current_step === step.step_order
              const isPassed = po.status === 'Approved' || po.current_step > step.step_order
              const isUpcoming = !log && !isCurrent

              return (
                <div key={step.id} className={`flex gap-10 relative transition-all duration-500 ${isUpcoming ? 'opacity-40 grayscale' : ''}`}>
                  {idx < arr.length - 1 && (
                    <div className={`absolute left-7 top-14 bottom-0 w-[3px] rounded-full transition-colors duration-500 ${isPassed ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                  )}
                  <div className="shrink-0 relative">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${log?.action === 'approve' ? 'bg-emerald-500 border-emerald-400 text-white shadow-xl' : log?.action === 'reject' ? 'bg-red-500 border-red-400 text-white shadow-xl' : isCurrent ? 'bg-white border-amber-500 text-amber-500 shadow-2xl animate-bounce' : 'bg-gray-50 border-gray-200 text-gray-300'}`}>
                      {log?.action === 'approve' ? <CheckCircle2 size={30} /> : log?.action === 'reject' ? <XCircle size={30} /> : isCurrent ? <Loader2 size={30} className="animate-spin" /> : <Clock size={30} />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-4 text-black">
                      <div className="flex flex-col">
                        <span className="font-black text-lg uppercase italic">{step.step_name}</span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">REQUIRED: {ROLE_LABELS[step.approver_role as keyof typeof ROLE_LABELS] || step.approver_role}</span>
                      </div>
                    </div>
                    {log && (
                      <div className="bg-gray-50 p-6 rounded-[2.5rem] relative">
                        <p className="text-gray-800 font-bold text-sm italic mb-6">" {log.comment || 'อนุมัติเรียบร้อย' } "</p>
                        <div className="flex items-center gap-4 border-t border-gray-200/50 pt-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-emerald-600 text-xs">
                            {log.users?.first_name[0]}
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] font-black text-gray-900 uppercase">{log.users?.first_name} {log.users?.last_name}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{ROLE_LABELS[log.users?.role as keyof typeof ROLE_LABELS] || log.users?.role}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {po.attachments?.length > 0 && (
          <div className="bg-white rounded-[3rem] border border-gray-100 p-10 shadow-sm"><div className="flex items-center gap-4 mb-8"><Paperclip className="text-blue-500" /><h3 className="font-black text-xs uppercase tracking-[0.25em] text-gray-400">ไฟล์แนบ (Attachments)</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {po.attachments.map((file: any, index: number) => (
                <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col p-6 bg-gray-50 rounded-[2rem] border border-gray-50 hover:bg-white transition-all shadow-sm">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-all shadow-sm">{file.type?.includes('pdf') ? <FileText /> : file.type?.includes('image') ? <ImageIcon /> : <File />}</div>
                   <p className="text-xs font-black text-gray-900 mb-1 truncate">{file.name}</p>
                   <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-200/50"><span className="text-[9px] font-black text-gray-400 uppercase">{(file.size / 1024).toFixed(1)} KB</span><Download size={14} className="text-emerald-500" /></div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Ms+Madi&family=Playfair+Display:ital,wght@1,900&display=swap');
        .font-signature { font-family: 'Ms Madi', cursive; }
        @media print {
          * { filter: none !important; box-shadow: none !important; }
          @page { margin: 0; size: A4 vertical; }
          body { background-color: white !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; }
          .print\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .max-w-\[1000px\] { max-width: 100% !important; width: 100% !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
