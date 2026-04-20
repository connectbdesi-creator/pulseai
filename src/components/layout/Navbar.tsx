'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, Search, X, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/models', label: 'Models' },
  { href: '/categories', label: 'Categories' },
]

type NavbarProps = {
  user: { email: string | null } | null
}

export function Navbar({ user }: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
          aria-label="PulseAI home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Zap className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span>PulseAI</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
          </Link>

          {user ? (
            <Link
              href="/dashboard"
              className="hidden md:inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Sign In
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          'border-t border-border md:hidden',
          open ? 'block' : 'hidden'
        )}
      >
        <nav
          className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
          aria-label="Mobile"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={user ? '/dashboard' : '/login'}
            onClick={() => setOpen(false)}
            className="mt-2 flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            {user ? 'Dashboard' : 'Sign In'}
          </Link>
        </nav>
      </div>
    </header>
  )
}
