import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { ClipboardList, Database, History, LineChart } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Orders needing attention', icon: ClipboardList, end: true },
  { to: '/history', label: 'History', icon: History },
  { to: '/data-health', label: 'Data health', icon: Database },
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
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-sm focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      <header className="border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <div className="mr-2 text-sm font-semibold tracking-tight">
            Delivery Risk Agent
          </div>

          <Badge variant="secondary">Demo data</Badge>
          <Badge variant="outline">Demo</Badge>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Country
            <select
              className="h-8 cursor-pointer rounded-sm border border-border bg-background px-2 text-sm text-foreground"
              defaultValue="SE"
              aria-label="Country scope"
            >
              <option value="SE">Sweden (SE)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Warehouse
            <select
              className="h-8 cursor-pointer rounded-sm border border-border bg-background px-2 text-sm text-foreground"
              defaultValue="SE-STO-01"
              aria-label="Warehouse scope"
            >
              <option value="SE-STO-01">SE-STO-01</option>
            </select>
          </label>

          <div className="min-w-[12rem] flex-1">
            <Input
              type="search"
              placeholder="Search order ID"
              aria-label="Search order ID"
              className="h-8"
            />
          </div>

          <Badge variant="outline" title="Mock freshness for F0">
            Updated 3 min ago
          </Badge>

          <span className="text-xs text-muted-foreground">dispatcher@demo</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Primary"
          className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card p-2"
        >
          {nav.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink key={to} to={to} className={navClass} {...rest}>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <main id="main-content" className="min-w-0 flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
