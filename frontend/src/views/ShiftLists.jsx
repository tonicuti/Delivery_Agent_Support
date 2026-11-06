import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { EmptyState, LoadState, Notice, RiskBadge, Status, Time } from "@/components/common.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { fmtPct } from "@/format.js";
import { usePoll } from "@/hooks.js";
import { cn } from "@/lib/utils.js";

const DEFAULT_CAPACITY = 5;

const defaultName = () => {
  const now = new Date();
  return `Shift ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${String(now.getHours()).padStart(2, "0")}h`;
};
// The name becomes the list's identifier: keep letters, digits and dashes only.
const toKey = (name) => name.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

function CreatePlan({ regions, onCreated }) {
  const [name, setName] = useState(defaultName);
  const [regionId, setRegionId] = useState(String(regions[0]?.region_id ?? ""));
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const key = toKey(name);
      const result = await api.post("/api/shifts", { shift_id: key, region_id: Number(regionId), capacity: Number(capacity) });
      toast.success(`Saved the plan: ${result.candidates} order${result.candidates === 1 ? "" : "s"} ranked`);
      onCreated(key);
    } catch (error) {
      toast.error(/different parameters/.test(error.message) ? "A plan with that name already exists with other settings. Choose another name." : "The plan could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4" aria-hidden="true" />Plan the shift</CardTitle>
        <CardDescription>Ranks the orders in a region by how likely they are to be late, right now. The plan is saved as it is and does not change later, even if the risk does.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-end">
          <div className="grid gap-1.5"><Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></div>
          <div className="grid gap-1.5"><Label htmlFor="plan-region">Region</Label>
            <Select value={regionId} onValueChange={setRegionId}>
              <SelectTrigger id="plan-region" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{regions.map((r) => <SelectItem key={r.region_id} value={String(r.region_id)}>{r.name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid gap-1.5"><Label htmlFor="plan-count">How many can you review?</Label>
            <Input id="plan-count" type="number" min="1" step="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} required /></div>
          <Button type="submit" disabled={busy || !regionId || !toKey(name)}>Save plan</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlanDetail({ planKey }) {
  const state = usePoll(`/api/shifts/${planKey}`);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <LoadState state={state}>
        {(plan) => (
          <>
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2"><Lock className="size-4" aria-hidden="true" />{plan.shift_id.replace(/-/g, " ")} · {plan.region}</CardTitle>
              <CardDescription>Saved <Time iso={plan.started_at_utc} />. The top {plan.review_capacity} are marked for review. The risk shown is what it was when the plan was saved.</CardDescription>
            </CardHeader>
            {plan.candidates.length === 0 ? (
              <EmptyState title="There was nothing to rank at that time">Check some orders first, then save a new plan.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-right">#</TableHead><TableHead>Order</TableHead><TableHead>Chance of being late</TableHead><TableHead>Review</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {plan.candidates.map((c) => (
                      <TableRow key={c.order_id}>
                        <TableCell className="tabular text-right">{c.rank_at_start}</TableCell>
                        <TableCell><Link to={`/orders/${c.order_id}`} className="font-semibold text-primary hover:underline">{c.external_order_id}</Link></TableCell>
                        <TableCell><div className="flex items-center gap-2"><span className="tabular w-12 font-bold">{fmtPct(c.p_late)}</span><RiskBadge band={c.risk_band} /></div></TableCell>
                        <TableCell>{c.selected_for_review ? <Status tone="info">Review this shift</Status> : <Status tone="none">If time allows</Status>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </LoadState>
    </Card>
  );
}

export default function ShiftLists() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const regions = usePoll("/api/regions");
  const plans = usePoll("/api/shifts");
  const open = (key) => navigate(`/worklist/shifts/${key}`);

  return (
    <div className="grid gap-4">
      {regions.data && <CreatePlan regions={regions.data} onCreated={(key) => { plans.reload(); open(key); }} />}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {shiftId ? <PlanDetail key={shiftId} planKey={shiftId} /> : <Notice tone="info" icon={Lock} title="Choose a saved plan">Pick one from the list to see its ranking.</Notice>}
        </div>
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4"><CardTitle>Saved plans</CardTitle></CardHeader>
          <LoadState state={plans} rows={2}>
            {(items) => items.length === 0 ? <EmptyState title="No plans saved yet" /> : (
              <ul className="divide-y">
                {items.map((s) => (
                  <li key={s.shift_id}>
                    <button type="button" onClick={() => open(s.shift_id)}
                            className={cn("flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50", s.shift_id === shiftId && "bg-accent")}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{s.shift_id.replace(/-/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">{s.region} · {s.candidates} order{s.candidates === 1 ? "" : "s"} · <Time iso={s.started_at_utc} /></span>
                      </span>
                      <span className="tabular text-xs text-muted-foreground">top {s.review_capacity}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </LoadState>
        </Card>
      </div>
    </div>
  );
}
