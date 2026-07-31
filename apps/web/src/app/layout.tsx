import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/lib/trpc-provider'
import { NotificationBell } from '@/components/NotificationBell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Strike Manager',
  description: 'Bowling tournament management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-ink-900 text-steel-200 antialiased`}>
        <TRPCProvider>
          <div className="fixed top-4 right-4 z-50">
            <NotificationBell />
          </div>
          {children}
        </TRPCProvider>
      </body>
    </html>
  )
}
