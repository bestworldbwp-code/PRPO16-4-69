'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Search, Building2, User, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import FileUpload from '@/components/FileUpload'
import VendorModal from '@/components/VendorModal'
import VendorSelectModal from '@/components/VendorSelectModal'
import { notifyByRole } from '@/lib/notifications'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

function CreatePOContent() {
  const searchParams = useSearchParams()
  const initialPrId = searchParams?.get('pr_id') || ''
  const [selectedPrId, setSelectedPrId] = useState(initialPrId)
  const [selectedPr, setSelectedPr] = useState<any>(null)
  const [approvedPrs, setApprovedPrs] = useState<any[]>([])
  const [vendorName, setVendorName] = useState('')
  const [vendorAddress, setVendorAddress] = useState('')
  const [vendorTel, setVendorTel] = useState('')
  const [receiptDate, setReceiptDate] = useState('')
  const [creditDays, setCreditDays] = useState(0)
  const [contactPerson, setContactPerson] = useState('')
  const [memo, setMemo] = useState('')
  const [discount, setDiscount] = useState(0)
  const [vatPercent, setVatPercent] = useState(7)
  const [taxId, setTaxId] = useState('')
  
  const [vendors, setVendors] = useState<any[]>([])
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorList, setShowVendorList] = useState(false)
  
  const [description, setDescription] = useState('')
  const [poItems, setPoItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Fetch approved PRs
    supabase
      .from('purchase_requests')
      .select('id, pr_number, title')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setApprovedPrs(data) })
  }, [])

  const selectVendor = (v: any) => {
    setVendorName(v.name)
    setVendorAddress(v.address || '')
    setVendorTel(v.tel || '')
    setContactPerson(v.contact_person || '')
    setCreditDays(v.credit_days || 0)
    setTaxId(v.tax_id || '')
    setShowVendorList(false)
  }

  useEffect(() => {
    if (!selectedPrId) { setSelectedPr(null); setPoItems([]); return }

    // Fetch PR details + items
    const fetch = async () => {
      const { data: pr } = await supabase.from('purchase_requests').select('*').eq('id', selectedPrId).single()
      if (pr) setSelectedPr(pr)

      const { data: items } = await supabase.from('pr_items').select('*').eq('pr_id', selectedPrId)
      if (items) {
        setPoItems(items.map((item) => ({
          id: item.id,
          itemCode: item.item_code || '',
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: 0,
        })))
      }
    }
    fetch()
  }, [selectedPrId])

  const addItem = () => {
    setPoItems([...poItems, { id: crypto.randomUUID(), itemCode: '', description: '', quantity: 1, unit: 'ชิ้น', unitPrice: 0 }])
  }

  const removeItem = (id: string) => {
    if (poItems.length > 0) setPoItems(poItems.filter((i) => i.id !== id))
  }

  const updateItem = (id: string, field: string, value: string | number) => {
    setPoItems(poItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const subtotal = poItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0)
  const afterDiscount = subtotal - (Number(discount) || 0)
  const vatAmount = (afterDiscount * (Number(vatPercent) || 0)) / 100
  const grandTotal = afterDiscount + vatAmount

  const handleSubmit = async (asDraft: boolean) => {
    if (!vendorName.trim()) return alert('กรุณากรอกชื่อผู้จัดจำหน่าย')
    if (poItems.length === 0) return alert('กรุณาเพิ่มรายการสินค้า')
    if (poItems.some((i) => !i.description.trim())) return alert('กรุณากรอกรายละเอียดให้ครบ')

    setLoading(true)
    try {
      const userId = getCookie('user_id')
      if (!userId) throw new Error('กรุณาเข้าสู่ระบบ')

      const year = new Date().getFullYear()
      const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
      const poNumber = `PO-${year}-${rand}`

      let currentStep = 0
      if (!asDraft) {
        const { data: firstStep } = await supabase
          .from('approval_chains')
          .select('step_order')
          .eq('document_type', 'PO')
          .eq('is_active', true)
          .order('step_order')
          .limit(1)
          .maybeSingle()
        currentStep = firstStep?.step_order || 1
      }

      const { data: profile } = await supabase
        .from('users')
        .select('department_id')
        .eq('id', userId)
        .single()

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          pr_id: selectedPrId || null,
          vendor_name: vendorName.trim(),
          vendor_address: vendorAddress.trim(),
          vendor_tel: vendorTel.trim(),
          receipt_date: receiptDate || null,
          credit_days: creditDays,
          contact_person: contactPerson.trim(),
          memo: memo.trim(),
          discount: Number(discount) || 0,
          vat_percent: Number(vatPercent) || 0,
          description: description.trim(),
          created_by: userId,
          department_id: profile?.department_id, // บันทึกแผนกเพื่อการแยกแผนกแบบเด็ดขาด
          status: asDraft ? 'Draft' : 'Pending',
          current_step: currentStep,
          tax_id: taxId.trim(),
          attachments: attachments,
        })
        .select()
        .single()

      if (poErr) throw poErr

      // Insert PO items
      const itemsInsert = poItems.map((i) => ({
        po_id: po.id,
        item_code: i.itemCode?.trim() || null,
        description: i.description.trim(),
        quantity: i.quantity,
        unit: i.unit.trim(),
        unit_price: i.unitPrice || 0,
      }))
      await supabase.from('po_items').insert(itemsInsert)

      // Send LINE notification to Department Manager (New Workflow)
      if (!asDraft) {
        try {
          await notifyByRole({
            role: 'PurchasingManager',
            departmentId: profile?.department_id,
            message: `🔔 มีใบสั่งซื้อ (PO) ใหม่รอคุณอนุมัติ!\n` +
                     `--------------------------\n` +
                     `เลขที่: ${po.po_number}\n` +
                     `ผู้ขาย: ${po.vendor_name}\n` +
                     `มูลค่าสุทธิ: ${grandTotal.toLocaleString()} บาท\n` +
                     `สถานะ: รอ ผจก.จัดซื้อ ตรวจสอบ`
          })
        } catch (notifErr) {
          console.warn('LINE Notification failed but PO was created:', notifErr)
        }
      }

      router.push('/po')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/po" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สร้างใบสั่งซื้อ (PO)</h1>
          <p className="text-gray-500 text-sm">ออก PO จาก PR ที่อนุมัติแล้ว</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* Reference PR */}
          <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
            <h2 className="text-sm font-bold text-emerald-800 uppercase tracking-wide mb-3">📎 อ้างอิง PR (ถ้ามี)</h2>
            <select
              value={selectedPrId}
              onChange={(e) => setSelectedPrId(e.target.value)}
              className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm bg-white"
            >
              <option value="">-- ไม่เลือก / สร้าง PO อิสระ --</option>
              {approvedPrs.map((pr) => (
                <option key={pr.id} value={pr.id}>{pr.pr_number} — {pr.title}</option>
              ))}
            </select>
          </div>

          {/* Vendor + Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between items-center">
                <span>ผู้จัดจำหน่าย (Vendor) <span className="text-red-500">*</span></span>
                <button 
                  onClick={() => setShowSelectModal(true)}
                  className="text-[11px] text-emerald-600 font-bold uppercase hover:underline"
                >
                  คลิกเพื่อเปลี่ยนซัพพลายเออร์
                </button>
              </label>
              <div 
                onClick={() => setShowSelectModal(true)}
                className={`w-full px-5 py-4 border-2 ${vendorName ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-300 bg-gray-50/30'} rounded-3xl cursor-pointer hover:border-emerald-500 transition-all group flex items-center justify-between`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-2xl ${vendorName ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-bold ${vendorName ? 'text-gray-900' : 'text-gray-400 font-medium italic'} text-sm`}>
                      {vendorName || 'กดเลือกจากรายชื่อซัพพลายเออร์...'}
                    </p>
                    {taxId && <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Tax ID: {taxId}</p>}
                  </div>
                </div>
                <Search className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ผู้ติดต่อ (Contact Person)</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all text-sm"
                placeholder="ชื่อผู้ติดต่อ/เบอร์โทรตรง"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ที่อยู่ผู้จัดจำหน่าย</label>
              <textarea
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all text-sm resize-none"
                placeholder="ที่อยู่สำหรับออกใบกำกับภาษี"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">เบอร์โทรศัพท์ (Vendor Tel)</label>
              <input
                type="text"
                value={vendorTel}
                onChange={(e) => setVendorTel(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all text-sm"
                placeholder="02-XXX-XXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">วันที่รับของ</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">เครดิต (วัน)</label>
                <input
                  type="number"
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all text-sm"
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          {/* PO Items */}
          <div className="bg-emerald-50/30 rounded-2xl p-6 border border-emerald-100/50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-800">🛒 รายการสั่งซื้อ</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-sm flex items-center gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-full transition-colors font-medium"
              >
                <Plus className="w-4 h-4" /> เพิ่มรายการ
              </button>
            </div>

            <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <div className="col-span-2">รหัสสินค้า</div>
              <div className="col-span-4">รายละเอียด</div>
              <div className="col-span-1 text-center">จำนวน</div>
              <div className="col-span-1 text-center">หน่วย</div>
              <div className="col-span-2 text-center">ราคา/หน่วย</div>
              <div className="col-span-2 text-right">รวม</div>
            </div>

            <div className="space-y-3">
              {poItems.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-4 bg-white rounded-xl border border-slate-300 shadow-sm relative group">
                  <div className="md:col-span-2">
                    <input type="text" placeholder="รหัสสินค้า" value={item.itemCode || ''}
                      onChange={(e) => updateItem(item.id, 'itemCode', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div className="md:col-span-4">
                    <input type="text" placeholder="รายละเอียด *" value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div className="md:col-span-1">
                    <input type="number" min={1} value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div className="md:col-span-1">
                    <input type="text" value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <input type="number" min={0} step="0.01" value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500/20 outline-none" placeholder="0.00" />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-900 w-full text-right bg-gray-50 px-2 py-2 rounded-lg">
                      ฿{((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => removeItem(item.id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute -right-2 md:relative md:right-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {poItems.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">ยังไม่มีรายการ — เลือก PR หรือเพิ่มรายการด้านบน</div>
              )}
            </div>
          </div>

          {/* Calculations Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>หมายเหตุท้ายตาราง (Memo)</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">จะปรากฏใต้ตารางรายการ</span>
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm resize-none"
                  placeholder="เช่น กำหนดส่งของที่คลังสินค้า..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">หมายเหตุภายใน (Internal Description)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm resize-none"
                  placeholder="ระบุหมายเหตุสำหรับตรวจสอบภายใน"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-slate-300 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">รวมเป็นเงิน (Subtotal)</span>
                <span className="text-gray-900 font-bold">฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium whitespace-nowrap">หักส่วนลด (Discount)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">฿</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-32 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-right focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold"
                  />
                </div>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">จำนวนเงินหลังหักส่วนลด</span>
                <span className="text-gray-900 font-bold">฿{afterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <span className="text-sm text-gray-500 font-medium">ภาษีมูลค่าเพิ่ม (VAT)</span>
                   <input
                    type="number"
                    value={vatPercent}
                    onChange={(e) => setVatPercent(Number(e.target.value))}
                    className="w-12 px-1.5 py-1 text-xs border border-slate-300 rounded shadow-inner text-center focus:ring-2 focus:ring-emerald-500/20 outline-none font-black text-emerald-700"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <span className="text-gray-900 font-bold">฿{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-gray-300 my-1 shadow-sm" />
              <div className="flex justify-between items-center">
                <span className="text-base font-black text-gray-900 uppercase tracking-wide">จำนวนเงินรวมทั้งสิ้น</span>
                <span className="text-xl font-black text-emerald-700">฿{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
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

        <div className="bg-gray-50 border-t border-slate-300 px-6 md:px-8 py-4 flex justify-between items-center">
          <Link href="/po" className="text-sm text-gray-500 hover:text-gray-700 font-medium">ยกเลิก</Link>
          <div className="flex gap-3">
            <button onClick={() => handleSubmit(true)} disabled={loading}
              className="px-5 py-2.5 bg-white border border-slate-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
              บันทึกแบบร่าง
            </button>
            <button onClick={() => handleSubmit(false)} disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
              <Send className="w-4 h-4" /> {loading ? 'กำลังส่ง...' : 'ส่งอนุมัติ'}
            </button>
          </div>
        </div>
      </div>

      <VendorModal 
        isOpen={showVendorModal}
        onClose={() => {
            setShowVendorModal(false)
            setEditingVendor(null)
        }}
        initialData={editingVendor}
        onSuccess={(v) => {
            selectVendor(v)
        }}
      />

      <VendorSelectModal
        isOpen={showSelectModal}
        onClose={() => setShowSelectModal(false)}
        onSelect={(v) => {
            selectVendor(v)
            setShowSelectModal(false)
        }}
        onAddNew={() => {
            setEditingVendor(null)
            setShowVendorModal(true)
        }}
        onEdit={(v) => {
            setEditingVendor(v)
            setShowSelectModal(false)
            setShowVendorModal(true)
        }}
      />
    </div>
  )
}

export default function CreatePOPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Preparing PO Form...</p>
      </div>
    }>
      <CreatePOContent />
    </Suspense>
  )
}
