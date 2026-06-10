import type { ReportQueryResponse } from '../reports.types'
import { captureReportCharts, type ReportChartImages } from './captureReportCharts'
import { buildFallbackChartImages, mergeChartImages } from './reportChartSvg'

export async function resolveReportCharts(
  data: ReportQueryResponse,
  rootId = 'report-output'
): Promise<ReportChartImages> {
  const fallback = buildFallbackChartImages(data)

  await new Promise<void>(resolve => {
    window.requestAnimationFrame(() => resolve())
  })

  try {
    const captured = await captureReportCharts(rootId)

    return mergeChartImages(captured, fallback)
  } catch {
    return fallback
  }
}
