'use client'

import { useState, useTransition } from 'react'
import { Bell, BellOff, Check, Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  sendWhatsappVerification,
  updateNotificationSettings,
  type SettingsInput,
} from '@/lib/settings/actions'
import type { NotificationFrequency } from '@/types/database'

type SettingsFormProps = {
  initial: SettingsInput
}

const FREQUENCIES: {
  value: NotificationFrequency
  label: string
  hint: string
}[] = [
  { value: 'instant', label: 'Instant', hint: 'Every update as it happens.' },
  {
    value: 'daily',
    label: 'Daily digest',
    hint: 'A single summary email each morning.',
  },
  {
    value: 'weekly',
    label: 'Weekly digest',
    hint: 'The week in AI, delivered Sundays.',
  },
]

type PushState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export function SettingsForm({ initial }: SettingsFormProps) {
  const [form, setForm] = useState<SettingsInput>(initial)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>(
    'idle'
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [pushState, setPushState] = useState<PushState>('idle')
  const [whatsappState, setWhatsappState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle')
  const [whatsappError, setWhatsappError] = useState<string | null>(null)

  function setField<K extends keyof SettingsInput>(
    key: K,
    value: SettingsInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaveState('idle')
  }

  async function handleEnablePush() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushState('unsupported')
      return
    }
    setPushState('requesting')
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        setPushState('granted')
        setField('push_enabled', true)
        // TODO: register with OneSignal / FCM here and persist the token.
      } else {
        setPushState('denied')
      }
    } catch {
      setPushState('denied')
    }
  }

  async function handleConnectWhatsapp() {
    setWhatsappState('sending')
    setWhatsappError(null)
    startTransition(async () => {
      const { error } = await sendWhatsappVerification(
        form.whatsapp_number ?? ''
      )
      if (error) {
        setWhatsappError(error)
        setWhatsappState('error')
      } else {
        setWhatsappState('sent')
      }
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaveState('idle')
    setError(null)
    startTransition(async () => {
      const result = await updateNotificationSettings(form)
      if (result.error) {
        setError(result.error)
        setSaveState('error')
      } else {
        setSaveState('saved')
      }
    })
  }

  const pushButtonLabel =
    pushState === 'granted' || form.push_enabled
      ? 'Browser push enabled'
      : pushState === 'denied'
        ? 'Blocked by browser — update site permissions'
        : pushState === 'unsupported'
          ? 'Not supported in this browser'
          : 'Enable browser push'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Email */}
      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-1 text-sm font-semibold">Email notifications</legend>

        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.notification_frequency !== 'weekly' || true}
            onChange={() => {
              /* email is always on — users can pick frequency below */
            }}
            disabled
            className="mt-1 h-4 w-4 rounded accent-brand-600"
          />
          <span className="text-sm">
            <span className="font-medium">Send me email updates</span>
            <span className="mt-0.5 block text-xs text-muted">
              We email the address you signed up with. To stop emails entirely,
              use the Unsubscribe link in any message.
            </span>
          </span>
        </label>

        <div className="mt-6 flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Frequency
          </span>
          {FREQUENCIES.map((f) => {
            const active = form.notification_frequency === f.value
            return (
              <label
                key={f.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                  active
                    ? 'border-brand-600 bg-brand-600/5'
                    : 'border-border hover:border-brand-500/40'
                )}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={f.value}
                  checked={active}
                  onChange={() => setField('notification_frequency', f.value)}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span>
                  <span className="block font-medium">{f.label}</span>
                  <span className="block text-xs text-muted">{f.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Push */}
      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-1 text-sm font-semibold">Push notifications</legend>
        <p className="mt-2 text-sm text-muted">
          Breaking updates delivered straight to this browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={
              pushState === 'requesting' ||
              pushState === 'granted' ||
              pushState === 'unsupported' ||
              form.push_enabled
            }
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:opacity-70',
              form.push_enabled || pushState === 'granted'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border bg-surface hover:border-brand-500/40'
            )}
          >
            {pushState === 'requesting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : form.push_enabled || pushState === 'granted' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {pushButtonLabel}
          </button>
          {form.push_enabled && (
            <button
              type="button"
              onClick={() => setField('push_enabled', false)}
              className="inline-flex h-10 items-center gap-1 rounded-md px-3 text-xs text-muted hover:text-foreground"
            >
              <BellOff className="h-3.5 w-3.5" />
              Disable
            </button>
          )}
        </div>
      </fieldset>

      {/* WhatsApp */}
      <fieldset className="rounded-xl border border-border bg-surface p-6">
        <legend className="px-1 text-sm font-semibold">WhatsApp</legend>
        <p className="mt-2 text-sm text-muted">
          Get breaking model news as a WhatsApp message.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="tel"
            value={form.whatsapp_number ?? ''}
            onChange={(e) => setField('whatsapp_number', e.target.value)}
            placeholder="+14155551212"
            autoComplete="tel"
            className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={handleConnectWhatsapp}
            disabled={whatsappState === 'sending' || !form.whatsapp_number}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium hover:border-brand-500/40 disabled:opacity-60"
          >
            {whatsappState === 'sending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Connect WhatsApp
          </button>
        </div>
        {whatsappState === 'sent' && (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-300">
            Number saved. A verification message will be sent once our WhatsApp
            sender is online.
          </p>
        )}
        {whatsappError && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            {whatsappError}
          </p>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.whatsapp_enabled}
            onChange={(e) => setField('whatsapp_enabled', e.target.checked)}
            className="h-4 w-4 rounded accent-brand-600"
          />
          Send WhatsApp notifications once verified
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save settings
        </button>
        {saveState === 'saved' && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </form>
  )
}
