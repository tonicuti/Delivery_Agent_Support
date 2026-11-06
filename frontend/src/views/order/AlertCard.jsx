import { useState } from "react";
import { BadgeCheck, BellRing, Check, Pencil, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { DecisionBadge, Notice, Remaining, RiskBadge, SignalBadge, Status, Time } from "@/components/common.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { useMeta, useRole, useWords } from "@/context.jsx";
import { fmtPct, hoursBetween } from "@/format.js";

const TECHNICAL = /_|\bmodel\b|probab|evidence|p_late|\bid\b/i;

/** Accepting is one click; choosing another action or dismissing needs a little detail, so they open this. */
function DecisionDialog({ mode, rec, onClose, onDone }) {
  const { playbooks, dismiss_reasons: reasons } = useMeta();
  const { role } = useRole();
  const words = useWords();
  const choices = Object.keys(playbooks).filter((id) => id !== rec.action_id);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = mode === "edited";

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/recommendations/${rec.recommendation_id}/decision`, {
        decision: mode, role, notes: notes || null, ...(editing ? { action_id: value } : { reason: value }),
      });
      toast.success(editing ? "Saved: you chose another action." : "Saved: alert dismissed.");
      onDone();
      onClose();
    } catch {
      toast.error("Your choice could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Choose another action" : "This alert is not needed"}</DialogTitle>
            <DialogDescription>{editing ? "Pick what you will do instead of the suggestion." : "Tell us why, so we can send fewer alerts that are not useful."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="decision-value">{editing ? "What will you do?" : "Why is it not needed?"}</Label>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger id="decision-value" className="w-full"><SelectValue placeholder="Choose one" /></SelectTrigger>
              <SelectContent>
                {editing
                  ? choices.map((id) => <SelectItem key={id} value={id}>{words.action(id)}</SelectItem>)
                  : Object.entries(reasons).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {editing && value && <p className="text-xs text-muted-foreground">{playbooks[value]}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="decision-notes">Notes (optional)</Label>
            <Textarea id="decision-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !value}>{editing ? "Save my choice" : "Dismiss alert"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Alerts({ notifications, onChange }) {
  const [busy, setBusy] = useState(null);
  if (!notifications.length) return null;

  async function read(id) {
    setBusy(id);
    try {
      await api.post(`/api/alerts/${id}/ack`);
      toast.success("Marked as read");
      onChange();
    } catch {
      toast.error("That did not work just now. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Alerts sent to the team</p>
      {notifications.map((n) => (
        <div key={n.notification_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
          <span className="flex flex-wrap items-center gap-2">
            <Status tone="none" icon={BellRing}>{n.kind === "initial" ? "First alert" : "Reminder"}</Status>
            <Time iso={n.created_at_utc} className="text-xs text-muted-foreground" />
            <span className="tabular">{fmtPct(n.payload.p_late)} chance of being late</span>
          </span>
          {n.acknowledged_at_utc
            ? <Status tone="low" icon={Check}>Read <Time iso={n.acknowledged_at_utc} /></Status>
            : <Button size="xs" variant="outline" disabled={busy === n.notification_id} onClick={() => read(n.notification_id)}>Got it</Button>}
        </div>
      ))}
    </div>
  );
}

export default function AlertCard({ order, onChange }) {
  const { playbooks } = useMeta();
  const { role } = useRole();
  const words = useWords();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const rec = order.recommendation;
  const out = rec?.output;
  const valid = rec?.validation_status === "valid";
  const unknown = valid ? out.missing_information.map((m) => words.feature(m)) : [];

  async function accept() {
    setBusy(true);
    try {
      await api.post(`/api/recommendations/${rec.recommendation_id}/decision`, { decision: "approved", role });
      toast.success(`Saved: ${words.action(rec.action_id).toLowerCase()}. Now do it in your usual systems.`);
      onChange();
    } catch {
      toast.error("Your choice could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">What to do {order.risk_band && <RiskBadge band={order.risk_band} />}</CardTitle>
        <CardDescription>
          {order.p_late != null
            ? <>{fmtPct(order.p_late)} chance of being late · promised by <Time iso={order.promised_to_utc} /> · <Remaining hours={order.hours_remaining} className="text-inherit" /></>
            : "This order has not been checked yet. Press “Check now” to see how likely it is to be late."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {order.signals.length > 0 && (
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Why this order is at risk</p>
            <ul className="grid gap-2">
              {order.signals.map((s) => (
                <li key={s.code} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><SignalBadge signal={s} /><span className="text-muted-foreground">{s.detail}</span></li>
              ))}
            </ul>
          </div>
        )}

        {!rec && order.p_late != null && <Notice tone="info" icon={TriangleAlert} title="No action needed">We only suggest an action for orders that are likely to be late.</Notice>}
        {rec && !valid && <Notice tone="warn" title="No suggestion this time">The assistant could not work out a suggestion. The team was still alerted, so please decide from the details on this page.</Notice>}
        {valid && (
          <div className="grid gap-3 rounded-xl border bg-brand-soft/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-bold">{words.action(rec.action_id)}</p>
              <Status tone="low" icon={BadgeCheck}>Suggestion</Status>
            </div>
            <p className="text-sm text-muted-foreground">{playbooks[rec.action_id]}</p>
            {out.summary && !TECHNICAL.test(out.summary) && <p className="text-sm">{out.summary}</p>}
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Who</dt><dd>{out.suggested_owner}</dd>
              <dt className="text-muted-foreground">Reply by</dt>
              <dd><Time iso={out.suggested_response_deadline} /> · <Remaining hours={hoursBetween(out.suggested_response_deadline, order.now)} /></dd>
              {unknown.length > 0 && <><dt className="text-muted-foreground">Not known yet</dt><dd>{unknown.join(", ")}</dd></>}
            </dl>
          </div>
        )}

        {rec && (
          <div className="grid gap-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">What will you do?</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DecisionBadge decision={rec.decision} />
                {rec.decision && <span>{words.role(rec.decision.role)} · <Time iso={rec.decision.recorded_at_utc} /></span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={accept} disabled={busy || !valid}><BadgeCheck aria-hidden="true" />Accept suggestion</Button>
              <Button variant="outline" onClick={() => setDialog("edited")}><Pencil aria-hidden="true" />Choose another action</Button>
              <Button variant="outline" onClick={() => setDialog("dismissed")}><XCircle aria-hidden="true" />Not needed</Button>
            </div>
            <p className="text-xs text-muted-foreground">Do the work in your usual systems. Your choice is saved for the team, and you can change it later.</p>
          </div>
        )}
        <Alerts notifications={order.notifications} onChange={onChange} />
      </CardContent>
      {dialog && <DecisionDialog mode={dialog} rec={rec} onClose={() => setDialog(null)} onDone={onChange} />}
    </Card>
  );
}
