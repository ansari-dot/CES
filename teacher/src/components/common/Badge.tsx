import React from 'react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral';
  children: React.ReactNode;
  icon?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  size = 'sm',
}) => {
  const variantStyles = {
    primary: 'bg-[#e2dfff] text-[#3525cd]',
    secondary: 'bg-[#d1fae5] text-[#065f46]',
    tertiary: 'bg-[#ffddb8] text-[#92400e]',
    error: 'bg-[#fee2e2] text-[#991b1b]',
    neutral: 'bg-[#dee9fc] text-[#464555]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {children}
    </span>
  );
};
