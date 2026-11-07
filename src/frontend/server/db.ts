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
 * Open the SESSION copy only.
 * readonly=true still hits the copy (never the team source).
 */
export function openDb(readonly = false): DatabaseSync {
  ensureSessionDb()
  const session = resolveSessionDbPath()

  if (cached && cachedPath === session) {
    // If we previously opened readonly and now need write, reopen.
    if (!readonly) {
      // DatabaseSync has no "isReadOnly" flag exposed reliably — reopen writable.
      closeCached()
    } else {
      return cached
    }
  } else if (cached) {
    closeCached()
  }

  cached = new DatabaseSync(session, { readOnly: readonly })
  cachedPath = session
  return cached
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
