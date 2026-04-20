// Cookie helpers for client-side auth

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

export function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return
  const isSecure = window.location.protocol === 'https:'
  const cookieOptions = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    `max-age=${60 * 60 * 24 * days}`,
    'SameSite=Lax',
    isSecure ? 'Secure' : ''
  ].filter(Boolean).join('; ')
  document.cookie = cookieOptions
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

export function getCurrentUser() {
  return {
    id: getCookie('user_id'),
    role: getCookie('user_role'),
    name: getCookie('user_name'),
    username: getCookie('user_username'),
    departmentId: getCookie('user_dept_id'),
  }
}

export function setUserCookies(user: {
  id: string
  role: string
  firstName: string
  lastName: string
  username: string
  departmentId?: string | null
}) {
  setCookie('user_id', user.id)
  setCookie('user_role', user.role)
  setCookie('user_name', `${user.firstName} ${user.lastName}`.trim())
  setCookie('user_username', user.username)
  if (user.departmentId) setCookie('user_dept_id', user.departmentId)
}

export function clearUserCookies() {
  deleteCookie('user_id')
  deleteCookie('user_role')
  deleteCookie('user_name')
  deleteCookie('user_username')
  deleteCookie('user_dept_id')
}
