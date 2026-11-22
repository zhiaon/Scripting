// 本地真实用量历史:只记录实际拉取到的额度快照,不生成任何推测数据
type Snapshot = { used_percent?: number; reset_at?: string; fetched_at?: string }

const KEY = "quota.history.v2"
const KEEP = 8
const OPT = { shared: false }

export type DayRecord = { day: string; window: string; first: number; last: number }
type Store = { days: DayRecord[] }

function dayOf(ms: number): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10)
}

export function readStore(): Store {
  try {
    const v = Storage.get<Store>(KEY, OPT)
    if (v && Array.isArray(v.days)) {
      const days = v.days.filter(
        (d) =>
          !!d &&
          typeof d.day === "string" &&
          typeof d.window === "string" &&
          Number.isFinite(d.first) &&
          Number.isFinite(d.last)
      )
      return { days }
    }
  } catch {
    /* 读取失败按无历史处理 */
  }
  return { days: [] }
}

export function record(data: Snapshot, now = Date.now()): void {
  const used = Number(data?.used_percent)
  if (!Number.isFinite(used)) return
  const parsed = Date.parse(String(data?.fetched_at ?? ""))
  const ms = Number.isFinite(parsed) ? parsed : now
  const day = dayOf(ms)
  const window = String(data?.reset_at ?? "")
  const store = readStore()
  const found = store.days.find((d) => d.day === day)
  if (found && found.window === window) {
    found.last = used
  } else {
    if (found) store.days = store.days.filter((d) => d !== found)
    store.days.push({ day, window, first: used, last: used })
  }
  store.days.sort((a, b) => (a.day < b.day ? -1 : 1))
  if (store.days.length > KEEP) store.days = store.days.slice(-KEEP)
  try {
    Storage.set(KEY, store, OPT)
  } catch {
    /* 写入失败不影响本次展示 */
  }
}

export type TrendPoint = { label: string; value: number }

// 近 7 天每日已用额度变化(百分点),仅覆盖有观测记录的日期
export function trend(now = Date.now()): { points: TrendPoint[]; ok: boolean } {
  const store = readStore()
  const points: TrendPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const day = dayOf(now - i * 86400_000)
    const rec = store.days.find((d) => d.day === day)
    if (!rec || rec.window !== store.days.find((d) => d.day === day)?.window) continue
    points.push({ label: day.slice(5).replace("-", "/"), value: Math.max(0, +(rec.last - rec.first).toFixed(2)) })
  }
  return { points, ok: points.length >= 2 }
}
