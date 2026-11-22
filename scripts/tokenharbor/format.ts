// 时间与数值格式化:全部由真实数据计算,iOS 上不依赖 Intl
const BJ = 8 * 3600_000

function parts(iso?: string): string | null {
  const at = Date.parse(String(iso ?? ""))
  if (!Number.isFinite(at)) return null
  return new Date(at + BJ).toISOString()
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—"
  return `${Math.round(Number(v))}%`
}

export function bjShort(iso?: string): string {
  const s = parts(iso)
  return s ? `${s.slice(5, 10).replace("-", "-")} ${s.slice(11, 16)}` : "—"
}

export function bjFull(iso?: string): string {
  const s = parts(iso)
  return s ? `${s.slice(0, 10)} ${s.slice(11, 16)}` : "—"
}

export function ago(iso?: string, now = Date.now()): string {
  const at = Date.parse(String(iso ?? ""))
  if (!Number.isFinite(at)) return "—"
  const min = Math.floor(Math.max(0, now - at) / 60_000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  return `${Math.floor(hour / 24)} 天前`
}

export function untilReset(iso?: string, now = Date.now()): string {
  const at = Date.parse(String(iso ?? ""))
  if (!Number.isFinite(at)) return "—"
  const left = at - now
  if (left <= 0) return "已到重置时刻"
  const min = Math.floor(left / 60_000)
  const day = Math.floor(min / 1440)
  const hour = Math.floor((min % 1440) / 60)
  if (day > 0) return `${day} 天 ${hour} 小时`
  if (hour > 0) return `${hour} 小时 ${min % 60} 分`
  return `${Math.max(1, min)} 分钟`
}
