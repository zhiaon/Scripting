// 小组件尺寸判定:优先用 family,缺失时按 displaySize 兜底
export type WidgetSize = "small" | "medium" | "large"

export function widgetLayout(family: unknown, size?: { width?: number; height?: number }): WidgetSize {
  const f = String(family ?? "")
  if (f === "systemSmall") return "small"
  if (f === "systemMedium") return "medium"
  if (f === "systemLarge" || f === "systemExtraLarge") return "large"
  const h = Number(size?.height)
  const w = Number(size?.width)
  if (Number.isFinite(h) && h >= 260) return "large"
  if (Number.isFinite(w) && w >= 300) return "medium"
  if (Number.isFinite(h) && h > 0) return "small"
  return "medium"
}

// 各尺寸的内容内边距(点)
export const inset = { small: 14, medium: 16, large: 16 } as const
