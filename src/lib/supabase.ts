import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ozocgfohgtclnyakbmxv.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2NnZm9oZ3RjbG55YWtibXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzI5OTQsImV4cCI6MjA4ODc0ODk5NH0.KONI7_J6wgzKxo3qyHzRsmft1ilwCpvIohpcwlD4Pb8'

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)
