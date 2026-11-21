import { HStack, Image, RoundedRectangle, Spacer, Text, VStack } from "scripting"
import { labelFor, widgetCode } from "./auth"
import { snapshotText } from "./balance"
import { chinaTime, formatCredits } from "./credits"
import type { Attendance } from "./credits"
import type { OverviewRow } from "./overview_refresh"

// Flat, opaque surfaces keep the text clear; no material, blur or overlay.
const BG = "#101D30"
const PANEL = "#182C43"
const BORDER = "#314A64"
const WHITE = "#F3F7FF"
const MUTED = "#B4CADD"
const MINT = "#83EDCA"
const AMBER = "#FFD08A"
const TIME_OPACITY = 0.82
const ACCOUNT_WIDTH = { dense: 43, regular: 110 }
const SIGN_WIDTH = { dense: 30, regular: 65 }

export type OverviewSize = "small" | "medium" | "large"

export function overviewLayout(count: number, height: number, size: OverviewSize = "large") {
  const large = size === "large", small = size === "small"
  const visibleHeight = Number.isFinite(height) && height > 0 ? height : large ? 330 : 145
  const columns = large && (count > 8 || (count >= 7 && visibleHeight < 295)) ? 2 : 1
  const perColumn = Math.ceil(count / columns)
  const horizontal = small ? 11 : 16, vertical = large ? 14 : 11
  const spacing = large ? 8 : 4, title = large ? 28 : 20
  const chrome = 2 * vertical + title + 16 + 13 + 3 * spacing + 5
  const available = Math.floor((visibleHeight - chrome) / Math.max(1, perColumn)) - 2
  const dense = columns === 2 || small
  const rowHeight = Math.max(large ? 12 : 18, Math.min(dense ? 28 : 44, available))
  const fits = large || available >= 18
  return { columns, perColumn, dense, rowHeight, fits, small, large, horizontal, vertical, spacing, title, detailed: !dense && rowHeight >= 33 }
}

type Layout = ReturnType<typeof overviewLayout>

function amount(value: number | null | undefined, dense: boolean, limit = 8) {
  const full = formatCredits(value)
  if (value == null || full === "<0.01") return full
  const shown = dense ? full.replace(/,/g, "") : full
  if (shown.length <= (dense ? limit : 12)) return shown
  const compact = value >= 1e12 ? `${(value / 1e12).toPrecision(2)}兆`
    : value >= 1e8 ? `${(value / 1e8).toPrecision(2)}亿`
    : value >= 1e4 ? `${(value / 1e4).toFixed(1)}万` : value.toFixed(1)
  return `≈${compact}`
}

function statusAppearance(value: Attendance | undefined) {
  switch (value?.state) {
    case "unsigned": return { label: "未签到", short: "未", glyph: "exclamationmark.circle.fill", color: AMBER, fill: "#52391D" }
    case "signed": return { label: "已签到", short: "已", glyph: "checkmark.circle.fill", color: MINT, fill: "#164035" }
    case "closed": return { label: "未开放", short: "停", glyph: "minus.circle", color: MUTED, fill: "#2A3D52" }
    default: return { label: "状态未知", short: "?", glyph: "questionmark.circle", color: MUTED, fill: "#2A3D52" }
  }
}

function StatusBadge({ value, dense }: { value: Attendance | undefined; dense: boolean }) {
  const state = statusAppearance(value)
  return <HStack spacing={2} padding={{ horizontal: dense ? 2 : 4, vertical: dense ? 1 : 2 }}
    background={<RoundedRectangle cornerRadius={dense ? 3 : 5} fill={state.fill} />}>
    {!dense ? <Image systemName={state.glyph} font={8} foregroundStyle={state.color} /> : null}
    <Text font={dense ? 7 : 9} fontWeight="bold" foregroundStyle={state.color} lineLimit={1}>{dense ? state.short : state.label}</Text>
  </HStack>
}

function recordIsCached(row: OverviewRow) {
  return !!row.snapshot?.balance && (row.issue !== null || snapshotText(row.snapshot))
}

function GridHeader({ dense }: { dense: boolean }) {
  const font = dense ? 9 : 10
  return <HStack spacing={dense ? 3 : 4} padding={{ horizontal: dense ? 4 : 10 }} frame={{ height: 16 }}>
    <Text font={font} foregroundStyle={MUTED} frame={{ width: dense ? ACCOUNT_WIDTH.dense : ACCOUNT_WIDTH.regular, alignment: "leading" }}>账号</Text>
    <Text font={dense ? 8 : font} foregroundStyle={MUTED} lineLimit={1} frame={{ maxWidth: "infinity", alignment: "trailing" }}>可用积分</Text>
    <Text font={font} foregroundStyle={MUTED} frame={{ width: dense ? SIGN_WIDTH.dense : SIGN_WIDTH.regular, alignment: "trailing" }}>{dense ? "签到余" : "签到剩余"}</Text>
  </HStack>
}

function GridRow({ row, dense, height, detailed, duplicateTail }: {
  row: OverviewRow; dense: boolean; height: number; detailed: boolean; duplicateTail: boolean
}) {
  const { session, snapshot } = row
  const b = snapshot?.balance
  const cached = recordIsCached(row)
  const attendance = snapshot?.attendance?.value
  const state = statusAppearance(attendance)
  const reward = attendance && (attendance.state === "signed" || attendance.state === "unsigned") && attendance.amount != null
    ? `${attendance.state === "signed" ? "签到已领" : "签到可领"} ${formatCredits(attendance.amount)}` : null
  const shortId = !duplicateTail && session.phoneTail ? session.phoneTail : widgetCode(session)
  const name = dense ? shortId : duplicateTail && !detailed ? widgetCode(session) : labelFor(session)
  const total = amount(b?.total, dense)
  const sign = b?.checkin == null ? (dense ? "未知" : "无法确认") : amount(b.checkin, dense, 6)
  const tick = typeof b?.at === "number" ? chinaTime(b.at) : null
  const totalText = total + (cached && !detailed ? "*" : "")
  const shell = <RoundedRectangle cornerRadius={dense ? 5 : 8} fill={PANEL}
    stroke={{ shapeStyle: BORDER, strokeStyle: { lineWidth: 0.7 } }} />
  return <HStack spacing={dense ? 3 : 4} padding={{ horizontal: dense ? 4 : 10 }} frame={{ height }} background={shell}>
    <VStack alignment="leading" spacing={2} frame={{ width: dense ? ACCOUNT_WIDTH.dense : ACCOUNT_WIDTH.regular, alignment: "leading" }}>
      <HStack spacing={dense ? 2 : 4}>
        <Text font={dense ? 9 : 12} fontWeight="semibold" foregroundStyle={WHITE} lineLimit={1} monospacedDigit>
          {name}{detailed && duplicateTail ? ` · ${widgetCode(session)}` : ""}
        </Text>
        {!detailed ? <StatusBadge value={attendance} dense={dense} /> : null}
      </HStack>
      {detailed ? <HStack spacing={4}>
        <StatusBadge value={attendance} dense={false} />
        {reward ? <Text font={8} foregroundStyle={attendance?.state === "unsigned" ? state.color : MUTED} lineLimit={1}>{reward}</Text> : null}
      </HStack> : null}
    </VStack>
    <VStack alignment="trailing" spacing={1} frame={{ maxWidth: "infinity", alignment: "trailing" }}>
      <HStack alignment="lastTextBaseline" spacing={3}>
        <Text font={dense ? (totalText.length > 7 ? 8 : totalText.length > 6 ? 9 : 10) : detailed ? (totalText.length > 9 ? 13 : 17) : 13}
          fontWeight="semibold" monospacedDigit lineLimit={1} foregroundStyle={cached ? MUTED : WHITE}>{totalText}</Text>
        {detailed ? <Text font={8} foregroundStyle={MUTED}>积分</Text> : null}
      </HStack>
      {detailed && tick ? <Text font={8} opacity={TIME_OPACITY} foregroundStyle={MUTED} lineLimit={1}>{cached ? "缓存" : "更新"} {tick}</Text> : null}
    </VStack>
    <HStack alignment="lastTextBaseline" spacing={2} frame={{ width: dense ? SIGN_WIDTH.dense : SIGN_WIDTH.regular, alignment: "trailing" }}>
      <Text font={dense ? (sign.length > 5 ? 7 : 9) : (b?.checkin == null ? 10 : (sign.length > 5 ? 10 : 13))}
        fontWeight="medium" monospacedDigit lineLimit={1} foregroundStyle={b?.checkin == null || cached ? MUTED : MINT}>{sign}</Text>
      {detailed && b?.checkin != null ? <Text font={8} foregroundStyle={MUTED}>积分</Text> : null}
    </HStack>
  </HStack>
}

export function AccountOverview({ rows, layout, url }: { rows: OverviewRow[]; layout: Layout; url: string }) {
  const dense = layout.dense
  const groups = layout.columns === 2 ? [rows.slice(0, layout.perColumn), rows.slice(layout.perColumn)] : [rows]
  const tails = new Map<string, number>()
  for (const row of rows) {
    const tail = row.session.phoneTail
    if (tail) tails.set(tail, (tails.get(tail) ?? 0) + 1)
  }
  const signed = rows.filter(row => row.snapshot?.attendance?.value.state === "signed").length
  const unsigned = rows.filter(row => row.snapshot?.attendance?.value.state === "unsigned").length
  const cached = rows.some(recordIsCached)
  const pending = rows.some(row => row.snapshot?.balance?.total == null)
  return <VStack alignment="leading" spacing={layout.spacing} padding={{ horizontal: layout.horizontal, vertical: layout.vertical }}
    frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }} widgetBackground={BG} widgetURL={url}>
    <HStack spacing={layout.small ? 3 : 7} frame={{ height: layout.title }}>
      {!layout.small ? <Image systemName="person.2.fill" font={13} foregroundStyle={MINT} /> : null}
      <VStack alignment="leading" spacing={1}>
        <Text font={layout.small ? 11 : 14} fontWeight="bold" foregroundStyle={WHITE} lineLimit={1}>WorkBuddy</Text>
        {layout.large ? <Text font={9} foregroundStyle={MUTED}>账户积分</Text> : null}
      </VStack>
      <Spacer minLength={1} />
      <Text font={layout.small ? 9 : 10} fontWeight="semibold" foregroundStyle={MINT} padding={{ horizontal: layout.small ? 4 : 8, vertical: 3 }}
        background={<RoundedRectangle cornerRadius={8} fill="#214960" />}>{layout.small ? `${rows.length} 号` : `${rows.length} 个账号`}</Text>
    </HStack>
    <HStack alignment="top" spacing={8}>
      {groups.map((group, column) => <VStack key={column} alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
        <GridHeader dense={dense} />
        {group.map(row => <GridRow key={row.session.id} row={row} dense={dense} height={layout.rowHeight}
          detailed={layout.detailed} duplicateTail={(tails.get(row.session.phoneTail ?? "") ?? 0) > 1} />)}
      </VStack>)}
    </HStack>
    <Spacer minLength={0} />
    <HStack spacing={4} frame={{ height: 13 }}>
      <Image systemName={unsigned ? "exclamationmark.circle.fill" : signed ? "checkmark.circle.fill" : "calendar"}
        font={9} foregroundStyle={unsigned ? AMBER : signed ? MINT : MUTED} />
      {unsigned ? <Text font={9} fontWeight="semibold" foregroundStyle={AMBER} lineLimit={1}>{`未签到 ${unsigned}`}</Text> : null}
      <Text font={9} foregroundStyle="#CBDEF0" lineLimit={1}>
        {layout.small && unsigned ? "" : `已签到 ${signed}/${rows.length}`}{cached && !layout.detailed ? " · *缓存" : ""}{pending ? " · —未获取" : ""}
      </Text>
      <Spacer minLength={2} />
      {!layout.small ? <Text font={9} foregroundStyle={MINT} lineLimit={1}>账号列表 ›</Text> : null}
    </HStack>
  </VStack>
}
