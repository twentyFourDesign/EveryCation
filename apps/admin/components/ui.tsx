'use client';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { Lock } from 'lucide-react';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-gold text-ink font-semibold hover:bg-gold-light',
        navy: 'bg-navy text-white hover:bg-blue',
        outline: 'border-[1.5px] border-control-border bg-white text-ink hover:bg-surface-muted',
        danger: 'border-[1.5px] border-danger bg-white text-danger hover:bg-danger-soft',
        ghost: 'text-heading-blue hover:text-blue font-semibold',
      },
      size: { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-sm', lg: 'h-12 px-6 text-sm' },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);
export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof button>;
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} className={cn(button({ variant, size }), className)} {...p} />
));
Button.displayName = 'Button';

const badge = cva('inline-block rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      info: 'bg-tint text-navy',
      warn: 'bg-gold-soft text-ink',
      danger: 'bg-danger-soft text-danger',
      neutral: 'bg-surface-muted text-ink',
      navy: 'bg-navy text-white',
    },
  },
  defaultVariants: { tone: 'info' },
});
export const Badge = ({ tone, className, ...p }: ComponentProps<'span'> & VariantProps<typeof badge>) => (
  <span className={cn(badge({ tone }), className)} {...p} />
);

export const Card = ({ className, ...p }: ComponentProps<'section'>) => (
  <section className={cn('rounded-card bg-white p-5', className)} {...p} />
);

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[26px] leading-8 font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

/** A row of filter chips that behaves like tabs. */
export function Chips<V extends string>({ options, value, onChange, label }: { options: readonly (V | { value: V; label: string })[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const on = opt.value === value;
        return (
          <button key={opt.value} role="tab" aria-selected={on} onClick={() => onChange(opt.value)}
            className={cn('h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-medium', on ? 'bg-navy text-white' : 'border-[1.5px] border-control-border bg-white text-ink hover:bg-surface-muted')}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const control = 'h-11 w-full rounded-xl border-[1.5px] border-control-border bg-white px-3.5 text-sm placeholder:text-ink-muted aria-[invalid=true]:border-danger';
export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(({ className, ...p }, ref) => <input ref={ref} className={cn(control, className)} {...p} />);
Input.displayName = 'Input';
export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(({ className, ...p }, ref) => <select ref={ref} className={cn(control, 'font-medium', className)} {...p} />);
Select.displayName = 'Select';
export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(control, 'h-auto py-3 leading-[21px]', className)} {...p} />);
Textarea.displayName = 'Textarea';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      {children}
      {hint && !error && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
      {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Switch({ label, ...p }: { label: string } & ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root aria-label={label} className="relative h-7 w-[46px] flex-none cursor-pointer rounded-full bg-control-border transition-colors data-[state=checked]:bg-navy disabled:cursor-not-allowed disabled:opacity-60" {...p}>
      <SwitchPrimitive.Thumb className="block size-[22px] translate-x-[3px] rounded-full bg-white transition-transform data-[state=checked]:translate-x-[21px]" />
    </SwitchPrimitive.Root>
  );
}

export const LockedMark = () => <Lock aria-label="Locked rule" role="img" className="size-4 text-ink-muted" />;

export function StatCard({ label, value, note, alert }: { label: string; value: ReactNode; note?: ReactNode; alert?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-[18px] bg-white p-4', alert && 'bg-danger-soft')}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <b className="tnum text-[22px] leading-7 font-semibold">{value}</b>
      {note && <span className="text-xs text-ink-muted">{note}</span>}
    </div>
  );
}

export const Avatar = ({ initials, className }: { initials: string; className?: string }) => (
  <span aria-hidden className={cn('grid size-10 flex-none place-items-center rounded-full bg-tint text-sm font-semibold text-navy', className)}>{initials}</span>
);

/** Brief confirmation shown after an action. Announced to screen readers. */
export const Notice = ({ children }: { children: ReactNode }) =>
  children ? <p role="status" className="rounded-xl bg-tint px-4 py-3 text-sm font-medium text-navy">{children}</p> : null;
