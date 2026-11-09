import { Link } from 'react-router-dom'
import {
  ClipboardList,
  Database,
  History,
  LineChart,
  ListChecks,
  PackageSearch,
  PenLine,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'

const steps: {
  icon: LucideIcon
  title: string
  body: string
}[] = [
  {
    icon: ListChecks,
    title: 'Open the worklist',
    body: 'Start with Orders needing attention. Highest priority first; search by order ID if needed.',
  },
  {
    icon: PackageSearch,
    title: 'Read the evidence',
    body: 'Open a case. Check risk reasons, warehouse progress, and transport. Watch for Stale or Cannot assess.',
  },
  {
    icon: PenLine,
    title: 'Record a decision',
    body: 'Approve, Edit, or Dismiss. This only saves your decision — it does not update ERP, WMS, or TMS.',
  },
  {
    icon: Truck,
    title: 'Finish in source systems',
    body: 'Complete the real action outside this app, then confirm here or copy a customer draft.',
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
    desc: 'Prioritized worklist for today',
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
    to: '/data-health',
    icon: Database,
    title: 'Data health',
    desc: 'Whether feeds are fresh enough to trust',
    tint: 'bg-[#fef7e0] text-[#b06000]',
  },
  {
    to: '/performance',
    icon: LineChart,
    title: 'Performance',
    desc: 'Delivery and review metrics for the pilot',
    tint: 'bg-[#f3e8fd] text-[#7627bb]',
  },
]

/**
 * Product home — Google Material: wider grid, soft cards, tinted icons.
 */
export function HomePage() {
  return (
    <div className="min-h-svh bg-[#f8f9fa] text-[#202124]">
      <header className="border-b border-[#e8eaed] bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-6 lg:px-8">
          <Link
            to="/"
            className="text-[22px] font-normal tracking-tight text-[#202124]"
          >
            Delivery Risk Agent
          </Link>
          <Badge
            variant="secondary"
            className="rounded-sm border border-[#dadce0] bg-[#f1f3f4] text-[11px] font-normal text-[#5f6368]"
            title="Session SQLite copy — not live ERP/TMS"
          >
            Demo · session copy
          </Badge>
          <div className="ml-auto">
            <Link
              to="/dashboard"
              className="inline-flex h-9 items-center rounded-sm bg-[#1a73e8] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#1765cc] hover:shadow"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8 lg:px-8 lg:py-10">
        {/* Welcome band */}
        <section className="overflow-hidden rounded-lg border border-[#e8eaed] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              <h1 className="text-[28px] font-normal leading-tight tracking-tight sm:text-[32px]">
                Delivery Risk Agent
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#5f6368]">
                Review at-risk orders, check warehouse and transport evidence,
                and record a decision. Complete the real action in ERP, WMS, or
                TMS — this app does not change those systems.
              </p>
              <p className="mt-2 text-[13px] text-[#5f6368]">
                Scope: Sweden · Stockholm (WH1)
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  to="/dashboard"
                  className="inline-flex h-10 items-center rounded-sm bg-[#1a73e8] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1765cc] hover:shadow"
                >
                  Go to dashboard
                </Link>
                <a
                  href="#how-to-use"
                  className="text-sm font-medium text-[#1a73e8] hover:underline"
                >
                  How to use
                </a>
              </div>
            </div>

            <div
              className="relative hidden min-h-[220px] items-center justify-center border-t border-[#e8eaed] bg-[linear-gradient(160deg,#e8f0fe_0%,#f8f9fa_45%,#e6f4ea_100%)] lg:flex lg:border-t-0 lg:border-l"
              aria-hidden
            >
              <GoogleStyleIllustration />
            </div>
          </div>
        </section>

        {/* How to use — Material tiles */}
        <section id="how-to-use" className="mt-8 scroll-mt-6">
          <h2 className="text-[18px] font-medium">How to use</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Four steps for day-to-day work.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <li
                  key={s.title}
                  className="group rounded-lg border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition hover:border-[#dadce0] hover:shadow-[0_1px_3px_rgba(60,64,67,0.2),0_4px_8px_rgba(60,64,67,0.08)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8] transition group-hover:scale-105">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="text-xs font-medium text-[#5f6368]">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-medium">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#5f6368]">
                    {s.body}
                  </p>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 text-[13px] leading-5 text-[#5f6368]">
            If AI assist is Unavailable, you can still decide from the evidence.
            Approving here never means stock, route, or schedule already
            changed.
          </p>
        </section>

        {/* Where to go */}
        <section className="mt-8">
          <h2 className="text-[18px] font-medium">Where to go</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Jump into a workspace area.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {destinations.map((d) => {
              const Icon = d.icon
              return (
                <li key={d.to}>
                  <Link
                    to={d.to}
                    className="flex items-start gap-4 rounded-lg border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition hover:border-[#dadce0] hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(60,64,67,0.2),0_4px_8px_rgba(60,64,67,0.08)]"
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${d.tint}`}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-sm font-medium text-[#1a73e8]">
                        {d.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-[#5f6368]">
                        {d.desc}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-[#e8eaed] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-6 py-4 text-[12px] text-[#5f6368] lg:px-8">
          <span>Delivery Risk Agent</span>
          <Link to="/dashboard" className="text-[#1a73e8] hover:underline">
            Go to dashboard
          </Link>
        </div>
      </footer>
    </div>
  )
}

/** Flat geometric panel — Google marketing / Cloud console vibe, no AI glow. */
function GoogleStyleIllustration() {
  return (
    <div className="relative h-full w-full p-8">
      <svg
        viewBox="0 0 320 240"
        className="mx-auto h-full max-h-[240px] w-full max-w-[340px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="24"
          y="36"
          width="180"
          height="140"
          rx="8"
          fill="white"
          stroke="#dadce0"
          strokeWidth="1.5"
        />
        <rect x="40" y="56" width="72" height="10" rx="2" fill="#e8f0fe" />
        <rect x="40" y="76" width="148" height="8" rx="2" fill="#f1f3f4" />
        <rect x="40" y="92" width="120" height="8" rx="2" fill="#f1f3f4" />
        <rect x="40" y="120" width="40" height="28" rx="4" fill="#e8f0fe" />
        <rect x="88" y="120" width="40" height="28" rx="4" fill="#e6f4ea" />
        <rect x="136" y="120" width="40" height="28" rx="4" fill="#fef7e0" />
        <circle cx="248" cy="72" r="36" fill="#1a73e8" opacity="0.9" />
        <circle cx="268" cy="148" r="24" fill="#34a853" opacity="0.85" />
        <circle cx="220" cy="168" r="16" fill="#fbbc04" opacity="0.9" />
        <circle cx="292" cy="108" r="10" fill="#ea4335" opacity="0.85" />
        <path
          d="M248 72l-8 20h16l-8-20z"
          fill="white"
          opacity="0.35"
        />
      </svg>
    </div>
  )
}
