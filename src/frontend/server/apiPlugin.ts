import type { Plugin } from 'vite'
import {
  dbPathsForLog,
  ensureSessionDb,
  invalidateDbCache,
  openDb,
  readSessionFlags,
  resetSessionFromSource,
  writeSessionFlags,
} from './db'
import {
  DecisionConflictError,
  queryCase,
  queryDataHealth,
  queryHistory,
  queryWorklist,
  deletePlannerFeedback,
  writeAck,
  writePlannerFeedback,
  writeUnack,
} from './queries'
import {
  applyFlagsToCase,
  applyFlagsToWorklist,
} from './sessionFlags'
import { chatEvents, validateChatMessages } from './chatAnswer'

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
      // Warm a single writable handle (avoids reopen races under HMR).
      try {
        openDb()
      } catch (err) {
        console.error(
          '[delivery-db-api] failed to open session DB',
          err instanceof Error ? err.message : err,
        )
      }
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
            const flags = readSessionFlags()
            const includeLow = url.searchParams.get('include_low_risk') === '1'
            const warehouse = url.searchParams.get('warehouse_id')
            const status = url.searchParams.get('status') as 'active' | 'closed' | null
            const orderId = url.searchParams.get('order_id')
            const external = url.searchParams.get('external_order_id')
            const riskBandParam = url.searchParams.get('risk_band')
            const data = applyFlagsToWorklist(
              queryWorklist(db, {
                warehouse_id: warehouse ? Number(warehouse) : undefined,
                status: status ?? 'active',
                order_id: orderId ? Number(orderId) : undefined,
                external_order_id: external ?? undefined,
                include_low_risk: includeLow,
                risk_band: riskBandParam
                  ? (riskBandParam.split(',') as Array<'Low' | 'Medium' | 'High'>)
                  : undefined,
              }),
              flags,
            )
            return send(res, 200, data)
          }

          if (method === 'GET' && pathname.startsWith('/api/cases/')) {
            const orderId = Number(pathname.split('/').pop())
            const db = openDb(true)
            const flags = readSessionFlags()
            return send(res, 200, applyFlagsToCase(queryCase(db, orderId), flags))
          }

          if (method === 'GET' && pathname === '/api/history') {
            const db = openDb(true)
            return send(res, 200, queryHistory(db))
          }

          if (method === 'POST' && pathname === '/api/chat/stream') {
            const body = (await readJson(req)) as {
              messages?: unknown
              order_id?: unknown
            }
            let messages
            try {
              messages = validateChatMessages(body.messages)
            } catch (err) {
              return send(res, 400, {
                error: err instanceof Error ? err.message : 'Invalid messages',
              })
            }
            const orderId =
              body.order_id == null || body.order_id === ''
                ? null
                : Number(body.order_id)
            if (orderId != null && (!Number.isInteger(orderId) || orderId <= 0)) {
              return send(res, 400, { error: 'order_id must be a positive integer' })
            }

            // Read-only fact answers; chat history stays in the browser only.
            const db = openDb(true)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-transform')
            res.setHeader('Connection', 'keep-alive')
            for (const event of chatEvents(db, messages, orderId)) {
              res.write(`data: ${JSON.stringify(event)}\n\n`)
            }
            res.end()
            return
          }

          if (method === 'GET' && pathname === '/api/data-health') {
            const db = openDb(true)
            const flags = readSessionFlags()
            return send(res, 200, queryDataHealth(db, flags))
          }

          if (method === 'POST' && pathname === '/api/session/agent-enabled') {
            const body = (await readJson(req)) as { agent_enabled?: boolean }
            if (typeof body.agent_enabled !== 'boolean') {
              return send(res, 400, { error: 'agent_enabled boolean required' })
            }
            const flags = writeSessionFlags({ agent_enabled: body.agent_enabled })
            const db = openDb(true)
            return send(res, 200, queryDataHealth(db, flags))
          }

          if (method === 'GET' && pathname === '/api/session/flags') {
            return send(res, 200, readSessionFlags())
          }

          if (method === 'POST' && pathname === '/api/session/flags') {
            const body = (await readJson(req)) as Record<string, unknown>
            const patch: Parameters<typeof writeSessionFlags>[0] = {}
            for (const key of [
              'agent_enabled',
              'force_ai_unavailable',
              'force_stale_scores',
              'simulate_conflict_on_save',
              'simulate_risk_increase',
              'simulate_delivery_return',
            ] as const) {
              if (typeof body[key] === 'boolean') patch[key] = body[key]
            }
            return send(res, 200, writeSessionFlags(patch))
          }

          if (method === 'POST' && pathname === '/api/planner-feedback') {
            const body = (await readJson(req)) as {
              recommendation_id: string
              chosen_action_id: string | null
              notes: string | null
              recorded_by: string
              recorded_at_utc: string
              expected_feedback_id?: string | null
            }
            const flags = readSessionFlags()
            const simulate = flags.simulate_conflict_on_save
            if (simulate) {
              writeSessionFlags({ simulate_conflict_on_save: false })
            }
            const db = openDb(false)
            try {
              const row = writePlannerFeedback(db, {
                recommendation_id: body.recommendation_id,
                chosen_action_id: body.chosen_action_id as never,
                notes: body.notes,
                recorded_by: body.recorded_by,
                recorded_at_utc: body.recorded_at_utc,
                expected_feedback_id: body.expected_feedback_id,
                simulate_conflict: simulate,
              })
              return send(res, 200, {
                feedback_id: row.feedback_id,
                recommendation_id: row.recommendation_id,
                chosen_action_id: row.chosen_action_id,
                notes: row.notes,
                recorded_by: row.recorded_by,
                recorded_at_utc: row.recorded_at_utc,
              })
            } catch (err) {
              if (err instanceof DecisionConflictError) {
                return send(res, 409, { error: err.message })
              }
              throw err
            }
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
          // Stale handle after HMR / interrupted I/O — drop cache for next request.
          if (/disk I\/O|SQLITE_IOERR|unable to open|database is locked/i.test(message)) {
            invalidateDbCache()
          }
          return send(res, 500, { error: message })
        }
      })
    },
  }
}
