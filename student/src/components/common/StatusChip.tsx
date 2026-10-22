import React from 'react';

interface StatusChipProps {
  status: string;
  className?: string;
}

export default function StatusChip({ status, className = "" }: StatusChipProps) {
  const getStyle = () => {
    switch (status?.toLowerCase()) {
      case 'upcoming':
        return 'bg-warning-bg text-warning';
      case 'livenow':
      case 'live':
        return 'bg-error text-white font-bold animate-pulse';
      case 'submitted':
      case 'present':
      case 'graded':
      case 'paid':
        return 'bg-success-bg text-success font-semibold';
      case 'pending':
        return 'bg-warning-bg text-warning font-semibold';
      case 'overdue':
      case 'absent':
      case 'unpaid':
        return 'bg-error-bg text-error font-semibold';
      case 'late':
        return 'bg-amber-100 text-amber-700 font-semibold';
      case 'leave':
        return 'bg-blue-100 text-blue-700 font-semibold';
      case 'cancelled':
        return 'bg-muted text-muted-foreground font-semibold';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getStyle()} ${className}`}>
      {status === 'LiveNow' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      {status}
    </span>
  );
}
