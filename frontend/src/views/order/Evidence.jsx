import { Activity, Bell, Boxes, CalendarClock, FileWarning, ShoppingBag, Truck, UserCheck, Warehouse } from "lucide-react";
import { EmptyState, RiskBadge, Status, Time } from "@/components/common.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useMeta, useWords } from "@/context.jsx";
import { bandOf, fmtPct, fmtTime, prettyText } from "@/format.js";

const KIND_ICON = {
  order: ShoppingBag, promise: CalendarClock, stock: Boxes, warehouse: Warehouse, transport: Truck,
  score: Activity, alert: Bell, decision: UserCheck, claim: FileWarning,
};

export function Timeline({ events }) {
  if (!events.length) return <EmptyState title="Nothing has happened yet" />;
  return (
    <ol className="relative grid max-h-[32rem] gap-0 overflow-y-auto pr-2">
      {events.map((e, i) => {
        const Icon = KIND_ICON[e.kind] ?? Activity;
        return (
          <li key={`${e.at_utc}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < events.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />}
            <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold">{e.title}</p>
              {e.detail && <p className="break-words text-xs text-muted-foreground">{prettyText(e.detail)}</p>}
              <Time iso={e.at_utc} className="text-xs text-muted-foreground" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const W = 360, H = 140, PAD = { l: 34, r: 12, t: 12, b: 24 };

/** How the chance of being late has moved over time, with the three risk zones shaded. */
export function RiskHistory({ history }) {
  if (!history.length) return <EmptyState title="Not checked yet">Each check is kept, so you can see how the risk moves.</EmptyState>;
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (history.length === 1 ? pw / 2 : (i / (history.length - 1)) * pw);
  const y = (p) => PAD.t + (1 - p) * ph;
  return (
    <div className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Chance of being late over ${history.length} check${history.length === 1 ? "" : "s"}; latest ${fmtPct(history.at(-1).p_late)}`}>
        <rect x={PAD.l} y={y(1)} width={pw} height={y(0.5) - y(1)} className="fill-risk-high-bg" />
        <rect x={PAD.l} y={y(0.5)} width={pw} height={y(0.2) - y(0.5)} className="fill-risk-med-bg" />
        <rect x={PAD.l} y={y(0.2)} width={pw} height={y(0) - y(0.2)} className="fill-risk-low-bg" />
        {[0, 0.5, 1].map((t) => <text key={t} x={PAD.l - 5} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{t * 100}%</text>)}
        {history.length > 1 && <polyline fill="none" className="stroke-primary" strokeWidth="2" points={history.map((h, i) => `${x(i)},${y(h.p_late)}`).join(" ")} />}
        {history.map((h, i) => (
          <circle key={h.score_id} cx={x(i)} cy={y(h.p_late)} r="4" className="fill-primary stroke-card" strokeWidth="2"><title>{`${fmtPct(h.p_late)} at ${fmtTime(h.as_of_utc)}`}</title></circle>
        ))}
      </svg>
      <details className="text-sm"><summary className="cursor-pointer font-medium">See the numbers</summary>
        <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Chance of being late</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader>
          <TableBody>{[...history].reverse().map((h) => (
            <TableRow key={h.score_id}><TableCell><Time iso={h.as_of_utc} /></TableCell><TableCell className="tabular">{fmtPct(h.p_late)}</TableCell><TableCell><RiskBadge band={bandOf(h.p_late)} /></TableCell></TableRow>
          ))}</TableBody></Table></details>
    </div>
  );
}

const STOCK_TONE = { in_stock: "low", short: "med", backorder: "high" };

export function Items({ lines }) {
  const words = useWords();
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader><TableRow className="bg-muted/50"><TableHead>Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Stock</TableHead></TableRow></TableHeader>
        <TableBody>{lines.map((l) => (
          <TableRow key={l.line_no}><TableCell>{l.product}</TableCell>
            <TableCell className="tabular text-right">{l.ordered_qty} {l.unit}</TableCell>
            <TableCell>{l.stock_status ? <Status tone={STOCK_TONE[l.stock_status] ?? "none"}>{words.stock(l.stock_status)}</Status> : <span className="text-muted-foreground">Unknown</span>}</TableCell></TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

export function DecisionHistory({ decisions }) {
  const words = useWords();
  const { dismiss_reasons: reasons } = useMeta();
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Team decisions</CardTitle><CardDescription>Everything decided about this order, newest first.</CardDescription></CardHeader>
      <CardContent>
        {decisions.length === 0 ? <p className="text-sm text-muted-foreground">Nobody has decided anything yet.</p> : (
          <ul className="grid gap-3">
            {decisions.map((d) => (
              <li key={d.feedback_id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Status tone={d.decision === "approved" ? "low" : d.decision === "edited" ? "info" : "none"}>{words.decision(d.decision)}</Status>
                  <span className="text-muted-foreground">{words.role(d.role)} · <Time iso={d.recorded_at_utc} /></span>
                </div>
                {d.chosen_action_id && <p className="mt-0.5">{words.action(d.chosen_action_id)}</p>}
                {d.reason && <p className="mt-0.5 text-muted-foreground">Reason: {reasons[d.reason] ?? d.reason}</p>}
                {d.text && <p className="mt-0.5 text-muted-foreground">“{d.text}”</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
