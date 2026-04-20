'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, Plus, Search, Edit2, Trash2, 
  Phone, User, MapPin, Loader2, RefreshCw 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import VendorModal from '@/components/VendorModal'

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<any>(null)

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .order('name')
    
    if (data) setVendors(data)
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบซัพพลายเออร์ "${name}" ?`)) return
    
    const { error } = await supabase.from('vendors').delete().eq('id', id)
    if (error) {
      alert('ไม่สามารถลบได้: ' + error.message)
    } else {
      fetchVendors()
    }
  }

  const filtered = vendors.filter(v => 
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 max-w-[95vw] pb-10 mx-auto animate-in fade-in duration-500">
      {/* Excel Header Style */}
      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center md:justify-start gap-3 uppercase">
              <Building2 className="w-8 h-8 text-blue-600" />
              Vendor Registry
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center md:text-left">ศูนย์บริหารจัดการรายชื่อผู้จำหน่ายและข้อมูลการติดต่ออิเล็กทรอนิกส์</p>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative group w-full md:w-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ รหัสซัพพลายเออร์..."
                className="w-full md:w-80 h-11 pl-10 pr-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-sans"
              />
            </div>
            <button
              onClick={() => { setSelectedVendor(null); setShowModal(true); }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3px]" />
              เพิ่มซัพพลายเออร์
            </button>
          </div>
        </div>
      </div>

      {/* Excel Style Data Grid */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/60 border-b border-gray-200 text-[10px] font-black text-gray-300 first:border-l-0 uppercase tracking-[0.15em]">
                <th className="px-8 py-4 border-r border-gray-100 w-24 text-center">CODE</th>
                <th className="px-8 py-4 border-r border-gray-100 min-w-[250px]">Vendor Name / Tax Details</th>
                <th className="px-8 py-4 border-r border-gray-100 min-w-[200px]">Contact Person / Channel</th>
                <th className="px-8 py-4 border-r border-gray-100 min-w-[250px]">Billing Address</th>
                <th className="px-8 py-4 border-r border-gray-100 text-center w-24">Credit</th>
                <th className="px-8 py-4 text-right w-32 bg-gray-50/30">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                    <p className="text-[10px] text-gray-400 mt-4 font-black uppercase tracking-widest">กำลังดึงข้อมูล...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-300">
                    <p className="font-black text-gray-300 uppercase tracking-[0.2em] italic">--- ไม่พบข้อมูลซัพพลายเออร์ ---</p>
                  </td>
                </tr>
              ) : (
                filtered.map((vendor, idx) => (
                  <tr 
                    key={vendor.id} 
                    className={`border-b border-gray-50 hover:bg-blue-50/20 transition-all group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}
                  >
                    <td className="px-8 py-5 border-r border-gray-50 text-center">
                       <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 tracking-wider">
                         {vendor.code || 'NULL'}
                       </span>
                    </td>
                    <td className="px-8 py-5 border-r border-gray-50">
                      <p className="text-sm font-black text-slate-800 leading-tight">{vendor.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Tax ID: {vendor.tax_id || '-'}</p>
                    </td>
                    <td className="px-8 py-5 border-r border-gray-50">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <User className="w-3 h-3 text-slate-300" />
                          <span className="font-bold">{vendor.contact_person || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-blue-600 font-black">
                          <Phone className="w-3 h-3 text-blue-200" />
                          <span>{vendor.tel || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 border-r border-gray-50">
                       <div className="flex gap-2 max-w-[280px]">
                         <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
                         <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-bold italic">{vendor.address || '-'}</p>
                       </div>
                    </td>
                    <td className="px-8 py-5 border-r border-gray-50 text-center font-black">
                       <span className="text-sm text-emerald-600">{vendor.credit_days || 0}</span>
                       <span className="text-[9px] text-slate-300 ml-1.5 uppercase tracking-tighter">Days</span>
                    </td>
                    <td className="px-8 py-5 text-right bg-gray-50/30 group-hover:bg-white transition-colors">
                      <div className="flex justify-end gap-1.5 overflow-hidden">
                        <button
                          onClick={() => { setSelectedVendor(vendor); setShowModal(true); }}
                          className="p-2.5 text-slate-200 group-hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all active:scale-90"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor.id, vendor.name)}
                          className="p-2.5 text-slate-200 group-hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                          title="ลบซัพพลายเออร์"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VendorModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { fetchVendors(); setShowModal(false); }}
        initialData={selectedVendor}
      />
    </div>
  )
}
