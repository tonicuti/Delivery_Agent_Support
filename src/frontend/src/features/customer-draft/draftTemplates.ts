import type { CaseDetail } from '@/shared/types'
import {
  buildCaseReasons,
  formatPromiseWindow,
  formatUtc,
  type CaseReason,
} from '@/features/case-detail/caseFormat'

export type DraftLanguage = 'sv' | 'no' | 'da'

export type DraftFact = {
  id: string
  label: string
  value: string
  verified: boolean
}

export const DRAFT_LANGUAGES: {
  id: DraftLanguage
  label: string
}[] = [
  { id: 'sv', label: 'Swedish' },
  { id: 'no', label: 'Norwegian' },
  { id: 'da', label: 'Danish' },
]

/** Default from AppShell country scope SE → Swedish. */
export function defaultDraftLanguage(
  countryCode: string | null | undefined,
): DraftLanguage {
  const c = (countryCode ?? 'SE').toUpperCase()
  if (c === 'NO') return 'no'
  if (c === 'DK') return 'da'
  return 'sv'
}

export function buildDraftFacts(detail: CaseDetail): DraftFact[] {
  const reasons = buildCaseReasons(detail)
  const facts: DraftFact[] = [
    {
      id: 'order',
      label: 'Order',
      value: detail.customer_order.external_order_id,
      verified: true,
    },
    {
      id: 'promise',
      label: 'Promised delivery',
      value: formatPromiseWindow(detail),
      verified: detail.promise_version != null,
    },
    {
      id: 'customer_type',
      label: 'Customer type',
      value: detail.customer.customer_type,
      verified: true,
    },
    {
      id: 'area',
      label: 'Delivery area',
      value: `${detail.delivery_site.postcode}${
        detail.order_snapshot.region_name
          ? ` · ${detail.order_snapshot.region_name}`
          : ''
      }`,
      verified: true,
    },
  ]

  const eta = detail.shipment?.latest_eta_update?.current_eta_at_utc
  if (eta) {
    facts.push({
      id: 'current_eta',
      label: 'Expected arrival (from system)',
      value: formatUtc(eta),
      // ETA from TMS feed — treat as needs customer-safe verification
      verified: false,
    })
  }

  for (const r of reasons.slice(0, 3)) {
    facts.push(reasonToFact(r))
  }

  return facts
}

function reasonToFact(r: CaseReason): DraftFact {
  return {
    id: `reason-${r.id}`,
    label: r.label,
    value: r.evidence,
    // Reasons derived / model codes are not customer-confirmed
    verified: !r.needsVerification,
  }
}

type TemplateInput = {
  orderId: string
  promise: string
  delayHint: string | null
  language: DraftLanguage
}

/**
 * Simple templates — no LLM. Never include p_late, PII beyond order ref,
 * or claims that vehicles/actions were already changed.
 */
export function buildDraftText(input: TemplateInput): string {
  const { orderId, promise, delayHint, language } = input
  const delay =
    delayHint ??
    (language === 'sv'
      ? 'en möjlig försening'
      : language === 'no'
        ? 'en mulig forsinkelse'
        : 'en mulig forsinkelse')

  switch (language) {
    case 'sv':
      return [
        `Hej,`,
        ``,
        `Vi kontaktar dig angående order ${orderId}.`,
        `Det utlovade leveransfönstret är ${promise}.`,
        `Just nu indikerar våra system ${delay}. Vi undersöker detta och återkommer när vi har bekräftad information.`,
        ``,
        `Detta är ett utkast — ingen ny leveranstid har bekräftats ännu.`,
        ``,
        `Vänliga hälsningar,`,
        `Kundservice`,
      ].join('\n')
    case 'no':
      return [
        `Hei,`,
        ``,
        `Vi kontakter deg angående ordre ${orderId}.`,
        `Det lovede leveringsvinduet er ${promise}.`,
        `Akkurat nå indikerer systemene våre ${delay}. Vi undersøker dette og kommer tilbake når vi har bekreftet informasjon.`,
        ``,
        `Dette er et utkast — ingen ny leveringstid er bekreftet ennå.`,
        ``,
        `Med vennlig hilsen,`,
        `Kundeservice`,
      ].join('\n')
    case 'da':
      return [
        `Hej,`,
        ``,
        `Vi kontakter dig vedrørende ordre ${orderId}.`,
        `Det lovede leveringsvindue er ${promise}.`,
        `Lige nu indikerer vores systemer ${delay}. Vi undersøger dette og vender tilbage, når vi har bekræftet information.`,
        ``,
        `Dette er et udkast — ingen ny leveringstid er bekræftet endnu.`,
        ``,
        `Venlig hilsen,`,
        `Kundeservice`,
      ].join('\n')
  }
}

export function delayHintFromFacts(
  facts: DraftFact[],
  language: DraftLanguage,
): string | null {
  const unverifiedReason = facts.find(
    (f) => f.id.startsWith('reason-') && !f.verified,
  )
  if (!unverifiedReason) return null
  // Soft, non-committal — do not copy internal evidence prose verbatim
  if (language === 'sv') return 'en möjlig försening som ännu inte är kundbekräftad'
  if (language === 'no') return 'en mulig forsinkelse som ennå ikke er kundbekreftet'
  return 'en mulig forsinkelse, som endnu ikke er kundbekræftet'
}
