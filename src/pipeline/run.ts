import { fileURLToPath } from 'node:url'
import { runScraper } from '../scraper/index'
import { writeArticle } from './writer'
import { publishArticle } from './publisher'

try {
  process.loadEnvFile('.env.local')
} catch {
  // .env.local optional — CI injects vars directly.
}

export async function runPipeline() {
  const t0 = Date.now()
  const queue = await runScraper()
  if (queue.length === 0) {
    console.log('[pipeline] nothing to write')
    return { written: 0, failed: 0 }
  }

  console.log(`[pipeline] writing ${queue.length} articles…`)
  let written = 0
  let failed = 0

  for (const item of queue) {
    try {
      const draft = await writeArticle(item, item.models, item.category)
      const published = await publishArticle(draft)
      written += 1
      console.log(
        `[pipeline] ✓ ${published.title} — /updates/${published.slug}`
      )
    } catch (err) {
      failed += 1
      console.error(
        `[pipeline] ✗ "${item.title}" (${item.url}):`,
        err instanceof Error ? err.message : err
      )
    }
  }

  console.log(
    `[pipeline] done: written=${written} failed=${failed} in ${Date.now() - t0}ms`
  )
  return { written, failed }
}

const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectInvocation) {
  runPipeline()
    .then(({ failed }) => process.exit(failed > 0 ? 1 : 0))
    .catch((err) => {
      console.error('[pipeline] fatal', err)
      process.exit(1)
    })
}
