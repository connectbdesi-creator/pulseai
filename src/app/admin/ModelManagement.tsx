'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import {
  createModel,
  toggleModel,
  type CreateModelInput,
} from './actions'
import type { ModelCategory } from '@/types/database'

export type AdminModel = {
  id: string
  slug: string
  name: string
  maker: string | null
  category: ModelCategory
  is_active: boolean
  follower_count: number
}

const CATEGORIES: ModelCategory[] = [
  'llm',
  'image',
  'code',
  'audio',
  'multimodal',
  'infrastructure',
]

export function ModelManagement({ models }: { models: AdminModel[] }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {models.length} {models.length === 1 ? 'model' : 'models'} ·{' '}
          {models.filter((m) => m.is_active).length} active
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:border-brand-500/40"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Hide form' : 'Add model'}
        </button>
      </div>

      {showForm && <AddModelForm onDone={() => setShowForm(false)} />}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden md:table-cell">Maker</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 hidden lg:table-cell text-right">
                Followers
              </th>
              <th className="px-4 py-3 text-right">Active</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <ModelRow key={m.id} model={m} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModelRow({ model }: { model: AdminModel }) {
  const [active, setActive] = useState(model.is_active)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    const next = !active
    setActive(next)
    setError(null)
    startTransition(async () => {
      const res = await toggleModel(model.id, next)
      if (res.error) {
        setActive(!next) // revert
        setError(res.error)
      }
    })
  }

  return (
    <tr className={cn('border-b border-border last:border-b-0')}>
      <td className="px-4 py-3">
        <div className="font-medium">{model.name}</div>
        <div className="text-xs text-muted">{model.slug}</div>
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-sm text-foreground/80">
        {model.maker ?? '—'}
      </td>
      <td className="px-4 py-3">
        <Badge variant="category" value={model.category} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-right text-sm">
        {model.follower_count.toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={`Toggle ${model.name} active`}
            onClick={handleToggle}
            disabled={pending}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-60',
              active ? 'bg-brand-600' : 'bg-border'
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                active ? 'translate-x-[22px]' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddModelForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<CreateModelInput>({
    name: '',
    slug: '',
    maker: '',
    category: 'llm',
    description: '',
    current_version: '',
    pricing_input_per_1m: null,
    pricing_output_per_1m: null,
    context_window: null,
    release_date: '',
    logo_url: '',
  })
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function setField<K extends keyof CreateModelInput>(
    key: K,
    value: CreateModelInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await createModel(form)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(true)
        setForm({
          name: '',
          slug: '',
          maker: '',
          category: 'llm',
          description: '',
          current_version: '',
          pricing_input_per_1m: null,
          pricing_output_per_1m: null,
          context_window: null,
          release_date: '',
          logo_url: '',
        })
        // Keep form open for rapid-entry; admin closes it when done.
      }
    })
  }

  const input =
    'h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
  const label = 'flex flex-col gap-1 text-xs font-medium text-muted'

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
    >
      <label className={label}>
        Name*
        <input
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          className={input}
        />
      </label>
      <label className={label}>
        Slug*
        <input
          required
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
          placeholder="kebab-case"
          className={input}
        />
      </label>
      <label className={label}>
        Maker
        <input
          value={form.maker ?? ''}
          onChange={(e) => setField('maker', e.target.value)}
          className={input}
        />
      </label>
      <label className={label}>
        Category*
        <select
          value={form.category}
          onChange={(e) =>
            setField('category', e.target.value as ModelCategory)
          }
          className={input}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Description
        <textarea
          rows={2}
          value={form.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </label>
      <label className={label}>
        Current version
        <input
          value={form.current_version ?? ''}
          onChange={(e) => setField('current_version', e.target.value)}
          className={input}
        />
      </label>
      <label className={label}>
        Release date
        <input
          type="date"
          value={form.release_date ?? ''}
          onChange={(e) => setField('release_date', e.target.value)}
          className={input}
        />
      </label>
      <label className={label}>
        Input price / 1M
        <input
          type="number"
          step="0.0001"
          min="0"
          value={form.pricing_input_per_1m ?? ''}
          onChange={(e) =>
            setField(
              'pricing_input_per_1m',
              e.target.value === '' ? null : Number(e.target.value)
            )
          }
          className={input}
        />
      </label>
      <label className={label}>
        Output price / 1M
        <input
          type="number"
          step="0.0001"
          min="0"
          value={form.pricing_output_per_1m ?? ''}
          onChange={(e) =>
            setField(
              'pricing_output_per_1m',
              e.target.value === '' ? null : Number(e.target.value)
            )
          }
          className={input}
        />
      </label>
      <label className={label}>
        Context window
        <input
          type="number"
          min="0"
          value={form.context_window ?? ''}
          onChange={(e) =>
            setField(
              'context_window',
              e.target.value === '' ? null : Number(e.target.value)
            )
          }
          className={input}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Logo URL
        <input
          type="url"
          value={form.logo_url ?? ''}
          onChange={(e) => setField('logo_url', e.target.value)}
          className={input}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400 sm:col-span-2"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300 sm:col-span-2">
          <Check className="h-3.5 w-3.5" />
          Model created.
        </p>
      )}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted hover:text-foreground"
        >
          Close
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Add model
        </button>
      </div>
    </form>
  )
}
