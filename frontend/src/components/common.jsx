import { BadgeCheck, CircleCheck, CircleMinus, Clock, Diamond, Eye, Pencil, TriangleAlert, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Skeleton } from "@/components/ui/skeleton.jsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { cn } from "@/lib/utils.js";
import { fmtAge, fmtRemaining, fmtTime, remainingTone, stoppedWord } from "@/format.js";

const TONES = {
  high: "border-risk-high bg-risk-high-bg text-risk-high-fg",
  med: "border-risk-med bg-risk-med-bg text-risk-med-fg",
  low: "border-risk-low bg-risk-low-bg text-risk-low-fg",
  info: "border-info bg-info-bg text-info-fg",
  none: "border-border bg-muted text-muted-foreground",
};

/** Status chip: colour, icon and words together, never colour alone. */
export function Status({ tone = "none", icon: Icon, children, title, className }) {
  const chip = (
    <Badge variant="outline" className={cn("h-6 gap-1 px-2.5 text-xs font-semibold", TONES[tone], className)}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </Badge>
  );
  if (!title) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span className="inline-flex">{chip}</span></TooltipTrigger>
      <TooltipContent className="max-w-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

const BAND = {
  High: { tone: "high", icon: TriangleAlert, text: "High risk" },
  Medium: { tone: "med", icon: Diamond, text: "Medium risk" },
  Low: { tone: "low", icon: CircleCheck, text: "Low risk" },
};

export function RiskBadge({ band }) {
  if (!band) return <Status tone="none" icon={CircleMinus}>Not checked yet</Status>;
  const b = BAND[band];
  return <Status tone={b.tone} icon={b.icon}>{b.text}</Status>;
}

export function DecisionBadge({ decision }) {
  const kind = decision?.decision;
  if (kind === "approved") return <Status tone="low" icon={BadgeCheck}>Accepted</Status>;
  if (kind === "edited") return <Status tone="info" icon={Pencil}>Changed</Status>;
  if (kind === "dismissed") return <Status tone="none" icon={XCircle}>Dismissed</Status>;
  return <Status tone="med" icon={Eye}>Needs review</Status>;
}

export function StaleBadge({ minutes }) {
  return (
    <Status tone="med" icon={Clock} title={`Last checked ${fmtAge(minutes).toLowerCase()}. Check again before you act on it.`}>
      Out of date
    </Status>
  );
}

export function EligibilityBadge({ reason }) {
  if (reason === "eligible") return <Status tone="low" icon={CircleCheck}>Being watched</Status>;
  return <Status tone="none" icon={CircleMinus} title="We have stopped watching this order for lateness.">{stoppedWord(reason)}</Status>;
}

export function SignalBadge({ signal }) {
  return <Status tone="none" className="font-medium" title={signal.detail}>{signal.label}</Status>;
}

const REMAINING_CLASS = {
  overdue: "font-semibold text-risk-high-fg",
  urgent: "font-semibold text-risk-med-fg",
  ok: "text-foreground",
  none: "text-muted-foreground",
};

export function Remaining({ hours, className }) {
  return <span className={cn("tabular text-sm", REMAINING_CLASS[remainingTone(hours)], className)}>{fmtRemaining(hours)}</span>;
}

export function Time({ iso, className }) {
  return <time dateTime={iso || undefined} className={cn("tabular whitespace-nowrap", className)}>{fmtTime(iso)}</time>;
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      {Icon && <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Icon className="size-6" aria-hidden="true" /></span>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "default", icon: Icon = TriangleAlert, title, children, className }) {
  return (
    <Alert variant={tone === "bad" ? "destructive" : "default"} className={cn(tone === "warn" && TONES.med, tone === "info" && TONES.info, className)}>
      <Icon aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription>{children}</AlertDescription>}
    </Alert>
  );
}

export function LoadState({ state, rows = 4, children }) {
  if (state.loading && !state.data) {
    return (
      <div className="grid gap-2 p-4" aria-busy="true" role="status">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (state.error && !state.data) {
    const { status, message } = state.error;
    const text = status === 404 ? "We could not find that." : status === 0 ? message : "Something went wrong on our side. Please try again in a moment.";
    return <div className="p-4"><Notice tone="bad" title="This did not load">{text}</Notice></div>;
  }
  return children(state.data);
}
