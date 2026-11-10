import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { MapPin, Mic, Square, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import type { z } from 'zod';
import { tipSchema } from '@everycation/shared';
import { Button, Chips, FormInput, Note, Photo, Screen, Segmented, T, colors, cx } from '@/ui';

type Form = z.infer<typeof tipSchema>;
const formats = ['Video', 'Voice', 'Write'] as const;
const categories = ['Packing', 'Getting there', 'Food', 'Money', 'Sights', 'Safety'];
const MAX = 60;

export default function RecordTip() {
  const { control, handleSubmit, setValue } = useForm<Form>({ resolver: zodResolver(tipSchema), defaultValues: { format: 'video', place: '', headline: '', category: 'Packing', body: '' } });
  const format = useWatch({ control, name: 'format' });
  const [recording, setRecording] = useState(false); const [secs, setSecs] = useState(0); const [state, setState] = useState<'idle' | 'draft' | 'posted'>('idle');
  useEffect(() => { if (!recording) return; const t = setInterval(() => setSecs((s) => { if (s + 1 >= MAX) setRecording(false); return Math.min(MAX, s + 1); }), 1000); return () => clearInterval(t); }, [recording]);
  const clock = `0:${String(secs).padStart(2, '0')} / 1:00`;
  const needsClip = format !== 'write' && secs === 0;
  const post = handleSubmit(() => { if (needsClip) return; setRecording(false); setState('posted'); });
  if (state === 'posted') return (
    <Screen title="Record a tip" footer={<Button label="DONE" onPress={() => router.back()} />}>
      <View className="items-center gap-3 pt-12"><T v="h2" className="text-center">Your tip is posted</T><T className="text-center text-ink-muted">Travellers heading there will see it in Explore and the community feed.</T></View>
    </Screen>);
  return (
    <Screen title="Record a tip" right={<Text className="pr-3 font-pop-sb text-[13px] text-heading-blue">Drafts</Text>}
      footer={<View className="flex-row gap-3"><Button className="flex-1" variant="outline" label={state === 'draft' ? 'Draft saved' : 'Save draft'} onPress={() => setState('draft')} /><Button className="flex-[1.4]" label="POST TIP" disabled={needsClip} onPress={post} /></View>}>
      <Segmented options={formats} value={formats.find((f) => f.toLowerCase() === format)!} onChange={(f) => { setValue('format', f.toLowerCase() as Form['format']); setRecording(false); setSecs(0); }} />
      {format === 'write' ? <FormInput control={control} name="body" label="Your tip" multiline maxLength={600} placeholder="What do you wish someone had told you?" /> : (
        <View className={cx('items-center justify-end overflow-hidden rounded-card pb-5', format === 'video' ? 'h-[300px] bg-ink' : 'h-[180px] bg-navy')}>
          {/* Camera and microphone capture plug in here (expo-camera, expo-audio) in a development build. */}
          {format === 'video' && <Photo k="waterfall" className="absolute inset-0 opacity-70" />}
          {format === 'voice' && <View className="absolute inset-0 items-center justify-center"><Mic size={44} color="#fff" /></View>}
          <View className="mb-3 rounded-full bg-black/60 px-3 py-1"><Text accessibilityLiveRegion="polite" className="font-pop-sb text-[13px] text-white">{clock}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} onPress={() => { if (!recording && secs >= MAX) setSecs(0); setRecording((r) => !r); }} className="h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-danger">
            {recording ? <Square size={22} color="#fff" fill="#fff" /> : format === 'video' ? <Video size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
          </Pressable>
        </View>
      )}
      {needsClip && <Note>Record up to one minute, or switch to Write.</Note>}
      <View><FormInput control={control} name="place" label="Place *" placeholder="South Iceland" /><View className="absolute right-4 top-[41px]"><MapPin size={20} color={colors.inkMuted} /></View></View>
      <FormInput control={control} name="headline" label="Tip headline *" placeholder="Pack a rain shell, even in July" maxLength={80} />
      <Controller control={control} name="category" render={({ field }) => <Chips options={categories} value={field.value} onChange={field.onChange} />} />
    </Screen>
  );
}
