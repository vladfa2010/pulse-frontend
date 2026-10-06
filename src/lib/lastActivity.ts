// ТЗ-154: «как давно изучали курс» — человекочитаемо, с русскими склонениями.
// Вынесен в lib ради юнит-теста; используется в Profile (карточка «Продолжить обучение»).
export function lastActivityLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Изучали сегодня'
  if (days === 1) return 'Изучали вчера'
  if (days < 30) {
    const d = days % 10, dd = days % 100
    const word = d === 1 && dd !== 11 ? 'день' : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? 'дня' : 'дней'
    return `Изучали ${days} ${word} назад`
  }
  const months = Math.floor(days / 30)
  if (months < 12) {
    const m = months % 10, mm = months % 100
    const word = m === 1 && mm !== 11 ? 'месяц' : m >= 2 && m <= 4 && (mm < 12 || mm > 14) ? 'месяца' : 'месяцев'
    return `Изучали ${months} ${word} назад`
  }
  return 'Изучали больше года назад'
}
