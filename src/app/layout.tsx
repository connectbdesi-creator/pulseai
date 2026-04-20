import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'PulseAI — Follow the AI models that matter',
    template: '%s · PulseAI',
  },
  description:
    'Track every major AI model release, pricing change, and capability update — all in one feed. Follow the models you care about and get notified the moment something ships.',
  metadataBase: new URL('https://pulseai.app'),
  openGraph: {
    type: 'website',
    siteName: 'PulseAI',
    title: 'PulseAI — Follow the AI models that matter',
    description:
      'Track every major AI model release, pricing change, and capability update.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar user={user ? { email: user.email ?? null } : null} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
