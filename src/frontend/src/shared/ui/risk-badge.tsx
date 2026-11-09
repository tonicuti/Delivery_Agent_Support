import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { RiskBand } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

const config: Record<
  RiskBand,
  { label: RiskBand; className: string; Icon: typeof ShieldCheck }
> = {
  High: {
    label: 'High',
    className: 'border-risk-high/30 bg-risk-high/10 text-risk-high',
    Icon: ShieldAlert,
  },
  Medium: {
    label: 'Medium',
    className: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
    Icon: AlertTriangle,
  },
  Low: {
    label: 'Low',
    className: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
    Icon: ShieldCheck,
  },
}

/** Text + icon — never colour alone. Labels match backend risk_band(). */
export function RiskBadge({ risk }: { risk: RiskBand }) {
  const { label, className, Icon } = config[risk]
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{label}</span>
    </Badge>
  )
}
