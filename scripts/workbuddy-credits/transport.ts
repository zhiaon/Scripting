import { fetch } from "scripting"
import { object } from "./credits"
import type { Dict } from "./credits"

const API = "https://copilot.tencent.com"
const VERSION = "5.9.3"
const RELEASE = "2.0.0"
const routes = {
  start: { method: "POST", path: "/v2/plugin/auth/state?platform=workbuddy", host: "https://www.workbuddy.cn" },
  exchange: { method: "GET", path: "/v2/plugin/auth/token", host: "https://www.workbuddy.cn" },
  account: { method: "GET", path: "/v2/plugin/login/account", host: API },
  renew: { method: "POST", path: "/v2/plugin/auth/token/refresh", host: API },
  balance: { method: "POST", path: "/v2/billing/meter/get-user-resource", host: API },
  packageNames: { method: "POST", path: "/billing/meter/get-user-resource-summary", host: API },
  attendance: { method: "POST", path: "/v2/billing/meter/checkin-activity-status", host: API },
} as const

type Route = keyof typeof routes
export type Reply = { status: number; code: number | null; data: Dict | null }
export type HeaderMap = Record<string, string>

export class WorkBuddyError extends Error {
  constructor(readonly kind: "network" | "auth" | "api" | "storage" | "pending", message: string) {
    super(message)
    this.name = "WorkBuddyError"
  }
}

export const authExpired = (r: Reply) => r.status === 401 || r.code === 401
export const accepted = (r: Reply) => r.status >= 200 && r.status < 300 && r.code === 0 && r.data !== null
export const pendingLogin = (r: Reply) => r.code === 11217 || r.code === 12151
export const noIdentity = { "X-No-User-Id": "true", "X-No-Enterprise-Id": "true", "X-No-Department-Info": "true" }
export const anonymous = { ...noIdentity, "X-No-Authorization": "true" }

export function randomIdentifier() {
  return Crypto.generateSymmetricKey(128).toHexString().slice(0, 32)
}

export function officialLogin(raw: string, state: string, fresh = false): string {
  let url: URL
  try { url = new URL(raw) } catch { throw new WorkBuddyError("api", "WorkBuddy 返回的登录地址无效") }
  if (url.origin !== "https://www.workbuddy.cn" || url.pathname !== "/login" || url.username || url.password ||
      url.searchParams.getAll("state").length !== 1 || url.searchParams.get("state") !== state) {
    throw new WorkBuddyError("api", "登录地址未通过官网校验，已停止")
  }
  if (fresh) {
    url.searchParams.set("version", RELEASE)
    url.searchParams.set("loginSessionId", randomIdentifier())
  }
  return url.toString()
}

export async function request(route: Route, headers: HeaderMap = {}, state?: string, timeout = 12): Promise<Reply> {
  const cfg = routes[route]
  const url = cfg.host + cfg.path + (state === undefined ? "" : `?state=${encodeURIComponent(state)}`)
  try {
    const response = await fetch(url, {
      method: cfg.method,
      headers: {
        Accept: "application/json", "Content-Type": "application/json", "User-Agent": `WorkBuddy/${VERSION}`,
        ...headers,
      },
      ...(cfg.method === "POST" ? { body: "{}" } : {}),
      // An upstream redirect must not forward a user's login or bearer token.
      handleRedirect: async () => null,
      timeout,
    })
    const raw = await response.text()
    let envelope: Dict | null = null
    if (raw && raw.length <= 524_288) {
      try { envelope = object(JSON.parse(raw)) } catch { /* do not log the upstream body */ }
    }
    const c = envelope?.code
    const numeric = typeof c === "number" ? c : typeof c === "string" && /^-?\d{1,8}$/.test(c) ? Number(c) : NaN
    return { status: response.status, code: Number.isSafeInteger(numeric) ? numeric : null, data: object(envelope?.data) }
  } catch {
    throw new WorkBuddyError("network", "连接 WorkBuddy 失败，请检查网络后重试")
  }
}

export function requireData(r: Reply, action: string): Dict {
  if (accepted(r)) return r.data!
  if (authExpired(r)) throw new WorkBuddyError("auth", "WorkBuddy 登录已过期，请重新授权")
  const suffix = r.code !== null && r.code !== 0 ? `（${r.code}）` : r.status !== 200 ? `（HTTP ${r.status}）` : ""
  throw new WorkBuddyError("api", `${action}失败${suffix}`)
}
