import { HStack, Image, Spacer, Text, VStack, ZStack } from "scripting"
import { C } from "./theme"
import { ago, bjFull, pct, untilReset } from "./format"
import { QuotaProgressRing } from "./quota_ring"
import { QuotaStatistics } from "./quota_stats"

type Data = {
  used_percent: number
  remaining_percent: number
  reset_at: string
  fetched_at: string
  window_days: number
}

function InfoRow(props: { label: string; value: string; sub?: string; tint?: string }) {
  return (
    <HStack spacing={8} alignment="top">
      <Text font={11.5} foregroundStyle={C.text2}>{props.label}</Text>
      <Spacer minLength={6} />
      <VStack alignment="trailing" spacing={1}>
        <Text font={11.5} monospacedDigit foregroundStyle={props.tint ?? C.text} lineLimit={1}>
          {props.value}
        </Text>
        {props.sub ? <Text font={9.5} foregroundStyle={C.text3} lineLimit={1}>{props.sub}</Text> : null}
      </VStack>
    </HStack>
  )
}

// 核心额度卡片:数据全部来自真实接口,缺失时显示 —,不写占位数值
export function QuotaCard(props: { data: Data | null; now: number; shown: boolean }) {
  const d = props.data
  const used = d ? Math.max(0, Math.min(100, d.used_percent)) : 0
  const remaining = d ? Math.max(0, Math.min(100, d.remaining_percent)) : 0
  const days = d && Number.isFinite(d.window_days) ? d.window_days : 7
  return (
    <VStack alignment="leading" spacing={14} padding={16}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={{ style: C.card, shape: { type: "rect", cornerRadius: 24 } }}
      shadow={{ color: "#000000", radius: 18, x: 0, y: 10 }}
      opacity={props.shown ? 1 : 0}
      animation={{ animation: Animation.default(), value: props.shown ? 1 : 0 }}>

      <HStack spacing={6}>
        <Text font={13} fontWeight="semibold" foregroundStyle={C.text2}>{`${days} 天额度`}</Text>
        <Spacer minLength={4} />
        <ZStack padding={{ horizontal: 8, vertical: 3 }}
          background={{ style: C.sub, shape: { type: "rect", cornerRadius: 9 } }}>
          <Text font={9.5} foregroundStyle={C.text3}>滚动窗口</Text>
        </ZStack>
      </HStack>

      <HStack spacing={12} alignment="center">
        <VStack alignment="leading" spacing={3}>
          <Text font={11} foregroundStyle={C.text3}>剩余额度</Text>
          <Text font={44} fontWeight="bold" monospacedDigit foregroundStyle={C.accent} lineLimit={1}>
            {d ? pct(remaining) : "—"}
          </Text>
          <Text font={11} foregroundStyle={C.text2} lineLimit={1}>
            {d ? `已使用 ${pct(used)}` : "暂无数据"}
          </Text>
        </VStack>
        <Spacer minLength={4} />
        <QuotaProgressRing used={used} remaining={remaining} size={96} valueFont={14} label />
      </HStack>

      <QuotaStatistics used={used} remaining={remaining} windowDays={days} />

      <VStack alignment="leading" spacing={7}>
        <InfoRow
          label="重置时间"
          value={d ? bjFull(d.reset_at) : "—"}
          sub="北京时间 UTC+8"
        />
        <InfoRow
          label="剩余重置时间"
          value={d ? untilReset(d.reset_at, props.now) : "—"}
          tint={C.accent}
        />
        <InfoRow label="当前更新时间" value={d ? ago(d.fetched_at, props.now) : "—"} />
      </VStack>
    </VStack>
  )
}
