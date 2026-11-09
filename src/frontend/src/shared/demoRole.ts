/** Demo role stub for F7 gate — not real auth. */
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

/** Can open /data-health at all. */
export function canOpenDataHealth(role: DemoRole = getDemoRole()): boolean {
  return role === 'dispatcher' || role === 'operator'
}

/** Full feed table + agent toggle. */
export function canSeeDataHealthDetail(
  role: DemoRole = getDemoRole(),
): boolean {
  return role === 'operator'
}
