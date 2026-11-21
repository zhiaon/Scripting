import type { Session } from "./auth"
import { nextRefresh, readSnapshot, refreshSnapshot, snapshotText } from "./balance"
import type { RefreshResult, Snapshot } from "./balance"
import { dayInChina } from "./credits"

export type OverviewRow = { session: Session; snapshot: Snapshot | null; issue: string | null }

const BATCH = 4
const MIN_REFRESH = 5 * 60_000
// Match the single-account widget's freshness window for attendance.
const ATTENDANCE_FRESH = 25 * 60_000
const CURSOR = "wb.widget.overview_cursor.v1"
const PRIVATE = { shared: false }

function fresh(snapshot: Snapshot | null, now: number): boolean {
  return !!snapshot?.balance && snapshot.balance.total !== null && !snapshotText(snapshot, now) &&
    !!snapshot.attendance && now - snapshot.attendance.at < ATTENDANCE_FRESH &&
    dayInChina(snapshot.attendance.at) === dayInChina(now)
}

function sameDaySnapshot(snapshot: Snapshot | null, now: number): Snapshot | null {
  // Work started before Beijing midnight may finish on the next day.
  if (!snapshot?.attendance || dayInChina(snapshot.attendance.at) === dayInChina(now)) return snapshot
  return snapshot.balance ? { ...snapshot, attendance: null } : null
}

type Entry = { session: Session; cached: Snapshot | null; result?: RefreshResult }

function widgetBatch(entries: Entry[], now: number): Entry[] {
  const due = entries.filter(e => !fresh(e.cached, now)).sort((a, b) => a.session.slot - b.session.slot)
  if (!due.length) return []
  let slot = 0
  try {
    const saved = Storage.get<{ slot: number }>(CURSOR, PRIVATE)
    if (saved && Number.isSafeInteger(saved.slot) && saved.slot > 0) slot = saved.slot
  } catch { /* allow a best-effort refresh without persistence */ }
  const start = due.findIndex(e => e.session.slot > slot)
  const batch = (start < 0 ? due : due.slice(start).concat(due.slice(0, start))).slice(0, BATCH)
  // Advance on attempts, not on successes, so a broken account cannot block the queue.
  try { Storage.set(CURSOR, { slot: batch[batch.length - 1].session.slot }, PRIVATE) } catch { /* best effort */ }
  return batch
}

export async function loadOverview(sessions: Session[], foreground = false): Promise<{ rows: OverviewRow[]; next: number }> {
  const started = Date.now()
  const entries: Entry[] = sessions.map(session => ({ session, cached: readSnapshot(session, started) }))
  const chosen = foreground ? entries : widgetBatch(entries, started)
  for (let i = 0; i < chosen.length; i += BATCH) {
    await Promise.all(chosen.slice(i, i + BATCH).map(async e => {
      try { e.result = await refreshSnapshot(e.session, !foreground) }
      catch {
        const now = Date.now()
        e.result = { snapshot: e.cached, issue: "刷新失败", next: nextRefresh(e.cached, now, true) }
      }
    }))
  }

  const now = Date.now()
  let next = nextRefresh(null, now)
  const rows = entries.map(({ session, cached, result }): OverviewRow => {
    // A null result after revoked or changed authorization must not resurrect cached data.
    const snapshot = sameDaySnapshot(result ? result.snapshot : cached, now)
    const pending = !fresh(snapshot, now)
    const status = pending ? snapshot ? "缓存待更新" : "暂无数据" : null
    const error = result?.issue ?? null
    const issue = error && status ? `${error} · ${status}` : error ?? status
    next = Math.min(next, error && result ? result.next : pending ? now + MIN_REFRESH : nextRefresh(snapshot, now))
    return { session, snapshot, issue }
  })
  return { rows, next: Math.max(now + MIN_REFRESH, next) }
}
