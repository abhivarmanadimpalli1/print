import React from 'react';
import type { OrderStatus } from '../../types';

export interface BadgeProps {
  status?: OrderStatus;
  variant?: 'purple' | 'mint' | 'peach' | 'rose' | 'sky' | 'gray';
  children?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant,
  children,
  size = 'md',
}) => {
  let computedVariant = variant || 'gray';
  let label = children;

  if (status) {
    switch (status) {
      case 'new':
        computedVariant = 'sky';
        label = label || 'New Order';
        break;
      case 'review':
        computedVariant = 'peach';
        label = label || 'Needs Review';
        break;
      case 'approved':
        computedVariant = 'purple';
        label = label || 'Approved';
        break;
      case 'printing':
        computedVariant = 'peach';
        label = label || 'Printing';
        break;
      case 'ready':
        computedVariant = 'mint';
        label = label || 'Ready for Pickup';
        break;
      case 'completed':
        computedVariant = 'mint';
        label = label || 'Completed';
        break;
      case 'cancelled':
        computedVariant = 'rose';
        label = label || 'Cancelled / Rejected';
        break;
    }
  }

  const variantStyles = {
    purple: 'bg-[#5645d4] text-white font-semibold',
    mint: 'bg-[#d9f3e1] text-[#1aae39] font-medium border border-[#1aae39]/30',
    peach: 'bg-[#ffe8d4] text-[#dd5b00] font-medium border border-[#dd5b00]/30',
    rose: 'bg-[#fde0ec] text-[#e03131] font-medium border border-[#e03131]/30',
    sky: 'bg-[#dcecfa] text-[#0075de] font-medium border border-[#0075de]/30',
    gray: 'bg-[#f0eeec] text-[#5d5b54] font-medium border border-[#c8c4be]/40',
  }[computedVariant];

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full uppercase tracking-wider ${sizeStyles} ${variantStyles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
};
