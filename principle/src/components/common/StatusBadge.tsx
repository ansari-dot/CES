import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Check,
  PauseCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  showIcon?: boolean;
  iconOnly?: boolean;
  minimal?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className = '',
  showIcon = true,
  iconOnly = false,
  minimal = false
}) => {
  let inferredVariant = variant;
  const lower = status.toLowerCase();

  if (!inferredVariant) {
    if (
      lower.includes('active') ||
      lower.includes('paid') ||
      lower.includes('approved') ||
      lower.includes('operational') ||
      lower.includes('submitted') ||
      lower.includes('verified') ||
      lower.includes('published')
    ) {
      inferredVariant = 'success';
    } else if (
      lower.includes('pending') ||
      lower.includes('draft') ||
      lower.includes('requires') ||
      lower.includes('degraded') ||
      lower.includes('partial')
    ) {
      inferredVariant = 'warning';
    } else if (
      lower.includes('suspended') ||
      lower.includes('overdue') ||
      lower.includes('cancelled') ||
      lower.includes('rejected') ||
      lower.includes('failed') ||
      lower.includes('missing') ||
      lower.includes('deactivated')
    ) {
      inferredVariant = 'danger';
    } else {
      inferredVariant = 'neutral';
    }
  }

  const getStatusIcon = () => {
    switch (inferredVariant) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={1.75} />;
      case 'warning':
        return <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" strokeWidth={1.75} />;
      case 'danger':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" strokeWidth={1.75} />;
      case 'info':
        return <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" strokeWidth={1.75} />;
      default:
        return <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />;
    }
  };

  if (iconOnly) {
    return (
      <span
        title={status}
        className={`inline-flex items-center justify-center p-1 rounded-md transition-colors ${
          inferredVariant === 'success'
            ? 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100'
            : inferredVariant === 'warning'
            ? 'text-amber-700 bg-amber-50/80 hover:bg-amber-100'
            : inferredVariant === 'danger'
            ? 'text-rose-700 bg-rose-50/80 hover:bg-rose-100'
            : inferredVariant === 'info'
            ? 'text-sky-700 bg-sky-50/80 hover:bg-sky-100'
            : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
        } ${className}`}
      >
        {getStatusIcon()}
      </span>
    );
  }

  if (minimal) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          inferredVariant === 'success'
            ? 'text-emerald-700'
            : inferredVariant === 'warning'
            ? 'text-amber-700'
            : inferredVariant === 'danger'
            ? 'text-rose-700'
            : inferredVariant === 'info'
            ? 'text-sky-700'
            : 'text-slate-600'
        } ${className}`}
      >
        {showIcon && getStatusIcon()}
        <span>{status}</span>
      </span>
    );
  }

  const styles = {
    neutral: 'text-slate-600 bg-slate-50 border-slate-200/80',
    success: 'text-emerald-700 bg-emerald-50/60 border-emerald-200/70',
    warning: 'text-amber-700 bg-amber-50/60 border-amber-200/70',
    danger: 'text-rose-700 bg-rose-50/60 border-rose-200/70',
    info: 'text-sky-700 bg-sky-50/60 border-sky-200/70'
  }[inferredVariant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border tabular-nums whitespace-nowrap shadow-2xs ${styles} ${className}`}
    >
      {showIcon && getStatusIcon()}
      <span>{status}</span>
    </span>
  );
};

