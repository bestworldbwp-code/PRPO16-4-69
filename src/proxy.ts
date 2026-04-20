import { type NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicApi = pathname.startsWith('/api/line/webhook')
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const userId = request.cookies.get('user_id')?.value

  // ไม่ต้องเช็ค Login สำหรับหน้า Login, Register และ Webhook API
  if (!userId && !isAuthPage && !isPublicApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → redirect to dashboard (from auth pages)
  if (userId && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export default proxy
