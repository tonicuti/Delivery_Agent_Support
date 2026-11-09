import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export type PageHeroTone =
  | 'home'
  | 'orders'
  | 'history'
  | 'chat'
  | 'performance'

type Props = {
  title: string
  description: string
  tone: PageHeroTone
  actions?: ReactNode
  className?: string
}

const TONE_BG: Record<PageHeroTone, string> = {
  home: 'bg-[linear-gradient(135deg,#eef3ff_0%,#ffffff_55%,#eef8f1_100%)]',
  orders: 'bg-[linear-gradient(135deg,#e8f0fe_0%,#ffffff_58%,#f8fafc_100%)]',
  history: 'bg-[linear-gradient(135deg,#e6f4ea_0%,#ffffff_58%,#f8fafc_100%)]',
  chat: 'bg-[linear-gradient(135deg,#fef7e0_0%,#ffffff_58%,#f8fafc_100%)]',
  performance:
    'bg-[linear-gradient(135deg,#f3e8fd_0%,#ffffff_58%,#f8fafc_100%)]',
}

/** Compact page header with a quiet Google-style illustration. */
export function PageHero({
  title,
  description,
  tone,
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-sm border border-border',
        TONE_BG[tone],
        className,
      )}
    >
      <div className="grid items-center gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>
          ) : null}
        </div>
        <div
          className="mx-auto hidden h-[4.75rem] w-[9.5rem] sm:block"
          aria-hidden
        >
          <HeroArt tone={tone} />
        </div>
      </div>
    </div>
  )
}

function HeroArt({ tone }: { tone: PageHeroTone }) {
  switch (tone) {
    case 'home':
      return <ArtHome />
    case 'orders':
      return <ArtOrders />
    case 'history':
      return <ArtHistory />
    case 'chat':
      return <ArtChat />
    case 'performance':
      return <ArtPerformance />
  }
}

function ArtHome() {
  return (
    <svg viewBox="0 0 152 76" className="h-full w-full" fill="none">
      <rect x="8" y="14" width="78" height="52" rx="6" fill="#fff" stroke="#dadce0" />
      <rect x="18" y="24" width="36" height="6" rx="2" fill="#e8f0fe" />
      <rect x="18" y="36" width="58" height="4" rx="1.5" fill="#e8eaed" />
      <rect x="18" y="44" width="48" height="4" rx="1.5" fill="#e8eaed" />
      <rect x="18" y="54" width="20" height="6" rx="2" fill="#1a73e8" opacity="0.85" />
      <circle cx="118" cy="28" r="16" fill="#1a73e8" opacity="0.88" />
      <circle cx="134" cy="52" r="11" fill="#34a853" opacity="0.85" />
      <circle cx="104" cy="54" r="8" fill="#fbbc04" opacity="0.9" />
    </svg>
  )
}

function ArtOrders() {
  return (
    <svg viewBox="0 0 152 76" className="h-full w-full" fill="none">
      <rect x="10" y="12" width="90" height="54" rx="6" fill="#fff" stroke="#dadce0" />
      <rect x="20" y="22" width="70" height="8" rx="2" fill="#e8f0fe" />
      <rect x="20" y="36" width="70" height="8" rx="2" fill="#fce8e6" />
      <rect x="20" y="50" width="70" height="8" rx="2" fill="#fef7e0" />
      <circle cx="28" cy="26" r="2.5" fill="#1a73e8" />
      <circle cx="28" cy="40" r="2.5" fill="#ea4335" />
      <circle cx="28" cy="54" r="2.5" fill="#fbbc04" />
      <path
        d="M116 20h22v36H116V20Z"
        fill="#e8f0fe"
        stroke="#1a73e8"
        strokeWidth="1.5"
        opacity="0.9"
      />
      <path d="M122 30h10M122 38h10M122 46h6" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ArtHistory() {
  return (
    <svg viewBox="0 0 152 76" className="h-full w-full" fill="none">
      <circle cx="48" cy="38" r="24" fill="#fff" stroke="#dadce0" strokeWidth="2" />
      <circle cx="48" cy="38" r="18" fill="#e6f4ea" />
      <path
        d="M48 26v12l8 5"
        stroke="#137333"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="86" y="18" width="52" height="12" rx="3" fill="#e6f4ea" />
      <rect x="86" y="36" width="44" height="12" rx="3" fill="#e8eaed" />
      <rect x="86" y="54" width="36" height="12" rx="3" fill="#e8f0fe" />
    </svg>
  )
}

function ArtChat() {
  return (
    <svg viewBox="0 0 152 76" className="h-full w-full" fill="none">
      <rect x="12" y="14" width="70" height="36" rx="10" fill="#fff" stroke="#dadce0" />
      <rect x="22" y="24" width="40" height="5" rx="2" fill="#e8eaed" />
      <rect x="22" y="34" width="28" height="5" rx="2" fill="#e8eaed" />
      <path d="M28 50l8-6h-8v6Z" fill="#fff" stroke="#dadce0" />
      <rect x="70" y="30" width="66" height="32" rx="10" fill="#fef7e0" stroke="#f9ab00" />
      <rect x="82" y="40" width="42" height="5" rx="2" fill="#f9ab00" opacity="0.45" />
      <rect x="82" y="50" width="30" height="5" rx="2" fill="#f9ab00" opacity="0.35" />
      <circle cx="128" cy="22" r="8" fill="#1a73e8" opacity="0.85" />
    </svg>
  )
}

function ArtPerformance() {
  return (
    <svg viewBox="0 0 152 76" className="h-full w-full" fill="none">
      <rect x="10" y="12" width="100" height="54" rx="6" fill="#fff" stroke="#dadce0" />
      <rect x="22" y="46" width="12" height="12" rx="2" fill="#e8f0fe" />
      <rect x="40" y="36" width="12" height="22" rx="2" fill="#f3e8fd" />
      <rect x="58" y="28" width="12" height="30" rx="2" fill="#1a73e8" opacity="0.85" />
      <rect x="76" y="40" width="12" height="18" rx="2" fill="#34a853" opacity="0.8" />
      <path
        d="M24 24h20M24 30h14"
        stroke="#dadce0"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="130" cy="28" r="14" fill="#f3e8fd" />
      <path
        d="M124 28h12M130 22v12"
        stroke="#7627bb"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
