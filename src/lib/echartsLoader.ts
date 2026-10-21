// ТЗ-122: общий ленивый лоадер echarts. Раньше паттерн с кэшированным промисом
// дублировался в CandleChart/CascadeChart; новые графики (сценарии, активность
// юзера) импортируют только этот хелпер, чтобы чанк echarts не попадал в бандл.
let echartsPromise: Promise<typeof import('echarts')> | null = null

export function loadECharts() {
  if (!echartsPromise) echartsPromise = import('echarts')
  return echartsPromise
}
