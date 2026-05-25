import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold">Политика конфиденциальности</h1>
        </div>

        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Какие данные мы собираем</h2>
            <p className="text-sm leading-relaxed">Email, имя пользователя, пароль (хешированный), список тегов для отслеживания, настройки уведомлений. Мы не собираем финансовую информацию.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Как используем данные</h2>
            <p className="text-sm leading-relaxed">Данные используются для персонализации ленты новостей, отправки уведомлений и улучшения сервиса. Мы не продаём данные третьим лицам.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Хранение данных</h2>
            <p className="text-sm leading-relaxed">Данные хранятся на защищённых серверах. Пароли хешируются с использованием bcrypt. JWT-токены хранятся только в вашем браузере.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Cookies</h2>
            <p className="text-sm leading-relaxed">Мы используем cookies только для аутентификации (JWT токен в localStorage). Никакого трекинга или рекламных cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Удаление аккаунта</h2>
            <p className="text-sm leading-relaxed">Вы можете удалить аккаунт в любой момент. Все персональные данные будут безвозвратно удалены.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Контакты</h2>
            <p className="text-sm leading-relaxed">По вопросам конфиденциальности: support@pulse.app</p>
          </section>
        </div>
      </div>
    </div>
  )
}
