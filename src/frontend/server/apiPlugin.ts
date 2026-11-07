import type { Plugin } from 'vite'
import {
  dbPathsForLog,
  ensureSessionDb,
  openDb,
  resetSessionFromSource,
} from './db'
import {
  queryCase,
  queryDataHealth,
  queryHistory,
  queryWorklist,
  deletePlannerFeedback,
  writeAck,
  writePlannerFeedback,
  writeUnack,
} from './queries'

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(json)
}

/**
 * Dev API over a SESSION copy of the team SQLite.
 * Team source DB is never written; POST /api/session/reset restores the copy.
 */
export function deliveryDbApiPlugin(): Plugin {
  return {
    name: 'delivery-db-api',
    configureServer(server) {
      const boot = ensureSessionDb()
      const paths = dbPathsForLog()
      console.info(`[delivery-db-api] source (RO)  → ${paths.source}`)
      console.info(
        `[delivery-db-api] session (RW) → ${paths.session}${boot.created ? ' [created]' : ''}`,
      )

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const url = new URL(req.url, 'http://localhost')
          const pathname = url.pathname
          const method = (req.method ?? 'GET').toUpperCase()

          if (method === 'GET' && pathname === '/api/health') {
            const p = dbPathsForLog()
            return send(res, 200, {
              ok: true,
              source_db: p.source,
              session_db: p.session,
              write_target: 'session_copy_only',
            })
          }

          if (method === 'POST' && pathname === '/api/session/reset') {
            const result = resetSessionFromSource()
            return send(res, 200, {
              ok: true,
              message: 'Session DB restored from source. Team source was not modified.',
              ...result,
            })
          }

          if (method === 'GET' && pathname === '/api/worklist') {
            const db = openDb(true)
            const includeLow = url.searchParams.get('include_low_risk') === '1'
            const warehouse = url.searchParams.get('warehouse_id')
            const status = url.searchParams.get('status') as 'active' | 'closed' | null
            const orderId = url.searchParams.get('order_id')
            const external = url.searchParams.get('external_order_id')
            const riskBandParam = url.searchParams.get('risk_band')
            const data = queryWorklist(db, {
              warehouse_id: warehouse ? Number(warehouse) : undefined,
              status: status ?? 'active',
              order_id: orderId ? Number(orderId) : undefined,
              external_order_id: external ?? undefined,
              include_low_risk: includeLow,
              risk_band: riskBandParam
                ? (riskBandParam.split(',') as Array<'Low' | 'Medium' | 'High'>)
                : undefined,
            })
            return send(res, 200, data)
          }

          if (method === 'GET' && pathname.startsWith('/api/cases/')) {
            const orderId = Number(pathname.split('/').pop())
            const db = openDb(true)
            return send(res, 200, queryCase(db, orderId))
          }

          if (method === 'GET' && pathname === '/api/history') {
            const db = openDb(true)
            return send(res, 200, queryHistory(db))
          }

          if (method === 'GET' && pathname === '/api/data-health') {
            const db = openDb(true)
            return send(res, 200, queryDataHealth(db))
          }

          if (method === 'POST' && pathname === '/api/planner-feedback') {
            const body = (await readJson(req)) as {
              recommendation_id: string
              chosen_action_id: string | null
              notes: string | null
              recorded_by: string
              recorded_at_utc: string
            }
            const db = openDb(false)
            const row = writePlannerFeedback(db, {
              recommendation_id: body.recommendation_id,
              chosen_action_id: body.chosen_action_id as never,
              notes: body.notes,
              recorded_by: body.recorded_by,
              recorded_at_utc: body.recorded_at_utc,
            })
            return send(res, 200, {
              feedback_id: row.feedback_id,
              recommendation_id: row.recommendation_id,
              chosen_action_id: row.chosen_action_id,
              notes: row.notes,
              recorded_by: row.recorded_by,
              recorded_at_utc: row.recorded_at_utc,
            })
          }

          if (
            method === 'DELETE' &&
            pathname.startsWith('/api/planner-feedback/')
          ) {
            const feedback_id = decodeURIComponent(
              pathname.slice('/api/planner-feedback/'.length),
            )
            if (!feedback_id) {
              return send(res, 400, { error: 'feedback_id required' })
            }
            const db = openDb(false)
            const result = deletePlannerFeedback(db, feedback_id)
            return send(res, 200, result)
          }

          if (method === 'POST' && pathname === '/api/notifications/ack') {
            const body = (await readJson(req)) as {
              notification_id: string
              acknowledged_at_utc: string
            }
            const db = openDb(false)
            const row = writeAck(db, body)
            return send(res, 200, {
              notification_id: row.notification_id,
              episode_id: row.episode_id,
              recommendation_id: row.recommendation_id,
              kind: row.kind,
              payload_json: row.payload_json,
              created_at_utc: row.created_at_utc,
              acknowledged_at_utc: row.acknowledged_at_utc,
            })
          }

          if (method === 'POST' && pathname === '/api/notifications/unack') {
            const body = (await readJson(req)) as { notification_id: string }
            const db = openDb(false)
            const row = writeUnack(db, body.notification_id)
            return send(res, 200, {
              notification_id: row.notification_id,
              episode_id: row.episode_id,
              recommendation_id: row.recommendation_id,
              kind: row.kind,
              payload_json: row.payload_json,
              created_at_utc: row.created_at_utc,
              acknowledged_at_utc: row.acknowledged_at_utc,
            })
          }

          return send(res, 404, { error: `No route ${method} ${pathname}` })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[delivery-db-api]', message)
          return send(res, 500, { error: message })
        }
      })
    },
  }
}
