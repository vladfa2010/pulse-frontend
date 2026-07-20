import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface SitesListInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxItems?: number;
}

export function SitesListInput({ value, onChange, maxItems = 10 }: SitesListInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalize = (url: string): string =>
    url.match(/^https?:\/\//) ? url : 'https://' + url;

  const isValidUrl = (url: string): boolean => {
    try { new URL(normalize(url)); return true; } catch { return false; }
  };

  const addSite = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (value.length >= maxItems) { setError(`Max ${maxItems} sites`); return; }
    if (!isValidUrl(trimmed)) { setError('Invalid URL'); return; }
    const normalized = normalize(trimmed);
    if (value.includes(normalized)) { setError('Already in list'); return; }
    onChange([...value, normalized]);
    setInputValue('');
    setError(null);
  };

  const removeSite = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* List — first item is the official site */}
      <div className="space-y-1 mb-2">
        {value.map((site, i) => (
          <div key={`${site}-${i}`} className="flex items-center gap-2 group">
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: i === 0 ? '#2563EB22' : 'transparent', color: i === 0 ? '#60A5FA' : '#4B5563' }}
            >
              {i === 0 ? 'official' : `${i + 1}`}
            </span>
            <a
              href={site}
              target="_blank"
              rel="noopener"
              className="flex-1 text-xs truncate hover:opacity-80"
              style={{ color: '#60A5FA' }}
            >
              {site} ↗
            </a>
            <button
              onClick={() => removeSite(i)}
              className="p-0.5 rounded hover:bg-[#222222] transition-colors"
              style={{ color: '#6B7280' }}
              title="Remove site"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <p className="text-xs" style={{ color: '#6B7280' }}>No sites</p>
        )}
      </div>

      {/* Add input */}
      {value.length < maxItems && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSite(); } }}
            placeholder="https://..."
            className="flex-1 text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-[#333333]"
            style={{ borderColor: '#222222', color: '#D1D5DB' }}
          />
          <button
            onClick={addSite}
            className="flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors hover:border-[#444444]"
            style={{ borderColor: '#222222', color: '#9CA3AF' }}
          >
            <Plus size={12} /> Add site
          </button>
        </div>
      )}
      {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  );
}
