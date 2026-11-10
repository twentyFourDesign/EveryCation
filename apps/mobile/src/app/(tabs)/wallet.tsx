import { router } from 'expo-router';
import { ArrowDownToLine, ArrowUpFromLine, Check, History, Lock, ShieldCheck, Target } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNaira } from '@everycation/shared';
import { Button, Header, IconButton, Loading, Mark, Note, Photo, Progress, SectionTitle, T, colors, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { goalImage, nextSetupStep, useWallet } from '@/lib/wallet';


function Intro({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <View className="gap-5 px-5 pt-8">
      <View className="items-center gap-3"><View className="h-20 w-20 items-center justify-center rounded-full bg-tint"><ShieldCheck size={40} color={colors.navy} /></View>
        <T v="h2" className="text-center">{title}</T><T className="text-center text-ink-muted">{body}</T></View>
      {children}
    </View>
  );
}

export default function Wallet() {
  const status = useSession((s) => s.status);
  const { data: w, isLoading, error, refetch, isRefetching } = useWallet();
  const actions = [{ l: 'Add money', i: ArrowDownToLine, h: '/wallet/add-money' }, { l: 'Withdraw', i: ArrowUpFromLine, h: '/wallet/withdraw' }, { l: 'New goal', i: Target, h: '/wallet/new-goal' }];
  const steps = w ? [['Confirm your identity', w.setup.identity === 'verified'], ['Create your wallet PIN', w.setup.hasPin], ['Link your bank account', w.setup.hasBank]] as const : [];
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="w-full max-w-[520px] flex-1 self-center">
        <Header title="Travel wallet" back={false} right={w?.setup.ready ? <IconButton icon={History} label="Wallet history" onPress={() => router.push('/wallet/history')} /> : undefined} />
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={w ? <RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.navy} /> : undefined}>
          {status !== 'signedIn' ? (
            <Intro title="Sign in to use your wallet" body="Save for trips and travel shopping, and withdraw to your bank whenever you need to."><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></Intro>
          ) : isLoading ? <Loading what="your wallet" /> : error || !w ? (
            <View className="gap-4 px-5 pt-8"><Note tone="danger">{errorMessage(error)}</Note><Button variant="outline" label="Try again" onPress={() => refetch()} /></View>
          ) : !w.setup.ready ? (
            <Intro title="Set up your travel wallet" body="Three short steps, about three minutes. Your money is held with a licensed bank partner.">
              <View className="gap-2.5">{steps.map(([label, done], i) => (
                <View key={label} className="flex-row items-center gap-3 rounded-2xl bg-surface-muted p-3.5">
                  <View className={cx('h-7 w-7 items-center justify-center rounded-full', done ? 'bg-navy' : 'border-2 border-control-border')}>{done ? <Check size={14} color="#fff" strokeWidth={3} /> : <Text className="font-pop-sb text-xs text-ink-muted">{i + 1}</Text>}</View>
                  <T v="strong" className={cx(done && 'text-ink-muted')}>{label}</T>
                </View>))}</View>
              <Button label={steps.some(([, d]) => d) ? 'CONTINUE SETUP' : 'SET UP WALLET'} onPress={() => router.push(nextSetupStep(w.setup))} />
            </Intro>
          ) : (
            <View className="gap-5 px-5 pb-8 pt-2">
              <View className="gap-4 overflow-hidden rounded-card bg-navy p-5">
                <View className="absolute -right-6 -top-6 opacity-10"><Mark size={150} color="#fff" /></View>
                <View><Text className="font-pop text-[13px] text-navy-text-soft">Total balance</Text><Text accessibilityLabel={`Total balance ${formatNaira(w.total)}`} className="font-pop-sb text-[36px] leading-[44px] text-white">{formatNaira(w.total)}</Text></View>
                <View className="flex-row gap-6">
                  <View><Text className="font-pop text-xs text-navy-text-soft">Available</Text><Text className="font-pop-sb text-base text-white">{formatNaira(w.available)}</Text></View>
                  <View><Text className="font-pop text-xs text-navy-text-soft">In savings goals</Text><Text className="font-pop-sb text-base text-white">{formatNaira(w.inGoals)}</Text></View>
                </View>
              </View>
              {w.frozen && <Note tone="danger" icon={Lock}>Your wallet is frozen. No money can go out until you unfreeze it in Wallet settings.</Note>}
              <View className="flex-row gap-3">
                {actions.map((a) => (
                  <Pressable key={a.l} accessibilityRole="button" accessibilityLabel={a.l} onPress={() => go(a.h)} className="flex-1 items-center gap-2 rounded-card bg-surface-muted py-4 active:opacity-70">
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-gold"><a.i size={20} color={colors.ink} /></View><T v="label">{a.l}</T>
                  </Pressable>
                ))}
              </View>
              <SectionTitle action="Settings" onAction={() => router.push('/wallet/settings')}>Savings goals</SectionTitle>
              {w.goals.length === 0 && <View className="gap-3 rounded-card bg-surface-muted p-4"><T v="strong">No goals yet</T><T v="small">Put money aside for a trip or travel shopping, and lock it until you need it.</T><Button small variant="navy" label="Create your first goal" onPress={() => router.push('/wallet/new-goal')} /></View>}
              {w.goals.map((g) => (
                <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`${g.name}, ${formatNaira(g.saved)} of ${formatNaira(g.target)}`} onPress={() => go(`/wallet/goal/${g.id}`)} className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3 active:opacity-80">
                  <Photo k={goalImage(g)} className="h-16 w-16 rounded-2xl" />
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row items-center gap-2"><T v="strong" className="flex-shrink" numberOfLines={1}>{g.name}</T>{g.locked && <Lock size={14} color={colors.inkMuted} accessibilityLabel="Locked" />}</View>
                    <Progress pct={g.percent} /><T v="small" className="text-xs">{formatNaira(g.saved)} of {formatNaira(g.target)}</T>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
