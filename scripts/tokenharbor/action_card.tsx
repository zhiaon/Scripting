import { HStack, Image, ProgressView, Spacer, Text, VStack, ZStack, useState } from "scripting"
import { C } from "./theme"

// 功能入口卡片:轻微玻璃质感,按下有缩放反馈
export function ActionCard(props: {
  icon: string
  tint: string
  title: string
  desc: string
  loading?: boolean
  disabled?: boolean
  onTap: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const idle = props.disabled || props.loading
  return (
    <HStack spacing={13} padding={{ horizontal: 15, vertical: 14 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={{ style: C.card, shape: { type: "rect", cornerRadius: 20 } }}
      opacity={idle ? 0.55 : 1}
      scaleEffect={pressed ? 0.98 : 1}
      animation={{ animation: Animation.default(), value: pressed ? 1 : 0 }}
      onTapGesture={() => {
        if (idle) return
        setPressed(true)
        setTimeout(() => setPressed(false), 120)
        props.onTap()
      }}>
      <ZStack frame={{ width: 36, height: 36 }}
        background={{ style: C.sub, shape: { type: "rect", cornerRadius: 12 } }}>
        <Image systemName={props.icon} font={16} foregroundStyle={props.tint} />
      </ZStack>
      <VStack alignment="leading" spacing={2}>
        <Text font={14} fontWeight="semibold" foregroundStyle={C.text}>{props.title}</Text>
        <Text font={10.5} foregroundStyle={C.text3} lineLimit={1}>{props.desc}</Text>
      </VStack>
      <Spacer minLength={6} />
      {props.loading ? (
        <ProgressView />
      ) : (
        <Image systemName="chevron.right" font={12} fontWeight="semibold" foregroundStyle={C.text3} />
      )}
    </HStack>
  )
}
