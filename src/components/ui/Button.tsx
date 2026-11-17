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
    'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#5645d4] focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-10',
    lg: 'text-base px-5 py-2.5 gap-2.5 h-11',
  }[size];

  const variantStyles = {
    primary:
      'bg-[#5645d4] text-white hover:bg-[#4534b3] active:bg-[#3a2a99] shadow-sm',
    secondary:
      'bg-white text-[#1a1a1a] border border-[#c8c4be] hover:bg-[#f6f5f4] active:bg-[#ede9e4]',
    dark:
      'bg-[#0a1530] text-white hover:bg-[#1a2a52] active:bg-[#070f24]',
    ghost:
      'bg-transparent text-[#37352f] hover:bg-[#f6f5f4] active:bg-[#ede9e4]',
    danger:
      'bg-[#e03131] text-white hover:bg-[#c92a2a] active:bg-[#b02525]',
    'outline-danger':
      'bg-white text-[#e03131] border border-[#e03131]/40 hover:bg-[#fde0ec] active:bg-[#fcc2d7]',
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
