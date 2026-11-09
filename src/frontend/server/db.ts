import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(serverDir, '..')

/**
 * Enterprise-style local data access:
 * - SOURCE DB = team fixture (never written by the UI)
 * - SESSION DB = working copy under .data/ (all reads/writes)
 * Reset = re-copy source → session.
 */

export function resolveSourceDbPath(): string {
  if (process.env.DELIVERY_DB_PATH) {
    return path.resolve(process.env.DELIVERY_DB_PATH)
  }
  return path.resolve(
    frontendRoot,
    '../backend/practice_delivery/my_practice.db',
  )
}

export function resolveSessionDbPath(): string {
  if (process.env.DELIVERY_SESSION_DB_PATH) {
    return path.resolve(process.env.DELIVERY_SESSION_DB_PATH)
  }
  return path.resolve(frontendRoot, '.data/session.db')
}

function ensureSourceExists(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Source SQLite not found at ${sourcePath}. Set DELIVERY_DB_PATH to the team DB.`,
    )
  }
}

function closeCached(): void {
  if (!cached) return
  try {
    cached.close()
  } catch {
    /* ignore */
  }
  cached = null
  cachedPath = null
}

/**
 * Copy source → session. Overwrites session. Safe to call for "reset to golden".
 * Source file is never opened for write.
 */
export function resetSessionFromSource(): {
  source: string
  session: string
  copied_at_utc: string
} {
  const source = resolveSourceDbPath()
  const session = resolveSessionDbPath()
  ensureSourceExists(source)

  closeCached()

  fs.mkdirSync(path.dirname(session), { recursive: true })
  // Also clear SQLite sidecars if present from a previous open.
  for (const side of ['', '-wal', '-shm']) {
    const p = `${session}${side}`
    if (side && fs.existsSync(p)) fs.unlinkSync(p)
  }
  fs.copyFileSync(source, session)

  return {
    source,
    session,
    copied_at_utc: new Date().toISOString(),
  }
}

/** Ensure session exists (first boot copies from source). */
export function ensureSessionDb(): { source: string; session: string; created: boolean } {
  const source = resolveSourceDbPath()
  const session = resolveSessionDbPath()
  ensureSourceExists(source)

  if (!fs.existsSync(session)) {
    resetSessionFromSource()
    return { source, session, created: true }
  }
  return { source, session, created: false }
}

let cached: DatabaseSync | null = null
let cachedPath: string | null = null

/**
 * Open the SESSION copy only (never the team source).
 *
 * Always opens writable and reuses one handle. Re-opening readonly→write on
 * every POST caused Windows SQLITE_IOERR ("disk I/O error") under HMR /
 * concurrent fetches.
 *
 * `readonly` is kept for call-site compatibility but ignored for open mode.
 */
export function openDb(_readonly = false): DatabaseSync {
  ensureSessionDb()
  const session = resolveSessionDbPath()

  if (cached && cachedPath === session) {
    return cached
  }
  if (cached) closeCached()

  cached = new DatabaseSync(session)
  cachedPath = session
  try {
    cached.exec('PRAGMA busy_timeout = 5000;')
  } catch {
    /* older builds may not allow exec — ignore */
  }
  return cached
}

/** Drop cached handle after I/O / lock failures so the next call reopens. */
export function invalidateDbCache(): void {
  closeCached()
}

export function dbPathsForLog(): { source: string; session: string } {
  return {
    source: resolveSourceDbPath(),
    session: resolveSessionDbPath(),
  }
}

/** @deprecated use dbPathsForLog().session */
export function dbPathForLog(): string {
  return resolveSessionDbPath()
}

import {
  DEFAULT_SESSION_FLAGS,
  normalizeSessionFlags,
  type SessionFlags,
} from './sessionFlags'

export type { SessionFlags }

function sessionFlagsPath(): string {
  return path.resolve(path.dirname(resolveSessionDbPath()), 'session_flags.json')
}

/** Demo ops flags for F7/F8 — not a schema table. */
export function readSessionFlags(): SessionFlags {
  const p = sessionFlagsPath()
  try {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<SessionFlags>
      return normalizeSessionFlags(raw)
    }
  } catch {
    /* default */
  }
  return { ...DEFAULT_SESSION_FLAGS }
}

export function writeSessionFlags(
  patch: Partial<SessionFlags>,
): SessionFlags {
  const next = normalizeSessionFlags({ ...readSessionFlags(), ...patch })
  fs.mkdirSync(path.dirname(sessionFlagsPath()), { recursive: true })
  fs.writeFileSync(sessionFlagsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
