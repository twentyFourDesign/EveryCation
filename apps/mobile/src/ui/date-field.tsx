import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { T, colors, cx } from './index';

/** Dates are calendar days as "YYYY-MM-DD", worked out in UTC so they never shift with the phone's time zone. */
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parts = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y: y!, m: m! - 1, d: d! }; };
export const todayIso = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()); };
export const addDays = (s: string, n: number) => { const p = parts(s); const t = new Date(Date.UTC(p.y, p.m, p.d + n)); return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
export const showDate = (s: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function Calendar({ value, min, max, onPick }: { value: string | null; min?: string; max?: string; onPick: (d: string) => void }) {
  const start = parts(value ?? (min && min > todayIso() ? min : max && max < todayIso() ? max : todayIso()));
  const [month, setMonth] = useState({ y: start.y, m: start.m });
  const [years, setYears] = useState(false);
  const today = todayIso();
  const first = new Date(Date.UTC(month.y, month.m, 1)).getUTCDay(); const lead = (first + 6) % 7; // Monday first
  const count = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const step = (n: number) => setMonth(({ y, m }) => { const t = m + n; return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);
  const lo = min ? parts(min).y : Number(today.slice(0, 4)) - 100;
  const hi = max ? parts(max).y : Number(today.slice(0, 4)) + 10;

  if (years) return (
    <ScrollView className="max-h-[320px]" contentContainerClassName="flex-row flex-wrap gap-2 py-1">
      {Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).map((y) => (
        <Pressable key={y} accessibilityRole="button" onPress={() => { setMonth((c) => ({ ...c, y })); setYears(false); }}
          className={cx('h-10 w-[22%] items-center justify-center rounded-full', y === month.y ? 'bg-navy' : 'bg-surface-muted')}>
          <Text className={cx('font-pop-md text-sm', y === month.y ? 'text-white' : 'text-ink')}>{y}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
  return (
    <View className="gap-2">
      <View className="flex-row items-center">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => step(-1)} className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-muted"><ChevronLeft size={22} color={colors.navy} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a year" onPress={() => setYears(true)} className="flex-1 items-center py-1">
          <Text className="font-pop-sb text-base text-ink">{MONTHS[month.m]} {month.y} ▾</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => step(1)} className="h-10 w-10 items-center justify-center rounded-full active:bg-surface-muted"><ChevronRight size={22} color={colors.navy} /></Pressable>
      </View>
      <View className="flex-row">{DAYS.map((d) => <Text key={d} className="flex-1 text-center font-pop-md text-xs text-ink-muted">{d}</Text>)}</View>
      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} className="h-11 w-[14.28%]" />;
          const d = iso(month.y, month.m, day); const on = d === value; const ok = allowed(d);
          return (
            <View key={d} className="h-11 w-[14.28%] items-center justify-center">
              <Pressable accessibilityRole="button" accessibilityLabel={showDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} accessibilityState={{ selected: on, disabled: !ok }} disabled={!ok} onPress={() => onPick(d)}
                className={cx('h-10 w-10 items-center justify-center rounded-full', on ? 'bg-navy' : d === today ? 'border-[1.5px] border-navy' : ok && 'active:bg-surface-muted')}>
                <Text className={cx('font-pop-md text-sm', on ? 'text-white' : ok ? 'text-ink' : 'text-line')}>{day}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * A date box that opens a calendar. `value` is "YYYY-MM-DD" or "" for none.
 * `min` and `max` stop days outside them being picked; tap the month to jump between years.
 */
export function DateField({ label, value, onChange, min, max, error, placeholder = 'Choose a date', optional }: {
  label: string; value: string; onChange: (d: string) => void; min?: string; max?: string; error?: string; placeholder?: string; optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1.5">
      <T v="label">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}${value ? `, ${showDate(value)}` : ''}`} onPress={() => setOpen(true)}
        className={cx('h-[52px] flex-row items-center gap-2 rounded-xl border-[1.5px] bg-white px-4', error ? 'border-danger' : open ? 'border-navy' : 'border-control-border')}>
        <Text numberOfLines={1} className={cx('flex-1 font-pop text-[15px]', value ? 'text-ink' : 'text-ink-muted')}>{value ? showDate(value) : placeholder}</Text>
        <CalendarDays size={19} color={value ? colors.navy : colors.inkMuted} />
      </Pressable>
      {!!error && <Text accessibilityRole="alert" className="font-pop-md text-xs text-danger">{error}</Text>}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close the calendar" onPress={() => setOpen(false)} className="flex-1 items-center justify-end bg-black/40 sm:justify-center">
          <Pressable onPress={() => {}} className="w-full max-w-[440px] gap-3 rounded-t-[28px] bg-white px-5 pb-8 pt-4 sm:rounded-[28px] sm:pb-5">
            <View className="flex-row items-center">
              <T v="strong" className="flex-1">{label.replace(/ \*$/, '')}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setOpen(false)}><X size={22} color={colors.inkMuted} /></Pressable>
            </View>
            <Calendar value={value || null} min={min} max={max} onPick={(d) => { onChange(d); setOpen(false); }} />
            {optional && !!value && (
              <Pressable accessibilityRole="button" onPress={() => { onChange(''); setOpen(false); }} className="items-center py-2"><Text className="font-pop-sb text-sm text-heading-blue">Clear date</Text></Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
