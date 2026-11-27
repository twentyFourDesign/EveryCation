import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Button, Input, Note, Screen, T } from '@/ui';
import { errorMessage, uploadMedia } from '@/lib/api';
import { initials } from '@/lib/community';
import { useSession } from '@/lib/session';

/** Name, username, home city and bio. Also the first screen a new account sees after signing in. */
export default function EditProfile() {
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const { me, status, updateProfile } = useSession();
  const [name, setName] = useState(me?.name ?? ''); const [handle, setHandle] = useState(me?.handle ?? ''); const [city, setCity] = useState(me?.city ?? ''); const [bio, setBio] = useState(me?.bio ?? '');
  const [tried, setTried] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const errors = { name: name.trim().length < 2 ? 'Enter your name' : undefined, handle: handle && !/^[a-zA-Z0-9._]{3,24}$/.test(handle) ? 'Use 3 to 24 letters, numbers, dots or underscores' : undefined };
  const [photo, setPhoto] = useState<'idle' | 'uploading'>('idle');
  /** The photo saves straight away, separately from the form below. */
  async function pickPhoto() {
    setError('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (r.canceled || !r.assets[0]) return;
      setPhoto('uploading');
      const up = await uploadMedia(r.assets[0]);
      await updateProfile({ avatarMediaId: up.id });
    } catch (e) { setError(errorMessage(e)); } finally { setPhoto('idle'); }
  }
  async function removePhoto() {
    setError('');
    try { await updateProfile({ avatarMediaId: null }); } catch (e) { setError(errorMessage(e)); }
  }
  const done = () => (welcome ? router.replace('/explore') : router.back());
  async function save() {
    setTried(true); setError('');
    if (errors.name || errors.handle) return;
    setBusy(true);
    try { await updateProfile({ name: name.trim(), city: city.trim(), bio: bio.trim(), ...(handle && { handle }) }); done(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  if (status !== 'signedIn') return <Screen title="Your profile"><T>Sign in to edit your profile.</T><Button label="SIGN IN" onPress={() => router.push('/sign-up')} /></Screen>;
  return (
    <Screen title={welcome ? '' : 'Edit profile'} back={!welcome} footer={<><Button disabled={busy} label={busy ? 'SAVING…' : welcome ? 'CONTINUE' : 'SAVE'} onPress={save} />{welcome && <Button variant="ghost" label="Skip for now" onPress={done} />}</>}>
      {welcome && <View className="gap-1"><T v="h1">Welcome to EveryCation</T><T className="text-ink-muted">Tell travellers who you are. Your name shows next to the tips and advice you share.</T></View>}
      <View className="items-center gap-2">
        <Avatar initials={initials(name || 'You')} uri={me?.avatarUrl} size={104} onPress={pickPhoto} label="Choose a profile photo" />
        <View className="flex-row gap-5">
          <Text accessibilityRole="button" onPress={photo === 'idle' ? pickPhoto : undefined} className="font-pop-sb text-sm text-heading-blue">{photo === 'uploading' ? 'Uploading…' : me?.avatarUrl ? 'Change photo' : 'Add a photo'}</Text>
          {!!me?.avatarUrl && photo === 'idle' && <Text accessibilityRole="button" onPress={removePhoto} className="font-pop-sb text-sm text-ink-muted">Remove</Text>}
        </View>
      </View>
      <Input label="Name *" value={name} onChangeText={setName} placeholder="Amaka O." maxLength={60} autoComplete="name" error={tried ? errors.name : undefined} />
      <Input label="Username" value={handle} onChangeText={(v) => setHandle(v.replace(/^@/, ''))} placeholder="amaka.travels" autoCapitalize="none" autoCorrect={false} maxLength={24} error={errors.handle} />
      <Input label="Home city" value={city} onChangeText={setCity} placeholder="Lagos" maxLength={60} />
      <Input label="About you" value={bio} onChangeText={setBio} multiline maxLength={200} placeholder="Weekend planner, mountain chaser." hint={`${bio.length} of 200`} />
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
