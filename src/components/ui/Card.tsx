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
    none: 'bg-[#242424]',
    surface: 'bg-[#1c1c1c]',
    peach: 'bg-[#3c2b22]',
    rose: 'bg-[#402321]',
    mint: 'bg-[#163529]',
    lavender: 'bg-[#303030]',
    sky: 'bg-[#243239]',
    yellow: 'bg-[#303030]',
    'yellow-bold': 'bg-white',
  }[tint];

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }[padding];

  const borderStyles = border
    ? 'border border-[#3d3d3d]'
    : '';

  return (
    <div
      className={`qp-card rounded-none ${tintStyles} ${borderStyles} ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
