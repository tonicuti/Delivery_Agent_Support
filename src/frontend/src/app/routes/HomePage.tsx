import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  History,
  LineChart,
  ListChecks,
  MessageSquare,
  PackageSearch,
  PenLine,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHero } from '@/shared/ui/PageHero'

const steps: {
  icon: LucideIcon
  title: string
  body: string
}[] = [
  {
    icon: ListChecks,
    title: 'Open orders needing attention',
    body: 'Start with the highest priority first. Search by order number if needed.',
  },
  {
    icon: PackageSearch,
    title: 'Read the evidence',
    body: 'Check delay reasons, warehouse progress, and transport. Watch for outdated info.',
  },
  {
    icon: PenLine,
    title: 'Record a decision',
    body: 'Approve, edit, or dismiss. This only saves your decision — it does not change other systems.',
  },
  {
    icon: Truck,
    title: 'Finish in your own systems',
    body: 'Do the real action outside this app, then confirm here or copy a customer draft.',
  },
]

const destinations: {
  to: string
  icon: LucideIcon
  title: string
  desc: string
  tint: string
}[] = [
  {
    to: '/dashboard',
    icon: ClipboardList,
    title: 'Orders needing attention',
    desc: 'Orders that may need a look today',
    tint: 'bg-[#e8f0fe] text-[#1a73e8]',
  },
  {
    to: '/history',
    icon: History,
    title: 'History',
    desc: 'Past alerts, decisions, and outcomes',
    tint: 'bg-[#e6f4ea] text-[#137333]',
  },
  {
    to: '/chat',
    icon: MessageSquare,
    title: 'Chat',
    desc: 'Ask which orders need attention and what to do next',
    tint: 'bg-[#fef7e0] text-[#b06000]',
  },
  {
    to: '/performance',
    icon: LineChart,
    title: 'Performance',
    desc: 'See flagged orders, decisions, and how alerts are picked up',
    tint: 'bg-[#f3e8fd] text-[#7627bb]',
  },
]

/** Home & guide — same shell / type scale as the other tabs. */
export function HomePage() {
  const guideRef = useRef<HTMLElement | null>(null)

  const scrollToGuide = () => {
    const el = guideRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('ring-2', 'ring-primary/40')
    window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-primary/40')
    }, 1200)
  }

  return (
    <section className="space-y-4">
      <PageHero
        tone="home"
        title="Home & guide"
        description="Review orders that may be late, check warehouse and transport updates, and record your decision. Complete the real action in your own systems — this app does not change them."
        actions={
          <>
            <Link
              to="/dashboard"
              className="inline-flex h-8 items-center rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to orders
            </Link>
            <button
              type="button"
              onClick={scrollToGuide}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              How to use
            </button>
          </>
        }
      />

      <section
        ref={guideRef}
        id="how-to-use"
        className="scroll-mt-3 space-y-2 transition-[box-shadow] duration-300"
      >
        <div>
          <h2 className="text-sm font-semibold tracking-tight">How to use</h2>
          <p className="text-sm text-muted-foreground">
            Four steps for day-to-day work.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <li
                key={s.title}
                className="rounded-sm border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-sm bg-[#e8f0fe] text-[#1a73e8]">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-2.5 text-sm font-medium">{s.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {s.body}
                </p>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          If no suggestion is available, you can still decide from the details.
          Approving here never means stock, route, or schedule has already
          changed.
        </p>
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Where to go</h2>
          <p className="text-sm text-muted-foreground">
            Jump into a workspace area.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {destinations.map((d) => {
            const Icon = d.icon
            return (
              <li key={d.to}>
                <Link
                  to={d.to}
                  className="flex items-start gap-3 rounded-sm border border-border bg-card p-3 transition hover:bg-muted/40"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-sm ${d.tint}`}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-sm font-medium text-primary">
                      {d.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {d.desc}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </section>
  )
}
