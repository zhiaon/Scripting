import { AreaChart, Chart, HStack, Image, LineChart, Spacer, Text, VStack } from "scripting"
import { C } from "./theme"
import { trend } from "./history"

// 近 7 天使用趋势:只绘制本地真实记录,不生成推测数据
export function UsageTrendChart(props: { now: number }) {
  const { points, ok } = trend(props.now)
  const empty = points.length === 0
  return (
    <VStack alignment="leading" spacing={10} padding={16}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={{ style: C.card, shape: { type: "rect", cornerRadius: 24 } }}>
      <HStack spacing={7}>
        <Image systemName="chart.xyaxis.line" font={13} foregroundStyle={C.accent} />
        <Text font={13} fontWeight="semibold" foregroundStyle={C.text}>近 7 天使用趋势</Text>
        <Spacer minLength={6} />
        <Text font={10} foregroundStyle={C.text3}>{ok ? "每日用量" : empty ? "暂无记录" : "记录不足"}</Text>
      </HStack>

      {ok ? (
        <VStack alignment="leading" spacing={7} frame={{ maxWidth: "infinity" }}>
          <Chart chartLegend="hidden" frame={{ height: 128, maxWidth: "infinity" }}>
            <AreaChart
              marks={points.map((p) => ({
                x: p.label,
                y: p.value,
                foregroundStyle: {
                  gradient: [
                    { color: "rgba(66,217,160,0.28)", location: 0 },
                    { color: "rgba(66,217,160,0.02)", location: 1 },
                  ],
                  startPoint: { x: 0.5, y: 0 },
                  endPoint: { x: 0.5, y: 1 },
                },
              }))}
            />
            <LineChart
              marks={points.map((p) => ({
                x: p.label,
                y: p.value,
                foregroundStyle: C.accent,
                lineStyle: { lineWidth: 2, lineCap: "round", lineJoin: "round" },
              }))}
            />
          </Chart>
          <HStack spacing={8}>
            <Text font={10} foregroundStyle={C.text3}>{`最近一日 +${points[points.length - 1].value} 百分点`}</Text>
            <Spacer minLength={4} />
            <Text font={10} foregroundStyle={C.text3}>基于本机记录</Text>
          </HStack>
        </VStack>
      ) : (
        <HStack spacing={11} padding={{ vertical: 12 }}>
          <Image
            systemName={empty ? "chart.line.downtrend.xyaxis" : "clock.badge.exclamationmark"}
            font={22}
            foregroundStyle={C.text3}
          />
          <VStack alignment="leading" spacing={3}>
            <Text font={12} foregroundStyle={C.text2}>{empty ? "暂无历史数据" : "记录不足"}</Text>
            <Text font={10} foregroundStyle={C.text3} lineLimit={2}>
              {empty
                ? "刷新额度后开始记录,不生成推测数据"
                : "至少需要两天的观测才能画出趋势"}
            </Text>
          </VStack>
        </HStack>
      )}
    </VStack>
  )
}
