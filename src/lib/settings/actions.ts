'use server'

import { createClient } from '@/lib/supabase/server'
import type { NotificationFrequency } from '@/types/database'

const VALID_FREQUENCIES: NotificationFrequency[] = [
  'instant',
  'daily',
  'weekly',
]

export type SettingsInput = {
  push_enabled: boolean
  whatsapp_enabled: boolean
  whatsapp_number: string | null
  notification_frequency: NotificationFrequency
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Accept E.164-ish input. Strip anything but leading + and digits.
  const cleaned = trimmed.replace(/[^\d+]/g, '')
  if (!/^\+?\d{7,16}$/.test(cleaned)) return null
  return cleaned
}

export async function updateNotificationSettings(
  input: SettingsInput
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!VALID_FREQUENCIES.includes(input.notification_frequency)) {
    return { error: 'Invalid frequency' }
  }

  let whatsappNumber: string | null = null
  if (input.whatsapp_enabled) {
    whatsappNumber = normalizePhone(input.whatsapp_number)
    if (!whatsappNumber) {
      return { error: 'Enter a valid phone number in international format' }
    }
  } else if (input.whatsapp_number) {
    // Keep whatever they entered even when disabled — normalized so it's sane.
    whatsappNumber = normalizePhone(input.whatsapp_number)
  }

  // Upsert so the profile row is created if the auth trigger hadn't run yet.
  const { error } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email ?? '',
        push_enabled: input.push_enabled,
        whatsapp_enabled: input.whatsapp_enabled,
        whatsapp_number: whatsappNumber,
        notification_frequency: input.notification_frequency,
      },
      { onConflict: 'id' }
    )

  if (error) return { error: error.message }
  return { error: null }
}

export async function sendWhatsappVerification(
  phone: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const normalized = normalizePhone(phone)
  if (!normalized) {
    return { error: 'Enter a valid phone number in international format' }
  }

  // Persist the number immediately so we can match the incoming verify message.
  await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email ?? '',
        whatsapp_number: normalized,
      },
      { onConflict: 'id' }
    )

  // TODO: wire this up to your WhatsApp Business provider (Twilio / Meta Cloud
  // API). For now we just stash the number — the verification message will be
  // sent once the provider is configured.
  return { error: null }
}
