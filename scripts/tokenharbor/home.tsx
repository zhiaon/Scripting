import { Button, HStack, Image, ScrollView, Text, VStack, useEffect, useState } from "scripting"
import type { Result } from "./quota"
import { C } from "./theme"
import { HeaderView } from "./header_view"
import { QuotaCard } from "./quota_card"
import { UsageTrendChart } from "./usage_trend"
import { ActionCard } from "./action_card"
import { SettingsView } from "./settings_view"

export type Flash = { kind: "ok" | "error"; text: string } | null

// 首页:深色极简仪表盘,额度数据是视觉中心
export function HomePage(props: {
  result: Result
  busy: boolean
  now: number
  settings: boolean
  flash: Flash
  onSettings: (open: boolean) => void
  onRefresh: () => void
  onSetKey: () => void
  onPreview: () => void
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(true)
  }, [])
  const d = props.result.data
  const needsKey = !d && /尚未配置|Key 已失效/.test(props.result.label)
  if (props.settings) {
    return (
      <SettingsView
        busy={props.busy}
        onDone={() => props.onSettings(false)}
        onSetKey={props.onSetKey}
        onRefresh={props.onRefresh}
        onPreview={props.onPreview}
      />
    )
  }
  return (
    <VStack alignment="leading" frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={C.bg}
      toolbar={{ cancellationAction: <Button title="关闭" action={props.onClose} /> }}>
      <ScrollView>
        <VStack alignment="leading" spacing={12} padding={{ top: 16, bottom: 44, horizontal: 16 }}>
          <HeaderView onSettings={() => props.onSettings(true)} />

          {props.flash ? (
            <HStack spacing={7} padding={{ horizontal: 12, vertical: 8 }}
              frame={{ maxWidth: "infinity", alignment: "leading" }}
              background={{ style: C.sub, shape: { type: "rect", cornerRadius: 12 } }}
              opacity={props.flash.kind === "ok" ? 0.95 : 1}>
              <Image
                systemName={props.flash.kind === "ok" ? "checkmark.circle.fill" : "exclamationmark.circle.fill"}
                font={12}
                foregroundStyle={props.flash.kind === "ok" ? C.accent : C.blue}
              />
              <Text font={11} foregroundStyle={props.flash.kind === "ok" ? C.text2 : C.text} lineLimit={2}>
                {props.flash.text}
              </Text>
            </HStack>
          ) : null}

          {needsKey && !props.busy ? (
            <HStack spacing={11} padding={15}
              frame={{ maxWidth: "infinity", alignment: "leading" }}
              background={{ style: C.card, shape: { type: "rect", cornerRadius: 22 } }}
              onTapGesture={props.onSetKey}>
              <Image systemName="key.fill" font={17} foregroundStyle={C.blue} />
              <VStack alignment="leading" spacing={2}>
                <Text font={13} fontWeight="semibold" foregroundStyle={C.text}>需要配置客户端 Key</Text>
                <Text font={10.5} foregroundStyle={C.text3}>{props.result.label} · 点此配置</Text>
              </VStack>
            </HStack>
          ) : (
            <QuotaCard data={d} now={props.now} shown={shown} />
          )}

          <UsageTrendChart now={props.now} />

          <ActionCard icon="arrow.clockwise" tint={C.accent} title="刷新额度"
            desc={props.busy ? "正在获取最新额度…" : "获取最新的额度信息"} loading={props.busy} onTap={props.onRefresh} />
          <ActionCard icon="key.fill" tint={C.blue} title="设置客户端 Key"
            desc="配置您的 API Key" disabled={props.busy} onTap={props.onSetKey} />
          <ActionCard icon="square.grid.2x2" tint={C.purple} title="预览小组件"
            desc="查看精美小组件效果" disabled={props.busy} onTap={props.onPreview} />

          <HStack spacing={5} padding={{ top: 2 }}>
            <Image systemName="lock.shield" font={10} foregroundStyle={C.text3} />
            <Text font={10} foregroundStyle={C.text3} lineLimit={1}>
              {d ? `只读接口 · ${props.result.label}` : "只读接口 · 不写入任何账户数据"}
            </Text>
          </HStack>
        </VStack>
      </ScrollView>
    </VStack>
  )
}
