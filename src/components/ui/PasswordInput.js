'use client';

import { forwardRef, useState } from 'react';

export function EyeIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M16.7 16.7A10.9 10.9 0 0 1 12 18c-5.5 0-9.5-6-9.5-6a17.7 17.7 0 0 1 4.2-4.2" />
      <path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.5c5.5 0 9.5 6 9.5 6a17.7 17.7 0 0 1-1.6 2.1" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

const defaultInputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

const PasswordInput = forwardRef(function PasswordInput(
  { className, containerClassName, disabled, id, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  // Normalize className: strip any mt-1 (handled on the wrapper) and ensure pr-10 so text never overlaps icon
  let resolvedClass = className || defaultInputClass;
  resolvedClass = resolvedClass.replace(/(?:^|\s)mt-1(?:\s|$)/g, ' ').trim();
  if (/(?:^|\s)px-3(?:\s|$)/.test(resolvedClass)) {
    resolvedClass = resolvedClass.replace(/(?:^|\s)px-3(?:\s|$)/g, ' pl-3 pr-10 ').trim();
  } else if (!/(?:^|\s)pr-\w+(?:\s|$)/.test(resolvedClass)) {
    resolvedClass = `${resolvedClass} pr-10`;
  }

  const wrapperClass = ['relative mt-1', containerClassName].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      <input
        {...props}
        ref={ref}
        id={id}
        type={showPassword ? 'text' : 'password'}
        disabled={disabled}
        className={resolvedClass}
      />
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => {
          // Prevent the input from losing focus or resetting cursor position when clicking toggle
          event.preventDefault();
        }}
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        className={`absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded-r-lg ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
      >
        {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
export default PasswordInput;
