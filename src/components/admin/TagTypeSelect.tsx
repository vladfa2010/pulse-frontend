const TAG_TYPES = [
  'company',
  'ticker',
  'sector',
  'trend',
  'person',
  'commodity',
  'index',
  'currency',
] as const;

const TAG_TYPE_LABELS: Record<string, string> = {
  company: 'Компания',
  ticker: 'Тикер',
  sector: 'Сектор',
  trend: 'Тренд',
  person: 'Персона',
  commodity: 'Сырьё',
  index: 'Индекс',
  currency: 'Валюта',
};

interface TagTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TagTypeSelect({ value, onChange }: TagTypeSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
      style={{ borderColor: '#222222', color: '#D1D5DB', backgroundColor: '#111111' }}
    >
      {TAG_TYPES.map((type) => (
        <option key={type} value={type} style={{ backgroundColor: '#111111' }}>
          {TAG_TYPE_LABELS[type] ?? type}
        </option>
      ))}
    </select>
  );
}
