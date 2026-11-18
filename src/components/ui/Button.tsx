import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger' | 'outline-danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'qp-button inline-flex items-center justify-center font-semibold transition-colors duration-150 rounded-none focus:outline-none focus:ring-2 focus:ring-[#fff200] focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-11',
    md: 'text-sm px-4 py-2 gap-2 min-h-12',
    lg: 'text-base px-5 py-2.5 gap-2.5 min-h-12',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#da291c] text-white hover:bg-[#9d2211] active:bg-[#b01e0a] shadow-none',
    secondary:
      'bg-[#242424] text-[#ffffff] border border-[#606060] hover:bg-[#1c1c1c] active:bg-[#363636]',
    dark:
      'bg-[#181818] text-white hover:bg-[#303030] active:bg-[#121212]',
    ghost:
      'bg-transparent text-[#dedede] hover:bg-[#1c1c1c] active:bg-[#363636]',
    danger:
      'bg-[#e03131] text-white hover:bg-[#c92a2a] active:bg-[#b02525]',
    'outline-danger':
      'bg-[#242424] text-[#ff8278] border border-[#e03131]/40 hover:bg-[#402321] active:bg-[#402321]',
  }[variant];

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
