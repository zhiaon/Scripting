import { Button, HStack, Navigation, NavigationStack, RoundedRectangle, ScrollView, Spacer, Text, VStack, Widget, useState } from "scripting"
import { beginLogin, cancelLogin, finishLogin, labelFor, listSessions, readPending, removeAccount, widgetCode } from "./auth"
import type { Session } from "./auth"
import { clearSnapshot, readSnapshot, refreshSnapshot, safeMessage } from "./balance"
import type { RefreshResult } from "./balance"
import { AccountCard, Hero, ResourceRows, accent, cardBG, muted, pageBG } from "./dashboard"
import { presentIsolatedLogin } from "./login_browser"
import { loadOverview } from "./overview_refresh"

let working = false
function reloadWidgets() { try { Widget.reloadAll() } catch { /* advisory */ } }

export function MainView() {
  const [accounts, setAccounts] = useState(listSessions)
  const [chosen, setChosen] = useState<string | null>(null)
  const [pending, setPending] = useState(readPending)
  const [live, setLive] = useState<{ id: string; generation: string; result: RefreshResult } | null>(null)
  const [busy, setBusy] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const [canUseSafari, setCanUseSafari] = useState(false)
  const dismiss = Navigation.useDismiss()
  const a = accounts.find(item => item.id === chosen) ?? null
  const disabled = !!busy
  const record = a && live && live.id === a.id && live.generation === a.generation ? live.result : null
  const snap = a ? record?.snapshot ?? readSnapshot(a) : null

  function sync() { setAccounts(listSessions()) }

  async function perform(label: string, callback: () => void | Promise<void>) {
    if (working) return
    working = true; setBusy(label); setNote(null)
    try { await callback() }
    catch (error) { setNote(safeMessage(error)) }
    finally { working = false; setBusy(""); setPending(readPending()) }
  }

  async function read(a: Session, passive: boolean) {
    const result = await refreshSnapshot(a, passive)
    setLive({ id: a.id, generation: a.generation, result })
  }

  function pick(s: Session) {
    if (working) return
    setChosen(s.id); setNote(null)
    void perform("读取账号积分…", () => read(s, true))
  }

  async function complete() {
    const previous = listSessions()
    const { session: added, created } = await finishLogin()
    const replaced = previous.find(a => a.id === added.id)
    if (replaced && replaced.generation !== added.generation) clearSnapshot(replaced)
    sync(); setChosen(added.id); setCanUseSafari(false)
    setNote(created ? `已添加 ${labelFor(added)}，其他账号仍然保留。` : `已更新 ${labelFor(added)} 的授权，没有重复添加。`)
    await read(added, false)
    reloadWidgets()
  }

  async function showLogin(reloginId: string | null = null) {
    const p = readPending() ?? await beginLogin(reloginId)
    setPending(p)
    try { await presentIsolatedLogin(p) }
    catch (error) { setCanUseSafari(true); throw error }
    await complete()
  }

  async function useSafari() {
    const p = readPending()
    if (!p) { setNote("授权已过期，请重新点「添加手机号」。"); return }
    if (await Safari.openURL(p.url)) setNote("若官网显示旧账号，请在网页选择其他手机号；授权后返回点「检查授权」。")
    else setNote("打不开 Safari；请重试隔离登录。")
  }

  async function removeSelected(s: Session) {
    if (!(await Dialog.confirm({ title: "移除本机账号", message: `只清除 ${labelFor(s)}（${widgetCode(s)}）在这个脚本内的授权和缓存，不影响其他账号或 WorkBuddy 服务。`, cancelLabel: "取消", confirmLabel: "移除" }))) return
    try { removeAccount(s.id) }
    finally { sync(); reloadWidgets() }
    clearSnapshot(s); setChosen(null); setLive(null)
    setNote(`已移除 ${widgetCode(s)}。原先绑定该编号的卡片不会显示别的账号。`)
  }

  function preview(family: "systemSmall" | "systemMedium" | "systemLarge") {
    return Widget.preview({ family })
  }

  async function refreshAccounts() {
    const sessions = listSessions()
    const result = await loadOverview(sessions, true)
    sync()
    const ok = result.rows.filter(row => row.issue === null && row.snapshot?.balance?.total != null).length
    setNote(ok === sessions.length ? `已更新 ${ok} 个账号` : `已更新 ${ok}/${sessions.length} 个账号，未更新项保留可用缓存`)
    reloadWidgets()
  }

  const btn = (label: string, icon: string, work: () => void, prominent = false) => <Button
    title={label} systemImage={icon} buttonStyle={prominent ? "borderedProminent" : "bordered"} controlSize="regular" action={work} disabled={disabled}
  />
  const banner = busy || note || record?.issue

  return <NavigationStack>
    <ScrollView background={pageBG} navigationTitle={a ? "账号详情" : "WorkBuddy 积分"} navigationBarTitleDisplayMode="inline" toolbar={{
      cancellationAction: <Button title={a ? "账号列表" : "关闭"} action={a ? () => { setChosen(null); setNote(null) } : dismiss} disabled={disabled} />,
    }}>
      <VStack spacing={19} alignment="leading" padding={{ horizontal: 16, top: 12, bottom: 26 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {a || !accounts.length ? <Hero a={a} snapshot={snap} count={accounts.length} issue={record?.issue ?? null} /> : null}
        {banner ? <VStack alignment="leading" spacing={4} padding={11} frame={{ maxWidth: "infinity", alignment: "leading" }} background={<RoundedRectangle cornerRadius={12} fill={cardBG} />}>
          <Text font={12} foregroundStyle={accent}>{banner}</Text>
          {note && record?.issue && !busy ? <Text font={11} foregroundStyle={muted}>{record.issue}</Text> : null}
        </VStack> : null}
        {pending ? <VStack alignment="leading" spacing={9}>
          <Text font={15} fontWeight="semibold">待完成官网授权</Text>
          <Text font={12} foregroundStyle={muted}>在网页确认后返回。添加新号码不会退出已有账号。</Text>
          <HStack spacing={8}>
            {btn("继续登录", "person.crop.circle", () => void perform("打开官网登录…", () => showLogin(pending.reloginId)), true)}
            {btn("检查授权", "checkmark", () => void perform("检查授权…", complete))}
          </HStack>
          <HStack spacing={8}>
            {canUseSafari ? btn("用 Safari 打开", "safari", () => void perform("正在打开…", useSafari)) : null}
            {btn("取消本次", "xmark", () => void perform("取消授权…", () => { cancelLogin(); setCanUseSafari(false) }))}
          </HStack>
        </VStack> : null}
        {a ? <VStack alignment="leading" spacing={13}>
          <HStack spacing={8}>
            {btn("刷新积分", "arrow.clockwise", () => void perform("刷新此账号…", async () => { await read(a, false); reloadWidgets() }), true)}
          </HStack>
          <ResourceRows snapshot={snap} />
          <Text font={11} foregroundStyle={muted}>账号编号：{widgetCode(a)}。时间采用北京时间；此处只显示该账号的数据。</Text>
          {!pending ? btn("重新授权此号", "person.badge.key", () => void perform("打开官网登录…", () => showLogin(a.id))) : null}
          <Button title="移除此账号" role="destructive" action={() => void perform("等待确认…", () => removeSelected(a))} disabled={disabled} />
        </VStack> : <VStack alignment="leading" spacing={12}>
          {accounts.length ? <HStack>
            <VStack alignment="leading" spacing={4}>
              <Text font={24} fontWeight="bold">账号列表</Text>
              <Text font={12} foregroundStyle={muted}>{accounts.length} 个手机号授权 · 点账号看明细</Text>
            </VStack>
            <Spacer minLength={4} />
          </HStack> : null}
          {!pending ? btn(accounts.length ? "添加手机号" : "手机号登录", "person.badge.plus", () => void perform("打开官网登录…", () => showLogin()), true) : null}
          {accounts.length ? btn("刷新全部", "arrow.clockwise", () => void perform("正在更新各账号积分…", refreshAccounts)) : null}
          {accounts.map(s => <AccountCard key={s.id} a={s} snapshot={readSnapshot(s)} onPick={() => pick(s)} />)}
          <Text font={12} foregroundStyle={muted}>每个号码在官网分别授权。脚本只查询，不领签到奖励；只保留手机号尾号。</Text>
        </VStack>}
        <VStack alignment="leading" spacing={8}>
          <Text font={16} fontWeight="semibold">桌面卡片</Text>
          <HStack spacing={8}>
            {btn("预览小号", "square", () => void perform("打开预览…", () => preview("systemSmall")))}
            {btn("预览中号", "rectangle", () => void perform("打开预览…", () => preview("systemMedium")))}
          </HStack>
          {btn("预览大号 · 全部账号", "rectangle.portrait", () => void perform("打开大号预览…", () => preview("systemLarge")), true)}
          <Text font={11} foregroundStyle={muted}>桌面卡片自动显示已添加的账号，不需设置参数。小号或中号放不下时请用大号；点卡片进入账号列表。</Text>
        </VStack>
      </VStack>
    </ScrollView>
  </NavigationStack>
}
