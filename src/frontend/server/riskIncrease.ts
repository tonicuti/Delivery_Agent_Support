import { risk_band } from '../src/shared/types'

/** F8: latest score meaningfully worse than episode opening score. */
export function computeRiskIncreased(
  latestPLate: number,
  openingPLate: number | null,
): boolean {
  if (openingPLate == null || Number.isNaN(openingPLate)) return false
  const latestBand = risk_band(latestPLate)
  const openBand = risk_band(openingPLate)
  if (latestBand === 'High' && openBand !== 'High') return true
  if (latestBand === 'Medium' && openBand === 'Low') return true
  return latestPLate - openingPLate >= 0.1
}
