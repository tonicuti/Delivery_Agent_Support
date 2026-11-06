import { bandOf, fmtPct } from "@/format.js";

const CX = 110, CY = 104, R = 84, STROKE = 16;
// Band edges from the project contract: Low < 20 %, Medium 20-50 %, High > 50 %.
const ARCS = [
  { from: 0, to: 0.2, cls: "stroke-risk-low" },
  { from: 0.2, to: 0.5, cls: "stroke-risk-med" },
  { from: 0.5, to: 1, cls: "stroke-risk-high" },
];

const point = (fraction, radius = R) => {
  const angle = Math.PI * (1 - fraction);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
};

function arc(from, to) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Half-circle gauge of p_late with the three risk bands marked. */
export default function Gauge({ p }) {
  const band = bandOf(p);
  const [mx, my] = p == null ? [0, 0] : point(Math.min(Math.max(p, 0), 1));
  return (
    <figure className="m-0 flex flex-col items-center">
      <svg viewBox="0 0 220 128" className="w-full max-w-64" role="img"
           aria-label={p == null ? "Not checked yet" : `${fmtPct(p)} chance of being late, ${band.toLowerCase()} risk`}>
        <path d={arc(0, 1)} fill="none" className="stroke-muted" strokeWidth={STROKE + 4} strokeLinecap="round" />
        {ARCS.map((a) => (
          <path key={a.from} d={arc(a.from, a.to)} fill="none" className={a.cls} strokeWidth={STROKE} />
        ))}
        {p != null && <circle cx={mx} cy={my} r="9" className="fill-card stroke-foreground" strokeWidth="3" />}
        <text x={CX} y={CY - 8} textAnchor="middle" className="fill-foreground text-[34px] font-bold">
          {p == null ? "—" : `${Math.round(p * 100)}%`}
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {p == null ? "not checked yet" : "chance of being late"}
        </text>
      </svg>
      <figcaption className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-risk-low" />Low</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-risk-med" />Medium</span>
        <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-risk-high" />High</span>
      </figcaption>
    </figure>
  );
}
