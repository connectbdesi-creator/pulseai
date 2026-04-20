import { createHash } from 'node:crypto'
import { createScraperClient } from './supabase'
import type { ScrapedItem } from './types'

export function hashItem(item: Pick<ScrapedItem, 'url' | 'title'>): string {
  // Hash url + title so near-duplicate titles at the same URL collide but
  // different articles at the same URL (rare) don't.
  return createHash('sha256')
    .update(`${item.url.trim()}||${item.title.trim()}`)
    .digest('hex')
}

// Returns true if the item was already processed on a prior run.
// On a new item, inserts into processed_items so subsequent runs skip it.
export async function isProcessed(item: ScrapedItem): Promise<boolean> {
  const supabase = createScraperClient()
  const source_hash = hashItem(item)

  const { data: existing, error: selectErr } = await supabase
    .from('processed_items')
    .select('id')
    .eq('source_hash', source_hash)
    .maybeSingle()

  if (selectErr) {
    console.error('[dedup] select failed', selectErr.message)
    // Fail open — treat as new so we don't silently drop items on a DB blip.
    return false
  }
  if (existing) return true

  const { error: insertErr } = await supabase.from('processed_items').insert({
    source_hash,
    source_url: item.url,
  })
  // Unique-violation (23505) means another concurrent run just claimed it;
  // that's fine — treat as already processed.
  if (insertErr && (insertErr as { code?: string }).code === '23505') {
    return true
  }
  if (insertErr) {
    console.error('[dedup] insert failed', insertErr.message)
  }
  return false
}
