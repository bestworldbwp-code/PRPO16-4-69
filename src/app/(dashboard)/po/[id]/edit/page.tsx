'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Loader2, ShoppingCart, Search, Building2, User, ChevronDown } from 'lucide-react'
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

export default function EditPOPage() {
  const { id } = useParams() as { id: string }
  const [poNumber, setPoNumber] = useState('')
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
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [originalPo, setOriginalPo] = useState<any>(null)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [editingVendor, setEditingVendor] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPO()
  }, [id])

  const selectVendor = (v: any) => {
    setVendorName(v.name)
    setVendorAddress(v.address || '')
    setVendorTel(v.tel || '')
    setContactPerson(v.contact_person || '')
    setCreditDays(v.credit_days || 0)
    setTaxId(v.tax_id || '')
    setShowVendorList(false)
  }

  const fetchPO = async () => {
    try {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !po) {
        alert('ไม่พบข้อมูลใบสั่งซื้อ')
        router.push('/po')
        return
      }

      // Auth Check: Only Creator or Admin can edit
      const userId = getCookie('user_id')
      const role = getCookie('user_role')
      if (po.created_by !== userId && role !== 'Admin') {
        alert('คุณไม่มีสิทธิ์แก้ไขเอกสารนี้')
        router.push(`/po/${id}`)
        return
      }

      // Status Check
      if (po.status === 'Approved' || (po.current_step > 1 && role !== 'Admin')) {
        alert('ไม่สามารถแก้ไขเอกสารที่ผ่านการพิจารณาหรืออนุมัติแล้วได้')
        router.push(`/po/${id}`)
        return
      }

      setOriginalPo(po)
      setPoNumber(po.po_number)
      setVendorName(po.vendor_name)
      setVendorAddress(po.vendor_address || '')
      setVendorTel(po.vendor_tel || '')
      setReceiptDate(po.receipt_date || '')
      setCreditDays(po.credit_days || 0)
      setContactPerson(po.contact_person || '')
      setMemo(po.memo || '')
      setDiscount(po.discount || 0)
      setVatPercent(po.vat_percent || 7)
      setTaxId(po.tax_id || '')
      setVendorSearch(po.vendor_name || '')
      setDescription(po.description || '')
      setAttachments(po.attachments || [])

      // Fetch items
      const { data: itemsData } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', id)
        .order('created_at')
      
      if (itemsData) {
        setItems(itemsData.map(i => ({
          id: i.id,
          itemCode: i.item_code || '',
          description: i.description,
          quantity: i.quantity,
          unit: i.unit || 'ชิ้น',
          unitPrice: i.unit_price || 0
        })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), itemCode: '', description: '', quantity: 1, unit: 'ชิ้น', unitPrice: 0 }])
  }

  const removeItem = (itemId: any) => {
    if (items.length > 0) setItems(items.filter((i) => i.id !== itemId))
  }

  const updateItem = (itemId: any, field: string, value: string | number) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
  }

  const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0)
  const afterDiscount = subtotal - (Number(discount) || 0)
  const vatAmount = (afterDiscount * (Number(vatPercent) || 0)) / 100
  const grandTotal = afterDiscount + vatAmount

  const handleSubmit = async (asDraft: boolean) => {
    if (!vendorName.trim()) return alert('กรุณากรอกชื่อผู้จัดจำหน่าย')
    if (items.length === 0) return alert('กรุณาเพิ่มรายการสินค้า')
    if (items.some((i) => !i.description.trim())) return alert('กรุณากรอกรายละเอียดให้ครบ')

    setSubmitting(true)
    try {
      let currentStep = originalPo.current_step
      let status = asDraft ? 'Draft' : 'Pending'

      // Reset to step 1 if submitting (not as draft)
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

      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({
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
          status: status,
          current_step: currentStep,
          tax_id: taxId.trim(),
          attachments: attachments,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (poErr) throw poErr

      // Sync items
      await supabase.from('po_items').delete().eq('po_id', id)

      const itemsInsert = items.map((i) => ({
        po_id: id,
        description: i.description.trim(),
        quantity: i.quantity,
        unit: i.unit.trim(),
        unit_price: i.unitPrice || 0,
      }))
      await supabase.from('po_items').insert(itemsInsert)

      // LINE Notification
      if (!asDraft && originalPo.status !== 'Pending') {
        await notifyByRole({
          role: 'PurchasingManager',
          message: `🔄 มีการแก้ไขและส่งตรวจสอบ PO ใหม่: ${poNumber}\n` +
                   `--------------------------\n` +
                   `ผู้ขาย: ${vendorName}\n` +
                   `มูลค่าสุทธิ: ${grandTotal.toLocaleString()} บาท\n` +
                   `สถานะ: รอคุณพิจารณาตรวจสอบอีกครั้ง`
        })
      }

      router.push(`/po/${id}`)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">กำลังโหลดข้อมูล PO...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 font-sans">
      <div className="flex items-center gap-4">
        <Link href={`/po/${id}`} className="p-3 bg-white rounded-2xl shadow-sm hover:shadow-md text-gray-400 transition-all active:scale-95 border border-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight italic">แก้ไขใบสั่งซื้อ (Edit PO)</h1>
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em]">{poNumber}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 md:p-12 space-y-10">
          {/* Vendor Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex justify-between items-center px-2">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-emerald-500" /> ชื่อผู้ขาย (Vendor) <span className="text-red-500">*</span></span>
                <button 
                  onClick={() => setShowSelectModal(true)}
                  className="text-[11px] text-emerald-600 font-bold uppercase hover:underline"
                >
                  คลิกเพื่อเปลี่ยนซัพพลายเออร์
                </button>
              </label>
              <div 
                onClick={() => setShowSelectModal(true)}
                className={`w-full px-6 py-5 border-2 ${vendorName ? 'border-emerald-200 bg-emerald-50/20' : 'border-gray-50 bg-gray-50/50'} rounded-3xl cursor-pointer hover:border-emerald-500 transition-all group flex items-center justify-between shadow-sm`}
              >
                <div className="flex items-center gap-5">
                  <div className={`p-3.5 rounded-2xl ${vendorName ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-gray-200 text-gray-400'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black italic uppercase italic tracking-tight ${vendorName ? 'text-gray-900' : 'text-gray-400 font-medium italic'}`}>
                      {vendorName || 'กดเลือกจากรายชื่อซัพพลายเออร์...'}
                    </h3>
                    {taxId && <p className="text-[11px] text-emerald-600 font-black uppercase tracking-[0.2em] mt-1">Tax ID: {taxId}</p>}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-full shadow-sm border border-gray-100 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Search className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">ID ผู้เสียภาษี (Tax ID)</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
                placeholder="0XXXXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">ผู้ติดต่อ (Contact Person)</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
                placeholder="ชื่อผู้ติดต่อ/เบอร์โทรตรง"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">ที่อยู่ผู้จัดจำหน่าย</label>
              <textarea
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                rows={2}
                className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30 resize-none"
                placeholder="ที่อยู่สำหรับออกใบกำกับภาษี"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">เบอร์โทรศัพท์ (Vendor Tel)</label>
              <input
                type="text"
                value={vendorTel}
                onChange={(e) => setVendorTel(e.target.value)}
                className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
                placeholder="02-XXX-XXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">วันที่รับของ</label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1">เครดิต (วัน)</label>
                <input
                  type="number"
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value))}
                  className="w-full px-6 py-4 border-2 border-gray-50 rounded-2xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/30"
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-emerald-50/20 rounded-[2.5rem] p-8 md:p-10 border border-emerald-100/50">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-black text-emerald-900 text-xs uppercase tracking-[0.3em] flex items-center gap-3">
                <ShoppingCart className="w-5 h-5" /> รายการสั่งซื้อสินค้า
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="text-[10px] flex items-center gap-2 text-white bg-emerald-600 hover:bg-black px-6 py-3 rounded-2xl transition-all font-black uppercase tracking-widest shadow-xl shadow-emerald-100 active:scale-95"
              >
                <Plus size={16} strokeWidth={3} /> เพิ่มรายการ
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm transition-all focus-within:border-emerald-400 focus-within:shadow-lg focus-within:shadow-emerald-50 relative group">
                  <div className="md:col-span-2 space-y-1.5 font-sans">
                    <span className="text-[9px] font-black text-gray-300 uppercase ml-2 tracking-widest">รหัสสินค้า</span>
                    <input type="text" value={item.itemCode || ''} onChange={(e) => updateItem(item.id, 'itemCode', e.target.value)}
                      className="w-full px-4 py-3 text-sm border-none bg-gray-50 rounded-2xl outline-none font-bold placeholder:text-gray-200" placeholder="รหัส..." />
                  </div>
                  <div className="md:col-span-4 space-y-1.5 font-sans">
                    <span className="text-[9px] font-black text-gray-300 uppercase ml-2 tracking-widest">รายละเอียด</span>
                    <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full px-4 py-3 text-sm border-none bg-gray-50 rounded-2xl outline-none font-bold placeholder:text-gray-200" />
                  </div>
                  <div className="md:col-span-1 space-y-1.5 text-center">
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest font-sans">จำนวน</span>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-full px-4 py-3 text-sm border-none bg-gray-50 rounded-2xl outline-none font-black text-center text-emerald-600" />
                  </div>
                  <div className="md:col-span-1 space-y-1.5 text-center">
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest font-sans">หน่วย</span>
                    <input type="text" value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-4 py-3 text-sm border-none bg-gray-50 rounded-2xl outline-none font-bold text-center" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest font-sans">ราคา/หน่วย</span>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs font-sans">฿</span>
                      <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        className="w-full pl-8 pr-4 py-3 text-sm border-none bg-gray-50 rounded-2xl outline-none font-black text-right font-sans" />
                    </div>
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between gap-2 pt-5">
                    <span className="text-[10px] font-black text-gray-900 w-full text-right bg-emerald-50 px-3 py-3 rounded-2xl font-sans">
                      ฿{((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => removeItem(item.id)} className="p-3 text-red-300 hover:text-red-600 transition-all absolute -right-2 md:relative md:right-0">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-end">
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-2">หมายเหตุท้ายตาราง (Memo)</label>
                  <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4}
                    className="w-full px-6 py-4 border-2 border-gray-50 rounded-3xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-white resize-none"
                    placeholder="เงื่อนไขเพิ่มเติมที่จะแสดงในเอกสาร..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-2">หมายเหตุภายใน (Internal Description)</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                    className="w-full px-6 py-4 border-2 border-gray-50 rounded-3xl focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-white resize-none"
                    placeholder="สำหรับตรวจสอบภายใน..." />
                </div>
              </div>

              <div className="bg-emerald-900 px-8 py-8 rounded-[3rem] text-white shadow-2xl shadow-emerald-200 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                   <span>รวมเป็นเงิน (Subtotal)</span>
                   <span className="text-sm font-sans">฿{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">หักส่วนลด (Discount)</span>
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl">
                    <span className="text-[10px] font-sans">฿</span>
                    <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-24 bg-transparent border-none outline-none text-right font-black text-sm font-sans" />
                  </div>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                   <span>ยอดหลังหักส่วนลด</span>
                   <span className="text-sm font-sans">฿{afterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-sans">VAT</span>
                    <input type="number" value={vatPercent} onChange={(e) => setVatPercent(Number(e.target.value))}
                      className="w-10 bg-white/10 border-none outline-none text-center font-black text-xs rounded-lg py-1 px-1 font-sans text-emerald-400" />
                    <span className="text-[10px] font-black opacity-40">%</span>
                  </div>
                  <span className="text-sm font-sans font-black">฿{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-white/20 shadow-sm" />
                <div className="flex justify-between items-end pt-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Total Amount</p>
                  <p className="text-3xl font-black font-sans tracking-tight leading-none text-emerald-400">
                    <span className="text-xs mr-1 opacity-50 font-normal">฿</span>
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-2">หมายเหตุการสั่งซื้อ</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full px-8 py-5 border-2 border-gray-50 rounded-[2.5rem] focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-gray-50/10 resize-none"
              placeholder="ระบุข้อความเพิ่มเติมสำหรับผู้พิจารณา..." />
          </div>

          {/* Attachments */}
          <div className="pt-8 border-t border-gray-50">
             <FileUpload 
              value={attachments}
              onChange={setAttachments}
              maxFiles={5}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-50/50 border-t border-gray-100 px-12 py-10 flex justify-between items-center">
          <Link href={`/po/${id}`} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors">ยกเลิกการแก้ไข</Link>
          <div className="flex gap-5">
            <button onClick={() => handleSubmit(true)} disabled={submitting}
              className="px-8 py-4 bg-white border border-gray-200 text-gray-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50 active:scale-95 shadow-sm">
              บันทึกแบบร่าง
            </button>
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="px-12 py-4 bg-emerald-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-emerald-200 disabled:opacity-50 flex items-center gap-3 active:scale-95">
              <Send size={16} strokeWidth={3} />
              {submitting ? 'กำลังบันทึก...' : 'บันทึกและส่งตรวจสอบ'}
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
