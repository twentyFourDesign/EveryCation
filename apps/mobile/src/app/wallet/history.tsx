import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira, type WalletTxn } from '@everycation/shared';
import { Chips, Empty, Screen, T, colors, cx } from '@/ui';
import { useApp } from '@/lib/store';

const filters = ['All', 'Money in', 'Money out', 'Goals'] as const;
const match: Record<(typeof filters)[number], (t: WalletTxn) => boolean> = { All: () => true, 'Money in': (t) => t.direction === 'in', 'Money out': (t) => t.direction === 'out', Goals: (t) => t.type === 'goal' };
const icon = { in: ArrowDownLeft, out: ArrowUpRight, move: ArrowLeftRight };

export default function History() {
  const txns = useApp((s) => s.txns);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const list = txns.filter(match[filter]);
  const nov = txns.filter((t) => t.group !== 'OCTOBER');
  const sum = (f: (t: WalletTxn) => boolean) => nov.filter(f).reduce((n, t) => n + Math.abs(t.amount), 0);
  const groups = [...new Set(list.map((t) => t.group))];
  return (
    <Screen title="Wallet history">
      <Chips options={filters} value={filter} onChange={setFilter} />
      <View className="flex-row gap-2">
        {[['In · Nov', sum((t) => t.direction === 'in')], ['Out · Nov', sum((t) => t.direction === 'out')], ['Into goals', sum((t) => t.type === 'goal' && t.direction !== 'out')]].map(([l, v]) => (
          <View key={l as string} className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">{l}</T><T v="label" className="text-sm">{formatNaira(v as number)}</T></View>
        ))}
      </View>
      {list.length === 0 && <Empty>No transactions of this kind yet.</Empty>}
      {groups.map((g) => (
        <View key={g}><T v="eyebrow" className="text-ink-muted">{g}</T>
          {list.filter((t) => t.group === g).map((t) => { const Icon = icon[t.direction]; return (
            <View key={t.id} className="flex-row items-center gap-3 border-b border-line py-3">
              <View className={cx('h-10 w-10 items-center justify-center rounded-full', t.direction === 'in' ? 'bg-tint' : t.direction === 'out' ? 'bg-gold-soft' : 'bg-surface-muted')}><Icon size={20} color={colors.navy} /></View>
              <View className="flex-1"><T v="strong" className="text-sm">{t.title}</T><T v="small" className="text-xs">{t.detail}</T></View>
              <Text className={cx('font-pop-sb text-sm', t.direction === 'in' ? 'text-navy' : 'text-ink')}>{t.direction === 'move' ? formatNaira(t.amount) : formatNaira(t.amount, { sign: true })}</Text>
            </View>); })}
        </View>
      ))}
    </Screen>
  );
}
