import { HStack, Image, Script, Spacer, Text, VStack, Widget } from "scripting"
import { listSessions } from "./auth"
import { loadOverview } from "./overview_refresh"
import { AccountOverview, overviewLayout } from "./overview_view"

const BG = "#10243F"
const FG = "#F4F8FF"
const SUB = "#B9CDDE"
const MINT = "#80EDCF"
const SCRIPT_NAME = "WorkBuddy 积分"

function openAccountURL() {
  return Script.createRunSingleURLScheme(SCRIPT_NAME, { account: "list" })
}

function Notice({ title, detail }: { title: string; detail: string }) {
  return <VStack alignment="leading" spacing={8} padding={16}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}
    widgetBackground={BG} widgetURL={openAccountURL()}>
    <HStack spacing={6}>
      <Image systemName="creditcard.fill" font={13} foregroundStyle={MINT} />
      <Text font={12} fontWeight="semibold" foregroundStyle={FG}>WorkBuddy 积分</Text>
    </HStack>
    <Spacer minLength={0} />
    <Text font={15} fontWeight="semibold" foregroundStyle={FG} lineLimit={2}>{title}</Text>
    <Text font={10} foregroundStyle={SUB} lineLimit={3}>{detail}</Text>
    <Spacer minLength={0} />
    <Text font={9} foregroundStyle={MINT}>点此打开账号列表</Text>
  </VStack>
}

async function run() {
  const family = String(Widget.family)
  if (family.startsWith("accessory")) {
    Widget.present(<Text widgetURL={openAccountURL()}>WorkBuddy</Text>)
    return
  }
  // Old widget parameters (including WB numbers) no longer select one account.
  const sessions = listSessions().sort((a, b) => a.slot - b.slot)
  if (!sessions.length) {
    Widget.present(<Notice title="还没有账号" detail="点开账号列表，添加 WorkBuddy 手机号。" />)
    return
  }
  const size = family === "systemSmall" ? "small" : family === "systemMedium" ? "medium" : "large"
  const layout = overviewLayout(sessions.length, Widget.displaySize?.height ?? 0, size)
  if (!layout.fits) {
    Widget.present(<Notice title={`已添加 ${sessions.length} 个账号`} detail="请换大号小组件，一次看全。" />)
    return
  }
  const { rows, next } = await loadOverview(sessions)
  Widget.present(<AccountOverview rows={rows} layout={layout} url={openAccountURL()} />,
    { policy: "after", date: new Date(next) })
}

void run().catch(() => {
  Widget.present(<Notice title="暂时无法加载" detail="请打开账号列表检查账号状态。" />,
    { policy: "after", date: new Date(Date.now() + 10 * 60_000) })
})
