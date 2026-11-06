import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown, Package, Search } from "lucide-react";
import { EligibilityBadge, EmptyState, LoadState, PageHeader, Remaining, RiskBadge, StaleBadge, Time } from "@/components/common.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.jsx";
import { customerWord, fmtAge, fmtPct } from "@/format.js";
import { usePoll } from "@/hooks.js";

const BANDS = [["High", "High risk"], ["Medium", "Medium"], ["Low", "Low"], ["Unscored", "Not checked"]];
const SORTS = {
  risk: (a, b) => (b.p_late ?? -1) - (a.p_late ?? -1),
  promise: (a, b) => (a.hours_remaining ?? Infinity) - (b.hours_remaining ?? Infinity),
  order: (a, b) => a.order_id - b.order_id,
};
const SORT_NAMES = { risk: "chance of being late", promise: "delivery promise", order: "order" };

function SortButton({ id, sort, setSort, children }) {
  return (
    <button type="button" onClick={() => setSort(id)} aria-label={`Sort by ${SORT_NAMES[id]}`} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
      {children}<ArrowUpDown className={`size-3 ${sort === id ? "text-primary" : "opacity-40"}`} aria-hidden="true" />
    </button>
  );
}

export default function Orders() {
  const state = usePoll("/api/orders", { interval: 30_000 });
  const [params, setParams] = useSearchParams();
  const [band, setBand] = useState("");
  const [sort, setSort] = useState("risk");
  const query = params.get("q") ?? "";
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (state.data?.items ?? [])
      .filter((o) => !band || (o.risk_band ?? "Unscored") === band)
      .filter((o) => !needle || `${o.external_order_id} ${o.region} ${o.team} ${o.order_id}`.toLowerCase().includes(needle))
      .sort(SORTS[sort]);
  }, [state.data, query, band, sort]);

  return (
    <>
      <PageHeader title="Orders" description="All open orders and how likely each one is to be late. Open one to see the details and decide what to do." />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})}
                   placeholder="Search by order, region or team" aria-label="Search orders" className="pl-9" />
          </div>
          <ToggleGroup type="single" variant="outline" size="sm" value={band} onValueChange={(v) => setBand(v ?? "")} aria-label="Filter by risk" className="max-w-full overflow-x-auto">
            {BANDS.map(([id, name]) => <ToggleGroupItem key={id} value={id} className="px-2.5 text-xs sm:px-3 sm:text-sm">{name}</ToggleGroupItem>)}
          </ToggleGroup>
          <span className="ml-auto text-xs text-muted-foreground">Showing {rows.length} of {state.data?.items.length ?? 0}</span>
        </div>
        <LoadState state={state}>
          {() => rows.length === 0 ? (
            <EmptyState icon={Package} title="No orders match">
              <Button variant="outline" onClick={() => { setBand(""); setParams({}); }}>Show all orders</Button>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead><SortButton id="order" sort={sort} setSort={setSort}>Order</SortButton></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><SortButton id="risk" sort={sort} setSort={setSort}>Chance of being late</SortButton></TableHead>
                    <TableHead><SortButton id="promise" sort={sort} setSort={setSort}>Delivery promise</SortButton></TableHead>
                    <TableHead>Last checked</TableHead>
                    <TableHead>Next check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow key={o.order_id} className="cursor-pointer" onClick={() => navigate(`/orders/${o.order_id}`)}>
                      <TableCell>
                        <Link to={`/orders/${o.order_id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-primary hover:underline">{o.external_order_id}</Link>
                        <p className="text-xs text-muted-foreground">{o.region} · {customerWord(o.customer_type)}</p>
                      </TableCell>
                      <TableCell><EligibilityBadge reason={o.eligibility} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="tabular w-12 text-sm font-bold">{fmtPct(o.p_late)}</span>
                          <RiskBadge band={o.risk_band} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {o.promised_to_utc ? <><Remaining hours={o.hours_remaining} className="block" /><Time iso={o.promised_to_utc} className="text-xs text-muted-foreground" /></> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">{o.scored_at_utc ? fmtAge(o.age_minutes) : "Not yet"}</p>
                        {o.stale && <StaleBadge minutes={o.age_minutes} />}
                      </TableCell>
                      <TableCell><Time iso={o.next_due_at_utc} className="text-sm" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </LoadState>
      </Card>
    </>
  );
}
