import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const ALERT_STYLES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-zellige-500/30 bg-zellige-100 text-zellige-500',
} as const;

export function Alert({
  className,
  tone = 'error',
  ...props
}: ComponentProps<'div'> & { tone?: keyof typeof ALERT_STYLES }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2 text-sm', ALERT_STYLES[tone], className)}
      {...props}
    />
  );
}

const BADGE_STYLES = {
  neutral: 'bg-stone-100 text-stone-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-zellige-100 text-zellige-500',
  muted: 'bg-stone-200 text-stone-500 line-through',
} as const;

export type BadgeTone = keyof typeof BADGE_STYLES;

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_STYLES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-8 text-sm text-stone-500"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-stone-200 bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}
