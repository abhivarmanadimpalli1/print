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
    purple: 'bg-[#da291c] text-white font-semibold',
    mint: 'bg-[#163529] text-[#6ed5a3] font-medium border border-[#1aae39]/30',
    peach: 'bg-[#3c2b22] text-[#f3ba83] font-medium border border-[#dd5b00]/30',
    rose: 'bg-[#402321] text-[#ff8278] font-medium border border-[#e03131]/30',
    sky: 'bg-[#243239] text-[#8ccce9] font-medium border border-[#0075de]/30',
    gray: 'bg-[#303030] text-[#bcbcbc] font-medium border border-[#606060]/40',
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
