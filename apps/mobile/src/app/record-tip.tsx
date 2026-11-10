import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { MapPin, Mic, Square, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import type { z } from 'zod';
import { tipSchema } from '@everycation/shared';
import { Button, Chips, FormInput, Note, Photo, Screen, Segmented, T, colors, cx, go } from '@/ui';
import { NameGate } from '@/ui/name-gate';
import { errorMessage } from '@/lib/api';
import { findCountry, useCreateTip } from '@/lib/community';

type Form = z.infer<typeof tipSchema>;
const formats = ['Video', 'Voice', 'Write'] as const;
const categories = ['Packing', 'Getting there', 'Food', 'Money', 'Sights', 'Safety'];
const MAX = 60;

function RecordTipForm() {
  const create = useCreateTip();
  const { control, handleSubmit, setValue } = useForm<Form>({ resolver: zodResolver(tipSchema), defaultValues: { format: 'write', place: '', headline: '', category: 'Packing', body: '' } });
  const format = useWatch({ control, name: 'format' });
  const [recording, setRecording] = useState(false); const [secs, setSecs] = useState(0); const [postedId, setPostedId] = useState<string | null>(null); const [error, setError] = useState('');
  useEffect(() => { if (!recording) return; const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX) setRecording(false); return Math.min(MAX, s + 1); }), 1000); return () => clearInterval(t); }, [recording]);
  const post = handleSubmit(async (v) => {
    setError(''); setRecording(false);
    if (v.format === 'write' && (v.body ?? '').trim().length < 20) return setError('Write at least 20 characters so the tip is useful.');
    try { const tip = await create.mutateAsync({ title: v.headline, place: v.place, category: v.category, format: v.format, body: v.body ?? '', countryCode: findCountry(v.place)?.code }); setPostedId(tip.id); }
    catch (e) { setError(errorMessage(e)); }
  });
  if (postedId) return (
    <Screen title="Record a tip" footer={<><Button label="VIEW YOUR TIP" onPress={() => { router.back(); go(`/tip/${postedId}`); }} /><Button variant="ghost" label="Done" onPress={() => router.back()} /></>}>
      <View className="items-center gap-3 pt-12"><T v="h2" className="text-center">Your tip is posted</T><T className="text-center text-ink-muted">Travellers heading there will see it in Explore and the community feed.</T></View>
    </Screen>);
  return (
    <Screen title="Record a tip" footer={<Button label={create.isPending ? 'POSTING…' : 'POST TIP'} disabled={create.isPending} onPress={() => post()} />}>
      <Segmented options={formats} value={formats.find((f) => f.toLowerCase() === format)!} onChange={(f) => { setValue('format', f.toLowerCase() as Form['format']); setRecording(false); setSecs(0); }} />
      {format !== 'write' && (
        <>
          <View className={cx('items-center justify-end overflow-hidden rounded-card pb-5', format === 'video' ? 'h-[260px] bg-ink' : 'h-[170px] bg-navy')}>
            {/* Camera and microphone capture, and the upload, plug in here (expo-camera, expo-audio) in a development build. */}
            {format === 'video' && <Photo k="waterfall" className="absolute inset-0 opacity-70" />}
            {format === 'voice' && <View className="absolute inset-0 items-center justify-center"><Mic size={44} color="#fff" /></View>}
            <View className="mb-3 rounded-full bg-black/60 px-3 py-1"><Text accessibilityLiveRegion="polite" className="font-pop-sb text-[13px] text-white">{`0:${String(secs).padStart(2, '0')} / 1:00`}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} onPress={() => { if (!recording && secs >= MAX) setSecs(0); setRecording((r) => !r); }} className="h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-danger">
              {recording ? <Square size={22} color="#fff" fill="#fff" /> : format === 'video' ? <Video size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
            </Pressable>
          </View>
          <Note>{`Recording is not connected yet, so no ${format === 'video' ? 'video' : 'audio'} is saved. Your tip posts with its headline and notes, marked as a ${format} tip.`}</Note>
        </>
      )}
      <View><FormInput control={control} name="place" label="Place *" placeholder="South Iceland" hint="Add the country so travellers can find it, like Vík, Iceland." /><View className="absolute right-4 top-[41px]"><MapPin size={20} color={colors.inkMuted} /></View></View>
      <FormInput control={control} name="headline" label="Tip headline *" placeholder="Pack a rain shell, even in July" maxLength={80} />
      <FormInput control={control} name="body" label={format === 'write' ? 'Your tip *' : 'Notes (optional)'} multiline maxLength={1200} placeholder="What do you wish someone had told you?" />
      <Controller control={control} name="category" render={({ field }) => <Chips options={categories} value={field.value} onChange={field.onChange} />} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}

export default function RecordTip() {
  return <NameGate title="Record a tip" why="Tips are posted under your name, so sign in to share one."><RecordTipForm /></NameGate>;
}
