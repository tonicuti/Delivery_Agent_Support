import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { Notice, Status, Time } from "@/components/common.jsx";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { useRole } from "@/context.jsx";

const TASK = { urgent: ["high", "Urgent"], in_progress: ["med", "In progress"], done: ["low", "Done"] };
const REASON = { damaged: "Damaged", missing: "Missing" };
const CLAIM_STATUS = { open: ["info", "Open"], approved: ["low", "Replacement approved"], declined: ["none", "Declined"], closed: ["none", "Closed"] };

function ApproveForm({ claim, orderId, onChange }) {
  const { role } = useRole();
  const [quantities, setQuantities] = useState(() => Object.fromEntries(claim.lines.map((l) => [l.claim_line_id, l.disputed_qty])));
  const [finding, setFinding] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      const lines = claim.lines.map((l) => ({ claim_line_id: l.claim_line_id, quantity: Number(quantities[l.claim_line_id]) })).filter((l) => l.quantity > 0);
      await api.post(`/api/orders/${orderId}/replacement`, { claim_id: claim.claim_id, representative_id: role, finding, lines });
      toast.success("Replacement approved. An urgent task has been created.");
      onChange();
    } catch {
      toast.error("The replacement could not be approved. Please check the quantities and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border p-3">
      <p className="text-sm font-semibold">Approve a replacement</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {claim.lines.map((l) => (
          <div key={l.claim_line_id} className="grid gap-1.5">
            <Label htmlFor={`qty-${l.claim_line_id}`}>{REASON[l.reason] ?? l.reason}: how many to replace (up to {l.disputed_qty})</Label>
            <Input id={`qty-${l.claim_line_id}`} type="number" min="0" max={l.disputed_qty} step="any" value={quantities[l.claim_line_id]}
                   onChange={(e) => setQuantities({ ...quantities, [l.claim_line_id]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`finding-${claim.claim_id}`}>What did the inspection find?</Label>
        <Textarea id={`finding-${claim.claim_id}`} value={finding} onChange={(e) => setFinding(e.target.value)} maxLength={1000} />
      </div>
      <AlertDialog>
        <Button variant="destructive" className="w-fit" disabled={busy || !finding.trim()} asChild>
          <AlertDialogTrigger>Approve replacement…</AlertDialogTrigger>
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this replacement?</AlertDialogTitle>
            <AlertDialogDescription>We will stop watching this order for lateness and create an urgent task for the team. The task stays urgent until the customer has received every approved item. This cannot be undone here.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Claims({ order, onChange }) {
  const [busy, setBusy] = useState(false);
  const approved = order.eligibility === "replacement_authorized";

  async function refresh() {
    setBusy(true);
    try {
      const { tasks_completed: done } = await api.post(`/api/orders/${order.order_id}/replacement/refresh`);
      toast.info(done ? `${done} task${done === 1 ? "" : "s"} completed` : "The customer has not received everything yet.");
      onChange();
    } catch {
      toast.error("That did not work just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {order.claims.length === 0 && <p className="text-sm text-muted-foreground">There are no claims on this order. A claim on its own does not make anything urgent; only an approved replacement does.</p>}
      {approved && (
        <Notice tone="info" title="Replacement approved">
          We have stopped watching this order for lateness. Sending the items is not enough: the task stays urgent until the customer has received everything.
          <Button size="xs" variant="outline" className="ml-3" disabled={busy} onClick={refresh}>Check if it has arrived</Button>
        </Notice>
      )}
      {order.claims.map((claim) => {
        const [tone, text] = CLAIM_STATUS[claim.status] ?? ["none", claim.status];
        return (
          <div key={claim.claim_id} className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Claim opened <Time iso={claim.opened_at_utc} /></span>
              <Status tone={tone}>{text}</Status>
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader><TableRow className="bg-muted/50"><TableHead>Problem</TableHead><TableHead className="text-right">Claimed</TableHead><TableHead className="text-right">Approved</TableHead><TableHead>Task</TableHead></TableRow></TableHeader>
                <TableBody>{claim.lines.map((l) => {
                  const task = TASK[l.task_status];
                  return (
                    <TableRow key={l.claim_line_id}><TableCell>{REASON[l.reason] ?? l.reason}</TableCell>
                      <TableCell className="tabular text-right">{l.disputed_qty}</TableCell>
                      <TableCell className="tabular text-right">{l.approved_qty ?? "—"}</TableCell>
                      <TableCell>{task ? <Status tone={task[0]}>{task[1]}</Status> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>
                  );
                })}</TableBody>
              </Table>
            </div>
            {claim.status === "open" && !approved && <ApproveForm claim={claim} orderId={order.order_id} onChange={onChange} />}
          </div>
        );
      })}
    </div>
  );
}
