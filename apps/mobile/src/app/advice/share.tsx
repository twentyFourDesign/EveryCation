import { router, useLocalSearchParams } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { sample } from '@everycation/shared';
import { Button, Chips, Input, Note, Screen, T, Toggle } from '@/ui';
import { NameGate } from '@/ui/name-gate';
import { errorMessage } from '@/lib/api';
import { countryName, findCountry, useReviseAdvice, useShareAdvice } from '@/lib/community';

function ShareAdviceForm() {
  const p = useLocalSearchParams<{ code?: string; reviseId?: string; body?: string; city?: string; topic?: string }>();
  const share = useShareAdvice(); const revise = useReviseAdvice();
  const [country, setCountry] = useState(p.code ? countryName(p.code) : ''); const [city, setCity] = useState(p.city ?? '');
  const [topic, setTopic] = useState(p.topic ?? 'Money'); const [body, setBody] = useState(p.body ?? ''); const [visited, setVisited] = useState('');
  const [showPassport, setShowPassport] = useState(true); const [tried, setTried] = useState(false); const [error, setError] = useState(''); const [sentTo, setSentTo] = useState<string | null>(null);
  const match = findCountry(country); const editing = !!p.reviseId; const busy = share.isPending || revise.isPending;
  const errors = { country: !match ? 'Choose a country from the list, like Ghana' : undefined, city: city.trim().length < 2 ? 'Add the city or place' : undefined, body: body.trim().length < 30 ? 'Write at least 30 characters so it is useful' : undefined };

  async function submit() {
    setTried(true); setError('');
    if (errors.body || (!editing && (errors.country || errors.city))) return;
    try {
      if (editing) await revise.mutateAsync({ id: p.reviseId!, body: body.trim() });
      else await share.mutateAsync({ countryCode: match!.code, city: city.trim(), topic, body: body.trim(), visited: visited.trim() || undefined, showPassport });
      setSentTo(editing ? p.code! : match!.code);
    } catch (e) { setError(errorMessage(e)); }
  }
  if (sentTo) return (
    <Screen title="Share advice" footer={<Button label="DONE" onPress={() => { router.dismissTo('/advice'); router.push(`/advice/${sentTo}`); }} />}>
      <View className="items-center gap-3 pt-10"><View className="h-20 w-20 items-center justify-center rounded-full bg-tint"><ShieldCheck size={40} color="#002C82" /></View>
        <T v="h2" className="text-center">Sent for review</T><T className="text-center text-ink-muted">Our team checks every piece of advice. We&apos;ll tell you when it&apos;s approved and has the Verified badge.</T></View>
    </Screen>
  );
  return (
    <Screen title={editing ? 'Edit your advice' : 'Share advice'} footer={<><Button disabled={busy} label={busy ? 'SENDING…' : 'SUBMIT FOR REVIEW'} onPress={submit} /><T v="small" className="text-center text-xs">Share what you saw yourself. Advice guidelines</T></>}>
      {!editing && (
        <>
          <Input label="Country *" value={country} onChangeText={setCountry} placeholder="United Kingdom" autoCapitalize="words" error={tried ? errors.country : undefined} hint={match && match.name.toLowerCase() !== country.trim().toLowerCase() ? `We'll file this under ${match.name}.` : undefined} />
          <Input label="City or place *" value={city} onChangeText={setCity} placeholder="London" autoCapitalize="words" maxLength={60} error={tried ? errors.city : undefined} />
          <View className="gap-2"><T v="label">Topic</T><Chips wrap options={sample.adviceTopics} value={topic} onChange={setTopic} /></View>
        </>
      )}
      <Note icon={ShieldCheck}>Reviewed before it&apos;s verified. Our team checks every piece of advice. Once approved it gets the Verified badge.</Note>
      <Input label="Your advice *" value={body} onChangeText={setBody} multiline maxLength={600} placeholder="What should someone know before they go?" error={tried ? errors.body : undefined} hint={`${body.trim().length} of 600 characters. At least 30.`} />
      {!editing && (
        <>
          <Input label="When were you there? (optional)" value={visited} onChangeText={setVisited} placeholder="July 2025" maxLength={40} />
          <View className="flex-row items-center gap-3"><View className="flex-1"><T v="strong">Show my passport country</T><T v="small">Helps others with entry rules like yours</T></View><Toggle label="Show my passport country" value={showPassport} onChange={setShowPassport} /></View>
        </>
      )}
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}

export default function ShareAdvice() {
  return <NameGate title="Share advice" why="Advice is shared under your name and reviewed by our team, so sign in first."><ShareAdviceForm /></NameGate>;
}
