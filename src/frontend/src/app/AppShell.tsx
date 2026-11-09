import { UrgentAlerts } from '@/features/alerts/UrgentAlerts'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import {
  ClipboardList,
  History,
  Home,
  LineChart,
  MessageSquare,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

const nav = [
  { to: '/dashboard', label: 'Orders needing attention', icon: ClipboardList },
  { to: '/history', label: 'History', icon: History },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/performance', label: 'Performance', icon: LineChart },
] as const

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-150',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  ].join(' ')
}

type Props = { children: ReactNode }

export function AppShell({ children }: Props) {
  const navigate = useNavigate()
  const [orderQuery, setOrderQuery] = useState('')

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = orderQuery.trim()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    navigate({
      pathname: '/dashboard',
      search: params.toString() ? `?${params}` : '',
    })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      <UrgentAlerts />

      <header className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <Link
            to="/"
            className="mr-2 text-sm font-semibold tracking-tight hover:text-primary"
            title="Home"
          >
            Delivery Risk Agent
          </Link>

          <Badge
            variant="secondary"
            title="Demo data — not connected to live systems"
          >
            Demo
          </Badge>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
            title="This demo covers one location"
          >
            <span>
              <span className="text-foreground">
                Sweden · Stockholm warehouse
              </span>
            </span>
          </div>

          <form onSubmit={onSearch} className="min-w-[12rem] flex-1">
            <Input
              type="search"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="Search order number"
              aria-label="Search order number"
              className="h-8"
            />
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Primary"
          className="flex w-56 shrink-0 flex-col border-r border-border bg-card"
        >
          <div className="flex flex-1 flex-col gap-1 p-2">
            <NavLink to="/" end className={navClass}>
              <Home className="size-4 shrink-0" aria-hidden />
              <span>Home & guide</span>
            </NavLink>
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navClass}>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
          <div className="border-t border-border p-2">
            <Link
              to="/demo-controls"
              className="flex flex-col gap-0.5 rounded-sm px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Turn on edge cases while presenting (presenter only)"
            >
              <span className="font-medium">Demo controls</span>
              <span className="text-[10px] leading-snug opacity-80">
                Presenter switches
              </span>
            </Link>
          </div>
        </nav>

        <main id="main-content" className="min-w-0 flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
