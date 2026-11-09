import React from 'react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral';
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  size = 'sm',
}) => {
  const variantStyles = {
    primary: 'bg-indigo-50 text-[#36348e] border border-indigo-100',
    secondary: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
    tertiary: 'bg-amber-50 text-amber-900 border border-amber-200',
    error: 'bg-rose-50 text-rose-700 border border-rose-100',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {icon && (typeof icon === 'string' ? <span className="text-[12px]">{icon}</span> : icon)}
      {children}
    </span>
  );
};
