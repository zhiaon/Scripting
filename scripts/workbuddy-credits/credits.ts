export type Dict = Record<string, unknown>
export type Resource = { label: string; amount: number; cycleEnd: number | null; isCheckin: boolean }
export type Ledger = { total: number | null; checkin: number | null; nextExpiry: number | null; items?: Resource[] }
export type Attendance = { state: "signed" | "unsigned" | "closed"; amount: number | null; streak?: number }

export function object(x: unknown): Dict | null {
  return x !== null && typeof x === "object" && !Array.isArray(x) ? x as Dict : null
}

export function text(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null
}

export function credits(x: unknown): number | null {
  if (typeof x !== "number" && !(typeof x === "string" && /^\d+(?:\.\d+)?$/.test(x.trim()))) return null
  const n = Number(x)
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : null
}

// The raw resource response uses UTC for unzoned CycleEndTime.
export function instant(x: unknown): number | null {
  if (x == null || x === "") return null
  if (typeof x === "number" || (typeof x === "string" && /^\d+(?:\.\d+)?$/.test(x.trim()))) {
    const n = Number(x)
    return n > 0 && n < 1e14 ? (n < 1e11 ? n * 1000 : n) : null
  }
  const s = text(x)?.replace(" ", "T")
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/i.test(s)) return null
  const n = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(s) ? s : s + "Z")
  return Number.isFinite(n) && n > 0 ? n : null
}

const BJT = 8 * 3_600_000
export const dayInChina = (ms: number) => new Date(ms + BJT).toISOString().slice(0, 10)
export const nextDayInChina = (ms: number) => (Math.floor((ms + BJT) / 86_400_000) + 1) * 86_400_000 - BJT

export function parseAttendance(data: Dict): Attendance | null {
  if (data.active === false) return { state: "closed", amount: null }
  if (data.active !== true || typeof data.today_checked_in !== "boolean") return null
  const streak = credits(data.streak_days)
  return data.today_checked_in
    ? { state: "signed", amount: credits(data.today_credit), ...(streak !== null ? { streak: Math.floor(streak) } : {}) }
    : { state: "unsigned", amount: credits(data.daily_credit) }
}

function labelIsCheckin(value: string | null): boolean {
  if (!value || /非签到|非簽到/.test(value)) return false
  return /签到|簽到|\bcheck[\s_-]*in\b|\bsign[\s_-]*in\s+(?:reward|credits?)\b/i.test(value)
}

// Summary is only an optional PackageCode→label lookup. Never add its amounts a second time.
export function packageNames(data: Dict): ReadonlyMap<string, string> {
  const labels = new Map<string, string>()
  const conflicts = new Set<string>()
  for (const item of (Array.isArray(data.Packages) ? data.Packages : [])) {
    const row = object(item)
    const code = text(row?.PackageCode), name = text(row?.PackageName)
    if (!code || !name || conflicts.has(code)) continue
    if (labels.has(code) && labels.get(code) !== name) {
      labels.delete(code)
      conflicts.add(code)
    } else labels.set(code, name)
  }
  return labels
}

export function parseLedger(data: Dict, now: number, names = new Map<string, string>() as ReadonlyMap<string, string>): Ledger | null {
  const response = object(data.Response)
  // Do not mistake a failed nested response for an empty balance.
  if (response?.Error != null) return null
  const rows = object(response?.Data)?.Accounts
  if (!Array.isArray(rows)) return null
  let sawCredits = false, totalReliable = true, signReliable = true, sawSign = false
  let total = 0, checkin = 0, nextExpiry: number | null = null
  const unique = new Set<string>(), items: Resource[] = []
  for (const item of rows) {
    const row = object(item), unit = text(row?.CapacityUnit)
    if (!row || !unit) { totalReliable = false; continue }
    if (unit.toLowerCase() !== "credits") continue
    sawCredits = true
    const code = text(row.PackageCode)
    const isSign = labelIsCheckin(text(row.PackageName)) || (code !== null && labelIsCheckin(names.get(code) ?? null))
    if (isSign) sawSign = true
    const expires = instant(row.CycleEndTime)
    if (row.Status === 3 || row.Status === "3" || (expires !== null && expires <= now)) continue
    if (row.CycleEndTime != null && row.CycleEndTime !== "" && expires === null) {
      totalReliable = false
      if (isSign) signReliable = false
      continue
    }
    const remaining = credits(row.CycleCapacityRemainPrecise ?? row.CycleCapacityRemain)
    if (remaining === null) {
      totalReliable = false
      if (isSign) signReliable = false
      continue
    }
    // AccountId/ResourceId, if present, identify distinct resource instances. PackageCode
    // alone does not: different grants may use the same package. Collapse only exact rows
    // with an explicit instance ID (including cycle and value), otherwise preserve rows.
    const rowId = text(row.AccountId) ?? text(row.ResourceId)
    const duplicateKey = rowId ? JSON.stringify([rowId, code, expires, remaining]) : null
    if (duplicateKey && unique.has(duplicateKey)) continue
    if (duplicateKey) unique.add(duplicateKey)
    total += remaining
    if (isSign) checkin += remaining
    if (expires !== null && remaining > 0) nextExpiry = Math.min(nextExpiry ?? expires, expires)
    if (items.length < 24) {
      const label = (text(row.PackageName) ?? (code ? names.get(code) : undefined) ?? `积分包 ${items.length + 1}`)
        .replace(/[\x00-\x1f\x7f]/g, " ").replace(/1\d{10}/g, "[号码已隐藏]").slice(0, 44)
      items.push({ label, amount: remaining, cycleEnd: expires, isCheckin: isSign })
    }
  }
  if (!sawCredits) return null
  return {
    total: totalReliable ? credits(total) : null,
    checkin: sawSign && signReliable ? credits(checkin) : null,
    nextExpiry,
    items,
  }
}

export function formatCredits(amount: number | null | undefined) {
  if (amount == null) return "—"
  if (amount > 0 && amount < 0.01) return "<0.01"
  return amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

export function attendanceText(value: Attendance | null | undefined) {
  if (!value) return "签到状态未知"
  if (value.state === "closed") return "签到活动未开放"
  const verb = value.state === "signed" ? "今日已签到" : "今日未签到"
  return value.amount === null ? verb : `${verb} · ${value.state === "signed" ? "已领" : "可领"} ${formatCredits(value.amount)}`
}

export function chinaTime(ms: number): string {
  const iso = new Date(ms + BJT).toISOString()
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}
