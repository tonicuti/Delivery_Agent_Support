import type { DeliveryRiskApi } from '@/shared/types'
import { httpClient } from './httpClient'

/** Live path: Vite /api → team SQLite (my_practice.db by default). */
export const api: DeliveryRiskApi = httpClient

export type { DeliveryRiskApi } from '@/shared/types'
export { httpClient }
