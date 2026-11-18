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
            className="block text-xs font-semibold uppercase tracking-wider text-[#bcbcbc] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full h-11 px-3.5 bg-[#242424] text-[#ffffff] text-sm rounded-none border ${
            error
              ? 'border-[#e03131] focus:ring-2 focus:ring-[#e03131]/20'
              : 'border-[#606060] focus:border-[#da291c] focus:ring-2 focus:ring-[#da291c]/20'
          } outline-none transition-all placeholder:text-[#969696] disabled:bg-[#1c1c1c] disabled:text-[#b0b0b0] ${className}`}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-xs text-[#ff8278] font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-[#b0b0b0]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
