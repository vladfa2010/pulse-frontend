import { HelpCircle } from 'lucide-react';

interface HintProps {
  text: string;
}

export function Hint({ text }: HintProps) {
  return (
    <span className="relative group cursor-help" style={{ color: '#4B5563' }}>
      <HelpCircle size={12} />
      <span
        className="absolute left-0 top-5 z-50 w-64 px-3 py-2 rounded-lg border text-xs leading-relaxed
                   invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150
                   pointer-events-none"
        style={{
          backgroundColor: '#1A1A1A',
          borderColor: '#333333',
          color: '#D1D5DB',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </span>
    </span>
  );
}
