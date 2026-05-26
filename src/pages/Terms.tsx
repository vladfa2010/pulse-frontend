import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Назад</span>
          </Link>
          <h1 className="text-2xl font-bold">Условия использования</h1>
        </div>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Общие положения</h2>
            <p>
              Настоящие Условия использования регулируют отношения между ООО &laquo;Пульс&raquo; (далее — &laquo;Компания&raquo;)
              и пользователем сервиса PULSE (далее — &laquo;Пользователь&raquo;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. О сервисе</h2>
            <p>
              PULSE — платформа для агрегации и анализа инвестиционных новостей. 
              Сервис предоставляет информационные услуги и не является инвестиционным консультантом.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Не инвестиционная рекомендация</h2>
            <p>
              <strong className="text-white">Вся информация, предоставляемая сервисом, носит исключительно информационный характер.</strong>{' '}
              Компания не предоставляет инвестиционных рекомендаций, не призывает к покупке или продаже 
              ценных бумаг. Пользователь самостоятельно принимает инвестиционные решения.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Искусственный интеллект</h2>
            <p>
              Сервис использует технологии искусственного интеллекта для анализа новостей, 
              определения сентимента и генерации репортов. Результаты анализа могут содержать ошибки.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Конфиденциальность данных</h2>
            <p>
              Компания не передаёт персональные данные Пользователя третьим лицам. 
              Все данные обрабатываются и хранятся на территории Российской Федерации 
              в соответствии с Федеральным законом № 152-ФЗ &laquo;О персональных данных&raquo;.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Платные услуги</h2>
            <p>
              Premium-подписка предоставляется на условиях предоплаты. Возврат средств 
              возможен в течение 14 дней с момента оплаты при условии неиспользования платных функций.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
