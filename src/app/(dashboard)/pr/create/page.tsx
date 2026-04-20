'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send } from 'lucide-react'
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

export default function CreatePRPage() {
  const [prNumber, setPrNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [items, setItems] = useState([{ id: crypto.randomUUID(), itemCode: '', description: '', quantity: 1, unit: 'ชิ้น' }])
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const router = useRouter()

  useEffect(() => {
    // Set user's department and fetch its name
    const fetchDept = async () => {
      let deptId = getCookie('user_dept_id')
      
      // Fallback: if cookie missing, fetch from user table
      if (!deptId) {
        const userId = getCookie('user_id')
        if (userId) {
          const { data: user } = await supabase.from('users').select('department_id').eq('id', userId).single()
          if (user?.department_id) deptId = user.department_id
        }
      }

      if (deptId) {
        setDepartmentId(deptId)
        const { data } = await supabase.from('departments').select('name').eq('id', deptId).maybeSingle()
        if (data) setDepartmentName(data.name)
        else setDepartmentName('ไม่พบข้อมูลแผนก')
      } else {
        setDepartmentName('ยังไม่มีการระบุแผนก')
      }
    }

    fetchDept()

    // Generate PR number
    const year = new Date().getFullYear()
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
    setPrNumber(`PR-${year}-${rand}`)
  }, [])

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), itemCode: '', description: '', quantity: 1, unit: 'ชิ้น' }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id))
  }

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const handleSubmit = async (asDraft: boolean) => {
    if (!prNumber.trim()) return alert('กรุณากรอกเลขที่ PR')
    if (!title.trim()) return alert('กรุณากรอกหัวข้อ')
    if (!departmentId) return alert('กรุณาเลือกแผนก')
    if (items.some((i) => !i.description.trim())) return alert('กรุณากรอกรายละเอียดสินค้าให้ครบ')

    setLoading(true)
    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      // Get first active step for PR
      let currentStep = 0
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

      const { data: pr, error: prErr } = await supabase
        .from('purchase_requests')
        .insert({
          pr_number: prNumber.trim(),
          title: title.trim(),
          description: description.trim(),
          requester_id: userId,
          department_id: departmentId,
          status: asDraft ? 'Draft' : 'Pending',
          current_step: currentStep,
          attachments: attachments,
        })
        .select()
        .single()

      if (prErr) throw prErr

      // Insert items
      const prItems = items.map((i) => ({
        pr_id: pr.id,
        item_code: i.itemCode.trim(),
        description: i.description.trim(),
        quantity: i.quantity,
        unit: i.unit.trim(),
      }))
      await supabase.from('pr_items').insert(prItems)

      // 3. Send LINE notification to the correct approver based on the first step
      if (!asDraft) {
        const { data: chainInfo } = await supabase
          .from('approval_chains')
          .select('approver_role, step_name')
          .eq('document_type', 'PR')
          .eq('step_order', currentStep)
          .maybeSingle()

        await notifyByRole({
          role: chainInfo?.approver_role || 'Manager',
          departmentId: (chainInfo?.approver_role === 'Manager') ? departmentId : undefined, // Only filter by dept if it's a regular Manager
          message: `🔔 มีใบขอซื้อ (PR) ใหม่รอการพิจารณา!\n` +
                   `--------------------------\n` +
                   `เลขที่: ${pr.pr_number}\n` +
                   `เรื่อง: ${pr.title}\n` +
                   `ผู้เบิก: ${getCookie('user_name')}\n` +
                   `สถานะ: รอ ${chainInfo?.step_name || 'ผู้อนุมัติ'} ตรวจสอบ`
        })
      }

      router.push('/pr')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/pr" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สร้างใบขอซื้อ (PR)</h1>
          <p className="text-gray-500 text-sm">กรอกข้อมูลใบขอซื้อสินค้า/บริการ</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">เลขที่ PR <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all text-sm"
                placeholder="PR-2025-0001"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">แผนก <span className="text-red-500">*</span></label>
              <div className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-gray-50 text-gray-600 text-sm font-medium">
                {departmentName || 'กำลังโหลด...'}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">* ล็อกตามแผนกที่ลงทะเบียนไว้</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">หัวข้อ/เรื่อง <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all text-sm"
                placeholder="ขอซื้อวัสดุสำนักงาน"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-blue-50/40 rounded-2xl p-6 border border-slate-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-800">📦 รายการสินค้า</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-sm flex items-center gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-full transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ
              </button>
            </div>

            <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <div className="col-span-2">รหัส</div>
              <div className="col-span-5">รายละเอียด</div>
              <div className="col-span-2 text-center">จำนวน</div>
              <div className="col-span-2 text-center">หน่วย</div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-4 bg-white rounded-xl border border-slate-300 shadow-sm">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="รหัส"
                      value={item.itemCode}
                      onChange={(e) => updateItem(item.id, 'itemCode', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      placeholder="รายละเอียด *"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">หมายเหตุ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all text-sm resize-none"
              placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </div>

          {/* Attachments */}
          <div className="pt-4 border-t border-slate-300">
            <FileUpload 
              value={attachments}
              onChange={setAttachments}
              maxFiles={5}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 md:px-8 py-4 flex justify-between items-center">
          <Link href="/pr" className="text-sm text-gray-500 hover:text-gray-700 font-medium">ยกเลิก</Link>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              บันทึกแบบร่าง
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'กำลังส่ง...' : 'ส่งอนุมัติ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
