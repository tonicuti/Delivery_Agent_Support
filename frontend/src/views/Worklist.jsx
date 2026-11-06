import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellRing, Check, ChevronRight, Clock, Eye, ListChecks, RefreshCw, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { DecisionBadge, EmptyState, LoadState, Notice, PageHeader, Remaining, RiskBadge, SignalBadge, StaleBadge, Status, Time } from "@/components/common.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { useWords } from "@/context.jsx";
import { URGENT_HOURS, fmtAge, fmtClock, fmtPct } from "@/format.js";
import { usePoll } from "@/hooks.js";
import { cn } from "@/lib/utils.js";
import ShiftLists from "@/views/ShiftLists.jsx";

const REFRESH_MS = 15_000;
const MAX_REASONS_SHOWN = 3;

const FILTERS = {
  review: { label: "To review", hint: "Waiting for your decision", icon: Eye, tone: "bg-risk-high-bg text-risk-high-fg", test: (i) => !i.recommendation?.decision },
  unread: { label: "New alerts", hint: "Not read yet", icon: BellRing, tone: "bg-risk-med-bg text-risk-med-fg", test: (i) => i.alert && !i.alert.acknowledged_at_utc },
  urgent: { label: "Running out of time", hint: `Under ${URGENT_HOURS} hours left or overdue`, icon: Clock, tone: "bg-risk-high-bg text-risk-high-fg", test: (i) => i.hours_remaining != null && i.hours_remaining < URGENT_HOURS },
  old: { label: "Out of date", hint: "Not checked recently", icon: TimerOff, tone: "bg-info-bg text-info-fg", test: (i) => i.stale },
};

function Tile({ id, count, active, onToggle }) {
  const f = FILTERS[id];
  return (
    <button type="button" onClick={() => onToggle(id)} aria-pressed={active}
            className={cn("flex items-start gap-3 rounded-2xl bg-card p-3 text-left sm:items-center sm:p-4 shadow-[0_1px_2px_rgba(16,24,20,.06),0_2px_10px_rgba(16,24,20,.05)] ring-1 ring-foreground/5 transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring",
                          active && "ring-2 ring-primary")}>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11", f.tone)}><f.icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0">
        <span className="tabular block text-2xl font-bold leading-none">{count}</span>
        <span className="mt-1 block text-sm font-medium leading-tight">{f.label}</span>
        <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">{f.hint}</span>
      </span>
    </button>
  );
}

function AlertCell({ alert, busy, onRead }) {
  if (!alert) return <span className="text-muted-foreground">No alert</span>;
  if (alert.acknowledged_at_utc) return <Status tone="low" icon={Check}>Alert read</Status>;
  return (
    <div className="flex items-center gap-2">
      <Status tone="med" icon={BellRing}>{alert.kind === "initial" ? "New alert" : "Reminder"}</Status>
      <Button size="xs" variant="outline" disabled={busy} onClick={(e) => { e.stopPropagation(); onRead(alert.notification_id); }}>Got it</Button>
    </div>
  );
}

function LiveQueue() {
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState(null);
  const [reason, setReason] = useState(null);
  const [busyAlert, setBusyAlert] = useState(null);
  const list = usePoll("/api/worklist", { interval: REFRESH_MS, enabled: live });
  const words = useWords();
  const navigate = useNavigate();

  const items = list.data?.items ?? [];
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([id, f]) => [id, items.filter(f.test).length])), [items]);
  const reasonCounts = useMemo(() => {
    const map = new Map();
    items.forEach((i) => i.signals.forEach((s) => map.set(s.code, { label: s.label, n: (map.get(s.code)?.n ?? 0) + 1 })));
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [items]);
  const rows = items.filter((i) => (!filter || FILTERS[filter].test(i)) && (!reason || i.signals.some((s) => s.code === reason)));

  async function markRead(id) {
    setBusyAlert(id);
    try {
      await api.post(`/api/alerts/${id}/ack`);
      toast.success("Marked as read");
      list.reload();
    } catch {
      toast.error("That did not work just now. Please try again.");
    } finally {
      setBusyAlert(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Orders most likely to be late, the most urgent first.</p>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2"><Switch checked={live} onCheckedChange={setLive} aria-label="Refresh automatically" />Refresh automatically</label>
          <span className="tabular text-xs text-muted-foreground" role="status">{list.updatedAt ? `Updated ${fmtClock(list.updatedAt)}` : "Loading…"}</span>
          <Button size="sm" variant="outline" onClick={list.reload}><RefreshCw aria-hidden="true" />Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.keys(FILTERS).map((id) => <Tile key={id} id={id} count={counts[id]} active={filter === id} onToggle={(f) => setFilter(filter === f ? null : f)} />)}
      </div>

      {reasonCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by reason">
          <span className="text-xs font-medium text-muted-foreground">Reason:</span>
          {reasonCounts.map(([code, { label, n }]) => (
            <Button key={code} size="xs" variant={reason === code ? "default" : "outline"} aria-pressed={reason === code}
                    onClick={() => setReason(reason === code ? null : code)}>
              {label} <span className="tabular">{n}</span>
            </Button>
          ))}
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <LoadState state={list}>
          {() => items.length === 0 ? (
            <EmptyState icon={ListChecks} title="Nothing needs attention right now">
              Orders show up here when they are likely to be late. Open an order and press “Check now”, or turn on automatic checks from the menu at the top.
              <div className="mt-3"><Button asChild><Link to="/orders">See all orders</Link></Button></div>
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState title="No order matches these filters">
              <Button variant="outline" onClick={() => { setFilter(null); setReason(null); }}>Show everything</Button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10 text-right">#</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Chance of being late</TableHead>
                    <TableHead>Delivery promise</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead>Suggested action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last checked</TableHead>
                    <TableHead className="w-8"><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item, index) => {
                    const rec = item.recommendation;
                    return (
                      <TableRow key={item.order_id} className="cursor-pointer" onClick={() => navigate(`/orders/${item.order_id}`)}>
                        <TableCell className="tabular text-right text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Link to={`/orders/${item.order_id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-primary hover:underline">{item.external_order_id}</Link>
                          <p className="text-xs text-muted-foreground">{item.region}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="tabular w-12 text-sm font-bold">{fmtPct(item.p_late)}</span>
                            <RiskBadge band={item.risk_band} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Remaining hours={item.hours_remaining} className="block" />
                          <Time iso={item.promised_to_utc} className="text-xs text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-64 flex-wrap gap-1">
                            {item.signals.slice(0, MAX_REASONS_SHOWN).map((s) => <SignalBadge key={s.code} signal={s} />)}
                            {item.signals.length === 0 && <span className="text-xs text-muted-foreground">Nothing specific found</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 text-sm">
                          {rec?.validation_status === "valid"
                            ? <span className="font-medium">{words.action(rec.action_id)}</span>
                            : <span className="text-xs text-muted-foreground">{rec ? "No suggestion yet" : "Not checked yet"}</span>}
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-1.5">
                            <DecisionBadge decision={rec?.decision} />
                            <AlertCell alert={item.alert} busy={busyAlert === item.alert?.notification_id} onRead={markRead} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground">{fmtAge(item.age_minutes)}</p>
                          {item.stale && <StaleBadge minutes={item.age_minutes} />}
                        </TableCell>
                        <TableCell><ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </LoadState>
      </Card>
      {list.error && list.data && <Notice tone="warn" title="Showing what was loaded last">We could not refresh just now. We will keep trying.</Notice>}
    </div>
  );
}

export default function Worklist({ tab = "live" }) {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Worklist" description="What needs a decision now, ranked by how likely each order is to miss its promised delivery time." />
      <Tabs value={tab} onValueChange={(value) => navigate(value === "live" ? "/worklist" : "/worklist/shifts")} className="gap-4">
        <TabsList>
          <TabsTrigger value="live">Right now</TabsTrigger>
          <TabsTrigger value="shifts">Shift plan</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "live" ? <LiveQueue /> : <ShiftLists />}
    </>
  );
}
