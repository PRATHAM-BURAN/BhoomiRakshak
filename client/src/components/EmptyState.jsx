import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function EmptyState({
  icon: Icon = AlertCircle,
  title = 'No Data Available',
  description = 'No telemetry records or ground-truth reports found in the registry.',
  actionLabel,
  onAction
}) {
  return (
    <div className="p-8 my-4 border border-dashed border-outline-variant/60 rounded bg-white flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-outline mb-3">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <h4 className="text-sm font-semibold tracking-tight text-on-surface uppercase mb-1">
        {title}
      </h4>
      <p className="text-xs text-on-surface-variant max-w-md mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded hover:bg-primary-container transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
