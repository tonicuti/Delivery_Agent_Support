/** Demo role stub for F7 gate — not auth. */
export type DemoRole = 'dispatcher' | 'operator' | 'viewer'

const KEY = 'demo-role'

export function getDemoRole(): DemoRole {
  if (typeof sessionStorage === 'undefined') return 'dispatcher'
  const v = sessionStorage.getItem(KEY)
  if (v === 'operator' || v === 'viewer' || v === 'dispatcher') return v
  return 'dispatcher'
}

export function setDemoRole(role: DemoRole): void {
  sessionStorage.setItem(KEY, role)
}

/** Internal feed detail pages — operators/dispatchers only in this stub. */
export function canViewDataHealth(role: DemoRole = getDemoRole()): boolean {
  return role === 'dispatcher' || role === 'operator'
}
