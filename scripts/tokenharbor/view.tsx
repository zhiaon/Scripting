import { HStack, Image, Spacer, Text, VStack } from "scripting"
import type { Result } from "./quota"
import { C } from "./theme"
import { ago, bjShort, bjFull, pct, untilReset } from "./format"
import { QuotaProgressRing } from "./quota_ring"
import { QuotaStatistics } from "./quota_stats"
import { inset, widgetLayout } from "./layout"
import type { WidgetSize } from "./layout"

const NAME = "TokenHarbor"

function Header(props: { size: WidgetSize; days: number }) {
  const small = props.size === "small"
  return (
    <HStack spacing={small ? 5 : 6} alignment="center">
      <Image systemName="bolt.horizontal.circle.fill" font={small ? 10 : 11.5} foregroundStyle={C.accent2} />
      <Text font={small ? 10.5 : 12} fontWeight="semibold" foregroundStyle={C.text} lineLimit={1}>{NAME}</Text>
      <Spacer minLength={4} />
      <Text font={small ? 8.5 : 9.5} fontWeight="medium" foregroundStyle={C.text3} lineLimit={1}>{`${props.days} 天`}</Text>
    </HStack>
  )
}

function Hero(props: { size: WidgetSize; ok: boolean; used: number; remaining: number; note: string }) {
  const small = props.size === "small"
  const large = props.size === "large"
  // 圆环尺寸按可用高度反推,保证中号 158pt 内不溢出
  const ring = small ? 52 : large ? 92 : 68
  return (
    <HStack alignment="center" spacing={small ? 6 : 10}>
      <VStack alignment="leading" spacing={small ? 2 : 3}>
        <Text font={small ? 8.5 : 10} foregroundStyle={C.text3}>剩余额度</Text>
        <Text
          font={small ? 24 : large ? 40 : 30}
          fontWeight="bold"
          monospacedDigit
          foregroundStyle={props.ok ? C.accent : C.text3}
          lineLimit={1}
        >{props.ok ? pct(props.remaining) : "—"}</Text>
        <Text font={small ? 8.5 : 9.5} foregroundStyle={C.text3} lineLimit={1}>
          {props.ok ? `已用 ${pct(props.used)}` : props.note}
        </Text>
      </VStack>
      <Spacer minLength={2} />
      <QuotaProgressRing used={props.used} remaining={props.remaining} size={ring} valueFont={small ? 10 : 13} />
    </HStack>
  )
}

export function View(props: { result: Result; family?: string; size?: { width: number; height: number } }) {
  const layout = widgetLayout(props.family, props.size)
  const d = props.result.data
  const ok = !!d && Number.isFinite(Number(d.used_percent)) && Number.isFinite(Number(d.remaining_percent))
  const used = ok ? Number(d!.used_percent) : 0
  const remaining = ok ? Number(d!.remaining_percent) : 0
  const days = d && Number.isFinite(Number(d.window_days)) ? Number(d.window_days) : 7
  const note = props.result.label || "暂无数据"
  const pad = inset[layout]

  if (layout === "small") {
    return (
      <VStack alignment="leading" spacing={6} padding={pad}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
        <Header size={layout} days={days} />
        <Hero size={layout} ok={ok} used={used} remaining={remaining} note={note} />
        <Spacer minLength={0} />
        <Text font={8.5} foregroundStyle={C.text3} lineLimit={1}>
          {ok && d ? `${bjShort(d.reset_at)} 重置` : ""}
        </Text>
      </VStack>
    )
  }

  // 中号高度只有 158pt,只保留 卡头 + 主体 + 一行页脚,避免被裁切
  if (layout === "medium") {
    return (
      <VStack alignment="leading" spacing={8} padding={pad}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
        <Header size={layout} days={days} />
        <Hero size={layout} ok={ok} used={used} remaining={remaining} note={note} />
        <Spacer minLength={0} />
        <Text font={9} foregroundStyle={C.text3} lineLimit={1}>
          {ok && d ? `更新 ${ago(d.fetched_at)} · 重置 ${bjShort(d.reset_at)}` : note}
        </Text>
      </VStack>
    )
  }

  return (
    <VStack alignment="leading" spacing={11} padding={pad}
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <Header size={layout} days={days} />
      <Hero size={layout} ok={ok} used={used} remaining={remaining} note={note} />
      {ok ? <QuotaStatistics used={used} remaining={remaining} windowDays={days} /> : null}
      {ok && d ? (
        <VStack alignment="leading" spacing={5}>
          <HStack spacing={6}>
            <Text font={10.5} foregroundStyle={C.text3}>重置时间</Text>
            <Spacer minLength={6} />
            <Text font={10.5} monospacedDigit foregroundStyle={C.text}>{bjFull(d.reset_at)}</Text>
          </HStack>
          <HStack spacing={6}>
            <Text font={10.5} foregroundStyle={C.text3}>剩余重置</Text>
            <Spacer minLength={6} />
            <Text font={10.5} monospacedDigit foregroundStyle={C.accent}>{untilReset(d.reset_at)}</Text>
          </HStack>
        </VStack>
      ) : null}
      <Spacer minLength={0} />
      <Text font={9} foregroundStyle={C.text3} lineLimit={1}>
        {ok && d ? `更新 ${ago(d.fetched_at)} · 北京时间` : note}
      </Text>
    </VStack>
  )
}
