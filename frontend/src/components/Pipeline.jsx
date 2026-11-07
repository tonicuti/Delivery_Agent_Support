import { Check } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { STAGES } from "@/format.js";

/** Warehouse-to-road progress of one shipment; the current stage is highlighted. */
export default function Pipeline({ stageIndex }) {
  return (
    <ol className="grid grid-cols-5" aria-label="Shipment progress">
      {STAGES.map((label, i) => {
        const done = i < stageIndex;
        const current = i === stageIndex;
        return (
          <li key={label} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span aria-hidden="true"
                    className={cn("absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2", i <= stageIndex ? "bg-primary" : "bg-border")} />
            )}
            <span className={cn(
              "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-card text-[10px] font-semibold",
              done && "border-primary bg-primary text-primary-foreground",
              current && "border-primary text-primary ring-4 ring-primary/20",
              !done && !current && "border-border text-muted-foreground",
            )}>
              {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-[11px] leading-tight", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
