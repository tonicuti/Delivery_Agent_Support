import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { Button } from "@/components/ui/button.jsx";
import { useWords } from "@/context.jsx";
import { fmtPct } from "@/format.js";

/** One click: look at the order again right now with the latest information. */
export default function CheckNow({ order, onDone }) {
  const [busy, setBusy] = useState(false);
  const words = useWords();

  async function run() {
    setBusy(true);
    try {
      const r = await api.post(`/api/orders/${order.order_id}/run`, { mode: "live" });
      if (r.p_late == null) toast.info("We have stopped watching this order, so there is nothing to check.");
      else if (r.recommendation) toast.success(`${fmtPct(r.p_late)} chance of being late. Suggested action: ${words.action(r.recommendation.action_id)}.`);
      else if (r.risk_band === "High") toast.success(`${fmtPct(r.p_late)} chance of being late. No suggestion this time, but the team has been alerted.`);
      else toast.success(`${fmtPct(r.p_late)} chance of being late (${r.risk_band.toLowerCase()} risk). Nothing to do for now.`);
      onDone();
    } catch (error) {
      toast.error(/already in progress/.test(error.message) ? "A check is already running for this order." : "The check did not finish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={run} disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
        {busy ? "Checking…" : "Check now"}
      </Button>
      <span className="sr-only" role="status">{busy ? "Checking the order. This can take up to a minute." : ""}</span>
    </>
  );
}
