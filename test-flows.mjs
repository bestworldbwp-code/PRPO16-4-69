import { createClient } from '@supabase/supabase-js'

const url = "https://ozocgfohgtclnyakbmxv.supabase.co"
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2NnZm9oZ3RjbG55YWtibXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI5OTQsImV4cCI6MjA4ODc0ODk5NH0.KONI7_J6wgzKxo3qyHzRsmft1ilwCpvIohpcwlD4Pb8"
const supabase = createClient(url, key)

async function seed() {
  console.log('Clearing database...')
  await supabase.from('approval_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('po_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('pr_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('purchase_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Fetching users...')
  const { data: users } = await supabase.from('users').select('*')
  
  const requester = users.find(u => u.role === 'Requester') || users[0]
  const manager = users.find(u => u.role === 'Manager') || users[1]
  const executive = users.find(u => u.role === 'Executive') || users[2]
  const purchasing = users.find(u => u.role === 'Purchasing') || users[3]

  const { data: deps } = await supabase.from('departments').select('*').limit(1)
  const department_id = requester.department_id || deps[0].id

  // PR 1: Manager Rejects
  console.log('Creating PR 1 (Manager Rejects)...')
  const { data: pr1 } = await supabase.from('purchase_requests').insert({
    pr_number: 'PR-2026-0001',
    title: 'สั่งซื้อเก้าอี้สำนักงาน (ผจก.ไม่อนุมัติ)',
    description: 'ทดสอบเคส 1',
    requester_id: requester.id,
    department_id: department_id,
    status: 'Rejected',
    current_step: 1
  }).select().single()

  await supabase.from('pr_items').insert({ pr_id: pr1.id, description: 'เก้าอี้เพื่อสุขภาพ Ergonomic', quantity: 5 })
  await supabase.from('approval_logs').insert({ document_type: 'PR', document_id: pr1.id, step_order: 1, approver_id: manager.id, action: 'reject', comment: 'งบประมาณเกินกำหนด ขอยกเลิก' })

  // PR 2: Manager Approves, Executive Rejects
  console.log('Creating PR 2 (Executive Rejects)...')
  const { data: pr2 } = await supabase.from('purchase_requests').insert({
    pr_number: 'PR-2026-0002',
    title: 'สั่งซื้อ iPad Pro (ผู้บริหารไม่อนุมัติ)',
    description: 'ทดสอบเคส 2',
    requester_id: requester.id,
    department_id: department_id,
    status: 'Rejected',
    current_step: 2
  }).select().single()

  await supabase.from('pr_items').insert({ pr_id: pr2.id, description: 'iPad Pro M4', quantity: 2 })
  await supabase.from('approval_logs').insert({ document_type: 'PR', document_id: pr2.id, step_order: 1, approver_id: manager.id, action: 'approve', comment: 'เห็นควรอนุมัติ' })
  await supabase.from('approval_logs').insert({ document_type: 'PR', document_id: pr2.id, step_order: 2, approver_id: executive.id, action: 'reject', comment: 'อุปกรณ์เดิมยังใช้งานได้ ไม่จำเป็นต้องซื้อใหม่' })

  // PR 3: Manager Approves, Exec Approves -> Create PO
  console.log('Creating PR 3 (Approved and Opened PO)...')
  const { data: pr3 } = await supabase.from('purchase_requests').insert({
    pr_number: 'PR-2026-0003',
    title: 'สั่งซื้อกระดาษ A4 (ผ่านตลอด/เปิด PO แล้ว)',
    description: 'ทดสอบเคส 3',
    requester_id: requester.id,
    department_id: department_id,
    status: 'Approved',
    current_step: 3
  }).select().single()

  await supabase.from('pr_items').insert({ pr_id: pr3.id, description: 'กระดาษ A4 Double A 80 แกรม', quantity: 50 })
  await supabase.from('approval_logs').insert({ document_type: 'PR', document_id: pr3.id, step_order: 1, approver_id: manager.id, action: 'approve', comment: 'อนุมัติสำหรับการใช้งานประจำเดือน' })
  await supabase.from('approval_logs').insert({ document_type: 'PR', document_id: pr3.id, step_order: 2, approver_id: executive.id, action: 'approve', comment: 'อนุมัติ' })

  // Create PO
  console.log('Creating PO for PR 3...')
  const { data: po } = await supabase.from('purchase_orders').insert({
    po_number: 'PO-2026-0001',
    pr_id: pr3.id,
    vendor_name: 'Officemate Co.,Ltd',
    description: 'จัดซื้อกระดาษประจำเดือน',
    created_by: purchasing.id,
    status: 'Pending',
    current_step: 1
  }).select().single()

  await supabase.from('po_items').insert({ po_id: po.id, description: 'กระดาษ A4', quantity: 50, unit_price: 120 })

  console.log('All test scenarios generated successfully!')
}

seed().catch(console.error)
