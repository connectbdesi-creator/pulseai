import { createClient } from '@supabase/supabase-js'
import { seedModels } from '../lib/seed-models'
import type { Database } from '../types/database'

try {
  process.loadEnvFile('.env.local')
} catch {
  // .env.local is optional — fall back to whatever is already in process.env
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them in .env.local or the shell before running.'
  )
  process.exit(1)
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  console.log(`Seeding ${seedModels.length} models…`)

  const { data, error } = await supabase
    .from('models')
    .upsert(seedModels, { onConflict: 'slug' })
    .select('slug')

  if (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  }

  console.log(`Upserted ${data?.length ?? 0} rows.`)
}

main()
