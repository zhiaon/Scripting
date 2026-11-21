import { officialLogin, WorkBuddyError } from "./transport"
import type { Pending } from "./auth"

export function allowedOfficialNavigation(raw: string) {
  if (raw === "about:blank") return true
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false
    return url.hostname === "copilot.tencent.com" || ["workbuddy.cn", "codebuddy.cn"].some(d => url.hostname === d || url.hostname.endsWith(`.${d}`))
  } catch { return false }
}

export async function presentIsolatedLogin(pending: Pending) {
  const target = officialLogin(pending.url, pending.state)
  if (typeof WebViewController === "undefined") throw new WorkBuddyError("api", "本版 Scripting 不支持隔离登录，可改用 Safari 无痕模式")
  try {
    // Every add/re-auth gets an independent WebKit data store. No cookies,
    // webpage contents, SMS codes or form values are read by the script.
    const authPage = new WebViewController({ ephemeral: true })
    try {
      if (authPage.configuration && !authPage.configuration.ephemeral) throw new Error("Isolation unavailable")
      // Apply the documented navigation guard when available. Limit main frame
      // only: verification providers may legitimately use HTTPS subframes.
      if ("onNavigationAction" in authPage) {
        authPage.onNavigationAction = action => {
          if (!action.url) return "cancel"
          if (action.isMainFrame === false && action.targetFrame !== null && action.url.startsWith("https://")) return "allow"
          return allowedOfficialNavigation(action.url) ? "allow" : "cancel"
        }
      }
      if (!(await authPage.loadURL(target))) throw new Error("Could not load login")
      await authPage.present({ fullscreen: false, navigationTitle: "WorkBuddy 官网 · 手机号登录" })
    } finally { authPage.dispose() }
  } catch {
    throw new WorkBuddyError("network", "未能打开隔离登录页。可重试，或使用 Safari 无痕模式授权。")
  }
}
