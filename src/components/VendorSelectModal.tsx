'use client'

import { useState, useEffect } from 'react'
import { X, Search, Building2, User, Phone, MapPin, ChevronRight, Loader2, Plus, Edit2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface VendorSelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (vendor: any) => void
  onAddNew: () => void
  onEdit: (vendor: any) => void
}

export default function VendorSelectModal({ isOpen, onClose, onSelect, onAddNew, onEdit }: VendorSelectModalProps) {
  const [search, setSearch] = useState('')
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchVendors()
    }
  }, [isOpen, search])

  const fetchVendors = async () => {
    setLoading(true)
    try {
      let query = supabase.from('vendors').select('*').order('name')
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
      }

      const { data } = await query.limit(100)
      if (data) setVendors(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header Section */}
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">รายชื่อผู้จ่ายซัพพลายเออร์</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider opacity-80">ค้นหาและเลือกซัพพลายเออร์จากฐานข้อมูล</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Bar (Search & Quick Add) */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              autoFocus
              type="text"
              placeholder="ค้นหาด้วยรหัส หรือ ชื่อบริษัท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
            />
          </div>
          <button
            onClick={onAddNew}
            className="px-6 py-2 bg-emerald-600 text-white rounded-md shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มซัพพลายเออร์ใหม่</span>
          </button>
        </div>

        {/* Excel-Like Table Section */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-[80px]">รหัส</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider">ชื่อซัพพลายเออร์</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider">ผู้ติดต่อ / แผนก</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider">เบอร์โทรศัพท์</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider">ที่อยู่</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-[100px]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">กำลังดึงข้อมูล...</p>
                    </div>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <p className="text-slate-400 text-sm font-medium italic">ไม่พบข้อมูลที่คุณค้นหา</p>
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr 
                    key={v.id}
                    onClick={() => onSelect(v)}
                    className="hover:bg-emerald-50 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                        {v.code || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 group-hover:text-emerald-700 text-sm leading-snug">
                         {v.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-500 font-medium">
                       {v.contact_person || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-500 font-mono">
                       {v.tel || '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[10px] text-slate-400 line-clamp-2 max-w-[300px] leading-relaxed">
                         {v.address || '-'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-3">
                         <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(v)
                            }}
                            className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-white rounded border border-transparent hover:border-emerald-200 transition-all"
                            title="แก้ไข"
                         >
                            <Edit2 className="w-4 h-4" />
                         </button>
                         <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Bar */}
        <div className="px-8 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            แสดงข้อมูลล่าสุด {vendors.length} รายการ
          </div>
          <div className="text-[10px] text-emerald-600 font-bold italic">
            * เลือกแถวที่ต้องการเพื่อใช้ข้อมูลในหน้าสั่งซื้อ
          </div>
        </div>
      </div>
    </div>
  )
}
