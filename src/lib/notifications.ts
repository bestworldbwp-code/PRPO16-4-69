import { supabase } from './supabase'

/**
 * ฟังก์ชันหลักสำหรับการส่งแจ้งเตือน LINE แบบระบุตัวตน
 */
export async function notifyByRole(options: {
  role: string | string[]
  departmentId?: string
  message: string
}) {
  try {
    const { role, departmentId, message } = options

    // 1. ค้นหาผู้ใช้งานที่มีบทบาทและแผนกที่กำหนด และต้องมี line_user_id
    let query = supabase
      .from('users')
      .select('line_user_id')
      .not('line_user_id', 'is', null)

    if (Array.isArray(role)) {
      query = query.in('role', role)
    } else {
      query = query.eq('role', role)
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId)
    }

    const { data: users } = await query

    if (!users || users.length === 0) {
      console.warn('No users found with line_user_id for role:', role)
      return
    }

    // 2. ส่งข้อความหาทุกคนที่เข้าเงื่อนไข
    for (const user of users) {
      if (user.line_user_id) {
        await fetch('/api/line/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message, 
            targetId: user.line_user_id 
          }),
        })
      }
    }
  } catch (error) {
    console.error('Notification Service Error:', error)
  }
}

/**
 * แจ้งเตือนผู้ขอเบิกโดยตรง
 */
export async function notifyUser(userId: string, message: string) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('line_user_id')
      .eq('id', userId)
      .single()

    if (user?.line_user_id) {
      await fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message, 
          targetId: user.line_user_id 
        }),
      })
    }
  } catch (error) {
    console.error('NotifyUser Error:', error)
  }
}
