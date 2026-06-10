export type ReportChartImage = {
  title: string
  dataUrl: string
}

export type ReportChartImages = {
  breakdown?: ReportChartImage
  trend?: ReportChartImage
}

function svgElementToDataUrl(svg: SVGElement, width: number, height: number): string | null {
  try {
    const clone = svg.cloneNode(true) as SVGElement
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))

    if (!clone.getAttribute('viewBox')) {
      const bbox = svg.viewBox?.baseVal

      if (bbox && bbox.width > 0 && bbox.height > 0) {
        clone.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
      } else {
        clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
      }
    }

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

    bg.setAttribute('width', '100%')
    bg.setAttribute('height', '100%')
    bg.setAttribute('fill', '#ffffff')
    clone.insertBefore(bg, clone.firstChild)

    const svgString = new XMLSerializer().serializeToString(clone)

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  } catch {
    return null
  }
}

function captureChartFromContainer(container: HTMLElement | null): string | null {
  if (!container) return null

  const svg = container.querySelector('svg.apexcharts-svg') as SVGElement | null

  if (!svg) return null

  const rect = container.getBoundingClientRect()
  const width = Math.max(rect.width, container.offsetWidth, 640)
  const height = Math.max(rect.height, container.offsetHeight, 280)

  return svgElementToDataUrl(svg, width, height)
}

export async function captureReportCharts(rootId = 'report-output'): Promise<ReportChartImages> {
  const root = document.getElementById(rootId)

  if (!root) return {}

  const breakdownEl = root.querySelector('[data-report-chart="breakdown"]') as HTMLElement | null
  const trendEl = root.querySelector('[data-report-chart="trend"]') as HTMLElement | null

  const breakdownDataUrl = captureChartFromContainer(breakdownEl)
  const trendDataUrl = captureChartFromContainer(trendEl)

  const breakdownTitle =
    breakdownEl?.querySelector('[data-report-chart-title]')?.textContent?.trim() || 'Breakdown chart'

  const trendTitle =
    trendEl?.querySelector('[data-report-chart-title]')?.textContent?.trim() || 'Trend chart'

  const result: ReportChartImages = {}

  if (breakdownDataUrl) {
    result.breakdown = { title: breakdownTitle, dataUrl: breakdownDataUrl }
  }

  if (trendDataUrl) {
    result.trend = { title: trendTitle, dataUrl: trendDataUrl }
  }

  return result
}
