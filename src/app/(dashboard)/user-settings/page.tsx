'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import { Save, User, Bell, Info, Copy, CheckCircle, PenTool, Image as ImageIcon, Trash2, Lock, AlertCircle, Loader2, Building2, ShieldCheck, Mail } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import SignaturePad from '@/components/SignaturePad'

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [lineUserId, setLineUserId] = useState('')
  const [signature, setSignature] = useState('')
  const [showPad, setShowPad] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Password change states
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const userId = getCookie('user_id')

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          departments (name)
        `)
        .eq('id', userId)
        .single()

      if (error) throw error
      setUser(data)
      setLineUserId(data.line_user_id || '')
      setSignature(data.signature || '')
    } catch (error: any) {
      console.error('Error fetching user:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    try {
      setSaving(true)
      setMessage(null)
      
      const response = await fetch('/api/line/test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userId,
          lineUserId: lineUserId
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to send test')
      }
      
      setMessage({ type: 'success', text: 'ส่งข้อความทดสอบไปที่ LINE ของคุณแล้ว!' })
    } catch (error: any) {
      setMessage({ type: 'error', text: 'ไม่สามารถส่งข้อความทดสอบได้: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (extraUpdate: any = {}) => {
    try {
      setSaving(true)
      setMessage(null)
      
      const updateData = { 
        line_user_id: lineUserId.trim(),
        ...extraUpdate
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (error) throw error
      
      setMessage({ type: 'success', text: 'บันทึกข้อมูลสำเร็จเรียบร้อยแล้ว' })
      if (extraUpdate.signature !== undefined) fetchUserData()
      setTimeout(() => setMessage(null), 5000)
    } catch (error: any) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกัน' })
      return
    }

    if (oldPassword !== user.password) {
      setMessage({ type: 'error', text: 'รหัสผ่านเดิมไม่ถูกต้อง' })
      return
    }

    try {
      setPwSaving(true)
      setMessage(null)
      
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', userId)

      if (error) throw error

      setMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      fetchUserData()
    } catch (error: any) {
      setMessage({ type: 'error', text: 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + error.message })
    } finally {
      setPwSaving(false)
    }
  }

  const handleSignatureSave = async (signatureData: string) => {
    setSignature(signatureData)
    setShowPad(false)
    await handleSave({ signature: signatureData })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 400
        const scale = MAX_WIDTH / img.width
        canvas.width = MAX_WIDTH
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        const optimizedData = canvas.toDataURL('image/png', 0.8)
        handleSignatureSave(optimizedData)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const removeSignature = async () => {
    if (confirm('คุณต้องการลบลายเซ็นปัจจุบันใช่หรือไม่?')) {
      setSignature('')
      await handleSave({ signature: null })
    }
  }

  const copyInstruction = () => {
    navigator.clipboard.writeText('id')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Formal Header */}
      <div className="border-b border-slate-200 pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <User className="text-slate-400" size={32} />
            การตั้งค่าบัญชีผู้ใช้
          </h1>
          <p className="text-slate-500 font-medium">จัดการข้อมูลส่วนตัว ความปลอดภัย และการแจ้งเตือน</p>
        </div>
        <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          {ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS]}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-4 border-l-4 animate-in slide-in-from-top-2 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'bg-rose-50 text-rose-800 border-rose-500'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Professional Profile Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 flex flex-col items-center">
              <div className="w-28 h-28 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center text-slate-300 mb-6 group hover:border-blue-300 transition-colors">
                <User size={64} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-sm text-slate-400 font-medium mt-1 uppercase tracking-widest italic">{user?.username}</p>
            </div>
            
            <div className="border-t border-slate-100 p-6 space-y-4 bg-slate-50/30">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">แผนกต้นสังกัด</span>
                <span className="font-semibold text-slate-700 flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  {user?.departments?.name || 'ไม่พบคลิกเลือกแผนก'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รหัสพนักงาน</span>
                <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded w-fit text-sm">
                  {user?.id?.split('-')[0].toUpperCase() || '---'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                 <ShieldCheck size={16} className="text-emerald-500" />
                 <span className="text-xs font-bold text-emerald-600">ยืนยันตัวตนในระบบแล้ว</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Settings Content Column */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Notifications Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
              <Bell size={20} className="text-slate-400" />
              <h3 className="text-lg font-bold text-slate-900">การแจ้งเตือนและการเชื่อมต่อ</h3>
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">LINE User ID สำหรับรับพุชโนติ</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={lineUserId}
                      onChange={(e) => setLineUserId(e.target.value)}
                      placeholder="U4a8..."
                      className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-mono text-sm"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                      <Mail size={16} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave()}
                      disabled={saving}
                      className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-black font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin h-4 w-4" /> : 'บันทึก ID'}
                    </button>
                    <button
                      onClick={handleTest}
                      disabled={saving || !lineUserId}
                      className="p-3 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-200 transition-all"
                      title="ส่งทดสอบ"
                    >
                      <Bell size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Instructions in clean box */}
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
                  <Info size={14} /> วิธีการขอรหัส ID
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <ul className="text-sm text-slate-600 space-y-3 font-medium">
                    <li className="flex gap-2">
                      <span className="font-bold text-slate-400">1.</span>
                      <span>เพิ่มเพื่อนบอทแจ้งเตือนใน LINE</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-bold text-slate-400">2.</span>
                      <span>พิมพ์ <span className="text-blue-600 font-bold">id</span> และรับรหัส U...</span>
                    </li>
                  </ul>
                  <div className="flex items-center">
                    <button
                      onClick={copyInstruction}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-500 transition-all"
                    >
                      {copied ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={16} />}
                      {copied ? 'คัดลอกสำเร็จ' : 'คัดลอกคำว่า "id" ไปพิมพ์'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Signature Management */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <PenTool size={18} className="text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide px-1">ลายเซ็นดิจิทัล</h3>
                </div>
                {signature && (
                  <button onClick={removeSignature} className="text-slate-300 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="p-6 flex flex-col gap-6 flex-1">
                <div className="aspect-[4/3] bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                  {signature ? (
                    <img src={signature} alt="Signature" className="max-h-32 object-contain" />
                  ) : (
                    <div className="text-center opacity-30">
                      <PenTool size={32} className="mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest italic">No signature found</p>
                    </div>
                  )}
                </div>

                {!showPad ? (
                   <div className="space-y-2">
                    <label className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 rounded-lg transition-all cursor-pointer font-bold text-xs uppercase tracking-widest shadow-sm">
                      <ImageIcon size={16} className="text-slate-400" />
                      แนบไฟล์
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <button
                      onClick={() => setShowPad(true)}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-black text-white rounded-lg transition-all font-bold text-xs uppercase tracking-widest shadow-sm"
                    >
                      <PenTool size={16} />
                      สร้างลายเซ็น
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white p-2">
                    <SignaturePad onSave={handleSignatureSave} onCancel={() => setShowPad(false)} />
                  </div>
                )}
              </div>
            </div>

            {/* Security Management */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <Lock size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide px-1">ยกระดับความปลอดภัย</h3>
              </div>
              <form onSubmit={handlePasswordChange} className="p-6 flex flex-col gap-5 flex-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">รหัสผ่านปัจจุบัน</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:border-slate-900 transition-all outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">รหัสผ่านใหม่</label>
                  <div className="grid grid-cols-1 gap-2">
                     <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="ความยาวขั้นต่ำ 4 ตัวอักษร"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:border-slate-900 transition-all outline-none text-sm"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:border-slate-900 transition-all outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="pt-4 mt-auto">
                   <button
                    type="submit"
                    disabled={pwSaving}
                    className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-lg transition-all font-bold text-xs uppercase tracking-widest shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {pwSaving ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'ยืนยันการเปลี่ยนรหัส'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pt-8 text-center border-t border-slate-100 opacity-30">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                System Infrastructure Integrated v2.0
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
