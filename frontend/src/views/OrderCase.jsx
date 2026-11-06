import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, RefreshCw } from "lucide-react";
import Gauge from "@/components/Gauge.jsx";
import Pipeline from "@/components/Pipeline.jsx";
import { EligibilityBadge, LoadState, Notice, Remaining, RiskBadge, StaleBadge, Status, Time } from "@/components/common.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import { useWords } from "@/context.jsx";
import { customerWord, fmtAge, fmtClock, fmtDuration, hoursBetween } from "@/format.js";
import { usePoll } from "@/hooks.js";
import AlertCard from "@/views/order/AlertCard.jsx";
import CheckNow from "@/views/order/CheckNow.jsx";
import Claims from "@/views/order/Claims.jsx";
import CustomerDraft from "@/views/order/CustomerDraft.jsx";
import { DecisionHistory, Items, RiskHistory, Timeline } from "@/views/order/Evidence.jsx";

function RiskCard({ order }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Chance of being late</CardTitle>
        <CardDescription>{order.scored_at_utc ? <>Checked <Time iso={order.scored_at_utc} /> · {fmtAge(order.age_minutes).toLowerCase()}</> : "Not checked yet"}</CardDescription></CardHeader>
      <CardContent className="grid justify-items-center"><Gauge p={order.p_late} /></CardContent>
    </Card>
  );
}

function PromiseCard({ order }) {
  const promise = order.promises.at(-1);
  const used = promise ? Math.min(Math.max(hoursBetween(order.now, promise.window_start_utc) / hoursBetween(promise.window_end_utc, promise.window_start_utc), 0), 1) : null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Delivery promise</CardTitle>
        <CardDescription>{promise ? `Promised between ${fmtClock(promise.window_start_utc)} and ${fmtClock(promise.window_end_utc)}` : "No delivery time promised yet"}</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        <Remaining hours={order.hours_remaining} className="text-3xl font-bold" />
        {promise && (
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(used * 100)} percent of the promised time has passed`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${used * 100}%` }} />
          </div>
        )}
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Next check</dt><dd><Time iso={order.next_due_at_utc} /></dd>
          <dt className="text-muted-foreground">Order placed</dt><dd><Time iso={order.created_at_utc} /></dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function ShipmentsCard({ order }) {
  const words = useWords();
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Where it is</CardTitle><CardDescription>From the warehouse to the customer</CardDescription></CardHeader>
      <CardContent className="grid gap-5">
        {order.shipments.length === 0 && <p className="text-sm text-muted-foreground">No shipment has been arranged yet.</p>}
        {order.shipments.map((s) => {
          const late = s.current_eta_at_utc && s.planned_arrival_at_utc ? Math.round((new Date(s.current_eta_at_utc) - new Date(s.planned_arrival_at_utc)) / 60000) : 0;
          return (
            <div key={s.shipment_id} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><span className="font-semibold">Shipment {s.shipment_id}</span> <span className="text-muted-foreground">· {s.warehouse} · {s.carrier}</span></span>
                {late > 0 && <Status tone="med">Running {fmtDuration(late)} late</Status>}
              </div>
              {s.stage_index >= 0 ? <Pipeline stageIndex={s.stage_index} /> : <p className="text-xs text-muted-foreground">Nothing recorded at the warehouse yet</p>}
              <p className="text-xs text-muted-foreground">Expected to arrive <Time iso={s.current_eta_at_utc ?? s.planned_arrival_at_utc} />{s.stage ? ` · ${words.stage(s.stage).toLowerCase()}` : ""}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function OrderCase() {
  const { orderId } = useParams();
  const state = usePoll(`/api/orders/${orderId}`);
  return (
    <>
      <Link to="/orders" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />All orders</Link>
      <LoadState state={state} rows={6}>
        {(order) => (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{order.external_order_id}</h1>
                  <RiskBadge band={order.risk_band} /><EligibilityBadge reason={order.eligibility} />
                  {order.stale && <StaleBadge minutes={order.age_minutes} />}
                </div>
                <p className="text-sm text-muted-foreground">{order.region} · {order.team} · {customerWord(order.customer_type)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CheckNow order={order} onDone={state.reload} />
                <Button variant="outline" asChild><Link to={`/assistant?order=${order.order_id}&ref=${encodeURIComponent(order.external_order_id)}`}><MessageSquare aria-hidden="true" />Ask the assistant</Link></Button>
                <Button variant="outline" size="icon" onClick={state.reload} aria-label="Refresh this page"><RefreshCw aria-hidden="true" /></Button>
              </div>
            </div>
            {order.cancelled_at_utc && <Notice tone="warn" title="This order was cancelled">We stopped watching it for lateness.</Notice>}
            {order.stale && <Notice tone="warn" title="This information is out of date">It was last checked {fmtAge(order.age_minutes).toLowerCase()}. Press “Check now” before you act on it.</Notice>}

            <div className="grid gap-4 lg:grid-cols-3">
              <RiskCard order={order} /><PromiseCard order={order} /><ShipmentsCard order={order} />
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <AlertCard order={order} onChange={state.reload} />
              <div className="grid gap-4"><CustomerDraft order={order} /><DecisionHistory decisions={order.decisions} /></div>
            </div>

            <Tabs defaultValue="activity" className="gap-4">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="details">Order details</TabsTrigger>
                <TabsTrigger value="claims">Claims and replacements</TabsTrigger>
              </TabsList>
              <Card><CardContent>
                <TabsContent value="activity"><Timeline events={order.timeline} /></TabsContent>
                <TabsContent value="details">
                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="grid content-start gap-2"><h2 className="text-sm font-semibold">Items and stock</h2><Items lines={order.lines} /></div>
                    <div className="grid content-start gap-2"><h2 className="text-sm font-semibold">How the risk has changed</h2><RiskHistory history={order.score_history} /></div>
                  </div>
                </TabsContent>
                <TabsContent value="claims"><Claims order={order} onChange={state.reload} /></TabsContent>
              </CardContent></Card>
            </Tabs>
          </>
        )}
      </LoadState>
    </>
  );
}
