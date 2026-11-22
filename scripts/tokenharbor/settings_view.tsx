import { Button, HStack, Image, ScrollView, Spacer, Text, VStack, ZStack } from "scripting"
import { C } from "./theme"

type Row = { icon: string; tint: string; title: string; desc: string; onTap: () => void; loading?: boolean }

function RowView(props: Row) {
  return (
    <HStack spacing={13} padding={15}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={{ style: C.card, shape: { type: "rect", cornerRadius: 20 } }}
      onTapGesture={() => {
        if (!props.loading) props.onTap()
      }}>
      <ZStack frame={{ width: 38, height: 38 }}
        background={{ style: C.sub, shape: { type: "rect", cornerRadius: 12 } }}>
        <Image systemName={props.icon} font={17} foregroundStyle={props.tint} />
      </ZStack>
      <VStack alignment="leading" spacing={2}>
        <Text font={14.5} fontWeight="semibold" foregroundStyle={C.text}>{props.title}</Text>
        <Text font={11} foregroundStyle={C.text2} lineLimit={1}>{props.desc}</Text>
      </VStack>
      <Spacer minLength={6} />
      <Image systemName="chevron.right" font={13} fontWeight="semibold" foregroundStyle={C.text3} />
    </HStack>
  )
}

// 设置页面:只读展示接口与数据口径,客户端 Key 仍走原有 Dialog + Keychain 流程
export function SettingsView(props: {
  onDone: () => void
  onSetKey: () => void
  onRefresh: () => void
  onPreview: () => void
  busy: boolean
}) {
  return (
    <VStack alignment="leading" spacing={13} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      background={C.bg}>
      <ScrollView>
        <VStack alignment="leading" spacing={13} padding={{ top: 14, bottom: 36, horizontal: 16 }}>
          <HStack spacing={10} alignment="center">
            <Text font={19} fontWeight="semibold" foregroundStyle={C.text}>设置</Text>
            <Spacer />
            <Button title="完成" action={props.onDone} />
          </HStack>

          <VStack alignment="leading" spacing={9} padding={16}
            frame={{ maxWidth: "infinity", alignment: "leading" }}
            background={{ style: C.card, shape: { type: "rect", cornerRadius: 22 } }}
            border={{ style: C.divider, width: 1 }}>
            <HStack spacing={7}>
              <Image systemName="link" font={13} foregroundStyle={C.accent} />
              <Text font={13.5} fontWeight="semibold" foregroundStyle={C.text}>接口</Text>
            </HStack>
            <Text font={11.5} foregroundStyle={C.text2} lineLimit={2}>
              https://cpa.zhiaon.top/v1/tokenharbor/quota
            </Text>
            <Text font={10.5} foregroundStyle={C.text3}>只读接口,使用 CPA 客户端 Key 鉴权</Text>
          </VStack>

          <VStack alignment="leading" spacing={9} padding={16}
            frame={{ maxWidth: "infinity", alignment: "leading" }}
            background={{ style: C.card, shape: { type: "rect", cornerRadius: 22 } }}
            border={{ style: C.divider, width: 1 }}>
            <HStack spacing={7}>
              <Image systemName="info.circle" font={13} foregroundStyle={C.blue} />
              <Text font={13.5} fontWeight="semibold" foregroundStyle={C.text}>数据口径</Text>
            </HStack>
            <Text font={11.5} foregroundStyle={C.text2} lineLimit={3}>
              返回七天窗口的已用比例、剩余比例与重置时间,是额度占比,不是美元余额。
            </Text>
            <Text font={10.5} foregroundStyle={C.text3} lineLimit={3}>
              客户端 Key 仅保存在本机钥匙串,不写入源码与安装包,也不会上传。
            </Text>
          </VStack>

          <RowView icon="key.fill" tint={C.accent} title="设置客户端 Key" desc="配置您的 API Key" onTap={props.onSetKey} />
          <RowView icon="arrow.clockwise" tint={C.blue} title="刷新额度" desc="获取最新的额度信息" onTap={props.onRefresh} loading={props.busy} />
          <RowView icon="square.grid.2x2" tint={C.purple} title="预览小组件" desc="查看精美小组件效果" onTap={props.onPreview} />
        </VStack>
      </ScrollView>
    </VStack>
  )
}
