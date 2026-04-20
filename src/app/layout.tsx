import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PR/PO System - ระบบจัดการใบขอซื้อและใบสั่งซื้อ',
  description: 'ระบบจัดการใบขอซื้อ (PR) และใบสั่งซื้อ (PO) สำหรับองค์กร',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  )
}
