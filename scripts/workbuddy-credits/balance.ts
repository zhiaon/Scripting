import { accepted, authExpired, request, WorkBuddyError } from "./transport"
import type { Reply } from "./transport"
import { currentSession, meterHeaders, renewSession } from "./auth"
import type { Session } from "./auth"
import { dayInChina, nextDayInChina, packageNames, parseAttendance, parseLedger } from "./credits"
import type { Attendance, Ledger } from "./credits"

const DATA = "wb.widget.credit_snapshot.v1"
const ATTEMPT = "wb.widget.last_widget_request.v1"
const snapshotKey = (s: Session) => s.generation === "legacy" ? DATA : `wb.widget.credit_snapshot.v2.${s.id}.${s.generation}`
const attemptKey = (s: Session) => s.generation === "legacy" ? ATTEMPT : `wb.widget.last_widget_request.v2.${s.id}.${s.generation}`
const MINUTE = 60_000
const MAX_CACHE_MS = 48 * 60 * MINUTE
const FRESH_MS = 25 * MINUTE
const RETRY_MS = 10 * MINUTE
const PRIVATE = { shared: false }

type LedgerSample = Ledger & { at: number }
type AttendanceSample = { value: Attendance; at: number }
export type Snapshot = { id: string; balance: LedgerSample | null; attendance: AttendanceSample | null }
export type RefreshResult = { snapshot: Snapshot | null; issue: string | null; next: number }

export function readSnapshot(session: Session, now = Date.now()): Snapshot | null {
  try {
    const entry = Storage.get<Snapshot>(snapshotKey(session), PRIVATE)
    if (entry?.id !== session.id) return null
    const usable = (at: number | undefined): boolean => typeof at === "number" && at > 0 && at <= now && now - at < MAX_CACHE_MS
    const balance = usable(entry.balance?.at) ? entry.balance : null
    const attendance = usable(entry.attendance?.at) && dayInChina(entry.attendance!.at) === dayInChina(now) ? entry.attendance : null
    return balance || attendance ? { id: session.id, balance, attendance } : null
  } catch { return null }
}

export function snapshotText(snapshot: Snapshot | null, now = Date.now()): boolean {
  const b = snapshot?.balance
  return !!b && (now - b.at >= FRESH_MS || (b.nextExpiry !== null && b.nextExpiry <= now))
}

export function clearSnapshot(session: Session) {
  try { Storage.remove(snapshotKey(session), PRIVATE); Storage.remove(attemptKey(session), PRIVATE) } catch { /* obsolete authorization will not read these */ }
}

export function safeMessage(error: unknown): string {
  return error instanceof WorkBuddyError ? error.message : "操作暂未完成，请再试一次"
}

function isRecent(s: Snapshot | null, now: number): boolean {
  return !!s?.balance && s.balance.total !== null && !!s.attendance && now - s.attendance.at < FRESH_MS && !snapshotText(s, now)
}

export function nextRefresh(s: Snapshot | null, now: number, retry = false): number {
  const from = Math.min(s?.balance?.at ?? now, s?.attendance?.at ?? now)
  const candidates = [retry ? now + RETRY_MS : from + 30 * MINUTE, nextDayInChina(now)]
  if (!retry && s?.balance?.nextExpiry && s.balance.nextExpiry > now) candidates.push(s.balance.nextExpiry)
  return Math.max(now + 5 * MINUTE, Math.min(...candidates))
}

async function settled(work: Promise<Reply>): Promise<Reply | null> {
  try { return await work } catch { return null }
}

export async function refreshSnapshot(initial: Session, widget = false): Promise<RefreshResult> {
  const now = Date.now()
  let prior = readSnapshot(initial, now)
  if (widget) {
    if (isRecent(prior, now)) return { snapshot: prior, issue: null, next: nextRefresh(prior, now) }
    try {
      const last = Storage.get<{ id: string; at: number }>(attemptKey(initial), PRIVATE)
      if (last?.id === initial.id && last.at <= now && now - last.at < RETRY_MS) {
        return { snapshot: prior, issue: "等待下次刷新", next: nextRefresh(prior, now, true) }
      }
      Storage.set(attemptKey(initial), { id: initial.id, at: now }, PRIVATE)
    } catch { /* storage failure does not authorize access to any other account */ }
  }
  try {
    const timeout = widget ? 5 : 10
    let session = currentSession(initial), renewed = false
    if (session.expires !== null && session.expires <= now) {
      renewed = true
      session = await renewSession(session, timeout)
    }
    const read = (s: Session) => {
      const h = meterHeaders(s)
      return Promise.all([
        settled(request("balance", h, undefined, timeout)),
        settled(request("attendance", h, undefined, timeout)),
      ])
    }
    let [balanceReply, attendanceReply] = await read(session)
    if (!renewed && (balanceReply && authExpired(balanceReply) || (!balanceReply && attendanceReply && authExpired(attendanceReply)))) {
      session = await renewSession(session, timeout)
      ;[balanceReply, attendanceReply] = await read(session)
    }
    const at = Date.now()
    const rawBalance = balanceReply && accepted(balanceReply) ? balanceReply.data : null
    let balance = rawBalance ? parseLedger(rawBalance, at) : null
    if (rawBalance && balance && balance.checkin === null) {
      const summary = await settled(request("packageNames", meterHeaders(session), undefined, widget ? 3 : 7))
      if (summary && accepted(summary) && summary.data) balance = parseLedger(rawBalance, at, packageNames(summary.data))
    }
    const status = attendanceReply && accepted(attendanceReply) && attendanceReply.data ? parseAttendance(attendanceReply.data) : null
    currentSession(session)
    prior = readSnapshot(session)
    const snapshot = balance || status ? {
      id: session.id,
      balance: balance ? { ...balance, at } : prior?.balance ?? null,
      attendance: status ? { value: status, at } : prior?.attendance ?? null,
    } : prior
    if ((balance || status) && snapshot) {
      try { Storage.set(snapshotKey(session), snapshot, PRIVATE) } catch { /* live data remains usable */ }
    }
    const issue = balanceReply && authExpired(balanceReply) ? "登录已过期，请重新授权"
      : !balance && !status ? "未能读取余额与签到状态"
      : !balance || balance.total === null ? "总余额暂不可用"
      : !status ? "签到状态读取失败"
      : null
    return { snapshot, issue, next: nextRefresh(snapshot, Date.now(), issue !== null) }
  } catch (error) {
    let snapshot = prior
    try { snapshot = readSnapshot(currentSession(initial)) } catch { snapshot = null }
    return { snapshot, issue: safeMessage(error), next: nextRefresh(snapshot, Date.now(), true) }
  }
}
