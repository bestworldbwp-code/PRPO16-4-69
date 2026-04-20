'use client'

import { Plus, Trash2 } from 'lucide-react'
import { bahttext } from '@/lib/utils'

interface PettyCashFormProps {
  pcNumber: string
  setPcNumber: (val: string) => void
  title: string
  setTitle: (val: string) => void
  departmentName: string
  items: any[]
  addItem: () => void
  removeItem: (id: string) => void
  updateItem: (id: string, field: string, value: string | number) => void
  totalAmount: number
  description: string
  setDescription: (val: string) => void
  date?: string
}

export default function PettyCashForm({
  pcNumber, setPcNumber,
  title, setTitle,
  departmentName,
  items, addItem, removeItem, updateItem,
  totalAmount,
  description, setDescription,
  date = new Date().toLocaleDateString('th-TH')
}: PettyCashFormProps) {
  
  return (
    <div className="bg-white p-4 md:p-8 rounded-lg shadow-inner border border-gray-200" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      {/* Container that mimics the paper voucher */}
      <div className="max-w-[800px] mx-auto bg-white border-2 border-black p-6 md:p-10 text-black shadow-2xl relative">
        <div className="absolute top-4 right-4 border-2 border-black px-4 py-1 font-black text-xl">PC</div>
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-black">
          <div className="flex gap-4 items-start">
            <img src="/logo.png" className="w-16 h-16 object-contain" alt="Logo" />
            <div className="flex-1">
              <h2 className="text-xl font-black leading-tight">บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</h2>
              <p className="text-[10px] leading-tight mt-1 font-bold">328 ม.6 ต.คลองนิยมยาตรา อ.บางบ่อ จ.สมุทรปราการ 10560</p>
              <p className="text-[10px] leading-tight font-bold">โทร : 02-3175470-3 FAX : 02-317-5474</p>
              <p className="text-[10px] leading-tight font-bold">เลขประจำตัวผู้เสียภาษี 0115545001637 (สำนักงานใหญ่)</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-center">
             <div className="border border-black px-2 py-0.5 font-bold text-[10px]">ISO 9001</div>
             <div className="text-[8px] font-black opacity-70 uppercase tracking-tighter">Certified</div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black underline decoration-2 underline-offset-4">ใบเบิกเงินสดย่อย</h1>
          <p className="text-sm font-bold mt-2 italic text-gray-700">ขอเบิกเงินสดย่อยตามรายการ ดังต่อไปนี้</p>
        </div>

        {/* Info Grid with Dotted Line aesthetics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mb-8 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-black whitespace-nowrap">จ่ายให้ :</span>
            <span className="flex-1 border-b border-dotted border-black px-2 pb-0.5 font-bold bg-gray-50/50 rounded-t cursor-not-allowed">
              {/* User info is usually from cookie in create page */}
              เอกสารสำหรับการเบิก
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black whitespace-nowrap">เลขที่ :</span>
            <input 
              type="text" 
              value={pcNumber} 
              onChange={(e) => setPcNumber(e.target.value)}
              className="flex-1 border-b border-dotted border-black px-2 pb-0.5 font-black outline-none focus:bg-amber-50/50 transition-colors"
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black whitespace-nowrap">ฝ่าย / แผนก :</span>
            <span className="flex-1 border-b border-dotted border-black px-2 pb-0.5 font-bold italic text-gray-500">
              {departmentName}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-black whitespace-nowrap">วันที่ :</span>
            <span className="flex-1 border-b border-dotted border-black px-2 pb-0.5 font-bold">
              {date}
            </span>
          </div>
          <div className="md:col-span-2 flex items-baseline gap-2">
            <span className="font-black whitespace-nowrap">เรื่อง / วัตถุประสงค์ :</span>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ระบุวัตถุประสงค์การเบิกจ่าย"
              className="flex-1 border-b border-dotted border-black px-2 pb-0.5 font-bold outline-none focus:bg-amber-50/50 transition-colors"
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="mb-4">
          <table className="w-full border-collapse border-2 border-black text-sm">
            <thead>
              <tr className="bg-gray-50 uppercase text-xs font-black">
                <th className="border-2 border-black py-2 px-1 w-12 text-center">ลำดับ</th>
                <th className="border-2 border-black py-2 px-4 text-center">รายละเอียด Description</th>
                <th className="border-2 border-black py-2 px-1 w-40 text-center">จำนวนเงิน (บาท)</th>
                <th className="border-2 border-black py-2 px-1 w-12 text-center print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="group transition-colors hover:bg-gray-50">
                  <td className="border border-black text-center py-2 font-black text-xs">{idx + 1}</td>
                  <td className="border border-black px-2 py-1">
                    <input 
                      type="text" 
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="ระบุรายการ..."
                      className="w-full bg-transparent outline-none font-medium px-2 py-1 group-hover:placeholder:text-gray-400"
                    />
                  </td>
                  <td className="border border-black px-2 py-1 relative">
                    <input 
                      type="number" 
                      step="0.01"
                      value={item.amount === 0 ? '' : item.amount}
                      onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-transparent outline-none font-black text-right pr-2 py-1"
                    />
                  </td>
                  <td className="border border-black text-center print:hidden">
                    <button 
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Empty Rows to match paper look (optional but good for height) */}
              {items.length < 5 && Array(5 - items.length).fill(null).map((_, i) => (
                <tr key={`empty-${i}`}>
                   <td className="border border-black py-4"></td>
                   <td className="border border-black py-4"></td>
                   <td className="border border-black py-4"></td>
                   <td className="border border-black py-4 print:hidden"></td>
                </tr>
              ))}

              {/* Deduction placeholders (matching the paper image) */}
              <tr>
                <td className="border border-black"></td>
                <td className="border border-black px-4 py-1 text-[10px] italic font-bold text-gray-500">หัก เงินยืมทดรอง อื่นๆ</td>
                <td className="border border-black"></td>
                <td className="border border-black print:hidden"></td>
              </tr>
              <tr>
                <td className="border border-black"></td>
                <td className="border border-black px-4 py-1 text-[10px] italic font-bold text-gray-500">หัก ภาษีเงินได้หัก ณ ที่จ่าย</td>
                <td className="border border-black"></td>
                <td className="border border-black print:hidden"></td>
              </tr>
              <tr>
                <td className="border border-black"></td>
                <td className="border border-black px-4 py-1 text-[10px] italic font-bold text-gray-500">ส่วนขาด(เกิน) จากการปิดเศษสตางค์</td>
                <td className="border border-black"></td>
                <td className="border border-black print:hidden"></td>
              </tr>

              {/* Total Footer */}
              <tr className="bg-gray-100">
                <td colSpan={2} className="border-2 border-black text-right px-6 py-3 font-black text-base uppercase tracking-widest">
                  รวม / Total
                </td>
                <td className="border-2 border-black text-right px-4 py-3 font-black text-xl underline decoration-double decoration-1 underline-offset-4">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="border-2 border-black print:hidden"></td>
              </tr>
            </tbody>
          </table>
          <button 
            type="button" 
            onClick={addItem}
            className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg transition-all active:scale-95 border border-emerald-100"
          >
            <Plus size={14} strokeWidth={3} /> เพิ่มรายการค่าใช้จ่าย
          </button>
        </div>

        {/* Amount in Thai Words */}
        <div className="flex items-center gap-4 border-b-2 border-dotted border-black pb-2 mb-10 text-sm">
          <span className="font-black whitespace-nowrap">จำนวนเงิน (ตัวหนังสือ) :</span>
          <span className="flex-1 text-center font-black text-lg text-gray-800">
            {totalAmount > 0 ? bahttext(totalAmount) : '...................................................'}
          </span>
        </div>

        {/* Signature placeholders */}
        <div className="grid grid-cols-5 gap-4 text-[9px] font-black text-center uppercase tracking-widest mt-12 opacity-40">
           <div className="space-y-1">
             <div className="border-b border-black pb-4 text-gray-300 italic font-medium">Drafting...</div>
             <p>ผู้ขอเบิก</p>
           </div>
           <div className="space-y-1">
             <div className="border-b border-black pb-4 invisible">.</div>
             <p>ผู้ตรวจสอบ</p>
           </div>
           <div className="space-y-1">
             <div className="border-b border-black pb-4 invisible">.</div>
             <p>ผู้อนุมัติ</p>
           </div>
           <div className="space-y-1">
             <div className="border-b border-black pb-4 invisible">.</div>
             <p>ผู้จ่ายเงิน</p>
           </div>
           <div className="space-y-1">
             <div className="border-b border-black pb-4 invisible">.</div>
             <p>ผู้รับเงิน</p>
           </div>
        </div>

        {/* Remarks (Internal/Modern UI touch) */}
        <div className="mt-12 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200">
           <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">หมายเหตุเพิ่มเติม (ใช้ภายในระบบเท่านั้น)</label>
           <textarea 
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             className="w-full bg-transparent outline-none text-sm font-medium h-16 resize-none"
             placeholder="ระบุเหตุผลหรือหมายเหตุประกอบการเบิก..."
           />
        </div>
      </div>
    </div>
  )
}
