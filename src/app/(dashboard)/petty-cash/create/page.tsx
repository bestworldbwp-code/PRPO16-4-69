'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Wallet } from 'lucide-react'
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

import PettyCashForm from '@/components/PettyCashForm'

export default function CreatePettyCashPage() {
  const [pcNumber, setPcNumber] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [items, setItems] = useState([{ id: crypto.randomUUID(), description: '', amount: 0 }])
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

    // Generate PC number
    const year = new Date().getFullYear()
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
    setPcNumber(`PC-${year}-${rand}`)
  }, [])

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter((i) => i.id !== id))
  }

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleSubmit = async (asDraft: boolean) => {
    if (!pcNumber.trim()) return alert('กรุณากรอกเลขที่ PC')
    if (!title.trim()) return alert('กรุณากรอกหัวข้อการเบิก')
    if (!departmentId) return alert('กรุณาเลือกแผนก')
    if (items.some((i) => !i.description.trim() || i.amount <= 0)) return alert('กรุณากรอกรายละเอียดและจำนวนเงินให้ถูกต้อง')

    setLoading(true)
    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      // Get first active step for PC
      let currentStep = 0
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

      const { data: pc, error: pcErr } = await supabase
        .from('petty_cash')
        .insert({
          pc_number: pcNumber.trim(),
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

      if (pcErr) throw pcErr

      // Insert items
      const pcItems = items.map((i) => ({
        pc_id: pc.id,
        description: i.description.trim(),
        amount: Number(i.amount),
      }))
      await supabase.from('pc_items').insert(pcItems)

      // 3. Send LINE notification to the correct approver based on the first step
      if (!asDraft) {
        const { data: chainInfo } = await supabase
          .from('approval_chains')
          .select('approver_role, step_name')
          .eq('document_type', 'PC')
          .eq('step_order', currentStep)
          .maybeSingle()

        await notifyByRole({
          role: chainInfo?.approver_role || 'Manager',
          departmentId: (chainInfo?.approver_role === 'Manager') ? departmentId : undefined,
          message: `🔔 มีใบเบิกเงินสดย่อย (PC) ใหม่รอการพิจารณา!\n` +
                   `--------------------------\n` +
                   `เลขที่: ${pc.pc_number}\n` +
                   `เรื่อง: ${pc.title}\n` +
                   `ผู้เบิก: ${getCookie('user_name')}\n` +
                   `ยอดเงิน: ${totalAmount.toLocaleString()} บาท\n` +
                   `สถานะ: รอ ${chainInfo?.step_name || 'ผู้อนุมัติ'} ตรวจสอบ`
        })
      }

      router.push('/petty-cash')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/petty-cash" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 border-l-4 border-black pl-4 uppercase tracking-tight">แบบฟอร์มเบิกเงินสดย่อย (Entry)</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest ml-5">ลงบันทึกรายการตามรูปแบบเอกสารจริง</p>
        </div>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* The Paper-Like Form */}
        <PettyCashForm 
          pcNumber={pcNumber} setPcNumber={setPcNumber}
          title={title} setTitle={setTitle}
          departmentName={departmentName}
          items={items} addItem={addItem} removeItem={removeItem} updateItem={updateItem}
          totalAmount={totalAmount}
          description={description} setDescription={setDescription}
        />

        {/* Attachments Section (Modern UI kept for utility) */}
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
          <Link href="/petty-cash" className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors ml-4">ยกเลิก</Link>
          <div className="flex gap-4">
            <button
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className="px-6 py-3 bg-gray-800 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-700 hover:text-white transition-all disabled:opacity-50"
            >
              บันทึกแบบร่าง
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="px-10 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-3 disabled:opacity-50"
            >
              <Send className="w-4 h-4 stroke-[3px]" />
              {loading ? 'กำลังส่ง...' : 'ส่งขออนุมัติ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Paperclip } from 'lucide-react'

