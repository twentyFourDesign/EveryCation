import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ImagePlus, Video, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Note, Screen, T, colors, cx, go } from '@/ui';
import { IconCamera } from '@/ui/icons';
import { DateField, todayIso } from '@/ui/date-field';
import { NameGate } from '@/ui/name-gate';
import { PlaceField } from '@/ui/place-field';
import { VoicePlayer, VoiceRecorder, voiceUpload, type VoiceNote } from '@/ui/voice';
import { errorMessage, uploadMedia } from '@/lib/api';
import { findCountry } from '@/lib/community';
import { KINDS, KIND_ORDER, useCreateMoment, type MomentKind } from '@/lib/moments';
import type { PlaceHit } from '@/lib/trips';

const MAX = 500;
const pickOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 60 };

function Composer() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<MomentKind>(params.kind && params.kind in KINDS ? (params.kind as MomentKind) : 'status');
  const [body, setBody] = useState(''); const [place, setPlace] = useState(''); const [picked, setPicked] = useState<PlaceHit | null>(null); const [eventDate, setEventDate] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null); const [voice, setVoice] = useState<VoiceNote | null>(null);
  const [error, setError] = useState(''); const [step, setStep] = useState<'idle' | 'uploading' | 'posting'>('idle');
  const create = useCreateMoment();
  const k = KINDS[kind];
  const needsPlace = kind === 'safety'; const isEvent = kind === 'event';

  async function pick(from: 'library' | 'camera') {
    setError('');
    try {
      if (from === 'camera') { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) return setError('Allow camera access in your phone settings to take a photo or video.'); }
      const r = from === 'camera' ? await ImagePicker.launchCameraAsync(pickOptions) : await ImagePicker.launchImageLibraryAsync(pickOptions);
      if (!r.canceled && r.assets[0]) { setAsset(r.assets[0]); setVoice(null); }
    } catch { setError('We could not open that. Try choosing from your library instead.'); }
  }

  async function post() {
    setError('');
    const text = body.trim();
    if (!asset && !voice && text.length < 2) return setError('Write something, or add a photo, video or voice note.');
    if (isEvent && !eventDate) return setError('Choose the day of the event.');
    if (needsPlace && place.trim().length < 2) return setError('Say where this is, so travellers nearby can see it.');
    try {
      let mediaId: string | undefined;
      if (asset || voice) { setStep('uploading'); mediaId = (await uploadMedia(asset ?? (await voiceUpload(voice!)))).id; }
      setStep('posting');
      const where = place.trim();
      const m = await create.mutateAsync({ kind, body: text, mediaId, place: where.length >= 2 ? where : undefined, countryCode: where ? picked?.countryCode ?? findCountry(where)?.code : undefined, eventDate: isEvent ? eventDate : undefined });
      router.back(); go(`/moment/${m.id}`);
    } catch (e) { setError(errorMessage(e)); } finally { setStep('idle'); }
  }

  const busy = step !== 'idle';
  const label = step === 'uploading' ? `UPLOADING ${voice ? 'VOICE NOTE' : asset?.type === 'video' ? 'VIDEO' : 'PHOTO'}…` : step === 'posting' ? 'POSTING…' : 'POST MOMENT';
  return (
    <Screen title="New moment" footer={<>{!!error && <Note tone="danger">{error}</Note>}<Button label={label} disabled={busy} onPress={post} /><T v="small" className="text-center text-xs">Public: everyone on EveryCation can see, like and reply.</T></>}>
      <View className="gap-2">
        <T v="label">What kind of moment?</T>
        <View className="flex-row flex-wrap gap-2">
          {KIND_ORDER.map((x) => {
            const on = x === kind; const meta = KINDS[x];
            return (
              <Pressable key={x} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setKind(x)} style={on ? { backgroundColor: meta.bg, borderColor: meta.ink } : undefined}
                className={cx('h-10 flex-row items-center gap-1.5 rounded-full border-[1.5px] px-3.5', !on && 'border-line bg-white')}>
                <meta.icon size={17} color={meta.ink} accent={meta.ink === colors.onGold ? colors.navy : undefined} />
                <Text style={on ? { color: meta.ink } : undefined} className={cx('font-pop-sb text-[13px]', !on && 'text-ink')}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-1.5">
        <TextInput value={body} onChangeText={(v) => setBody(v.slice(0, MAX))} multiline placeholder={k.hint} placeholderTextColor={colors.inkMuted} accessibilityLabel="What you want to share" textAlignVertical="top"
          className="min-h-[130px] rounded-2xl border-[1.5px] border-control-border bg-white p-4 font-pop text-[16px] leading-6 text-ink focus:border-navy" />
        <T v="small" className={cx('self-end text-xs', body.length > MAX - 40 && 'text-danger')}>{body.length}/{MAX}</T>
      </View>

      {asset ? (
        <View>
          {asset.type === 'video'
            ? <View className="h-[200px] items-center justify-center gap-2 rounded-card bg-navy"><Video size={40} color="#fff" /><Text className="font-pop-sb text-sm text-white">Video ready{asset.duration ? ` · ${Math.round(asset.duration / 1000)}s` : ''}</Text></View>
            : <Image source={{ uri: asset.uri }} style={{ width: '100%', height: 240, borderRadius: 20 }} contentFit="cover" accessibilityLabel="Your photo" />}
          <Pressable accessibilityRole="button" accessibilityLabel="Remove this photo or video" onPress={() => setAsset(null)} className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white"><X size={18} color={colors.ink} /></Pressable>
        </View>
      ) : voice ? (
        <View className="gap-2">
          <VoicePlayer url={voice.uri} seconds={voice.seconds} label="Your voice note" />
          <Text accessibilityRole="button" onPress={() => setVoice(null)} className="self-start font-pop-sb text-[13px] text-heading-blue">Delete and record again</Text>
        </View>
      ) : (
        <View className="gap-2.5 rounded-card border-[1.5px] border-dashed border-control-border p-4">
          <T v="strong">Add a photo, video or voice note</T><T v="small">Optional. One per moment. Videos up to one minute, voice notes up to two.</T>
          <View className="flex-row gap-2.5"><Button className="flex-1" small variant="navy" icon={ImagePlus} label="Choose" onPress={() => pick('library')} /><Button className="flex-1" small variant="outline" icon={IconCamera} label="Camera" onPress={() => pick('camera')} /></View>
          <VoiceRecorder what="voice note" onDone={(note) => { setError(''); setVoice(note); }} onError={setError} />
        </View>
      )}

      {isEvent && <DateField label="Event date *" value={eventDate} onChange={setEventDate} min={todayIso()} />}
      <PlaceField label={needsPlace ? 'Where is this? *' : 'Place (optional)'} value={place} onChangeText={setPlace} picked={picked} onPick={setPicked} placeholder="Town, island or region" detect={needsPlace} />
      {needsPlace && <Note tone="gold">Share what you saw yourself and when. For emergencies, call local emergency services first.</Note>}
    </Screen>
  );
}

export default function NewMoment() {
  return <NameGate title="New moment" why="Moments are posted under your name, so sign in to share one."><Composer /></NameGate>;
}
