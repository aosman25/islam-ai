import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  id: number;
  name: string;
}

interface MultiSelectProps {
  options: SelectOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  emptyText?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder,
  emptyText = 'No options',
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus filter input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const remove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== id));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(filter.toLowerCase())
  );

  const selectedOptions = options.filter(o => selected.includes(o.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left transition-colors
          ${open
            ? 'border-teal-500/50 bg-slate-900/80 ring-1 ring-teal-500/20'
            : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-600/60'
          }`}
      >
        <span className="flex-1 truncate">
          {selected.length === 0
            ? <span className="text-slate-600">{placeholder}</span>
            : <span className="text-slate-300">{selected.length} selected</span>
          }
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <span
              onClick={clearAll}
              className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Selected chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedOptions.map(opt => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 border border-teal-500/25 rounded-full text-[11px] text-teal-300"
              dir="rtl"
            >
              {opt.name}
              <button
                onClick={e => remove(opt.id, e)}
                className="text-teal-500/60 hover:text-teal-300 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
          {/* Search inside dropdown */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
            <Search className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
            {filter && (
              <button onClick={() => setFilter('')} className="text-slate-600 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto py-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-slate-600 py-4">{emptyText}</p>
            ) : (
              filtered.map(opt => {
                const isSelected = selected.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggle(opt.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-right transition-colors
                      ${isSelected
                        ? 'text-teal-300 bg-teal-500/8'
                        : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                  >
                    {/* Checkbox visual */}
                    <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
                      ${isSelected
                        ? 'bg-teal-500/20 border-teal-500/50'
                        : 'border-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-teal-400" />}
                    </span>
                    <span className="flex-1 truncate text-right" dir="rtl">{opt.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
