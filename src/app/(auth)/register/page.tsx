'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, User, Building2, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    departmentId: '',
  })
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.from('departments').select('id, name').order('name').then(({ data }) => {
      if (data) setDepartments(data)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }
    if (form.password.length < 4) {
      setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร')
      return
    }
    if (!form.departmentId) {
      setError('กรุณาเลือกแผนก')
      return
    }

    setLoading(true)
    try {
      // Check if username exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('username', form.username.trim())
        .maybeSingle()

      if (existing) throw new Error('ชื่อผู้ใช้งานนี้ถูกใช้แล้ว')

      const { error: insertErr } = await supabase.from('users').insert({
        username: form.username.trim(),
        password: form.password,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        department_id: form.departmentId,
        role: 'Requester',
        is_approved: false,
      })

      if (insertErr) throw insertErr
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full mb-6">
            <UserPlus className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">สมัครสมาชิกสำเร็จ!</h2>
          <p className="text-blue-200/60 mb-8">
            กรุณารอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติบัญชีของคุณ<br />
            จากนั้นจึงจะสามารถเข้าสู่ระบบได้
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-colors"
          >
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-[2.5rem] shadow-2xl shadow-blue-500/20 border-4 border-white/10 mb-6 group-hover:scale-105 transition-transform duration-500">
            <div className="w-24 h-24 overflow-hidden rounded-[2rem]">
              <img 
                src="/logo.png" 
                alt="BWP Logo" 
                className="w-full h-full object-contain p-2"
              />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-[0.15em] uppercase leading-tight">BWP Group</h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px w-8 bg-blue-500/30" />
            <p className="text-blue-200/40 text-xs font-bold uppercase tracking-[0.3em]">Registration</p>
            <div className="h-px w-8 bg-blue-500/30" />
          </div>
        </div>

        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-100/80 mb-1.5">ชื่อ</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  placeholder="ชื่อจริง"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-100/80 mb-1.5">นามสกุล</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  placeholder="นามสกุล"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">แผนก</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm appearance-none"
                >
                  <option value="" className="bg-slate-800">-- เลือกแผนก --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id} className="bg-slate-800">
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">ยืนยันรหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 shadow-lg shadow-emerald-600/25 disabled:opacity-50 active:scale-[0.98] mt-2"
            >
              {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              มีบัญชีแล้ว?{' '}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
