import React from 'react';

interface ModeOption {
  type: 'FASTEST' | 'CHEAPEST' | 'BEST_VALUE';
  label: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  badge?: string;
}

interface ModeSelectorProps {
  selected: 'FASTEST' | 'CHEAPEST' | 'BEST_VALUE';
  onSelect: (type: 'FASTEST' | 'CHEAPEST' | 'BEST_VALUE') => void;
}

const options: ModeOption[] = [
  {
    type: 'FASTEST',
    label: '⚡ Fastest',
    description: 'Delivery in ~20‑25 min',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-600',
  },
  {
    type: 'BEST_VALUE',
    label: '⚖️ Best Value',
    description: 'Balanced price & speed',
    gradientFrom: 'from-purple-600',
    gradientTo: 'to-fuchsia-600',
    badge: 'Recommended',
  },
  {
    type: 'CHEAPEST',
    label: '💰 Cheapest',
    description: 'Lowest total cost',
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-orange-600',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" role="radiogroup" aria-label="Pharmacy comparison mode">
      {options.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onSelect(opt.type)}
          className={`p-4 rounded-xl text-left transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${opt.gradientFrom.split('-')[1]}-500 ${selected === opt.type ? `bg-gradient-to-r ${opt.gradientFrom} ${opt.gradientTo} text-white shadow-xl` : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'}`}
          aria-checked={selected === opt.type}
          role="radio"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{opt.label}</span>
            {opt.badge && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                {opt.badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm opacity-80">{opt.description}</p>
        </button>
      ))}
    </div>
  );
};
