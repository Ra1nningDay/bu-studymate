import type { ReactNode } from "react";

export interface AdminPageHeaderProps {
  badge?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  border?: boolean;
  className?: string;
}

export function AdminPageHeader({
  badge,
  title,
  description,
  actions,
  border = false,
  className = ""
}: AdminPageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${
        border ? "border-b border-slate-200 pb-5" : ""
      } ${className}`}
    >
      <div className="min-w-0">
        {badge && (
          <span className="mb-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-700">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      )}
    </header>
  );
}
