import { Link } from 'react-router'
import { Check } from 'lucide-react'

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-md mx-auto pt-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Тарифы</h1>
          <p className="text-slate-400">Выберите подходящий план</p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-b from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
          <div className="text-sm text-cyan-400 font-medium mb-2">Premium</div>
          <div className="text-4xl font-bold mb-1">490 ₽<span className="text-lg text-slate-400 font-normal">/мес</span></div>
          <p className="text-slate-400 text-sm mb-6">Полный доступ ко всем функциям</p>

          <ul className="space-y-3 mb-6">
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-cyan-400" /> До 10 тегов для отслеживания</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-cyan-400" /> Еженедельные отчёты</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-cyan-400" /> Сентимент-алерты</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-cyan-400" /> RSS из 32 источников</li>
            <li className="flex items-center gap-2 text-sm"><Check size={16} className="text-cyan-400" /> Перевод EN → RU</li>
          </ul>

          <Link to="/login" className="block w-full p-3 bg-cyan-500 rounded-lg font-medium text-center hover:bg-cyan-400">
            Подключить Premium
          </Link>
        </div>

        <div className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-400 hover:text-white">← На главную</Link>
        </div>
      </div>
    </div>
  )
}
