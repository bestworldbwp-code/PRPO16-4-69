'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, User, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { setUserCookies } from '@/lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: user, error: err } = await supabase
        .from('users')
        .select('id, username, password, first_name, last_name, role, department_id, is_approved')
        .ilike('username', username.trim())
        .single()

      if (err || !user) throw new Error('ไม่พบบัญชีผู้ใช้นี้ในระบบ')
      if (user.password !== password) throw new Error('รหัสผ่านไม่ถูกต้อง')
      if (!user.is_approved) throw new Error('บัญชีของคุณยังไม่ได้รับการอนุมัติจากผู้ดูแลระบบ')

      setUserCookies({
        id: user.id,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        departmentId: user.department_id,
      })

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
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
            <p className="text-blue-200/40 text-xs font-bold uppercase tracking-[0.3em]">PR / PO System</p>
            <div className="h-px w-8 bg-blue-500/30" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-2">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-100/80 mb-2">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-blue-600/25 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              ยังไม่มีบัญชี?{' '}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
