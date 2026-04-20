export type ModelCategory =
  | 'llm'
  | 'image'
  | 'code'
  | 'audio'
  | 'multimodal'
  | 'infrastructure'

export type ArticleImportance = 'breaking' | 'major' | 'minor'

export type NotificationFrequency = 'instant' | 'daily' | 'weekly'

export type NotificationChannel = 'email' | 'push' | 'whatsapp'

export type NotificationStatus = 'sent' | 'failed'

export interface ModelRow {
  id: string
  name: string
  slug: string
  maker: string | null
  category: ModelCategory
  description: string | null
  logo_url: string | null
  current_version: string | null
  pricing_input_per_1m: number | null
  pricing_output_per_1m: number | null
  context_window: number | null
  release_date: string | null
  last_updated_at: string | null
  follower_count: number
  is_active: boolean
  created_at: string
}

export type ModelInsert = Omit<
  ModelRow,
  'id' | 'follower_count' | 'is_active' | 'created_at'
> &
  Partial<Pick<ModelRow, 'id' | 'follower_count' | 'is_active' | 'created_at'>>

export type ModelUpdate = Partial<Omit<ModelRow, 'id' | 'created_at'>>

export interface ArticleRow {
  id: string
  title: string
  slug: string
  summary: string | null
  body: string | null
  model_ids: string[]
  model_tags: string[]
  category: string | null
  importance: ArticleImportance
  source_url: string | null
  source_name: string | null
  published_at: string | null
  is_published: boolean
  ai_generated: boolean
  created_at: string
}

export type ArticleInsert = Omit<
  ArticleRow,
  'id' | 'model_ids' | 'importance' | 'is_published' | 'ai_generated' | 'created_at'
> &
  Partial<
    Pick<
      ArticleRow,
      | 'id'
      | 'model_ids'
      | 'importance'
      | 'is_published'
      | 'ai_generated'
      | 'created_at'
    >
  >

export type ArticleUpdate = Partial<Omit<ArticleRow, 'id' | 'created_at'>>

export interface UserRow {
  id: string
  email: string
  whatsapp_number: string | null
  notification_frequency: NotificationFrequency
  push_enabled: boolean
  whatsapp_enabled: boolean
  created_at: string
}

export type UserInsert = Omit<
  UserRow,
  'notification_frequency' | 'push_enabled' | 'whatsapp_enabled' | 'created_at'
> &
  Partial<
    Pick<
      UserRow,
      'notification_frequency' | 'push_enabled' | 'whatsapp_enabled' | 'created_at'
    >
  >

export type UserUpdate = Partial<Omit<UserRow, 'id' | 'created_at'>>

export interface FollowRow {
  id: string
  user_id: string
  model_id: string | null
  category: string | null
  created_at: string
}

export type FollowInsert = Omit<FollowRow, 'id' | 'created_at'> &
  Partial<Pick<FollowRow, 'id' | 'created_at'>>

export type FollowUpdate = Partial<Omit<FollowRow, 'id' | 'created_at'>>

export interface NotificationLogRow {
  id: string
  user_id: string
  article_id: string
  channel: NotificationChannel
  sent_at: string
  status: NotificationStatus
}

export type NotificationLogInsert = Omit<NotificationLogRow, 'id' | 'sent_at'> &
  Partial<Pick<NotificationLogRow, 'id' | 'sent_at'>>

export type NotificationLogUpdate = Partial<Omit<NotificationLogRow, 'id'>>

export interface ProcessedItemRow {
  id: string
  source_hash: string
  source_url: string | null
  processed_at: string
}

export type ProcessedItemInsert = Omit<ProcessedItemRow, 'id' | 'processed_at'> &
  Partial<Pick<ProcessedItemRow, 'id' | 'processed_at'>>

export type ProcessedItemUpdate = Partial<Omit<ProcessedItemRow, 'id'>>

export interface Database {
  public: {
    Tables: {
      models: {
        Row: ModelRow
        Insert: ModelInsert
        Update: ModelUpdate
      }
      articles: {
        Row: ArticleRow
        Insert: ArticleInsert
        Update: ArticleUpdate
      }
      users: {
        Row: UserRow
        Insert: UserInsert
        Update: UserUpdate
      }
      follows: {
        Row: FollowRow
        Insert: FollowInsert
        Update: FollowUpdate
      }
      notification_log: {
        Row: NotificationLogRow
        Insert: NotificationLogInsert
        Update: NotificationLogUpdate
      }
      processed_items: {
        Row: ProcessedItemRow
        Insert: ProcessedItemInsert
        Update: ProcessedItemUpdate
      }
    }
    Enums: {
      model_category: ModelCategory
      article_importance: ArticleImportance
      notification_frequency: NotificationFrequency
      notification_channel: NotificationChannel
      notification_status: NotificationStatus
    }
  }
}
