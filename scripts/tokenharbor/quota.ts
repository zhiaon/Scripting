import { fetch } from "scripting"

const KEY = "cpa.client.v1", CACHE = "quota.last.v1"
const local = { synchronizable: false, accessibility: "first_unlock_this_device" as const }
const endpoint = "https://cpa.zhiaon.top/v1/tokenharbor/quota"
export type Quota = { window_days: number; used_percent: number; remaining_percent: number; fetched_at: string; reset_at: string }
export type Result = { data: Quota | null; label: string }
type Login = { key: string; id: string }
function login(): Login | null {
  const raw = Keychain.get(KEY, local)
  if (!raw) return null
  const v = JSON.parse(raw)
  if (typeof v.key !== 'string' || !v.key || typeof v.id !== 'string' || !v.id) throw Error('无法读取本机 Key')
  return v
}
export function validate(v: Quota, now = Date.now()) {
  const pct = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100
  const iso = (s: string) => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s))
  if (!v || v.window_days !== 7 || !pct(v.used_percent) || !pct(v.remaining_percent) || Math.abs(v.used_percent+v.remaining_percent-100)>0.000001 || !iso(v.reset_at) || !iso(v.fetched_at)) return false
  const end=Date.parse(v.reset_at), at=Date.parse(v.fetched_at)
  return end>now && end>at && at<=now+60_000 && now-at<6*3600_000
}
export function bj(s: string) { return new Date(Date.parse(s)+8*3600_000).toISOString().slice(0,16).replace('T',' ') }
export function percent(n: number) { return `${Number(n.toFixed(2))}%` }
function cached(a: Login): Quota | null {
  const c = Storage.get<{id:string;data:Quota}>(CACHE)
  return c?.id===a.id && validate(c.data) ? c.data : null
}
class BadKey extends Error {}
async function query(key: string): Promise<Quota> {
  const r = await fetch(endpoint, { method:'GET', headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}, timeout:8,
    handleRedirect:async()=>null, shouldAllowRedirect:async()=>false })
  if (r.status===401 || r.status===403) throw new BadKey()
  if (r.status!==200) throw Error('额度接口暂不可用')
  const v = JSON.parse(await r.text()) as Quota
  if (!validate(v)) throw Error('额度数据无效')
  return v
}
export async function setKey(raw: string): Promise<Result> {
  const key=raw.trim()
  if (!/^[\x21-\x7e]{1,1024}$/.test(key)) return {data:null,label:'Key 格式无效'}
  let data: Quota
  try { data=await query(key) } catch(e) { return {data:null,label:e instanceof BadKey?'Key 未通过 CPA 验证':'无法验证 Key，未更改授权'} }
  const id=Crypto.generateSymmetricKey(128).toHexString()
  if (!Keychain.set(KEY,JSON.stringify({key,id}),local)) return {data:null,label:'钥匙串保存失败'}
  Storage.set(CACHE,{id,data})
  return {data,label:'已更新'}
}
export async function load(force=false): Promise<Result> {
  let a:Login|null
  try { a=login() } catch {return {data:null,label:'钥匙串暂不可读'}}
  if (!a) return {data:null,label:'尚未配置客户端 Key'}
  const last=cached(a)
  if (!force && last && Date.now()-Date.parse(last.fetched_at)<10*60_000) return {data:last,label:'最近记录'}
  try {
    const data=await query(a.key)
    if (login()?.id!==a.id) return {data:null,label:'客户端 Key 已变更'}
    Storage.set(CACHE,{id:a.id,data}); return {data,label:'已更新'}
  } catch(e) {
    if (login()?.id!==a.id) return {data:null,label:'客户端 Key 已变更'}
    if(e instanceof BadKey) {Storage.remove(CACHE);return {data:null,label:'Key 已失效，请重新配置'}}
    const c=cached(a);return {data:c,label:c?'查询失败 · 缓存':'暂时无法查询额度'}
  }
}
