import { BellRing, ChartColumn, Flag, UserCheck } from "lucide-react";
import { LoadState, PageHeader, Status } from "@/components/common.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { useMeta } from "@/context.jsx";
import { fmtDuration, fmtPct } from "@/format.js";
import { usePoll } from "@/hooks.js";

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-accent-foreground"><Icon className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0">
          <span className="tabular block text-2xl font-bold leading-none">{value}</span>
          <span className="mt-1 block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </CardContent>
    </Card>
  );
}

/** A stacked bar with a written legend, so the meaning never depends on colour alone. */
function Split({ segments, empty }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (!total) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="grid gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {segments.filter((s) => s.value).map((s) => <div key={s.label} className={s.cls} style={{ width: `${(s.value / total) * 100}%` }} />)}
      </div>
      <ul className="grid gap-x-10 gap-y-1 text-sm sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2"><span className={`size-2.5 rounded-sm ${s.cls}`} aria-hidden="true" />{s.label}<span className="tabular ml-auto">{s.value}</span></li>
        ))}
      </ul>
    </div>
  );
}

function Scorecard({ k }) {
  const decided = k.decisions.approved + k.decisions.edited + k.decisions.dismissed;
  const useful = decided ? (k.decisions.approved + k.decisions.edited) / decided : null;
  const o = k.outcomes;
  const rows = [
    ["Late orders caught in time", "Of the orders you reviewed, how many really were late", o.precision_at_k == null ? null : `${fmtPct(o.precision_at_k)} of ${o.reviewed_with_outcome} reviewed`],
    ["Alerts are useful", "Share of decisions where the suggestion was accepted or changed", useful == null ? "No decisions yet" : `${fmtPct(useful)} of ${decided}`],
    ["Faster reaction to problems", "Typical time before an alert is read", k.alerts.median_minutes_to_acknowledge == null ? "No alerts read yet" : fmtDuration(k.alerts.median_minutes_to_acknowledge)],
    ["The worklist is used every day", "Alerts that someone has decided on", `${decided} of ${k.alerts.sent}`],
  ];
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4"><CardTitle>How we are doing</CardTitle><CardDescription>What the pilot is meant to achieve, and what we can already measure.</CardDescription></CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/50"><TableHead>Goal</TableHead><TableHead>How we measure it</TableHead><TableHead>So far</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(([goal, how, value]) => (
            <TableRow key={goal}><TableCell className="font-medium">{goal}</TableCell><TableCell className="text-muted-foreground">{how}</TableCell>
              <TableCell>{value ? <span className="tabular font-semibold">{value}</span> : <Status tone="none">Not enough delivered orders yet</Status>}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default function Insights() {
  const state = usePoll("/api/kpis", { interval: 30_000 });
  const { dismiss_reasons: reasonNames } = useMeta();
  return (
    <>
      <PageHeader title="Insights" description="How the team is doing: what was flagged, what people decided, and how alerts are being picked up." />
      <LoadState state={state} rows={5}>
        {(k) => {
          const decided = k.decisions.approved + k.decisions.edited + k.decisions.dismissed;
          const suggestions = k.recommendations.valid + k.recommendations.unavailable;
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat icon={Flag} label="Orders flagged" value={k.episodes_opened} hint={`${k.active_high_risk} still open`} />
                <Stat icon={BellRing} label="Alerts read" value={`${k.alerts.acknowledged} of ${k.alerts.sent}`} hint={k.alerts.median_minutes_to_acknowledge == null ? "None read yet" : `Usually read within ${fmtDuration(k.alerts.median_minutes_to_acknowledge)}`} />
                <Stat icon={UserCheck} label="Decisions made" value={decided} hint={`${k.decisions.approved} accepted · ${k.decisions.edited} changed · ${k.decisions.dismissed} dismissed`} />
                <Stat icon={ChartColumn} label="Suggestions given" value={`${k.recommendations.valid} of ${suggestions}`} hint="Alerts that came with a suggested action" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Orders by risk right now</CardTitle></CardHeader><CardContent>
                  <Split empty="No orders yet" segments={[
                    { label: "High risk", value: k.bands.High, cls: "bg-risk-high" }, { label: "Medium risk", value: k.bands.Medium, cls: "bg-risk-med" },
                    { label: "Low risk", value: k.bands.Low, cls: "bg-risk-low" }, { label: "Not checked yet", value: k.bands.Unscored, cls: "bg-border" }]} /></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">What people decided</CardTitle></CardHeader><CardContent>
                  <Split empty="No decisions yet" segments={[
                    { label: "Accepted the suggestion", value: k.decisions.approved, cls: "bg-risk-low" }, { label: "Chose another action", value: k.decisions.edited, cls: "bg-info" },
                    { label: "Dismissed", value: k.decisions.dismissed, cls: "bg-border" }]} /></CardContent></Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm">Why alerts were dismissed</CardTitle><CardDescription>Helps us send fewer alerts that are not useful.</CardDescription></CardHeader><CardContent>
                  <Split empty="Nothing has been dismissed yet" segments={Object.entries(k.dismiss_reasons).map(([id, value], i) => ({ label: reasonNames[id] ?? id, value, cls: ["bg-risk-high", "bg-risk-med", "bg-info", "bg-primary", "bg-border"][i % 5] }))} /></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm">What actually happened</CardTitle><CardDescription>Compares our warnings with real deliveries.</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm">
                  {k.outcomes.known_orders === 0
                    ? <p className="text-muted-foreground">No delivered orders have been recorded yet, so we cannot say how many warnings were right. We do not guess; this fills in once delivered orders are recorded.</p>
                    : <><p>On-time deliveries: <span className="tabular font-bold">{fmtPct(k.outcomes.on_time_rate)}</span> of {k.outcomes.known_orders} delivered orders</p>
                      <p>Flagged orders that really were late: <span className="tabular font-bold">{k.outcomes.precision_at_k == null ? "not known yet" : fmtPct(k.outcomes.precision_at_k)}</span></p></>}
                </CardContent></Card>
              </div>
              <Scorecard k={k} />
            </>
          );
        }}
      </LoadState>
    </>
  );
}
