import { useEffect, useMemo, useState } from 'react'
import type { CaseDetail } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatPromiseWindow } from '@/features/case-detail/caseFormat'
import {
  DRAFT_LANGUAGES,
  buildDraftFacts,
  buildDraftText,
  defaultDraftLanguage,
  delayHintFromFacts,
  type DraftLanguage,
} from './draftTemplates'

type Props = {
  detail: CaseDetail
  onToast?: (message: string) => void
}

export function CustomerMessageDraft({ detail, onToast }: Props) {
  const facts = useMemo(() => buildDraftFacts(detail), [detail])
  const hasUnverified = facts.some((f) => !f.verified)

  const [language, setLanguage] = useState<DraftLanguage>(() =>
    defaultDraftLanguage(detail.delivery_site.country_code ?? 'SE'),
  )
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )

  const regenerate = (lang: DraftLanguage) => {
    const text = buildDraftText({
      orderId: detail.customer_order.external_order_id,
      promise: formatPromiseWindow(detail),
      delayHint: delayHintFromFacts(facts, lang),
      language: lang,
    })
    setDraft(text)
    setDirty(false)
  }

  useEffect(() => {
    const lang = defaultDraftLanguage(
      detail.delivery_site.country_code ?? 'SE',
    )
    setLanguage(lang)
    regenerate(lang)
    // Intentionally only when switching cases
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.customer_order.order_id])

  const onLanguageChange = (lang: DraftLanguage) => {
    setLanguage(lang)
    regenerate(lang)
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft)
      setCopyState('copied')
      onToast?.('Copied')
      window.setTimeout(() => setCopyState('idle'), 2_000)
    } catch {
      setCopyState('failed')
      onToast?.('Copy failed — select text and copy manually')
    }
  }

  return (
    <section
      className="space-y-3 rounded-sm border border-border bg-card px-3 py-3"
      aria-labelledby="customer-draft-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="customer-draft-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Customer message draft
        </h2>
        {hasUnverified ? (
          <Badge variant="outline" className="text-risk-medium">
            Includes unverified facts
          </Badge>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Copy-only helper for existing channels. Does not send email or SMS.
        Templates never include model p_late or claims that ERP/TMS actions
        already ran.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Language
          </span>
          <select
            className="h-9 cursor-pointer rounded-sm border border-border bg-background px-2 text-sm"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as DraftLanguage)}
            aria-label="Draft language"
          >
            {DRAFT_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => regenerate(language)}
        >
          Reset to template
        </Button>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground">Facts used</h3>
        <ul className="mt-1 space-y-1">
          {facts.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-baseline gap-2 text-xs"
            >
              <span className="font-medium text-foreground">{f.label}:</span>
              <span className="text-muted-foreground">{f.value}</span>
              {!f.verified ? (
                <Badge variant="outline" className="text-[10px] text-risk-medium">
                  Unverified
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {hasUnverified ? (
        <p
          className="rounded-sm border border-risk-medium/30 bg-risk-medium/10 px-2 py-1.5 text-xs text-foreground"
          role="status"
        >
          Warning: some facts are not customer-confirmed (e.g. system ETA or
          derived delay reasons). Review before copying.
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          Draft text
        </span>
        <textarea
          className="min-h-[12rem] w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm leading-relaxed"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setDirty(true)
          }}
          aria-label="Customer message draft text"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void onCopy()}>
          {copyState === 'copied' ? 'Copied' : 'Copy draft'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled
          title="Sending not connected in MVP"
        >
          Send
        </Button>
        <span className="text-xs text-muted-foreground">
          Send disabled — not connected in MVP
        </span>
      </div>
    </section>
  )
}
