import { HStack, Image, Spacer, Text, VStack, ZStack } from "scripting"
import { C } from "./theme"

export function HeaderView(props: { onSettings: () => void }) {
  return (
    <HStack spacing={10} alignment="center">
      <ZStack frame={{ width: 34, height: 34 }}
        background={{
          gradient: [
            { color: "rgba(66,217,160,0.22)", location: 0 },
            { color: "rgba(67,139,255,0.14)", location: 1 },
          ],
          startPoint: { x: 0, y: 0 },
          endPoint: { x: 1, y: 1 },
        }}
        clipShape={{ type: "rect", cornerRadius: 11 }}>
        <Image systemName="chart.line.uptrend.xyaxis" font={17} foregroundStyle={C.accent} />
      </ZStack>
      <VStack alignment="leading" spacing={1}>
        <Text font={18} fontWeight="semibold" foregroundStyle={C.text}>TokenHarbor</Text>
        <Text font={10.5} foregroundStyle={C.text3}>AI 额度管理 · 智能高效</Text>
      </VStack>
      <Spacer />
      <ZStack frame={{ width: 34, height: 34 }}
        background={{ style: C.sub, shape: { type: "rect", cornerRadius: 17 } }}
        onTapGesture={props.onSettings}>
        <Image systemName="gearshape.fill" font={15} foregroundStyle={C.text2} />
      </ZStack>
    </HStack>
  )
}
