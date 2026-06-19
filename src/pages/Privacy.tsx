import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Политика конфиденциальности</h1>
        </div>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Сбор данных</h2>
            <p>
              Мы собираем минимально необходимую информацию: email, имя пользователя, 
              список отслеживаемых тегов, историю платежей. Мы не собираем данные 
              о вашем инвестиционном портфеле и брокерских счетах.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Хранение данных</h2>
            <p>
              Все данные хранятся на серверах, расположенных на территории Российской Федерации. 
              Мы используем шифрование при передаче (TLS) и хранении данных.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Передача третьим лицам</h2>
            <p>
              <strong className="text-white">Мы не передаём ваши персональные данные третьим лицам.</strong>{' '}
              Исключение составляют случаи, предусмотренные законодательством РФ 
              (запросы от уполномоченных государственных органов).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Уведомления</h2>
            <p>
              Мы отправляем уведомления через Telegram-бота и email 
              только с вашего согласия. Вы можете отключить уведомления в любой момент 
              в настройках профиля.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Cookies</h2>
            <p>
              Сервис использует cookies исключительно для технических целей 
              (аутентификация, сохранение настроек). Мы не используем cookies 
              для отслеживания активности на сторонних сайтах.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Удаление аккаунта</h2>
            <p>
              Вы можете удалить свой аккаунт в любой момент. При удалении все персональные 
              данные будут безвозвратно удалены в течение 30 дней.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Контакты</h2>
            <p>
              По вопросам конфиденциальности:{' '}
              <a href="mailto:pulse@inside-trade.ru" className="text-[#00D4FF] hover:underline">
                pulse@inside-trade.ru
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
