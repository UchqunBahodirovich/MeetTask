import React from 'react';

export const inputClass =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-xs font-medium text-red-600">{error}</p>
    ) : hint ? (
      <p className="text-xs text-slate-400">{hint}</p>
    ) : null}
  </div>
);
