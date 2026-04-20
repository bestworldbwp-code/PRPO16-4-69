import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const events = body.events || []

    // 🕒 1. สำหรับการ Verify หรือ Event ว่างเปล่า ให้ตอบกลับทันที (เพื่อกัน Timeout)
    if (events.length === 0) {
      console.log('--- LINE Webhook Verification Received ---')
      return NextResponse.json({ success: true })
    }

    // 2. ดึง Token จากฐานข้อมูล
    const { data: setting, error: dbErr } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'line_access_token')
      .maybeSingle()

    if (dbErr || !setting?.value) {
      console.error('❌ LINE Webhook Error: No Access Token found in system_settings table.')
      return NextResponse.json({ error: 'No token' }, { status: 404 })
    }

    const token = setting.value

    for (const event of events) {
      console.log(`📩 Incoming Event: ${event.type} from User: ${event.source?.userId}`)

      if (event.type === 'message' && event.source.userId) {
        const userId = event.source.userId
        const replyToken = event.replyToken

        // 3. ส่งข้อความตอบกลับทันที (Reply Message)
        const response = await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            replyToken: replyToken,
            messages: [
              {
                type: 'text',
                text: `✨ รหัส LINE ID ของคุณคือ:\n\n${userId}\n\nกรุณาคัดลอกรหัสนี้ส่งให้แอดมินเพื่อลงทะเบียนรับการแจ้งเตือนครับ`
              }
            ]
          })
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error('❌ LINE Reply API Error:', errBody)
        } else {
          console.log('✅ Sent ID reply to user successfully.')
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('💥 Webhook Critical Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 🔐 LINE Webhook Verification (GET check)
export async function GET() {
  return new Response('WhatsApp LINE Webhook is running!', { status: 200 })
}
