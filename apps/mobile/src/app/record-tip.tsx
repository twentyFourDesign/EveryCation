import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, ImagePlus, MapPin, Video, X } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import type { z } from 'zod';
import { tipSchema } from '@everycation/shared';
import { Button, Chips, FormInput, Note, Photo, Screen, T, colors, go } from '@/ui';
import { NameGate } from '@/ui/name-gate';
import { VoicePlayer, VoiceRecorder, voiceUpload, type VoiceNote } from '@/ui/voice';
import { errorMessage, uploadMedia } from '@/lib/api';
import { findCountry, useCreateTip } from '@/lib/community';

type Form = z.infer<typeof tipSchema>;
const categories = ['Packing', 'Getting there', 'Food', 'Money', 'Sights', 'Safety'];
const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60 };

function RecordTipForm() {
  const create = useCreateTip();
  const { control, handleSubmit } = useForm<Form>({ resolver: zodResolver(tipSchema), defaultValues: { format: 'write', place: '', headline: '', category: 'Packing', body: '' } });
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null); const [voice, setVoice] = useState<VoiceNote | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null); const [error, setError] = useState(''); const [step, setStep] = useState<'idle' | 'uploading' | 'posting'>('idle');
  const isVideo = asset?.type === 'video';

  async function pick(from: 'library' | 'camera') {
    setError('');
    try {
      if (from === 'camera') { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) return setError('Allow camera access in your phone settings to take a photo or video.'); }
      const r = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!r.canceled && r.assets[0]) setAsset(r.assets[0]);
    } catch { setError('We could not open that. Try choosing from your library instead.'); }
  }
  const post = handleSubmit(async (v) => {
    setError('');
    if (!asset && !voice && (v.body ?? '').trim().length < 20) return setError('Add a photo, a video or a voice note, or write at least 20 characters.');
    try {
      let mediaId: string | undefined;
      if (asset) { setStep('uploading'); mediaId = (await uploadMedia(asset)).id; }
      else if (voice) { setStep('uploading'); mediaId = (await uploadMedia(await voiceUpload(voice))).id; }
      setStep('posting');
      const tip = await create.mutateAsync({ title: v.headline, place: v.place, category: v.category, format: voice && !asset ? 'voice' : isVideo ? 'video' : 'write', body: v.body ?? '', countryCode: findCountry(v.place)?.code, mediaId });
      setPostedId(tip.id);
    } catch (e) { setError(errorMessage(e)); } finally { setStep('idle'); }
  });
  if (postedId) return (
    <Screen title="Share a tip" footer={<><Button label="VIEW YOUR TIP" onPress={() => { router.back(); go(`/tip/${postedId}`); }} /><Button variant="ghost" label="Done" onPress={() => router.back()} /></>}>
      <View className="items-center gap-3 pt-12"><T v="h2" className="text-center">Your tip is posted</T><T className="text-center text-ink-muted">Travellers heading there will see it in Explore and the community feed.</T></View>
    </Screen>);
  const busy = step !== 'idle';
  return (
    <Screen title="Share a tip" footer={<Button label={step === 'uploading' ? `UPLOADING ${voice && !asset ? 'VOICE NOTE' : isVideo ? 'VIDEO' : 'PHOTO'}…` : step === 'posting' ? 'POSTING…' : 'POST TIP'} disabled={busy} onPress={() => post()} />}>
      {asset ? (
        <View>
          {isVideo
            ? <View className="h-[220px] items-center justify-center gap-2 rounded-card bg-navy"><Video size={40} color="#fff" /><Text className="font-pop-sb text-sm text-white">Video ready{asset.duration ? ` · ${Math.round(asset.duration / 1000)}s` : ''}</Text></View>
            : <Photo k="lagoon-aerial" uri={asset.uri} className="h-[220px] rounded-card" alt="Your photo" />}
          <Pressable accessibilityRole="button" accessibilityLabel="Remove this photo or video" onPress={() => setAsset(null)} className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white"><X size={18} color={colors.ink} /></Pressable>
        </View>
      ) : voice ? (
        <View className="gap-2">
          <VoicePlayer url={voice.uri} seconds={voice.seconds} label="Your voice tip" />
          <Text accessibilityRole="button" onPress={() => setVoice(null)} className="self-start font-pop-sb text-[13px] text-heading-blue">Delete and record again</Text>
        </View>
      ) : (
        <View className="gap-2.5 rounded-card border-[1.5px] border-dashed border-control-border p-4">
          <T v="strong">Add a photo, a short video or a voice note</T><T v="small">Optional. Photos up to 8 MB, videos up to one minute, voice up to two minutes.</T>
          <View className="flex-row gap-2.5"><Button className="flex-1" small variant="navy" icon={ImagePlus} label="Choose" onPress={() => pick('library')} /><Button className="flex-1" small variant="outline" icon={Camera} label="Camera" onPress={() => pick('camera')} /></View>
          <VoiceRecorder onDone={(note) => { setError(''); setVoice(note); }} onError={setError} />
        </View>
      )}
      <View><FormInput control={control} name="place" label="Place *" placeholder="South Iceland" hint="Add the country so travellers can find it, like Vík, Iceland." /><View className="absolute right-4 top-[41px]"><MapPin size={20} color={colors.inkMuted} /></View></View>
      <FormInput control={control} name="headline" label="Tip headline *" placeholder="Pack a rain shell, even in July" maxLength={80} />
      <FormInput control={control} name="body" label={asset || voice ? 'Notes (optional)' : 'Your tip *'} multiline maxLength={1200} placeholder="What do you wish someone had told you?" />
      <Controller control={control} name="category" render={({ field }) => <Chips options={categories} value={field.value} onChange={field.onChange} />} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}

export default function RecordTip() {
  return <NameGate title="Share a tip" why="Tips are posted under your name, so sign in to share one."><RecordTipForm /></NameGate>;
}
