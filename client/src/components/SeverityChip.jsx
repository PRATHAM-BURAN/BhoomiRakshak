import React from 'react';

const SEVERITY_CONFIG = {
  SAFE: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
    label: 'SAFE'
  },
  LOW: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    label: 'LOW'
  },
  MODERATE: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
    label: 'MODERATE'
  },
  HIGH: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-600',
    label: 'HIGH'
  },
  CRITICAL: {
    bg: 'bg-rose-100',
    text: 'text-rose-950',
    border: 'border-rose-400',
    dot: 'bg-rose-700 animate-pulse',
    label: 'CRITICAL'
  }
};

export default function SeverityChip({ severity = 'SAFE', size = 'sm' }) {
  const norm = (severity || 'SAFE').toUpperCase();
  const config = SEVERITY_CONFIG[norm] || SEVERITY_CONFIG.SAFE;

  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono font-bold tracking-wider uppercase ${
        isSmall ? 'text-[10px] leading-tight' : 'text-xs py-1 px-2.5'
      } ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
}
