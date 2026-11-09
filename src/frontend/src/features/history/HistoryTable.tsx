import type { HistoryRow } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { RiskBadge } from '@/shared/ui/risk-badge'
import {
  decisionLabel,
  formatUtc,
  intervened,
  outcomeLabel,
  recommendedAction,
  shortModelVersion,
} from './historyFormat'

type Props = {
  rows: HistoryRow[]
  selectedEpisodeId: string | null
  onSelect: (episodeId: string) => void
}

export function HistoryTable({ rows, selectedEpisodeId, onSelect }: Props) {
  return (
    <div className="overflow-x-auto rounded-sm border border-border bg-card">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Opened</th>
            <th className="px-3 py-2 font-medium">Order</th>
            <th className="px-3 py-2 font-medium">Risk</th>
            <th className="px-3 py-2 font-medium">Recommendation</th>
            <th className="px-3 py-2 font-medium">Decision</th>
            <th className="px-3 py-2 font-medium">Outcome</th>
            <th className="px-3 py-2 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ep = row.risk_episode.episode_id
            const selected = selectedEpisodeId === ep
            const outcome = outcomeLabel(row)
            return (
              <tr
                key={ep}
                className={[
                  'cursor-pointer border-b border-border last:border-0 hover:bg-muted/40',
                  selected ? 'bg-muted/50' : '',
                ].join(' ')}
                tabIndex={0}
                onClick={() => onSelect(ep)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(ep)
                  }
                }}
              >
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatUtc(row.risk_episode.opened_at_utc)}
                </td>
                <td className="px-3 py-2">
                  <div
                    className="font-medium"
                    title={`episode ${ep} · p_late ${row.risk_score.p_late.toFixed(3)}`}
                  >
                    {row.customer_order.external_order_id}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span title={`p_late ${row.risk_score.p_late.toFixed(3)}`}>
                    <RiskBadge risk={row.risk_band} />
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {recommendedAction(row)}
                  <div className="text-muted-foreground">
                    {shortModelVersion(row.risk_score.model_version)}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{decisionLabel(row)}</td>
                <td className="px-3 py-2 text-xs">
                  <Badge
                    variant="outline"
                    className={
                      outcome === 'Late'
                        ? 'text-risk-high'
                        : outcome === 'Awaiting delivery outcome'
                          ? 'text-muted-foreground'
                          : undefined
                    }
                  >
                    {outcome}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {intervened(row) ? (
                    <Badge variant="secondary">Intervened</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
