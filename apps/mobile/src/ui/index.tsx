import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, Delete, Search, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, ScrollView, Switch, Text, TextInput, View, type TextInputProps, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { ImageKey } from '@everycation/shared';
import { colors } from '@everycation/tokens';
import { photos } from './photos';

export { colors };
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
/** Sample data stores links as strings; typed routes want an Href. */
export const go = (href: string) => router.push(href as Href);

const variants = {
  display: 'font-pop-sb text-[32px] leading-[38px] text-ink',
  h1: 'font-pop-sb text-[26px] leading-8 text-ink',
  h2: 'font-pop-sb text-xl leading-7 text-ink',
  title: 'font-pop-sb text-base leading-6 text-ink',
  body: 'font-pop text-[15px] leading-[22px] text-ink',
  strong: 'font-pop-sb text-[15px] leading-[22px] text-ink',
  small: 'font-pop text-[13px] leading-[19px] text-ink-muted',
  label: 'font-pop-sb text-[13px] leading-[18px] text-ink',
  eyebrow: 'font-pop-sb text-[11px] leading-4 tracking-widest text-heading-blue',
} as const;
export function T({ v = 'body', className, ...p }: TextProps & { v?: keyof typeof variants }) {
  return <Text className={cx(variants[v], className)} {...p} />;
}

export function Photo({ k, className, alt }: { k: ImageKey; className?: string; alt?: string }) {
  return (
    <View className={cx('overflow-hidden bg-surface-muted', className)}>
      <Image source={photos[k]} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={alt} accessible={!!alt} transition={150} />
    </View>
  );
}

export function IconButton({ icon: Icon, label, onPress, tone = 'plain', badge }: { icon: LucideIcon; label: string; onPress?: () => void; tone?: 'plain' | 'glass' | 'navy'; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      className={cx('h-11 w-11 items-center justify-center rounded-full active:opacity-70', tone === 'glass' && 'bg-white', tone === 'navy' && 'bg-navy')}>
      <Icon size={22} color={tone === 'navy' ? colors.onNavy : colors.ink} strokeWidth={2} />
      {!!badge && <View className="absolute -right-0.5 -top-0.5 h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1"><Text className="font-pop-b text-[11px] text-ink">{badge}</Text></View>}
    </Pressable>
  );
}

export function Header({ title, back = true, right, onBack }: { title?: string; back?: boolean; right?: ReactNode; onBack?: () => void }) {
  return (
    <View className="min-h-14 flex-row items-center gap-1 px-3 py-1.5">
      {back && <IconButton icon={ChevronLeft} label="Back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/explore')))} />}
      <T v="title" className={cx('flex-1 text-lg', !back && 'pl-2')} numberOfLines={1} accessibilityRole="header">{title}</T>
      {right}
    </View>
  );
}

/** Page shell: safe area, optional header, scrolling body and a pinned footer for the main action. */
export function Screen({ title, back, right, footer, scroll = true, children, className, edges = ['top', 'bottom'], bg = 'bg-white' }: {
  title?: string; back?: boolean; right?: ReactNode; footer?: ReactNode; scroll?: boolean; children: ReactNode; className?: string; edges?: ('top' | 'bottom')[]; bg?: string;
}) {
  const body = <View className={cx('gap-5 px-5 pb-8 pt-2', !scroll && 'flex-1', className)}>{children}</View>;
  return (
    <SafeAreaView edges={edges} className={cx('flex-1', bg)}>
      <View className="w-full max-w-[520px] flex-1 self-center">
        {(title !== undefined || right) && <Header title={title} back={back} right={right} />}
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{body}</ScrollView> : body}
        {footer && <View className="gap-2 border-t border-line bg-white px-5 pb-3 pt-3">{footer}</View>}
      </View>
    </SafeAreaView>
  );
}

const btn = {
  primary: ['bg-gold', 'text-ink'], navy: ['bg-navy', 'text-white'], outline: ['border-[1.5px] border-control-border bg-white', 'text-ink'],
  ghost: ['', 'text-heading-blue'], danger: ['border-[1.5px] border-danger bg-white', 'text-danger'],
} as const;
export function Button({ label, onPress, variant = 'primary', disabled, icon: Icon, small, className }: { label: string; onPress?: () => void; variant?: keyof typeof btn; disabled?: boolean; icon?: LucideIcon; small?: boolean; className?: string }) {
  const [box, text] = btn[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      className={cx('flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-80', small ? 'h-10' : 'h-[52px]', box, disabled && 'opacity-40', className)}>
      {Icon && <Icon size={18} color={variant === 'navy' ? '#fff' : variant === 'ghost' ? colors.headingBlue : colors.ink} />}
      <Text className={cx('font-pop-sb', small ? 'text-[13px]' : 'text-sm', variant === 'primary' && !small && 'tracking-wide', text)}>{label}</Text>
    </Pressable>
  );
}

export function Chips<V extends string>({ options, value, onChange, wrap }: { options: readonly V[]; value: V; onChange: (v: V) => void; wrap?: boolean }) {
  const items = options.map((o) => {
    const on = o === value;
    return (
      <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o)}
        className={cx('h-10 items-center justify-center rounded-full px-4', on ? 'bg-navy' : 'border-[1.5px] border-control-border bg-white')}>
        <Text className={cx('font-pop-md text-[13px]', on ? 'text-white' : 'text-ink')}>{o}</Text>
      </Pressable>
    );
  });
  if (wrap) return <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">{items}</View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5" accessibilityRole="tablist">{items}</ScrollView>;
}

export function Segmented<V extends string>({ options, value, onChange }: { options: readonly V[]; value: V; onChange: (v: V) => void }) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-full bg-surface-muted p-1">
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)} className={cx('h-10 flex-1 items-center justify-center rounded-full', o === value && 'bg-white')}>
          <Text className={cx('text-[13px]', o === value ? 'font-pop-sb text-navy' : 'font-pop-md text-ink-muted')}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Avatar = ({ initials, size = 40, onPress }: { initials: string; size?: number; onPress?: () => void }) => (
  <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `Open profile ${initials}` : undefined}
    style={{ width: size, height: size }} className="items-center justify-center rounded-full bg-tint">
    <Text className="font-pop-sb text-navy" style={{ fontSize: size * 0.36 }}>{initials}</Text>
  </Pressable>
);

export const Card = ({ children, className, onPress, label }: { children: ReactNode; className?: string; onPress?: () => void; label?: string }) =>
  onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={cx('rounded-card bg-surface-muted p-4 active:opacity-80', className)}>{children}</Pressable>
    : <View className={cx('rounded-card bg-surface-muted p-4', className)}>{children}</View>;

export const Note = ({ children, icon: Icon, tone = 'info' }: { children: ReactNode; icon?: LucideIcon; tone?: 'info' | 'gold' | 'danger' }) => (
  <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} className={cx('flex-row gap-3 rounded-2xl p-3.5', tone === 'info' ? 'bg-tint' : tone === 'gold' ? 'bg-gold-soft' : 'bg-danger-soft')}>
    {Icon && <Icon size={20} color={tone === 'danger' ? colors.danger : colors.navy} />}
    <Text className={cx('flex-1 font-pop text-[13px] leading-5', tone === 'danger' ? 'text-danger' : 'text-ink')}>{children}</Text>
  </View>
);

export const Badge = ({ label, tone = 'info', icon: Icon }: { label: string; tone?: 'info' | 'gold' | 'navy' | 'neutral' | 'danger'; icon?: LucideIcon }) => (
  <View className={cx('flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', { info: 'bg-tint', gold: 'bg-gold-soft', navy: 'bg-navy', neutral: 'bg-surface-muted', danger: 'bg-danger-soft' }[tone])}>
    {Icon && <Icon size={12} color={tone === 'navy' ? '#fff' : colors.navy} />}
    <Text className={cx('font-pop-sb text-[11px]', tone === 'navy' ? 'text-white' : tone === 'info' ? 'text-navy' : tone === 'danger' ? 'text-danger' : 'text-ink')}>{label}</Text>
  </View>
);

export const Progress = ({ pct, tone = 'sky' }: { pct: number; tone?: 'sky' | 'gold' }) => (
  <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} className="h-2 overflow-hidden rounded-full bg-line">
    <View className={cx('h-full rounded-full', tone === 'sky' ? 'bg-sky' : 'bg-gold')} style={{ width: `${pct}%` }} />
  </View>
);

export const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.navy, false: colors.controlBorder }} thumbColor="#fff"
    // @ts-expect-error web-only prop from react-native-web
    activeThumbColor="#fff" />
);

export function ListRow({ icon: Icon, title, subtitle, right, onPress, chevron = !!onPress, danger }: { icon?: LucideIcon; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; chevron?: boolean; danger?: boolean }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} className="min-h-14 flex-row items-center gap-3 border-b border-line py-3 active:opacity-70">
      {Icon && <View className="h-10 w-10 items-center justify-center rounded-full bg-tint"><Icon size={20} color={colors.navy} /></View>}
      <View className="flex-1">
        <Text className={cx('font-pop-md text-[15px]', danger ? 'text-danger' : 'text-ink')}>{title}</Text>
        {subtitle && <Text className="font-pop text-[13px] leading-[18px] text-ink-muted">{subtitle}</Text>}
      </View>
      {right}
      {chevron && <ChevronRight size={18} color={colors.inkMuted} />}
    </Pressable>
  );
}

export const SectionTitle = ({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) => (
  <View className="flex-row items-end justify-between">
    <View className="gap-1"><T v="title" className="text-lg" accessibilityRole="header">{children}</T><View className="h-[3px] w-9 rounded-full bg-gold" /></View>
    {action && <Pressable accessibilityRole="link" hitSlop={10} onPress={onAction}><Text className="font-pop-sb text-[13px] text-heading-blue">{action}</Text></Pressable>}
  </View>
);

const inputBox = 'rounded-xl border-[1.5px] bg-white px-4 font-pop text-[15px] text-ink focus:border-navy';
export function Input({ label, error, hint, className, ...p }: TextInputProps & { label?: string; error?: string; hint?: string }) {
  return (
    <View className="gap-1.5">
      {label && <T v="label">{label}</T>}
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.inkMuted} className={cx(inputBox, error ? 'border-danger' : 'border-control-border', p.multiline ? 'h-28 py-3' : 'h-[52px]', className)} textAlignVertical={p.multiline ? 'top' : undefined} {...p} />
      {error ? <Text accessibilityRole="alert" className="font-pop-md text-xs text-danger">{error}</Text> : hint ? <Text className="font-pop text-xs text-ink-muted">{hint}</Text> : null}
    </View>
  );
}
/** `Input` wired to react-hook-form. Shows the Zod message under the field. */
export function FormInput<F extends FieldValues>({ control, name, ...p }: { control: Control<F>; name: FieldPath<F> } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChangeText'>) {
  return <Controller control={control} name={name} render={({ field, fieldState }) => <Input value={String(field.value ?? '')} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} {...p} />} />;
}

export function PinPad({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const press = (k: string) => { if (k === 'del') onChange(value.slice(0, -1)); else if (value.length < length) onChange(value + k); };
  return (
    <View className="items-center gap-7">
      <View accessibilityLabel={`${value.length} of ${length} digits entered`} className="flex-row gap-4">
        {Array.from({ length }, (_, i) => <View key={i} className={cx('h-4 w-4 rounded-full border-[1.5px]', i < value.length ? 'border-navy bg-navy' : 'border-control-border')} />)}
      </View>
      <View className="w-full max-w-[300px] flex-row flex-wrap justify-between gap-y-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? <View key="sp" className="h-[68px] w-[30%]" /> : (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === 'del' ? 'Delete' : k} onPress={() => press(k)} className="h-[68px] w-[30%] items-center justify-center rounded-2xl bg-surface-muted active:bg-tint">
            {k === 'del' ? <Delete size={24} color={colors.ink} /> : <Text className="font-pop-md text-2xl text-ink">{k}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Mark({ size = 40, color = colors.navy }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 83.7 84.4" accessibilityLabel="EveryCation">
      <Path transform="translate(-11.2 -10.2)" fill={color === 'brand' ? colors.gold : color} d="M42.4 10.2 L84.2 22 L94.9 64.6 L89.5 70.2 L75.8 66.8 L81.5 59.6 L74.4 31.1 L46.1 24.2 L37.1 33.1 L24.3 29.3 Z" />
      <Path transform="translate(-11.2 -10.2)" fill={color === 'brand' ? colors.sky : color} d="M18.1 35.1 L30 38.2 L24.4 45.4 L30.2 67.1 L51.2 46.1 L59.5 53.5 L39.8 75.6 L60.4 81.8 L70.1 72.9 L82.8 76.1 L64.6 94.6 L22.8 83.9 L11.2 41.9 Z" />
    </Svg>
  );
}

export const Loading = ({ what = 'this' }: { what?: string }) => <T v="small" className="py-10 text-center">Loading {what}…</T>;
export const Empty = ({ children }: { children: string }) => <T v="small" className="py-8 text-center">{children}</T>;
export const Row = ({ children, className }: { children: ReactNode; className?: string }) => <View className={cx('flex-row items-center', className)}>{children}</View>;
export const KeyValue = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <View className="flex-row justify-between gap-4 py-2"><Text className="font-pop text-sm text-ink-muted">{k}</Text><Text className={cx('flex-shrink text-right text-sm text-ink', strong ? 'font-pop-b text-base' : 'font-pop-md')}>{v}</Text></View>
);

export const Stats = ({ items }: { items: [string | number, string][] }) => (
  <View className="flex-row justify-around rounded-card bg-surface-muted py-3.5">
    {items.map(([n, l]) => <View key={l} className="items-center"><T v="title" className="text-lg">{n}</T><T v="small">{l}</T></View>)}
  </View>
);

/** A radio-style choice row, used for payment sources and destinations. */
export const Option = ({ title, sub, on, onPress, right }: { title: string; sub?: string; on: boolean; onPress: () => void; right?: string }) => (
  <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} className={cx('min-h-[60px] flex-row items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2.5', on ? 'border-navy bg-tint' : 'border-line bg-white')}>
    <View className={cx('h-5 w-5 items-center justify-center rounded-full border-2', on ? 'border-navy bg-navy' : 'border-control-border')}>{on && <Check size={12} color="#fff" strokeWidth={3} />}</View>
    <View className="flex-1"><Text className="font-pop-md text-[15px] text-ink">{title}</Text>{sub && <Text className="font-pop text-xs text-ink-muted">{sub}</Text>}</View>
    {right && <Text className="font-pop-sb text-sm text-ink">{right}</Text>}
  </Pressable>
);

export function SearchBar({ className, ...p }: TextInputProps) {
  return (
    <View className={cx('h-[52px] min-w-0 flex-row items-center gap-2.5 rounded-full bg-surface-muted px-4', className)}>
      <Search size={20} color={colors.inkMuted} />
      <TextInput placeholderTextColor={colors.inkMuted} accessibilityLabel={p.placeholder} returnKeyType="search" className="h-full min-w-0 flex-1 font-pop text-[15px] text-ink" {...p} />
      {!!p.value && <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => p.onChangeText?.('')}><X size={18} color={colors.inkMuted} /></Pressable>}
    </View>
  );
}
