'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import { notifyByRole } from '@/lib/notifications'
import FileUpload from '@/components/FileUpload'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

export default function EditPRPage() {
  const { id } = useParams() as { id: string }
  const [prNumber, setPrNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [originalPr, setOriginalPr] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPR()
  }, [id])

  const fetchPR = async () => {
    try {
      const { data: pr, error } = await supabase
        .from('purchase_requests')
        .select('*, departments(name)')
        .eq('id', id)
        .single()

      if (error || !pr) {
        alert('ไม่พบข้อมูลใบขอซื้อ')
        router.push('/pr')
        return
      }

      // Auth Check: Only Creator or Admin can edit
      const userId = getCookie('user_id')
      const role = getCookie('user_role')
      if (pr.requester_id !== userId && role !== 'Admin') {
        alert('คุณไม่มีสิทธิ์แก้ไขเอกสารนี้')
        router.push(`/pr/${id}`)
        return
      }

      // Status Check: Approved documents or documents past Manager approval (Step 1) cannot be edited
      if (pr.status === 'Approved' || (pr.current_step > 1 && role !== 'Admin')) {
        alert('ไม่สามารถแก้ไขเอกสารที่ผ่านการพิจารณาหรืออนุมัติแล้วได้')
        router.push(`/pr/${id}`)
        return
      }

      setOriginalPr(pr)
      setPrNumber(pr.pr_number)
      setTitle(pr.title)
      setDescription(pr.description || '')
      setDepartmentId(pr.department_id)
      setDepartmentName(pr.departments?.name || '')
      setAttachments(pr.attachments || [])

      // Fetch items
      const { data: itemsData } = await supabase
        .from('pr_items')
        .select('*')
        .eq('pr_id', id)
        .order('created_at')
      
      if (itemsData) {
        setItems(itemsData.map(i => ({
          id: i.id,
          itemCode: i.item_code || '',
          description: i.description,
          quantity: i.quantity,
          unit: i.unit || 'ชิ้น'
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), itemCode: '', description: '', quantity: 1, unit: 'ชิ้น' }])
  }

  const removeItem = (itemId: any) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== itemId))
  }

  const updateItem = (itemId: any, field: string, value: string | number) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
  }

  const handleSubmit = async (asDraft: boolean) => {
    if (!prNumber.trim()) return alert('กรุณากรอกเลขที่ PR')
    if (!title.trim()) return alert('กรุณากรอกหัวข้อ')
    if (items.some((i) => !i.description.trim())) return alert('กรุณากรอกรายละเอียดสินค้าให้ครบ')

    setSubmitting(true)
    try {
      // 1. Update Main Document
      let currentStep = originalPr.current_step
      let status = asDraft ? 'Draft' : 'Pending'

      // Reset to first step if submitting (not saving as draft)
      if (!asDraft) {
        const { data: firstStep } = await supabase
          .from('approval_chains')
          .select('step_order')
          .eq('document_type', 'PR')
          .eq('is_active', true)
          .order('step_order')
          .limit(1)
          .maybeSingle()
        currentStep = firstStep?.step_order || 1
      }

      const { error: prErr } = await supabase
        .from('purchase_requests')
        .update({
          pr_number: prNumber.trim(),
          title: title.trim(),
          description: description.trim(),
          status: status,
          current_step: currentStep,
          attachments: attachments,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (prErr) throw prErr

      // 2. Sync Items: Delete old ones and insert new ones
      await supabase.from('pr_items').delete().eq('pr_id', id)

      const prItems = items.map((i) => ({
        pr_id: id,
        item_code: i.itemCode.trim(),
        description: i.description.trim(),
        quantity: i.quantity,
        unit: i.unit.trim(),
      }))
      await supabase.from('pr_items').insert(prItems)

      // 3. Notification
      if (!asDraft && originalPr.status !== 'Pending') {
        await notifyByRole({
          role: 'Manager',
          departmentId: departmentId,
          message: `🔄 มีการแก้ไขและส่งตรวจสอบ PR ใหม่: ${prNumber}\n` +
                   `--------------------------\n` +
                   `เรื่อง: ${title}\n` +
                   `ผู้เบิก: ${getCookie('user_name')}\n` +
                   `สถานะ: รอคุณพิจารณาอนุมัติอีกครั้ง`
        })
      }

      router.push(`/pr/${id}`)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-gray-500 font-medium font-sans uppercase tracking-[0.2em] text-[10px]">กำลังโหลดข้อมูล...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
      <div className="flex items-center gap-3">
        <Link href={`/pr/${id}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase">แก้ไขใบขอซื้อ (Edit PR)</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{prNumber}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-300 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-8 md:p-10 space-y-8">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">เลขที่เอกสาร <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                className="w-full px-5 py-3 border border-slate-300 rounded-2xl focus:border-blue-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">แผนก</label>
              <div className="w-full px-5 py-3 border border-slate-300 rounded-2xl bg-gray-50 text-gray-400 text-sm font-bold">
                {departmentName}
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">หัวข้อ/เรื่อง <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-5 py-3 border border-slate-300 rounded-2xl focus:border-blue-500 outline-none transition-all text-sm font-bold"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-blue-50/30 rounded-[2rem] p-8 border border-slate-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black text-gray-800 text-xs uppercase tracking-[0.2em]">📦 รายการสินค้าที่ขอซื้อ</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-[10px] flex items-center gap-2 text-white bg-blue-600 hover:bg-black px-5 py-2.5 rounded-full transition-all font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-5 bg-white rounded-2xl border border-slate-300 shadow-sm transition-all focus-within:border-blue-400">
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[8px] font-black text-gray-300 uppercase ml-1">รหัส</span>
                    <input
                      type="text"
                      value={item.itemCode}
                      onChange={(e) => updateItem(item.id, 'itemCode', e.target.value)}
                      className="w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl outline-none font-bold placeholder:text-gray-200"
                    />
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <span className="text-[8px] font-black text-gray-300 uppercase ml-1">รายละเอียดสินค้า *</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl outline-none font-bold"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1 text-center">
                    <span className="text-[8px] font-black text-gray-300 uppercase">จำนวน</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl outline-none font-black text-center text-blue-600"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1 text-center">
                    <span className="text-[8px] font-black text-gray-300 uppercase">หน่วย</span>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-3 py-2 text-sm border-none bg-gray-50 rounded-xl outline-none font-bold text-center"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center pt-4">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-10"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">หมายเหตุเพิ่มเติม</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-6 py-4 border border-slate-300 rounded-[2rem] focus:border-blue-500 outline-none transition-all text-sm font-bold bg-gray-50/20"
              placeholder="ระบุเหตุผลการแก้ไข หรือข้อมูลเพิ่มเติม..."
            />
          </div>

          {/* Attachments */}
          <div className="pt-6 border-t border-slate-300">
             <FileUpload 
              value={attachments}
              onChange={setAttachments}
              maxFiles={5}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 border-t border-gray-100 px-10 py-8 flex justify-between items-center">
          <Link href={`/pr/${id}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">ยกเลิกการแก้ไข</Link>
          <div className="flex gap-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-3.5 bg-white border border-gray-200 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50 active:scale-95"
            >
              บันทึกแบบร่าง
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center gap-3 active:scale-95"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'กำลังบันทึก...' : 'บันทึกและส่งอนุมัติ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
