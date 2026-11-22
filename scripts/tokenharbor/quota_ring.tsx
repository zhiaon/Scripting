import { Chart, DonutChart, Text, VStack, ZStack } from "scripting"
import { C } from "./theme"

type Props = {
  used: number
  remaining: number
  size?: number
  valueFont?: number
  label?: boolean
}

// 额度圆环:绿色=剩余,蓝色=已用,比例直接来自接口
export function QuotaProgressRing(props: Props) {
  const size = props.size ?? 104
  const used = Math.max(0, Math.min(100, props.used))
  const remaining = Math.max(0, Math.min(100, props.remaining))
  return (
    <ZStack frame={{ width: size, height: size }}>
      <Chart chartLegend="hidden" frame={{ width: size, height: size }}>
        <DonutChart
          marks={[
            {
              label: "已用",
              value: used,
              innerRadius: { type: "ratio", value: 0.76 },
              angularInset: 2,
              cornerRadius: 4,
              foregroundStyle: C.blue,
            },
            {
              label: "剩余",
              value: remaining,
              innerRadius: { type: "ratio", value: 0.76 },
              angularInset: 2,
              cornerRadius: 4,
              foregroundStyle: C.accent,
            },
          ]}
        />
      </Chart>
      <VStack spacing={0} alignment="center">
        <Text font={props.valueFont ?? 15} fontWeight="bold" monospacedDigit foregroundStyle={C.text}>
          {`${Math.round(remaining)}%`}
        </Text>
        {props.label ? <Text font={8.5} foregroundStyle={C.text3}>剩余</Text> : null}
      </VStack>
    </ZStack>
  )
}
