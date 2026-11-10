import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { adviceSchema, sample, type AdviceInput } from '@everycation/shared';
import { Button, Chips, FormInput, Note, Screen, T, Toggle } from '@/ui';
import { useApp } from '@/lib/store';

export default function ShareAdvice() {
  const p = useLocalSearchParams<{ location?: string; code?: string }>();
  const submitAdvice = useApp((s) => s.submitAdvice);
  const [sent, setSent] = useState(false);
  const { control, handleSubmit } = useForm<AdviceInput>({ resolver: zodResolver(adviceSchema), defaultValues: { location: p.location ?? 'Reykjavík, Iceland', topic: 'Money', body: '', showPassport: true } });
  const location = useWatch({ control, name: 'location' });
  const code = p.code ?? sample.countries.find((c) => location.toLowerCase().includes(c.name.toLowerCase()))?.code ?? 'IS';
  const send = handleSubmit((v) => { submitAdvice({ countryCode: code, city: v.location.split(',')[0]!, topic: v.topic, visited: 'your visit', body: v.body }); setSent(true); });
  if (sent) return (
    <Screen title="Share advice" footer={<Button label="DONE" onPress={() => router.replace(`/advice/${code}`)} />}>
      <View className="items-center gap-3 pt-10"><View className="h-20 w-20 items-center justify-center rounded-full bg-tint"><ShieldCheck size={40} color="#002C82" /></View>
        <T v="h2" className="text-center">Sent for review</T><T className="text-center text-ink-muted">Our team checks every piece of advice. We&apos;ll tell you when it&apos;s approved and has the Verified badge. Until then only you can see it by default.</T></View>
    </Screen>
  );
  return (
    <Screen title="Share advice" footer={<><Button label="SUBMIT FOR REVIEW" onPress={send} /><T v="small" className="text-center text-xs">Share what you saw yourself. Advice guidelines</T></>}>
      <FormInput control={control} name="location" label="Location *" placeholder="Country, city or place" />
      <Note icon={ShieldCheck}>Reviewed before it&apos;s verified. Our team checks every piece of advice. Once approved it gets the Verified badge. A matching trip from your timeline is attached as evidence.</Note>
      <View className="gap-2"><T v="label">Topic</T><Controller control={control} name="topic" render={({ field }) => <Chips wrap options={sample.adviceTopics} value={field.value} onChange={field.onChange} />} /></View>
      <FormInput control={control} name="body" label="Your advice *" multiline maxLength={600} placeholder="What should someone know before they go?" hint="At least 30 characters. Say when you visited if it matters." />
      <View className="flex-row items-center gap-3"><View className="flex-1"><T v="strong">Show my passport country</T><T v="small">Helps others with entry rules like yours</T></View>
        <Controller control={control} name="showPassport" render={({ field }) => <Toggle label="Show my passport country" value={field.value} onChange={field.onChange} />} /></View>
    </Screen>
  );
}
