import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#5d5b54] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full h-11 px-3.5 bg-white text-[#1a1a1a] text-sm rounded-[8px] border ${
            error
              ? 'border-[#e03131] focus:ring-2 focus:ring-[#e03131]/20'
              : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-2 focus:ring-[#5645d4]/20'
          } outline-none transition-all placeholder:text-[#a4a097] disabled:bg-[#f6f5f4] disabled:text-[#787671] ${className}`}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-xs text-[#e03131] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-[#787671]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
