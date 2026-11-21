import { credits, object, text } from "./credits"
import type { Dict } from "./credits"
import { accepted, anonymous, authExpired, noIdentity, officialLogin, pendingLogin, randomIdentifier, request, requireData, WorkBuddyError } from "./transport"
import type { HeaderMap } from "./transport"

const DEVICE_ONLY = { accessibility: "first_unlock_this_device" as const, synchronizable: false }
const PENDING = "wb.widget.pending.v1"
const LEGACY_SESSION = "wb.widget.session.v1"
const REGISTRY = "wb.widget.accounts.v2"
const SESSION_PREFIX = "wb.widget.account.v2."
const MAX_ACCOUNTS = 20
const LOGIN_TTL = 10 * 60_000
const DEFAULT_DOMAIN = "copilot.tencent.com"

type Tokens = { access: string; refresh: string | null; expires: number | null; refreshExpires: number | null; domain: string }
export type Session = Tokens & { id: string; slot: number; generation: string; uid: string; enterprise: string | null; phoneTail: string | null }
export type Pending = { state: string; url: string; at: number; tokens: Tokens | null; reloginId: string | null }
type AccountRef = { id: string; slot: number; generation: string; legacy?: boolean }
type Registry = { nextSlot: number; defaultId: string | null; accounts: AccountRef[] }
export type LoginResult = { session: Session; created: boolean }

function load(key: string): Dict | null {
  try {
    const raw = Keychain.get(key, DEVICE_ONLY)
    return raw ? object(JSON.parse(raw)) : null
  } catch { return null }
}

function save(key: string, value: object) {
  if (!Keychain.set(key, JSON.stringify(value), DEVICE_ONLY)) {
    throw new WorkBuddyError("storage", "无法写入本机钥匙串，请解锁手机后重试")
  }
}

function remove(key: string) {
  if (!Keychain.remove(key, DEVICE_ONLY)) throw new WorkBuddyError("storage", "未能清除本机授权，请重试")
}

function atom(value: unknown): string | null {
  const s = text(value)
  return s && /^[\x21-\x7e]{1,8192}$/.test(s) ? s : null
}

function normalizedDomain(value: unknown): string | null {
  const s = text(value)?.toLowerCase()
  return s && s.length <= 253 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(s) ? s : null
}

function storedTokens(value: Dict | null): Tokens | null {
  const access = atom(value?.access), domain = normalizedDomain(value?.domain)
  if (!access || !domain) return null
  return { access, domain, refresh: atom(value?.refresh), expires: credits(value?.expires), refreshExpires: credits(value?.refreshExpires) }
}

function absoluteExpiry(absolute: unknown, relative: unknown, now: number) {
  const exp = credits(absolute)
  if (exp !== null && exp > 0) return exp < 1e11 ? exp * 1000 : exp
  const seconds = credits(relative)
  return seconds === null ? null : now + seconds * 1000
}

function parseTokens(data: Dict, old?: Tokens): Tokens {
  const access = atom(data.accessToken)
  const domain = data.domain == null || data.domain === "" ? old?.domain ?? DEFAULT_DOMAIN : normalizedDomain(data.domain)
  const type = text(data.tokenType)
  const refresh = atom(data.refreshToken) ?? old?.refresh ?? null
  if (!access || !domain || (type && type.toLowerCase() !== "bearer") ||
      (data.refreshToken != null && data.refreshToken !== "" && !atom(data.refreshToken))) {
    throw new WorkBuddyError("api", "WorkBuddy 返回的登录凭据格式异常")
  }
  const now = Date.now()
  return {
    access, domain, refresh,
    expires: absoluteExpiry(data.expiresAt, data.expiresIn, now),
    refreshExpires: absoluteExpiry(data.refreshExpiresAt, data.refreshExpiresIn, now)
      ?? (refresh === old?.refresh ? old?.refreshExpires ?? null : null),
  }
}

function validId(value: unknown): string | null {
  const id = text(value)
  return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null
}

function registry(): Registry {
  let raw: string | null | undefined
  try {
    raw = Keychain.get(REGISTRY, DEVICE_ONLY)
    // The native bridge can return undefined, null or empty for a missing key.
    // A present but unreadable registry must not be replaced by a legacy list.
    if ((raw == null || raw === "") && typeof Keychain.contains === "function" && Keychain.contains(REGISTRY, DEVICE_ONLY)) {
      throw new Error("Registry is present but unreadable")
    }
  } catch { throw new WorkBuddyError("storage", "无法读取本机账号，请解锁后重试") }
  if (raw == null || raw === "") {
    // Read the original credential in-place until an account-list edit. Do not
    // copy, erase, or silently replace the user's existing authorization.
    const old = load(LEGACY_SESSION)
    const id = validId(old?.id)
    if (id && storedTokens(old) && atom(old?.uid)) {
      return { nextSlot: 2, defaultId: id, accounts: [{ id, slot: 1, generation: "legacy", legacy: true }] }
    }
    return { nextSlot: 1, defaultId: null, accounts: [] }
  }
  try {
    const d = object(JSON.parse(raw))
    const nextSlot = d?.nextSlot
    if (!d || !Array.isArray(d.accounts) || d.accounts.length > MAX_ACCOUNTS ||
        typeof nextSlot !== "number" || !Number.isSafeInteger(nextSlot) || nextSlot < 1) throw new Error()
    const seenIds = new Set<string>(), seenSlots = new Set<number>()
    const accounts = d.accounts.map((x: unknown): AccountRef => {
      const r = object(x), id = validId(r?.id), generation = validId(r?.generation), slot = r?.slot
      if (!id || !generation || typeof slot !== "number" || !Number.isSafeInteger(slot) || slot < 1 ||
          slot >= nextSlot || seenIds.has(id) || seenSlots.has(slot)) throw new Error()
      seenIds.add(id); seenSlots.add(slot)
      return { id, slot, generation, ...(r?.legacy === true ? { legacy: true } : {}) }
    }).sort((a, b) => a.slot - b.slot)
    const defaultId = validId(d.defaultId)
    if (accounts.length ? !defaultId || !seenIds.has(defaultId) : d.defaultId !== null) throw new Error()
    return { accounts, nextSlot, defaultId }
  } catch {
    throw new WorkBuddyError("storage", "账号列表无法读取；已保留现有授权，未覆盖")
  }
}

function credentialKey(ref: AccountRef): string {
  return ref.legacy ? LEGACY_SESSION : `${SESSION_PREFIX}${ref.id}.${ref.generation}`
}

function sessionFor(ref: AccountRef): Session | null {
  const data = load(credentialKey(ref)), tokens = storedTokens(data)
  const uid = atom(data?.uid)
  if (!tokens || data?.id !== ref.id || !uid) return null
  const tail = text(data?.phoneTail)
  return { ...tokens, id: ref.id, slot: ref.slot, generation: ref.generation, uid,
    enterprise: atom(data?.enterprise), phoneTail: tail && /^\d{4}$/.test(tail) ? tail : null }
}

export function readSession(id?: string): Session | null {
  const list = registry()
  const ref = list.accounts.find(a => a.id === (id === undefined ? list.defaultId : id))
  return ref ? sessionFor(ref) : null
}

export function listSessions(): Session[] {
  return registry().accounts.flatMap(ref => {
    const session = sessionFor(ref)
    return session ? [session] : []
  })
}

export const labelFor = (a: Session) => a.phoneTail ? `尾号 ${a.phoneTail}` : `账号 ${a.slot}`
export const widgetCode = (a: Session) => `WB${a.slot}`

export function setDefaultAccount(id: string) {
  const r = registry()
  const ref = r.accounts.find(x => x.id === id)
  if (!ref || !sessionFor(ref)) throw new WorkBuddyError("auth", "这个账号不可用，请返回账号列表")
  if (id !== r.defaultId) save(REGISTRY, { ...r, defaultId: id })
}

export function removeAccount(id: string) {
  const r = registry(), ref = r.accounts.find(x => x.id === id)
  if (!ref) return
  const accounts = r.accounts.filter(x => x.id !== id)
  // Publish removal first: even a late refresh cannot relink the removed account.
  save(REGISTRY, { ...r, accounts, defaultId: id === r.defaultId ? accounts[0]?.id ?? null : r.defaultId })
  if (readPending()?.reloginId === id) cancelLogin()
  remove(credentialKey(ref))
}

function sameAccount(a: Session, b: Pick<Session, "uid" | "enterprise">): boolean {
  // v1 and v2 are both domestic. UID and tenant, not tail digits or a
  // potentially changing token domain, are the account identity.
  return a.uid === b.uid && a.enterprise === b.enterprise
}

export function readPending(): Pending | null {
  const v = load(PENDING)
  const state = atom(v?.state), raw = text(v?.url), at = credits(v?.at)
  if (!state || !raw || at === null || at > Date.now() || Date.now() - at >= LOGIN_TTL) return null
  try { return { state, url: officialLogin(raw, state), at, tokens: storedTokens(object(v?.tokens)), reloginId: validId(v?.reloginId) } }
  catch { return null }
}

export function cancelLogin() { remove(PENDING) }

export async function beginLogin(reloginId: string | null = null): Promise<Pending> {
  const r = registry()
  if (reloginId && !readSession(reloginId)) throw new WorkBuddyError("auth", "指定账号已移除，无法重新授权")
  if (!reloginId && r.accounts.length >= MAX_ACCOUNTS) throw new WorkBuddyError("storage", `最多可添加 ${MAX_ACCOUNTS} 个账号`)
  const data = requireData(await request("start", { ...anonymous, "X-Requested-With": "XMLHttpRequest" }), "创建官网授权")
  const state = atom(data.state), url = text(data.authUrl)
  if (!state || !url) throw new WorkBuddyError("api", "官网没有返回完整的授权信息")
  const pending: Pending = { state, url: officialLogin(url, state, true), at: Date.now(), tokens: null, reloginId }
  save(PENDING, pending)
  return pending
}

function assertPending(expected: Pending) {
  if (readPending()?.state !== expected.state) throw new WorkBuddyError("pending", "这次授权已取消或过期，请重新打开登录页")
}

export async function finishLogin(): Promise<LoginResult> {
  const pending = readPending()
  if (!pending) throw new WorkBuddyError("pending", "授权已过期，请重新打开登录页")
  let tokens = pending.tokens
  if (!tokens) {
    const response = await request("exchange", anonymous, pending.state)
    assertPending(pending)
    if (pendingLogin(response) || (accepted(response) && !text(response.data?.accessToken))) {
      throw new WorkBuddyError("pending", "尚未收到官网授权。请在网页完成登录并确认，再点「检查授权」。")
    }
    tokens = parseTokens(requireData(response, "读取官网授权"))
    save(PENDING, { ...pending, tokens })
  }
  const reply = await request("account", { ...noIdentity, Authorization: `Bearer ${tokens.access}`, "X-Domain": tokens.domain }, pending.state)
  assertPending(pending)
  if (pendingLogin(reply)) throw new WorkBuddyError("pending", "官网还在准备账号信息，请稍后点「检查授权」。")
  const profile = requireData(reply, "读取已授权账号")
  const uid = atom(profile.uid)
  const enterprise = atom(profile.enterpriseId)
  if (!uid) throw new WorkBuddyError("api", "WorkBuddy 未返回当前账号，未保存授权")
  if ((text(profile.type) ?? "personal").toLowerCase() !== "personal" && !enterprise) {
    throw new WorkBuddyError("api", "无法确认组织账号的积分归属。请在官网选择个人账号。")
  }
  const phone = text(profile.phoneNumber)
  const phoneTail = phone?.match(/^(?:\+?86[ -]?)?1\d\d(?:\d{4}|\*{4})(\d{4})$/)?.[1] ?? null
  const r = registry()
  const accountList = r.accounts.map(ref => ({ ref, session: sessionFor(ref) }))
  // An unreadable item must not be silently treated as a new/duplicate account.
  if (accountList.some(a => a.session === null)) throw new WorkBuddyError("storage", "部分现有授权暂不可读；没有新增或覆盖账号")
  const existing = accountList.find(a => a.session && sameAccount(a.session, { uid, enterprise }))
  if (pending.reloginId && existing?.ref.id !== pending.reloginId) {
    cancelLogin()
    throw new WorkBuddyError("auth", "官网登录的不是此账号，原授权未改动。请用对应手机号，或选择「添加手机号」。")
  }
  if (!existing && r.accounts.length >= MAX_ACCOUNTS) throw new WorkBuddyError("storage", `最多可添加 ${MAX_ACCOUNTS} 个账号`)
  const ref: AccountRef = { id: existing?.ref.id ?? randomIdentifier(), slot: existing?.ref.slot ?? r.nextSlot, generation: randomIdentifier() }
  const session: Session = { ...tokens, ...ref, uid, enterprise, phoneTail: phoneTail ?? existing?.session?.phoneTail ?? null }
  save(credentialKey(ref), session)
  try {
    save(REGISTRY, {
      nextSlot: existing ? r.nextSlot : r.nextSlot + 1,
      defaultId: r.defaultId ?? ref.id,
      accounts: existing ? r.accounts.map(a => a.id === ref.id ? ref : a) : [...r.accounts, ref],
    })
  } catch (error) {
    try { remove(credentialKey(ref)) } catch { /* unpublished item is unreachable */ }
    throw error
  }
  // New generation is committed; old in-flight reads cannot overwrite it.
  if (existing) try { remove(credentialKey(existing.ref)) } catch { /* obsolete item is unreachable */ }
  try { cancelLogin() } catch { /* pending expires on its own */ }
  return { session, created: !existing }
}

export function meterHeaders(session: Session): HeaderMap {
  return {
    Authorization: `Bearer ${session.access}`, "X-User-Id": session.uid, "X-Domain": session.domain,
    "X-Product": "SaaS", "X-IDE-Type": "WorkBuddy",
    ...(session.enterprise ? { "X-Enterprise-Id": session.enterprise, "X-Tenant-Id": session.enterprise } : {}),
  }
}

export function currentSession(expected: Session): Session {
  const current = readSession(expected.id)
  if (!current || current.generation !== expected.generation) {
    throw new WorkBuddyError("auth", "此账号的授权已变更，请重新打开脚本")
  }
  return current
}

const renewing = new Map<string, Promise<Session>>()
export async function renewSession(expected: Session, timeout: number): Promise<Session> {
  const current = currentSession(expected)
  if (current.access !== expected.access) return current
  const renewId = `${current.id}.${current.generation}`
  const running = renewing.get(renewId)
  if (running) return running
  if (!current.refresh || (current.refreshExpires != null && current.refreshExpires <= Date.now())) {
    throw new WorkBuddyError("auth", "WorkBuddy 登录已过期，请重新授权")
  }
  const promise = (async () => {
    const reply = await request("renew", {
      "X-Refresh-Token": current.refresh!, "X-Auth-Refresh-Source": "plugin", "X-Domain": current.domain,
      ...(current.enterprise ? { "X-Enterprise-Id": current.enterprise, "X-Tenant-Id": current.enterprise } : {}),
    }, undefined, timeout)
    const latest = currentSession(current)
    if (latest.access !== current.access || latest.refresh !== current.refresh) return latest
    if (authExpired(reply) || reply.status === 403) throw new WorkBuddyError("auth", "WorkBuddy 登录已失效，请重新授权")
    const data = requireData(reply, "续期授权")
    const tokens = parseTokens(data, current)
    if (tokens.domain !== current.domain || (data.uid != null && atom(data.uid) !== current.uid) ||
      (data.enterpriseId != null && atom(data.enterpriseId) !== current.enterprise)) {
      throw new WorkBuddyError("auth", "授权账号信息有变化，请重新登录确认")
    }
    const session = { ...current, ...tokens }
    const refs = registry().accounts
    const ref = refs.find(a => a.id === current.id && a.generation === current.generation)
    if (!ref) throw new WorkBuddyError("auth", "此账号的授权已变更，请重新打开脚本")
    save(credentialKey(ref), session)
    try { return currentSession(session) }
    catch (error) {
      try { remove(credentialKey(ref)) } catch { /* an obsolete item is not addressable */ }
      throw error
    }
  })()
  renewing.set(renewId, promise)
  try { return await promise } finally { if (renewing.get(renewId) === promise) renewing.delete(renewId) }
}
