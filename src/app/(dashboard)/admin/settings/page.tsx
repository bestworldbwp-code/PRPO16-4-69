'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Send, ShieldCheck, Loader2, Link as LinkIcon, Command, Cpu, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCookie } from '@/lib/auth'
import { sendLineNotification } from '@/lib/line'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [targetId, setTargetId] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    // Check if user is Admin
    const role = getCookie('user_role')
    if (role !== 'Admin') {
      window.location.href = '/'
      return
    }
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['line_access_token', 'line_target_id'])

      if (data) {
        setAccessToken(data.find(s => s.key === 'line_access_token')?.value || '')
        setTargetId(data.find(s => s.key === 'line_target_id')?.value || '')
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      // Update access token
      const { error: err1 } = await supabase
        .from('system_settings')
        .update({ value: accessToken.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'line_access_token')
      
      // Update target ID
      const { error: err2 } = await supabase
        .from('system_settings')
        .update({ value: targetId.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'line_target_id')

      if (err1 || err2) throw new Error('บันทึกไม่สำเร็จ')

      setStatus({ type: 'success', message: '✅ บันทึกการตั้งค่าระบบเรียบร้อยแล้ว' })
    } catch (err: any) {
      setStatus({ type: 'error', message: '❌ เกิดข้อผิดพลาด: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!accessToken || !targetId) return alert('กรุณาระบุข้อมูลให้ครบถ้วนก่อนทดสอบ')
    setTesting(true)
    try {
      // We must save first to ensure API route uses current values
      await handleSave()
      
      const res = await sendLineNotification('🔔 [TEST] การแจ้งเตือนจากระบบ PR/PO - PC System ผ่าน API สำเร็จ!')
      if (res.success) {
        alert('ส่งข้อความทดสอบสำเร็จ! โปรดตรวจสอบใน LINE ของคุณ')
      } else {
        alert('ส่งไม่สำเร็จ: ' + res.error)
      }
    } finally {
      setTesting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest font-sans">Syncing System Config...</p>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Premium Card Header */}
      <div className="bg-white p-8 border border-gray-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center md:justify-start gap-3 uppercase">
              <Cpu className="w-8 h-8 text-blue-600" />
              Core Infrastructure
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center md:text-left">การตั้งค่าแกนกลาง ระบบการเชื่อมต่อ และความปลอดภัยระดับสูง</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
               onClick={handleSave}
               disabled={saving}
               className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-100 hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'บันทึกค่าระบบ'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* LINE Messaging API Section */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-[1.25rem] flex items-center justify-center border-4 border-white shadow-sm ring-1 ring-emerald-50 text-emerald-600">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.15em] leading-none">LINE Messaging API</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 font-sans">Automated Notification Bridge (Webhook / Push)</p>
              </div>
            </div>
            <div className="px-5 py-2 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-blue-100">
              <ShieldCheck className="w-3.5 h-3.5" /> High Security
            </div>
          </div>

          <div className="p-12 space-y-10">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2 flex items-center gap-2">
                <LinkIcon className="w-3 h-3 text-emerald-400" /> Channel Access Token
              </label>
              <textarea
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                rows={3}
                placeholder="ระบุ Channel Access Token..."
                className="w-full px-8 py-6 border-2 border-slate-50 rounded-[2rem] focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all text-sm font-black text-slate-700 bg-slate-50/20 shadow-inner resize-none font-mono tracking-tight"
              />
              <p className="text-[10px] text-slate-300 font-bold ml-2 italic tracking-wider">* รหัส Token ยาวคงที่ คัดลอกมาจาก Messaging API แท็บภายใน LINE Developers</p>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2 flex items-center gap-2">
                <Command className="w-3 h-3 text-blue-400" /> Target Connection ID
              </label>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="C1234567890abcdef..."
                className="w-full h-18 px-8 border-2 border-slate-50 rounded-3xl focus:ring-[12px] focus:ring-blue-500/5 focus:border-blue-400 outline-none transition-all text-sm font-black text-slate-700 bg-slate-50/20 shadow-inner font-mono tracking-tight"
              />
              <p className="text-[10px] text-slate-300 font-bold ml-2 italic tracking-wider">* ระบุ Group ID ของบริษัท หรือ User ID ที่ต้องการรันการแจ้งเตือน</p>
            </div>

            {status && (
              <div className={`p-6 rounded-3xl text-sm font-black flex items-center gap-4 transition-all duration-300 animate-in slide-in-from-top-4 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-md shadow-emerald-50' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                  {status.type === 'success' ? <ShieldCheck size={16} /> : <XCircle size={16} />}
                </div>
                {status.message}
              </div>
            )}

            <div className="pt-6 flex gap-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] bg-slate-900 hover:bg-black text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Commit All Changes
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 px-8 py-5 bg-white border-2 border-emerald-100 text-emerald-600 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Fire Test
              </button>
            </div>
          </div>
        </div>

        {/* System Onboarding Guide */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white space-y-10 relative overflow-hidden group shadow-2xl shadow-slate-200">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32 transition-all group-hover:scale-150 duration-1000"></div>
          
          <h2 className="text-xl font-black uppercase tracking-[0.3em] flex items-center gap-4 relative z-10">
             <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div> 🚀 Infrastructure Guide
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
            {[
              { idx: 1, title: 'CREATE CHANNEL', desc: 'สร้าง Messaging API ใน LINE Developers Portal เพื่อออกรหัสเชื่อมต่อพื้นฐาน' },
              { idx: 2, title: 'ISSUE TOKEN', desc: 'ออก Channel Access Token (Long-lived) เพื่อใช้เป็นกุญแจหลักในการเข้าถึง API' },
              { idx: 3, title: 'BOT INVITATION', desc: 'เชิญ Bot เข้าสู่กลุ่ม LINE ของบริษัทเพื่อให้ระบบสามารถ Push ข้อมูลหาทีมได้' },
              { idx: 4, title: 'VALIDATION', desc: 'กดปุ่ม Fire Test เพื่อตรวจสอบการเชื่อมต่อและความถูกต้องของข้อมูลที่ส่งเข้ากลุ่ม' },
            ].map((step) => (
              <div key={step.idx} className="space-y-4 group/step">
                <div className="text-4xl font-black text-white/5 group-hover/step:text-blue-500/20 transition-colors">{String(step.idx).padStart(2, '0')}</div>
                <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{step.title}</h4>
                <p className="text-[11px] text-white/40 font-bold leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
