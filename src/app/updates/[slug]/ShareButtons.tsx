'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { LinkedinIcon, XIcon } from '@/components/ui/BrandIcons'
import { cn } from '@/lib/cn'

type ShareButtonsProps = {
  title: string
  url: string
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard write can fail in insecure contexts; fail quietly.
    }
  }

  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

  const base =
    'inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium transition-colors hover:border-brand-500/40 hover:text-brand-600'

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleCopy} className={cn(base)}>
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy link
          </>
        )}
      </button>
      <a
        href={xUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(base)}
        aria-label="Share on X"
      >
        <XIcon className="h-3.5 w-3.5" />
        X
      </a>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(base)}
        aria-label="Share on LinkedIn"
      >
        <LinkedinIcon className="h-3.5 w-3.5" />
        LinkedIn
      </a>
    </div>
  )
}
