import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, Globe, Heart, MessageCircle, Phone, X } from 'lucide-react-native';
import { IconSavings } from '@/ui/icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNaira } from '@everycation/shared';
import { Button, IconButton, Loading, Note, Screen, T, colors, cx } from '@/ui';
import { PackageCover, SponsoredTag, nightsText } from '@/ui/package-card';
import { errorMessage } from '@/lib/api';
import { enquire, usePackage, type Channel } from '@/lib/packages';
import { useSession } from '@/lib/session';
import { TONE_STYLE, flag, usePassport, useRequirement } from '@/lib/travel';
import { useAddBucket, useBucket } from '@/lib/trips';

const showDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const SAMPLE_NOTE = {
  whatsapp: 'On a real package this opens a WhatsApp chat with the travel company, with the package name already written in.',
  call: 'On a real package this calls the travel company directly.',
  website: 'On a real package this opens the travel company’s booking page.',
};

export default function PackageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, isLoading, error } = usePackage(id);
  const passport = usePassport().code; const entry = useRequirement(passport, p?.countryCode);
  const signedIn = useSession((s) => s.status === 'signedIn');
  const bucket = useBucket(); const addBucket = useAddBucket();
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState<Channel | null>(null); const [problem, setProblem] = useState('');

  if (isLoading) return <Screen title=""><Loading what="the package" /></Screen>;
  if (!p) return <Screen title="Package"><Note tone="danger">{error ? errorMessage(error) : 'This package is no longer available.'}</Note></Screen>;

  const source = `package:${p.id}`; const inBucket = !!bucket.data?.some((b) => b.source === source);
  async function contact(channel: Exclude<Channel, 'save'>) {
    setProblem(''); setBusy(channel);
    try { const r = await enquire(p!.id, channel); if (r.sample) setNotice(SAMPLE_NOTE[channel]); else if (r.url) await Linking.openURL(r.url); }
    catch (e) { setProblem(errorMessage(e)); } finally { setBusy(null); }
  }
  function save() {
    void enquire(p!.id, 'save').catch(() => {});
    if (!signedIn) return router.push('/sign-up');
    router.push({ pathname: '/wallet/new-goal', params: { name: p!.title, target: String(p!.price), kind: 'package' } });
  }
  const tone = entry.data ? TONE_STYLE[entry.data.tone] : null;

  return (
    <View className="flex-1 bg-white">
      <ScrollView><View className="w-full max-w-[520px] self-center">
        <View>
          <PackageCover p={p} className="h-[300px]" big />
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
            <View className="flex-row items-center justify-between px-5 pt-2">
              <IconButton tone="glass" icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} />
              <SponsoredTag p={p} light />
            </View>
          </SafeAreaView>
        </View>
        <View className="-mt-6 gap-5 rounded-t-[28px] bg-white px-5 pb-8 pt-6">
          <View className="gap-1.5">
            <T v="eyebrow" className="text-ink-muted">{flag(p.countryCode)} {p.destination.toUpperCase()} · {nightsText(p.nights).toUpperCase()}</T>
            <T v="h2">{p.title}</T>
            <T v="small">Sponsored by <Text className="font-pop-sb text-ink">{p.advertiser.name}</Text></T>
          </View>
          <View className="flex-row items-center justify-between rounded-card bg-tint p-4">
            <View><Text className="font-pop text-xs text-ink-muted">From</Text><Text className="font-pop-sb text-2xl text-navy">{formatNaira(p.price)}</Text>{!!p.priceNote && <Text className="font-pop text-xs text-ink-muted">{p.priceNote}</Text>}</View>
            {(p.travelFrom || p.travelTo) && <View className="items-end"><Text className="font-pop text-xs text-ink-muted">Travel</Text><Text className="font-pop-sb text-sm text-ink">{p.travelFrom ? `From ${showDay(p.travelFrom)}` : ''}{p.travelTo ? ` to ${showDay(p.travelTo)}` : ''}</Text></View>}
          </View>
          {p.sample && <Note>This is a sample package, made to show how sponsored packages look. Its price is illustrative and the buttons do not contact anyone.</Note>}
          {!!p.summary && <T className="text-[15px] leading-6">{p.summary}</T>}

          {p.includes.length > 0 && (
            <View className="gap-2.5"><T v="strong">What is included</T>
              {p.includes.map((i) => <View key={i} className="flex-row gap-2.5"><Check size={18} color="#1E7034" /><T className="flex-1 text-[15px]">{i}</T></View>)}</View>
          )}
          {p.excludes.length > 0 && (
            <View className="gap-2.5"><T v="strong">Not included</T>
              {p.excludes.map((i) => <View key={i} className="flex-row gap-2.5"><X size={18} color={colors.inkMuted} /><T className="flex-1 text-[15px] text-ink-muted">{i}</T></View>)}</View>
          )}
          {p.itinerary.length > 0 && (
            <View className="gap-3"><T v="strong">The plan</T>
              {p.itinerary.map((d, n) => (
                <View key={`${d.day}${n}`} className="flex-row gap-3">
                  <View className="items-center"><View className="h-3 w-3 rounded-full bg-navy" />{n < p.itinerary.length - 1 && <View className="w-0.5 flex-1 bg-line" />}</View>
                  <View className="flex-1 gap-0.5 pb-1"><T v="eyebrow" className="text-heading-blue">{d.day.toUpperCase()}</T><T v="strong">{d.title}</T>{!!d.detail && <T v="small">{d.detail}</T>}</View>
                </View>
              ))}
            </View>
          )}
          {entry.data && tone && entry.data.entry !== 'own_country' && (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/requirements', params: { to: p.countryCode } })} style={{ backgroundColor: tone.bg }} className="gap-1 rounded-card p-3.5 active:opacity-80">
              <Text style={{ color: tone.ink }} className="font-pop-md text-xs">{flag(p.countryCode)} Visa & entry for {entry.data.toName} · {entry.data.fromName} passport</Text>
              <View className="flex-row items-center gap-2"><tone.icon size={22} color={tone.ink} accent={tone.accent} /><Text style={{ color: tone.ink }} className="flex-1 font-pop-sb text-base">{entry.data.title}{entry.data.days ? ` · up to ${entry.data.days} days` : ''}</Text></View>
              <Text style={{ color: tone.ink }} className="font-pop-sb text-[13px]">See what you need and make a checklist →</Text>
            </Pressable>
          )}
          <View className="flex-row gap-3">
            <Button className="flex-1" variant="outline" icon={IconSavings} label="Save for it" onPress={save} />
            <Button className="flex-1" variant={inBucket ? 'ghost' : 'outline'} icon={Heart} disabled={inBucket} label={inBucket ? 'On bucket list' : 'Bucket list'}
              onPress={() => (signedIn ? addBucket.mutate({ title: p.title, source, vibe: p.vibe ?? undefined, place: p.destination, countryCode: p.countryCode, ...(p.lat !== null && p.lng !== null && { lat: p.lat, lng: p.lng }) }) : router.push('/sign-up'))} />
          </View>
          <T v="small" className="text-xs">EveryCation shows this package for {p.advertiser.name.replace(' (sample agency)', '')}. Bookings, payments and refunds are between you and them, so check the details with them before you pay.</T>
        </View>
      </View></ScrollView>
      <SafeAreaView edges={['bottom']} className="border-t border-line bg-white"><View className="w-full max-w-[520px] gap-2 self-center px-5 py-3">
        {!!notice && <Note>{notice}</Note>}
        {!!problem && <Note tone="danger">{problem}</Note>}
        <View className="flex-row gap-2.5">
          {p.contact.whatsapp && <View className="flex-1"><Button icon={MessageCircle} label={busy === 'whatsapp' ? 'OPENING…' : 'ENQUIRE ON WHATSAPP'} disabled={!!busy} onPress={() => contact('whatsapp')} /></View>}
          {p.contact.call && <ContactIcon icon={Phone} label="Call" onPress={() => contact('call')} />}
          {p.contact.website && <ContactIcon icon={Globe} label="Website" onPress={() => contact('website')} />}
        </View>
      </View></SafeAreaView>
    </View>
  );
}

const ContactIcon = ({ icon: Icon, label, onPress }: { icon: typeof Phone; label: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={cx('h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-navy active:bg-tint')}><Icon size={20} color={colors.navy} /></Pressable>
);
