import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Capacitor } from '@capacitor/core'
import packageJson from '../../package.json'

const linkGroups = [
  {
    title: 'Продукт',
    links: [
      { href: '/', label: 'Главная' },
      { href: '/sentiment', label: 'Индекс настроения' },
      { href: '/pricing', label: 'Тарифы' },
      { href: '/feed', label: 'Лента' },
      { href: '/download', label: 'Android-приложение' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { href: '/terms', label: 'Условия использования' },
      { href: '/privacy', label: 'Политика конфиденциальности' },
    ],
  },
  {
    title: 'Поддержка',
    links: [
      { href: 'mailto:pulse@inside-trade.ru', label: 'pulse@inside-trade.ru' },
    ],
  },
]

function NativeVersion() {
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])

  if (!isNative) return null

  return (
    <p className="text-xs text-text-muted text-center mt-2">
      v{packageJson.version}
    </p>
  )
}

export default function Footer() {
  return (
    <footer
      className="w-full border-t"
      style={{
        borderColor: 'rgba(255, 255, 255, 0.04)',
        backgroundColor: 'rgba(6, 6, 6, 0.5)',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link to="/" className="text-lg font-bold text-white">PULSE</Link>
            <p className="text-sm text-text-muted mt-2">
              Инвестиционные новости в реальном времени
            </p>
          </div>

          {/* Link groups */}
          {linkGroups.map(group => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-text-primary mb-3">{group.title}</h4>
              <ul className="flex flex-col gap-2">
                {group.links.map(link => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}>
          <p className="text-sm text-text-muted text-center">
            © 2026. ИП Баклыков Владислав Васильевич ОГРНИП 320665800117586 ИНН 666201324610
          </p>
          <NativeVersion />
        </div>
      </div>
    </footer>
  )
}
