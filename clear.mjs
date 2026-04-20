import { createClient } from '@supabase/supabase-js'

const url = "https://ozocgfohgtclnyakbmxv.supabase.co"
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2NnZm9oZ3RjbG55YWtibXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI5OTQsImV4cCI6MjA4ODc0ODk5NH0.KONI7_J6wgzKxo3qyHzRsmft1ilwCpvIohpcwlD4Pb8"
const supabase = createClient(url, key)

async function clear() {
  console.log('Clearing approval_logs...')
  await supabase.from('approval_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('Clearing po_items...')
  await supabase.from('po_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('Clearing pr_items...')
  await supabase.from('pr_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('Clearing purchase_orders...')
  await supabase.from('purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('Clearing purchase_requests...')
  await supabase.from('purchase_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  console.log('Done!')
}

clear().catch(console.error)
