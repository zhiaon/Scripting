import { HStack, Spacer, Text, VStack } from "scripting"
import { C } from "./theme"
import { pct } from "./format"

function Column(props: { title: string; value: number; hint: string; tint: string }) {
  return (
    <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font={11.5} foregroundStyle={C.text2}>{props.title}</Text>
      <Text font={20} fontWeight="semibold" monospacedDigit foregroundStyle={props.tint}>
        {pct(props.value)}
      </Text>
      <Text font={10} foregroundStyle={C.text3} lineLimit={1}>{props.hint}</Text>
    </VStack>
  )
}

// 已用 / 剩余 两列统计,数值直接来自接口返回
export function QuotaStatistics(props: { used: number; remaining: number; windowDays: number }) {
  const days = Number.isFinite(props.windowDays) && props.windowDays > 0 ? props.windowDays : 7
  return (
    <HStack spacing={12} padding={{ vertical: 11, horizontal: 12 }}
      background={{ style: C.sub, shape: { type: "rect", cornerRadius: 14 } }}>
      <Column title="已用额度" value={props.used} hint={`本 ${days} 天窗口消耗`} tint={C.text} />
      <Spacer minLength={8} />
      <Column title="剩余额度" value={props.remaining} hint="可用至重置时刻" tint={C.accent} />
    </HStack>
  )
}
