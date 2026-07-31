import Link from 'next/link'
import { Trophy, Target, BarChart3, ArrowRight, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'

export default function Home() {
  return (
    <div className="min-h-screen bg-ink-900 text-steel-200">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-ink-900/95 backdrop-blur supports-[backdrop-filter]:bg-ink-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/tournaments" className="text-sm font-medium text-steel-400 hover:text-white transition-colors">
              Browse tournaments
            </Link>
            <Link href="/login" className="text-sm font-medium text-steel-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-lg bg-pin-400 px-5 py-2 text-sm font-semibold text-white hover:bg-pin-500 transition-colors shadow-lg shadow-pin-400/20">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-800/50 to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-pin-400/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-28">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-steel-400">
              <span className="h-2 w-2 rounded-full bg-pin-400 animate-pulse" />
              Now in beta — free during launch
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Tournament management
              <span className="block text-pin-400">built for bowling.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-steel-400">
              The only platform purpose-built for tournament directors.
              Create events, shuffle brackets, track live standings, and manage sidepots —
              all from one powerful dashboard.
            </p>
            <div className="mt-10 flex items-center gap-4">
              <Link href="/signup" className="group inline-flex items-center gap-2 rounded-xl bg-pin-400 px-7 py-3.5 text-base font-semibold text-white hover:bg-pin-500 transition-all shadow-xl shadow-pin-400/25">
                Organize a tournament <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/tournaments" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-7 py-3.5 text-base font-semibold text-steel-300 hover:bg-white/5 hover:text-white transition-all">
                Find a tournament <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-ink-800">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Everything a tournament director needs
            </h2>
            <p className="mt-4 text-lg text-steel-400">
              Purpose-built tools for every stage of your event
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Trophy className="h-7 w-7" />}
              title="Tournaments"
              items={["Multi-stage formats", "Custom handicap rules", "Player registration", "Squad management"]}
            />
            <FeatureCard
              icon={<Target className="h-7 w-7" />}
              title="Brackets & Sidepots"
              items={["Fairness-optimized shuffle", "Eliminator brackets", "High game & series", "Blind draw doubles"]}
            />
            <FeatureCard
              icon={<BarChart3 className="h-7 w-7" />}
              title="Live Standings"
              items={["Real-time WebSocket", "Auto handicap calc", "QR share results", "Export CSV & PDF"]}
            />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/5 bg-ink-900 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: "100%", label: "USBC-compliant handicap" },
              { value: "50K", label: "Shuffle iterations for fairness" },
              { value: "< 1s", label: "Real-time standings latency" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-pin-400">{stat.value}</div>
                <div className="mt-1 text-sm text-steel-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ink-800 to-ink-900">
        <div className="absolute top-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-pin-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-32 text-center">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Ready to run your next tournament?
          </h2>
          <p className="mt-5 text-xl text-steel-400">
            Free during beta. Set up your first event in under 5 minutes.
          </p>
          <div className="mt-10">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-pin-400 px-8 py-4 text-lg font-semibold text-white hover:bg-pin-500 transition-all shadow-2xl shadow-pin-400/30">
              Create your account <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-ink-900 py-10 text-center text-sm text-steel-600">
        <p>&copy; {new Date().getFullYear()} Strike Manager</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="group rounded-2xl border border-white/5 bg-ink-700/50 p-8 hover:border-white/10 hover:bg-ink-700 transition-all">
      <div className="mb-5 inline-flex rounded-xl bg-pin-400/10 p-3 text-pin-400 group-hover:bg-pin-400/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-steel-400">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pin-400/60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
