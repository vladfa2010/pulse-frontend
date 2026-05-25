import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold">Условия использования</h1>
        </div>

        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Общие положения</h2>
            <p className="text-sm leading-relaxed">Настоящие Условия регулируют использование сервиса PULSE — агрегатора инвестиционных новостей. Используя сервис, вы соглашаетесь с этими условиями.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Регистрация</h2>
            <p className="text-sm leading-relaxed">Для использования сервиса необходима регистрация. Вы обязаны предоставить достоверную информацию и поддерживать её в актуальном состоянии.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Подписка</h2>
            <p className="text-sm leading-relaxed">Premium-подписка предоставляет расширенный доступ к функциям сервиса. Стоимость: 490 ₽/месяц. Отмена возможна в любой момент.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Контент</h2>
            <p className="text-sm leading-relaxed">Новости собираются из открытых RSS-источников. PULSE не несёт ответственности за содержание новостей.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Ограничение ответственности</h2>
            <p className="text-sm leading-relaxed">PULSE предоставляет информационные услуги и не является инвестиционным советником. Решения, принятые на основе информации из сервиса, являются вашей личной ответственностью.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Изменения условий</h2>
            <p className="text-sm leading-relaxed">Мы оставляем за собой право изменять настоящие условия. Об изменениях вы будете уведомлены по email.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
