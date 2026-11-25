/**
 * =============================================================================
 * PULSE — «Ритм рынков»: нативный React-компонент (ТЗ «нативная встройка»)
 * =============================================================================
 *
 * JSX-порт DOM-скелета раздела 5.1 ТЗ-194 (собственный <header> виджета не
 * переносится — заголовок есть у страницы; футер — caption-паттерном страницы
 * в CalendarPage). Инициализация ядра — в useEffect, cleanup отменяет rAF и
 * слушателей (unmount + StrictMode-двойной маунт: init/destroy идемпотентны).
 */

import { useEffect, useRef } from 'react'
import { init } from './widget-core'
import './market-rhythm.css'

export default function MarketRhythm() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const destroy = init(root)
    return () => destroy()
  }, [])

  return (
    <div className="market-rhythm" ref={rootRef}>
      <main>
        {/* ================= MAP ================= */}
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Мировая карта · статус бирж</span>
            <div className="seg mr-tzseg">
              <button className="on" data-tz="UTC">UTC</button>
              <button data-tz="LOCAL">Моё время</button>
            </div>
          </div>
          <div className="mapbox">
            <canvas className="mr-map" />
            <div className="mr-tip" />
          </div>
          <div className="ruler">
            <div className="ruler-track">
              <canvas className="mr-ruler-cv" />
              <div className="mr-chip">--:-- UTC</div>
            </div>
            <div className="ruler-foot">
              <div className="legend">
                <span><i style={{ background: 'var(--mr-mint)' }} />открыта</span>
                <span><i style={{ background: 'var(--mr-red)' }} />закрыта</span>
                <span><i style={{ background: 'rgba(0,212,255,.8)' }} />сессии закрытых (выбранная)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= STATUS ================= */}
        <section className="panel status-panel">
          <div className="panel-head">
            <span className="panel-title">Биржи · открыты и закрыты</span>
          </div>
          <div className="rows mr-rows" />
        </section>
      </main>
    </div>
  )
}
