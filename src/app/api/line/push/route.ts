import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const { message, targetId } = await req.json()

    // 1. ดึง Token และ Target ID จากฐานข้อมูล
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['line_access_token', 'line_target_id'])

    const token = settings?.find(s => s.key === 'line_access_token')?.value
    const defaultTargetId = settings?.find(s => s.key === 'line_target_id')?.value
    const finalTargetId = targetId || defaultTargetId

    if (!token || !finalTargetId) {
      console.error('LINE Notification Error: Missing configuration')
      return NextResponse.json({ error: 'Missing LINE configuration' }, { status: 500 })
    }

    // 2. ส่ง Push Message ไปยัง LINE API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: finalTargetId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      console.error('LINE API Error:', result)
      return NextResponse.json({ error: result.message || 'Failed to send LINE message' }, { status: response.status })
    }

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('LINE Route Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
