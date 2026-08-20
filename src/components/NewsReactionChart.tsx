import CandleChart from './CandleChart'

interface InstrumentChart {
  tag_id: string
  tag_name: string
  symbol: string
  date: string
  shifted: boolean
  timezone: string
  exchange_mic: string
  exchange_name: string
  times: string[]
  ohlc: number[][]
  volumes: number[]
}

interface Props {
  instrument: InstrumentChart
  publishedAt: string
}

export default function NewsReactionChart({ instrument, publishedAt }: Props) {
  return (
    <CandleChart
      times={instrument.times}
      ohlc={instrument.ohlc}
      volumes={instrument.volumes}
      height={180}
      markTime={instrument.shifted ? undefined : publishedAt}
      timezone={instrument.timezone}
    />
  )
}
