import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Clock, PenLine, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { sample } from '@everycation/shared';
import { Avatar, Badge, Button, Chips, Empty, IconButton, Loading, Note, Screen, T, Toggle, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { countryName, initials, useCountryAdvice, useMarkHelpful, useReport, type Advice } from '@/lib/community';
import { useSession } from '@/lib/session';

const state: Record<Advice['status'], { label: string; tone: 'info' | 'gold' | 'danger' }> = {
  verified: { label: 'Verified', tone: 'info' }, in_review: { label: 'In review', tone: 'gold' }, rereview: { label: 'Being re-checked', tone: 'gold' },
  changes_requested: { label: 'Changes requested', tone: 'gold' }, rejected: { label: 'Not approved', tone: 'danger' },
};

export default function CountryAdvice() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = raw.toUpperCase(); const name = countryName(code);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const { data: list, isLoading, error } = useCountryAdvice(code, verifiedOnly);
  const helpful = useMarkHelpful(); const report = useReport();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [city, setCity] = useState('All'); const [topic, setTopic] = useState('All topics'); const [reported, setReported] = useState<string[]>([]); const [problem, setProblem] = useState('');
  const cities = ['All', ...new Set((list ?? []).map((a) => a.city))];
  const shown = (list ?? []).filter((a) => (city === 'All' || a.city === city) && (topic === 'All topics' || a.topic === topic));
  const verifiedCount = (list ?? []).filter((a) => a.status === 'verified').length;
  const needSignIn = () => { if (signedIn) return false; router.push('/sign-up'); return true; };

  async function flag(a: Advice) {
    if (needSignIn()) return;
    setProblem('');
    try { await report.mutateAsync({ targetType: 'advice', targetId: a.id, reason: 'Wrong or out of date' }); setReported((r) => [...r, a.id]); }
    catch (e) { setProblem(errorMessage(e)); }
  }
  return (
    <Screen title="" right={<IconButton icon={Share2} label="Share" onPress={() => Share.share({ message: `Travel advice for ${name} · EveryCation` })} />}
      footer={<Button variant="navy" icon={PenLine} label={`Share your ${name} advice`} onPress={() => router.push({ pathname: '/advice/share', params: { code } })} />}>
      <View className="flex-row items-center gap-3"><Avatar initials={code} size={52} /><View className="flex-1"><T v="h1">{name}</T><T v="small">{list ? `${verifiedCount} verified${verifiedOnly ? '' : ` · ${list.length} shown`}` : ' '}</T></View></View>
      {cities.length > 2 && <Chips options={cities} value={city} onChange={setCity} />}
      <Chips options={['All topics', ...sample.adviceTopics]} value={topic} onChange={setTopic} />
      <View className="flex-row items-center justify-between gap-3">
        <T v="small" className="flex-1">{verifiedOnly ? 'Showing advice our team has checked.' : 'Showing everything, including advice not checked yet.'} Most helpful first.</T>
        <Toggle label="Verified only" value={verifiedOnly} onChange={setVerifiedOnly} />
      </View>
      {isLoading && <Loading what="advice" />}
      {(!!error || !!problem) && <Note tone="danger">{problem || errorMessage(error)}</Note>}
      {list && shown.length === 0 && <Empty>{`No ${verifiedOnly ? 'verified ' : ''}advice here yet. If you have been, share what you learned.`}</Empty>}
      {shown.map((a) => {
        const s = state[a.status]; const verified = a.status === 'verified';
        return (
          <View key={a.id} className="gap-3 rounded-card bg-surface-muted p-4">
            <View className="flex-row items-center gap-3">
              <Avatar initials={initials(a.author.name)} onPress={() => go(`/traveller/${a.author.id}`)} />
              <View className="flex-1 gap-1"><T v="strong">{a.mine ? 'You' : a.author.name}</T>
                <View className="flex-row flex-wrap items-center gap-1.5"><Badge icon={verified ? BadgeCheck : Clock} tone={s.tone} label={s.label} /><T v="small" className="text-xs">{a.city}{a.visited ? ` · ${a.visited}` : ''}</T></View></View>
            </View>
            <T v="eyebrow">{a.topic.toUpperCase()}</T>
            <T>{a.body}</T>
            {a.mine && a.status === 'changes_requested' && (
              <><Note tone="gold">{`Our team asked for a change: ${a.reviewNote ?? 'please add more detail.'}`}</Note>
                <Button small variant="navy" label="Edit and send again" onPress={() => router.push({ pathname: '/advice/share', params: { code, reviseId: a.id, body: a.body, city: a.city, topic: a.topic } })} /></>
            )}
            {a.mine && a.status === 'rejected' && !!a.reviewNote && <Note tone="danger">{`Not approved: ${a.reviewNote}`}</Note>}
            {a.mine && a.status === 'in_review' && <T v="small" className="text-xs">Only you see this until our team approves it, unless a traveller switches &quot;Verified only&quot; off.</T>}
            {!a.mine && !verified && <T v="small" className="text-xs">Not checked by our team yet. Treat it as one traveller&apos;s experience.</T>}
            {!a.mine && (
              <View className="flex-row items-center gap-5">
                <Pressable accessibilityRole="button" accessibilityState={{ selected: a.markedHelpful }} onPress={() => { if (!needSignIn()) helpful.mutate(a.id); }} className={cx('h-9 justify-center rounded-full px-3.5', a.markedHelpful ? 'bg-navy' : 'border-[1.5px] border-control-border bg-white')}>
                  <Text className={cx('font-pop-sb text-[13px]', a.markedHelpful ? 'text-white' : 'text-ink')}>Helpful · {a.helpful}</Text></Pressable>
                <Text accessibilityRole="button" onPress={() => flag(a)} className="font-pop-sb text-[13px] text-ink-muted">{reported.includes(a.id) ? 'Reported' : 'Report'}</Text>
              </View>
            )}
          </View>
        );
      })}
    </Screen>
  );
}
