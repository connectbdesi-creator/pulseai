import { ImageResponse } from 'next/og'
import { createPublicClient } from '@/lib/supabase/public'

export const alt = 'PulseAI — AI model update'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: article } = await supabase
    .from('articles')
    .select('title, importance, model_ids')
    .eq('slug', slug)
    .maybeSingle()

  const firstModelId = article?.model_ids?.[0]
  const { data: model } = firstModelId
    ? await supabase
        .from('models')
        .select('name, maker')
        .eq('id', firstModelId)
        .maybeSingle()
    : { data: null }

  const modelLabel = model
    ? model.maker
      ? `${model.maker} · ${model.name}`
      : model.name
    : 'PulseAI'

  const title = article?.title ?? 'AI model update'
  const importance = article?.importance ?? 'minor'

  const importanceStyle =
    importance === 'breaking'
      ? { background: '#fee2e2', color: '#b91c1c', label: 'BREAKING' }
      : importance === 'major'
        ? { background: '#ffedd5', color: '#c2410c', label: 'MAJOR' }
        : { background: '#e2e8f0', color: '#475569', label: 'UPDATE' }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background:
            'linear-gradient(135deg, #0a0a0f 0%, #0f172a 55%, #1e3a8a 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            ⚡
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.01em' }}>
            PulseAI
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: 999,
                background: importanceStyle.background,
                color: importanceStyle.color,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {importanceStyle.label}
            </div>
            <div
              style={{
                fontSize: 22,
                color: '#cbd5e1',
                fontWeight: 500,
              }}
            >
              {modelLabel}
            </div>
          </div>

          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              maxWidth: 1000,
              display: 'flex',
            }}
          >
            {title.length > 140 ? `${title.slice(0, 137)}…` : title}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#94a3b8',
            fontSize: 22,
          }}
        >
          <div>Follow the AI models that matter to you</div>
          <div>pulseai.app</div>
        </div>
      </div>
    ),
    size
  )
}
