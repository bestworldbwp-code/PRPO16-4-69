'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Loader2, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import { notifyByRole, notifyUser } from '@/lib/notifications'
import FileUpload from '@/components/FileUpload'
import PettyCashForm from '@/components/PettyCashForm'
import { Paperclip } from 'lucide-react'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

export default function EditPettyCashPage() {
  const { id } = useParams() as { id: string }
  const [pcNumber, setPcNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [originalPc, setOriginalPc] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPC()
  }, [id])

  const fetchPC = async () => {
    try {
      const { data: pc, error } = await supabase
        .from('petty_cash')
        .select('*, departments(name)')
        .eq('id', id)
        .single()

      if (error || !pc) {
        alert('ไม่พบข้อมูลใบเบิกเงินสดย่อย')
        router.push('/petty-cash')
        return
      }

      // Auth Check: Only Creator or Admin can edit
      const userId = getCookie('user_id')
      const role = getCookie('user_role')
      if (pc.requester_id !== userId && role !== 'Admin') {
        alert('คุณไม่มีสิทธิ์แก้ไขเอกสารนี้')
        router.push(`/petty-cash/${id}`)
        return
      }

      // Status Check
      if (pc.status === 'Approved' || (pc.current_step > 1 && role !== 'Admin')) {
        alert('ไม่สามารถแก้ไขเอกสารที่ผ่านการพิจารณาหรืออนุมัติแล้วได้')
        router.push(`/petty-cash/${id}`)
        return
      }

      setOriginalPc(pc)
      setPcNumber(pc.pc_number)
      setTitle(pc.title)
      setDescription(pc.description || '')
      setDepartmentName(pc.departments?.name || '')
      setAttachments(pc.attachments || [])

      // Fetch items
      const { data: itemsData } = await supabase
        .from('pc_items')
        .select('*')
        .eq('pc_id', id)
        .order('created_at')
      
      if (itemsData) {
        setItems(itemsData.map(i => ({
          id: i.id,
          description: i.description,
          amount: i.amount || 0
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  const removeItem = (itemId: any) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== itemId))
  }

  const updateItem = (itemId: any, field: string, value: string | number) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
  }

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleSubmit = async (asDraft: boolean) => {
    if (!pcNumber.trim()) return alert('กรุณากรอกเลขที่ PC')
    if (!title.trim()) return alert('กรุณากรอกหัวข้อ')
    if (items.some((i) => !i.description.trim() || Number(i.amount) <= 0)) return alert('กรุณากรอกรายละเอียดและยอดเงินให้ครบถ้วน')

    setSubmitting(true)
    try {
      let currentStep = originalPc.current_step
      let status = asDraft ? 'Draft' : 'Pending'

      // Reset flow if submitting (not as draft)
      if (!asDraft) {
        const { data: firstStep } = await supabase
          .from('approval_chains')
          .select('step_order')
          .eq('document_type', 'PC')
          .eq('is_active', true)
          .order('step_order')
          .limit(1)
          .maybeSingle()
        currentStep = firstStep?.step_order || 1
      }

      const { error: pcErr } = await supabase
        .from('petty_cash')
        .update({
          pc_number: pcNumber.trim(),
          title: title.trim(),
          description: description.trim(),
          status: status,
          current_step: currentStep,
          attachments: attachments,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (pcErr) throw pcErr

      // Sync items
      await supabase.from('pc_items').delete().eq('pc_id', id)

      const itemsInsert = items.map((i) => ({
        pc_id: id,
        description: i.description.trim(),
        amount: Number(i.amount),
      }))
      await supabase.from('pc_items').insert(itemsInsert)

      // LINE Notification
      if (!asDraft) {
        // Find next approver
        const { data: chainInfo } = await supabase
          .from('approval_chains')
          .select('approver_role, step_name')
          .eq('document_type', 'PC')
          .eq('step_order', currentStep)
          .maybeSingle()

        await notifyByRole({
          role: chainInfo?.approver_role || 'Manager',
          departmentId: (chainInfo?.approver_role === 'Manager') ? originalPc.department_id : undefined,
          message: `🔄 มีการแก้ไขและส่งตรวจสอบเอกสารเงินสดย่อยใหม่: ${pcNumber}\n` +
                   `--------------------------\n` +
                   `เรื่อง: ${title}\n` +
                   `ผู้เบิก: ${getCookie('user_name')}\n` +
                   `ยอดเงิน: ${totalAmount.toLocaleString()} บาท\n` +
                   `สถานะ: รอ ${chainInfo?.step_name || 'ผู้อนุมัติ'} ตรวจสอบอีกครั้ง`
        })
      }

      router.push(`/petty-cash/${id}`)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      <p className="text-gray-400 font-black uppercase tracking-[0.25em] text-[10px]">กำลังโหลดข้อมูล PC...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 font-sans">
      <div className="flex items-center gap-4">
        <Link href={`/petty-cash/${id}`} className="p-3 rounded-2xl hover:bg-white hover:shadow-md text-gray-400 transition-all active:scale-90 text-xs font-black">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 border-l-4 border-black pl-4 uppercase tracking-tight">แก้ไขใบเบิกเงินสดย่อย (Edit)</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest ml-5">ปรับปรุงข้อมูลตามรูปแบบเอกสารจริง</p>
        </div>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <PettyCashForm 
          pcNumber={pcNumber} setPcNumber={setPcNumber}
          title={title} setTitle={setTitle}
          departmentName={departmentName}
          items={items} addItem={addItem} removeItem={removeItem} updateItem={updateItem}
          totalAmount={totalAmount}
          description={description} setDescription={setDescription}
          date={originalPc ? new Date(originalPc.created_at).toLocaleDateString('th-TH') : undefined}
        />

        {/* Attachments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> เอกสารแนบ (Attachments)
          </h3>
          <FileUpload 
            value={attachments}
            onChange={setAttachments}
            maxFiles={5}
          />
        </div>

        {/* Actions */}
        <div className="bg-gray-900 rounded-[2rem] p-6 flex justify-between items-center shadow-xl shadow-gray-200">
          <Link href={`/petty-cash/${id}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors ml-4">ยกเลิก</Link>
          <div className="flex gap-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-3 bg-gray-800 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50"
            >
              บันทึกแบบร่าง
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-10 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-3 disabled:opacity-50"
            >
              <Send size={18} strokeWidth={4} />
              {submitting ? 'กำลังบันทึก...' : 'อัปเดตและส่งอนุมัติ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
