import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-slate-200/90 shadow-sm transition-all duration-150 min-w-0 ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-5 py-3.5 border-b border-slate-100 min-w-0">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2 flex-wrap">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-5 min-w-0">{children}</div>
    </div>
  );
};
