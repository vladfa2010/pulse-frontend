import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagChipsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
}

export function TagChipsInput({
  value,
  onChange,
  minItems,
  maxItems,
  placeholder = 'Add...',
}: TagChipsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const canRemove = (index: number) => {
    if (!minItems) return true;
    return value.length > minItems;
  };

  const canAdd = () => {
    if (!maxItems) return true;
    return value.length < maxItems;
  };

  const addChip = (chip: string) => {
    const trimmed = chip.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (!canAdd()) return;
    onChange([...value, trimmed]);
    setInputValue('');
  };

  const removeChip = (index: number) => {
    if (!canRemove(index)) return;
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      // Remove last chip if input is empty
      if (canRemove(value.length - 1)) {
        const newValue = [...value];
        newValue.pop();
        onChange(newValue);
      }
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((chip, i) => (
          <span
            key={`${chip}-${i}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border"
            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#D1D5DB' }}
          >
            {chip}
            {canRemove(i) && (
              <button
                onClick={() => removeChip(i)}
                className="hover:opacity-70"
                style={{ color: '#6B7280' }}
              >
                <X size={10} />
              </button>
            )}
          </span>
        ))}
      </div>
      {canAdd() && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
          style={{ borderColor: '#222222', color: '#D1D5DB' }}
        />
      )}
    </div>
  );
}
