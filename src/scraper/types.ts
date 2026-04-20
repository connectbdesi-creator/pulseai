export type ScrapedItem = {
  title: string
  url: string
  content: string
  publishedAt: string | null // ISO 8601 or null if unknown
  sourceName: string
}

export type RelevanceResult = {
  relevant: boolean
  models: string[]
  category: string // llm | image | code | audio | multimodal | infrastructure | '' (unknown)
}

export type QueueItem = ScrapedItem & RelevanceResult
