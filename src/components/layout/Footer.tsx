import Link from 'next/link'
import { Zap } from 'lucide-react'
import { GithubIcon, XIcon } from '@/components/ui/BrandIcons'

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/models', label: 'Models' },
  { href: '/categories', label: 'Categories' },
]

const SOCIAL = [
  {
    href: 'https://x.com/pulseai',
    label: 'X',
    icon: XIcon,
  },
  {
    href: 'https://github.com/pulseai',
    label: 'GitHub',
    icon: GithubIcon,
  },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Zap className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span>PulseAI</span>
            </Link>
            <p className="mt-3 text-sm text-muted">
              Follow the AI models that matter to you.
            </p>
          </div>

          <nav
            className="flex flex-wrap gap-x-6 gap-y-2"
            aria-label="Footer navigation"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-foreground/80 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {SOCIAL.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-foreground/80 hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} PulseAI. All rights reserved.</span>
          <span>Built with ❤️ using Claude API</span>
        </div>
      </div>
    </footer>
  )
}
