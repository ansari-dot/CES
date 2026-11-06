import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  colorScheme?: 'primary' | 'success' | 'warning' | 'secondary' | 'error';
}

export default function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  colorScheme = "primary"
}: MetricCardProps) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    secondary: "bg-secondary text-secondary-foreground",
    error: "bg-error-bg text-error",
  };

  return (
    <div className="bg-card border border-border rounded-md p-3.5 flex gap-2.5 items-start shadow-xs">
      <div className={`w-9 h-9 rounded-sm flex items-center justify-center shrink-0 ${colorMap[colorScheme] || colorMap.secondary}`}>
        <Icon className="w-4 h-4 stroke-[2.2]" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground font-medium">{title}</div>
        <div className="font-headings font-bold text-foreground text-lg leading-tight mt-0.5">{value}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}
