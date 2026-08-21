import CandleChart from './CandleChart'
import type { InstrumentChart } from '@/lib/newsChart'

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
