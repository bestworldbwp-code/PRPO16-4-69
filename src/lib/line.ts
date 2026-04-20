/**
 * LINE Messaging API Helper
 * วิธีใช้งาน:
 * await sendLineNotification('ข้อความที่ต้องการส่ง')
 */

export async function sendLineNotification(message: string) {
  try {
    const response = await fetch('/api/line/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('LINE Notification Failed:', error)
      return { success: false, error: error.error }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('LINE Helper Error:', error)
    return { success: false, error: error.message }
  }
}
