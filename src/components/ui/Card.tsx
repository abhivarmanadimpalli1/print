import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tint?: 'none' | 'peach' | 'rose' | 'mint' | 'lavender' | 'sky' | 'yellow' | 'yellow-bold' | 'surface';
  border?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  tint = 'none',
  border = true,
  padding = 'lg',
  children,
  className = '',
  ...props
}) => {
  const tintStyles = {
    none: 'bg-white',
    surface: 'bg-[#f6f5f4]',
    peach: 'bg-[#ffe8d4]',
    rose: 'bg-[#fde0ec]',
    mint: 'bg-[#d9f3e1]',
    lavender: 'bg-[#e6e0f5]',
    sky: 'bg-[#dcecfa]',
    yellow: 'bg-[#fef7d6]',
    'yellow-bold': 'bg-[#f9e79f]',
  }[tint];

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }[padding];

  const borderStyles = border
    ? 'border border-[#e5e3df]'
    : '';

  return (
    <div
      className={`rounded-[12px] ${tintStyles} ${borderStyles} ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
