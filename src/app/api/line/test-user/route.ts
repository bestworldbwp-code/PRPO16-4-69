import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { userId, lineUserId: manualLineId } = await req.json()

    // 1. ดึง Token ระบบก่อน (สำคัญที่สุด)
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'line_access_token')
      .maybeSingle()

    const token = setting?.value
    if (!token) {
      return NextResponse.json({ error: 'ไม่พบ Channel Access Token ในการตั้งค่าระบบ กรุณาตรวจสอบเมนู "ตั้งค่าระบบ" ก่อนครับ' }, { status: 404 })
    }

    // 2. ระบุปลายทาง (ถ้าส่งมาเองใช้ของที่ส่งมา ถ้าไม่ส่งมาให้ไปหาใน DB)
    let targetId = manualLineId

    if (!targetId && userId) {
      const { data: user } = await supabase
        .from('users')
        .select('line_user_id')
        .eq('id', userId)
        .maybeSingle()
      targetId = user?.line_user_id
    }

    if (!targetId) {
      return NextResponse.json({ error: 'กรุณากรอก LINE User ID ก่อนกดทดสอบครับ' }, { status: 400 })
    }

    // 3. ส่ง Push Message ทดสอบ
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: 'text',
            text: `🔔 ทดสอบระบบแจ้งเตือน\n------------------\nการเชื่อมต่อระบบ LINE สำเร็จแล้ว! คุณจะได้รับการแจ้งเตือนผลการอนุมัติผ่านทางนี้ครับ`
          }
        ]
      })
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(errBody)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Test Notification Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
