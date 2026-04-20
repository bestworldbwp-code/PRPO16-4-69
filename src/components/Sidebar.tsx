'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Building2,
  Users,
  GitBranch,
  LogOut,
  Wallet,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCookie, clearUserCookies } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const mainLinks = [
  { href: '/', label: 'หน้าหลัก', icon: LayoutDashboard },
  { href: '/pr', label: 'ใบขอซื้อ (PR)', icon: FileText },
  { href: '/po', label: 'ใบสั่งซื้อ (PO)', icon: ShoppingCart },
  { href: '/petty-cash', label: 'เงินสดย่อย (PC)', icon: Wallet },
]

const adminLinks = [
  { href: '/admin/vendors', label: 'จัดการซัพพลายเออร์', icon: Building2 },
  { href: '/admin/departments', label: 'จัดการแผนก', icon: Building2 },
  { href: '/admin/users', label: 'จัดการผู้ใช้งาน', icon: Users },
  { href: '/admin/workflows', label: 'สายอนุมัติ', icon: GitBranch },
  { href: '/admin/settings', label: 'ตั้งค่าระบบ', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [name, setName] = useState<string>('')

  useEffect(() => {
    setRole(getCookie('user_role'))
    setName(getCookie('user_name') || '')
  }, [])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLogout = () => {
    clearUserCookies()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Branding / Logo */}
      <div className="p-6 border-b border-slate-800/50">
        <Link href="/" className="flex flex-col items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-20 h-20 bg-white p-1.5 rounded-3xl shadow-2xl shadow-blue-500/10 ring-4 ring-slate-800/50 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="BWP Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-black tracking-[0.2em] uppercase text-white leading-none">BWP Group</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5">PR / PO System</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {mainLinks.map((link) => {
          // Hide PO link for Requesters
          if (link.href === '/po' && role === 'Requester') return null
          
          const Icon = link.icon
          const active = isActive(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {link.label}
            </Link>
          )
        })}

        {role === 'Admin' && (
          <>
            <div className="pt-6 mt-4 border-t border-slate-800">
              <p className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                ผู้ดูแลระบบ
              </p>
            </div>
            {adminLinks.map((link) => {
              const Icon = link.icon
              const active = isActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {link.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
            {name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{name || 'User'}</p>
            <p className="text-[11px] text-slate-500 truncate">{role || ''}</p>
          </div>
        </div>
        <Link
          href="/user-settings"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
            isActive('/user-settings')
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          ตั้งค่าส่วนตัว
        </Link>
        <button
          onClick={handleLogout}
          className="w-full h-10 flex items-center gap-3 px-3 mt-1 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
