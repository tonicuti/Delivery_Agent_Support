import { useState } from "react";
import { CircleCheck, Play, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api.js";
import { Button } from "@/components/ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.jsx";
import { Time } from "@/components/common.jsx";
import { usePoll } from "@/hooks.js";
import { cn } from "@/lib/utils.js";

function Line({ ok, children }) {
  const Icon = ok ? CircleCheck : TriangleAlert;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-risk-low" : "text-risk-med")} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Whether the assistant is ready, and whether orders are re-checked automatically. */
export default function Automation() {
  const [busy, setBusy] = useState(false);
  const system = usePoll("/api/system", { interval: 15_000 });
  const data = system.data;
  const ready = data?.ollama?.reachable && data?.ollama?.model_present;
  const automatic = data && data.scheduler.mode !== "off";

  async function act(task, success) {
    setBusy(true);
    try {
      const result = await task();
      toast.success(success(result));
      system.reload();
    } catch {
      toast.error("That did not work just now. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Assistant and automatic checks">
          <span className={cn("size-2 rounded-full", !data ? "bg-muted-foreground" : ready ? "bg-risk-low" : "bg-risk-med")} aria-hidden="true" />
          <Sparkles aria-hidden="true" />
          <span className="hidden sm:inline">{!data ? "Checking…" : ready ? "Assistant ready" : "Assistant offline"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] space-y-4">
        <div>
          <h2 className="text-sm font-bold">Assistant and automatic checks</h2>
          <p className="text-xs text-muted-foreground">The worklist keeps working even if the assistant is offline.</p>
        </div>
        {!data ? <p className="text-sm text-muted-foreground">Checking…</p> : (
          <>
            <Line ok={ready}>{ready ? "The assistant is ready to help." : "The assistant is not available right now. Suggestions and chat will be missing until it is back."}</Line>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Check orders automatically</p>
              <ToggleGroup type="single" variant="outline" value={automatic ? "on" : "off"} disabled={busy}
                           onValueChange={(v) => v && act(() => api.post("/api/scheduler", { mode: v === "on" ? "live" : "off" }),
                             () => (v === "on" ? "Orders will be checked automatically" : "Automatic checks are off"))}>
                <ToggleGroupItem value="off" className="px-5">Off</ToggleGroupItem>
                <ToggleGroupItem value="on" className="px-5">On</ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {automatic ? "Orders are re-checked as their delivery time gets closer: more often the less time is left."
                  : "Nothing is checked until you press “Check now” on an order."}
              </p>
              <Button size="sm" variant="secondary" disabled={busy}
                      onClick={() => act(() => api.post("/api/scheduler/run-once", { mode: "live" }), (r) => (r.processed ? `Checked ${r.processed} order${r.processed === 1 ? "" : "s"}` : "Everything is up to date"))}>
                <Play aria-hidden="true" />Check due orders now
              </Button>
              <p className="text-xs text-muted-foreground">
                Last automatic check: {data.scheduler.last_tick_utc ? <Time iso={data.scheduler.last_tick_utc} /> : "none yet"}
              </p>
              {data.scheduler.last_error && <p className="text-xs text-risk-high-fg" role="alert">The last automatic check did not finish. It will try again.</p>}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
