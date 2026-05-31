import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: 'blue' | 'green' | 'red' | 'yellow' | 'gray';
  icon?: string;
}

const accentClass = {
  blue:   'border-blue-500 text-blue-600',
  green:  'border-green-500 text-green-600',
  red:    'border-red-500 text-red-600',
  yellow: 'border-yellow-500 text-yellow-600',
  gray:   'border-gray-400 text-gray-600',
};

export default function StatCard({
  label,
  value,
  unit,
  accent = 'blue',
  icon,
}: StatCardProps) {
  return (
    <div
      className={`bg-white/95 rounded-[28px] shadow-sm border border-slate-200 border-l-4 ${accentClass[accent]} px-5 py-5 flex items-center justify-between gap-4`}
    >
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-3xl font-semibold text-slate-900 mt-2">
          {value}
          {unit && (
            <span className="text-base font-medium text-slate-500 ml-1">{unit}</span>
          )}
        </p>
      </div>
      {icon && <div className="text-4xl">{icon}</div>}
    </div>
  );
}
