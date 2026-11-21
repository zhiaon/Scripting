import { Button, HStack, Image, RoundedRectangle, Spacer, Text, VStack } from "scripting"
import { labelFor, widgetCode } from "./auth"
import type { Session } from "./auth"
import { snapshotText } from "./balance"
import type { Snapshot } from "./balance"
import { chinaTime, formatCredits } from "./credits"

export const pageBG = { light: "#EEF3F8", dark: "#0D1725" }
export const cardBG = { light: "#FFFFFF", dark: "#18283B" }
export const muted = { light: "#51667F", dark: "#A7BACF" }
export const accent = { light: "#12665F", dark: "#7AE5C7" }
const white = "#F0F6FF"
const soft = "#BBD2E5"
const mint = "#83EDCA"
const gradient = { gradient: [{ color: "#17334E", location: 0 }, { color: "#10233B", location: 0.62 }, { color: "#114042", location: 1 }], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }

export function AccountCard({ a, snapshot, onPick }: { a: Session; snapshot: Snapshot | null; onPick: () => void }) {
  return <Button buttonStyle="plain" action={onPick}>
    <HStack spacing={10} padding={13} background={<RoundedRectangle cornerRadius={16} fill={cardBG} />}>
      <Image systemName="person.crop.circle" font={20} foregroundStyle={accent} />
      <VStack alignment="leading" spacing={3}>
        <Text font={15} fontWeight="semibold">{labelFor(a)}</Text>
        <Text font={11} foregroundStyle={muted}>{widgetCode(a)}</Text>
      </VStack>
      <Spacer minLength={4} />
      <Text font={15} fontWeight="semibold" monospacedDigit lineLimit={1}>{formatCredits(snapshot?.balance?.total)}</Text>
      <Image systemName="chevron.right" font={10} foregroundStyle={muted} />
    </HStack>
  </Button>
}

export function Metric({ label, value, color = white }: { label: string; value: string; color?: string }) {
  return <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <Text font={11} foregroundStyle={soft}>{label}</Text>
    <Text font={value.length > 10 ? 15 : 19} fontWeight="bold" monospacedDigit lineLimit={1} foregroundStyle={color}>{value}</Text>
  </VStack>
}

export function Hero({ a, snapshot, count, issue }: { a: Session | null; snapshot: Snapshot | null; count: number; issue: string | null }) {
  const b = snapshot?.balance
  const status = snapshot?.attendance?.value
  const verified = status?.state === "signed"
  const statusLabel = verified ? "今日已签到" : status?.state === "unsigned" ? "今日未签到" : status?.state === "closed" ? "活动未开放" : "未查到签到状态"
  const total = formatCredits(b?.total)
  return <VStack alignment="leading" spacing={12} padding={18}
    frame={{ maxWidth: "infinity", alignment: "leading" }} background={<RoundedRectangle cornerRadius={24} fill={gradient} />}
  >
    <HStack spacing={7}>
      <Image systemName="creditcard.fill" font={14} foregroundStyle={mint} />
      <Text font={14} fontWeight="semibold" foregroundStyle={white}>WorkBuddy 积分</Text>
      <Spacer minLength={4} />
      <Text font={11} foregroundStyle={soft}>{a ? `${labelFor(a)} · ${widgetCode(a)}` : "只读查询"}</Text>
    </HStack>
    {a ? <VStack alignment="leading" spacing={9}>
      <Text font={12} foregroundStyle={soft}>总可用积分</Text>
      <Text font={total.length > 11 ? 29 : 38} fontWeight="bold" fontDesign="rounded" monospacedDigit lineLimit={1} foregroundStyle={white}>{total}</Text>
      <HStack spacing={8} padding={{ top: 3 }}>
        <Metric label="签到余额" value={b?.checkin == null ? "无法确认" : formatCredits(b.checkin)} color={mint} />
        <Metric label={verified ? "签到已领" : status?.state === "unsigned" ? "签到可领" : "签到奖励"} value={formatCredits(status?.amount)} />
      </HStack>
      <HStack spacing={5} padding={{ top: 4 }}>
        <Image systemName={verified ? "checkmark.circle.fill" : "calendar"} font={12} foregroundStyle={verified ? mint : soft} />
        <Text font={11} foregroundStyle={white}>{statusLabel}{verified && status?.streak ? ` · 连续 ${status.streak} 天` : ""}</Text>
        <Spacer minLength={1} />
        <Text font={10} foregroundStyle={soft} lineLimit={1}>{b ? `${issue || snapshotText(snapshot) ? "缓存" : "更新"} ${chinaTime(b.at)}` : "暂无快照"}</Text>
      </HStack>
    </VStack> : <VStack alignment="leading" spacing={8} padding={{ vertical: 6 }}>
      <Text font={25} fontWeight="bold" foregroundStyle={white}>登录后查看积分</Text>
      <Text font={13} foregroundStyle={soft}>支持多个手机号授权并存，分别查看余额与签到。</Text>
    </VStack>}
  </VStack>
}

export function ResourceRows({ snapshot }: { snapshot: Snapshot | null }) {
  const b = snapshot?.balance
  const rows = b?.items ?? []
  return <VStack alignment="leading" spacing={10}>
    <HStack>
      <Text font={18} fontWeight="semibold">积分包明细</Text>
      <Spacer />
      <Text font={11} foregroundStyle={muted}>最多展示 24 项</Text>
    </HStack>
    <VStack alignment="leading" spacing={10} padding={14}
      frame={{ maxWidth: "infinity", alignment: "leading" }} background={<RoundedRectangle cornerRadius={17} fill={cardBG} />}
    >
      {rows.length ? rows.map((item, index) => <HStack key={index} spacing={12}>
        <Image systemName={item.isCheckin ? "calendar.badge.checkmark" : "square.stack"} font={14} foregroundStyle={muted} />
        <VStack alignment="leading" spacing={3}>
          <Text font={13} fontWeight="medium">{item.label}</Text>
          {item.cycleEnd ? <Text font={11} foregroundStyle={muted}>{chinaTime(item.cycleEnd)} 周期结束</Text> : null}
        </VStack>
        <Spacer minLength={4} />
        <Text font={13} monospacedDigit fontWeight="semibold">{formatCredits(item.amount)}</Text>
      </HStack>) : <Text font={12} foregroundStyle={muted}>刷新余额后显示服务返回的有效积分包。</Text>}
    </VStack>
    {b?.checkin == null ? <Text font={11} foregroundStyle={muted} padding={{ horizontal: 2 }}>当前数据无法确认单独的签到余额，不代表未领取或剩余为 0。</Text> : null}
  </VStack>
}
