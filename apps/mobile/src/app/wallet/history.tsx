import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatNaira } from '@everycation/shared';
import { Button, Chips, Empty, Loading, Note, Screen, T, colors, cx } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useWalletHistory, type HistoryItem } from '@/lib/wallet';

const filters = ['All', 'Money in', 'Money out', 'Goals'] as const;
type Row = HistoryItem & { direction: 'in' | 'out' | 'move'; amount: number; detail: string };

/** What a transaction did to the wallet as a whole: money came in, went out, or moved between pots. */
function toRow(t: HistoryItem): Row {
  const net = t.movements.reduce((n, m) => n + m.amount, 0);
  const direction = net > 0 ? 'in' : net < 0 ? 'out' : 'move';
  const amount = direction === 'move' ? Math.max(...t.movements.map((m) => Math.abs(m.amount)), 0) : net;
  const day = new Date(t.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const where = direction === 'move' ? '' : ` · ${direction === 'in' ? 'to' : 'from'} ${t.movements[0]?.account.toLowerCase() ?? 'wallet'}`;
  return { ...t, direction, amount, detail: `${day}${where}` };
}
const match: Record<(typeof filters)[number], (r: Row) => boolean> = { All: () => true, 'Money in': (r) => r.direction === 'in', 'Money out': (r) => r.direction === 'out', Goals: (r) => r.kind.startsWith('goal') || r.movements.some((m) => m.account !== 'Available balance') };
const icon = { in: ArrowDownLeft, out: ArrowUpRight, move: ArrowLeftRight };
const group = (iso: string) => { const d = new Date(iso); const now = new Date(); return d.toDateString() === now.toDateString() ? 'TODAY' : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase(); };

export default function History() {
  const { data, isLoading, error, refetch } = useWalletHistory();
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const rows = (data?.items ?? []).filter((t) => t.movements.length > 0).map(toRow); // skip bank-side settlement steps
  const list = rows.filter(match[filter]);
  const thisMonth = rows.filter((r) => new Date(r.at).getMonth() === new Date().getMonth());
  const sum = (d: Row['direction']) => thisMonth.filter((r) => r.direction === d).reduce((n, r) => n + Math.abs(r.amount), 0);
  const groups = [...new Set(list.map((r) => group(r.at)))];
  return (
    <Screen title="Wallet history">
      <Chips options={filters} value={filter} onChange={setFilter} />
      <View className="flex-row gap-2">
        {([['In this month', sum('in')], ['Out this month', sum('out')], ['Moved to goals', sum('move')]] as const).map(([l, v]) => (
          <View key={l} className="flex-1 rounded-2xl bg-surface-muted p-3"><T v="small" className="text-xs">{l}</T><T v="label" className="text-sm">{formatNaira(v)}</T></View>
        ))}
      </View>
      {isLoading && <Loading what="your history" />}
      {!!error && <><Note tone="danger">{errorMessage(error)}</Note><Button variant="outline" label="Try again" onPress={() => refetch()} /></>}
      {data && list.length === 0 && <Empty>{rows.length ? 'No transactions of this kind yet.' : 'Nothing here yet. Add money to get started.'}</Empty>}
      {groups.map((g) => (
        <View key={g}><T v="eyebrow" className="text-ink-muted">{g}</T>
          {list.filter((r) => group(r.at) === g).map((r) => { const Icon = icon[r.direction]; return (
            <View key={r.reference} className="flex-row items-center gap-3 border-b border-line py-3">
              <View className={cx('h-10 w-10 items-center justify-center rounded-full', r.direction === 'in' ? 'bg-tint' : r.direction === 'out' ? 'bg-gold-soft' : 'bg-surface-muted')}><Icon size={20} color={colors.navy} /></View>
              <View className="flex-1"><T v="strong" className="text-sm">{r.description}</T><T v="small" className="text-xs">{r.detail}</T></View>
              <Text className={cx('font-pop-sb text-sm', r.direction === 'in' ? 'text-navy' : 'text-ink')}>{r.direction === 'move' ? formatNaira(r.amount) : formatNaira(r.amount, { sign: true })}</Text>
            </View>); })}
        </View>
      ))}
    </Screen>
  );
}
