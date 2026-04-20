import { cn } from '@/lib/cn'
import type {
  ArticleImportance,
  ModelCategory,
} from '@/types/database'

const CATEGORY_STYLES: Record<ModelCategory, string> = {
  llm: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  image: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  code: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  audio: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  multimodal: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  infrastructure:
    'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
}

const CATEGORY_LABEL: Record<ModelCategory, string> = {
  llm: 'LLM',
  image: 'Image',
  code: 'Code',
  audio: 'Audio',
  multimodal: 'Multimodal',
  infrastructure: 'Infrastructure',
}

const IMPORTANCE_STYLES: Record<ArticleImportance, string> = {
  breaking:
    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  major:
    'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  minor:
    'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
}

const IMPORTANCE_LABEL: Record<ArticleImportance, string> = {
  breaking: 'Breaking',
  major: 'Major',
  minor: 'Minor',
}

const BASE =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide'

type CategoryBadgeProps = {
  variant: 'category'
  value: ModelCategory
  className?: string
}

type ImportanceBadgeProps = {
  variant: 'importance'
  value: ArticleImportance
  className?: string
}

type MakerBadgeProps = {
  variant: 'maker'
  value: string
  className?: string
}

export type BadgeProps =
  | CategoryBadgeProps
  | ImportanceBadgeProps
  | MakerBadgeProps

export function Badge(props: BadgeProps) {
  if (props.variant === 'category') {
    return (
      <span
        className={cn(BASE, CATEGORY_STYLES[props.value], props.className)}
      >
        {CATEGORY_LABEL[props.value]}
      </span>
    )
  }

  if (props.variant === 'importance') {
    const dot =
      props.value === 'breaking'
        ? 'bg-red-500'
        : props.value === 'major'
          ? 'bg-orange-500'
          : 'bg-slate-400'
    return (
      <span
        className={cn(BASE, IMPORTANCE_STYLES[props.value], props.className)}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
        {IMPORTANCE_LABEL[props.value]}
      </span>
    )
  }

  return (
    <span
      className={cn(
        BASE,
        'bg-surface-muted text-foreground/80 border border-border normal-case tracking-normal',
        props.className
      )}
    >
      {props.value}
    </span>
  )
}
