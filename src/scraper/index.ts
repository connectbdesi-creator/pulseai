import { fileURLToPath } from 'node:url'
import { fetchRssItems } from './sources/rss'
import { fetchHackerNewsItems } from './sources/hackernews'
import { fetchRedditItems } from './sources/reddit'
import { isProcessed } from './dedup'
import { classifyRelevance } from './filter'
import type { QueueItem, ScrapedItem } from './types'

try {
  process.loadEnvFile('.env.local')
} catch {
  // .env.local optional — CI should inject env vars directly.
}

// Run the three scrapers in parallel, then walk each item sequentially through
// dedup → relevance. Sequential matters here: dedup writes a row per new item
// (creating it), so processing in parallel risks duplicate processed_items
// inserts that cost us Gemini calls. The 23505 handler in dedup.ts stops real
// double-processing across concurrent CI runs.
export async function runScraper(): Promise<QueueItem[]> {
  const t0 = Date.now()
  const [rss, hn, reddit] = await Promise.all([
    fetchRssItems(),
    fetchHackerNewsItems(),
    fetchRedditItems(),
  ])
  const all: ScrapedItem[] = [...rss, ...hn, ...reddit]
  console.log(
    `[scraper] sources: rss=${rss.length} hn=${hn.length} reddit=${reddit.length} (${all.length} total) in ${Date.now() - t0}ms`
  )

  const queue: QueueItem[] = []
  let skippedDup = 0
  let skippedIrrelevant = 0
  let classifierErrors = 0

  for (const item of all) {
    const seen = await isProcessed(item)
    if (seen) {
      skippedDup += 1
      continue
    }
    const relevance = await classifyRelevance(item)
    if (!relevance.relevant) {
      skippedIrrelevant += 1
      continue
    }
    if (!relevance.category && relevance.models.length === 0) {
      // Gemini said relevant but gave us nothing to tag — skip to avoid
      // orphan articles.
      classifierErrors += 1
      continue
    }
    queue.push({ ...item, ...relevance })
  }

  console.log(
    `[scraper] done: queued=${queue.length} dup=${skippedDup} irrelevant=${skippedIrrelevant} uncategorised=${classifierErrors} in ${Date.now() - t0}ms`
  )
  return queue
}

// Only run the orchestrator when invoked directly (tsx src/scraper/index.ts),
// not when imported as a module.
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectInvocation) {
  runScraper()
    .then((queue) => {
      console.log(JSON.stringify(queue, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('[scraper] fatal', err)
      process.exit(1)
    })
}
