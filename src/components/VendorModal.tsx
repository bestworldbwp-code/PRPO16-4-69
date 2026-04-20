'use client'

import { useState, useEffect } from 'react'
import { X, Save, Building2, User, Phone, MapPin, CreditCard, Hash, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VendorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (vendor: any) => void
  initialData?: any
}

export default function VendorModal({ isOpen, onClose, onSuccess, initialData }: VendorModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tax_id: '',
    address: '',
    tel: '',
    contact_person: '',
    credit_days: 0,
    status: 'Active',
    business_type: '',
    note: ''
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        tax_id: initialData.tax_id || '',
        address: initialData.address || '',
        tel: initialData.tel || '',
        contact_person: initialData.contact_person || '',
        credit_days: initialData.credit_days || 0,
        status: initialData.status || 'Active',
        business_type: initialData.business_type || '',
        note: initialData.note || ''
      })
    } else {
      setFormData({
        name: '',
        code: '',
        tax_id: '',
        address: '',
        tel: '',
        contact_person: '',
        credit_days: 0,
        status: 'Active',
        business_type: '',
        note: ''
      })
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return alert('กรุณาระบุชื่อซัพพลายเออร์')

    setLoading(true)
    try {
      let result
      if (initialData?.id) {
        result = await supabase
          .from('vendors')
          .update({
            ...formData,
            name: formData.name.trim(),
            code: formData.code.trim(),
            tax_id: formData.tax_id.trim(),
            address: formData.address.trim(),
            tel: formData.tel.trim(),
            contact_person: formData.contact_person.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', initialData.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('vendors')
          .insert([{
            ...formData,
            name: formData.name.trim(),
            code: formData.code.trim(),
            tax_id: formData.tax_id.trim(),
            address: formData.address.trim(),
            tel: formData.tel.trim(),
            contact_person: formData.contact_person.trim(),
          }])
          .select()
          .single()
      }

      const { data, error } = result
      if (error) throw error
      onSuccess(data)
      onClose()
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Professional Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {initialData ? 'แก้ไขข้อมูลซัพพลายเออร์' : 'เพิ่มซัพพลายเออร์ใหม่'}
              </h2>
              <p className="text-slate-500 text-[11px] font-medium tracking-wide">
                {initialData ? 'อัปเดตข้อมูลรายละเอียดผู้จัดจำหน่ายในระบบ' : 'กรอกข้อมูลเพื่อเชื่อมโยงกับระบบจัดซื้อ'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                ชื่อซัพพลายเออร์ <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="ระบุชื่อบริษัท จำกัด / หจก."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">รหัสซัพพลายเออร์ (ID)</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="เช่น ก001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">เลขผู้เสียภาษี (Tax ID)</label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="เลข 13 หลัก"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">ที่อยู่ (Address)</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400 resize-none"
                placeholder="ที่อยู่สำหรับออกบิล..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">ชื่อผู้ติดต่อ</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="ติดต่อฝ่ายขาย / บัญชี"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">เบอร์โทรศัพท์</label>
              <input
                type="text"
                value={formData.tel}
                onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                placeholder="02-XXX-XXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">เครดิต (วัน)</label>
                <input
                  type="number"
                  value={formData.credit_days}
                  onChange={(e) => setFormData({ ...formData, credit_days: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-bold bg-slate-50 text-slate-700"
                >
                  <option value="Active">ใช้งานปกติ (Active)</option>
                  <option value="Inactive">ระงับใช้งาน (Inactive)</option>
                </select>
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="text-xs font-bold uppercase tracking-wider">บันทึกข้อมูลซัพพลายเออร์</span>
          </button>
        </div>
      </div>
    </div>
  )
}
