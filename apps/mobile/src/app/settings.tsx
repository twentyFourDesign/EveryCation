import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, ListRow, Screen, T, Toggle } from '@/ui';
import { useSession } from '@/lib/session';

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <View><T v="eyebrow" className="mb-1 text-ink-muted">{title}</T>{children}</View>;

export default function Settings() {
  const [bio, setBio] = useState(true);
  const [visibility, setVisibility] = useState<'Followers' | 'Everyone' | 'Only me'>('Followers');
  const { status, signOut } = useSession();
  const nextVisibility = () => setVisibility((v) => (v === 'Followers' ? 'Everyone' : v === 'Everyone' ? 'Only me' : 'Followers'));
  return (
    <Screen title="Settings">
      <Group title="ACCOUNT">
        <ListRow title="Personal details" onPress={() => {}} />
        <ListRow title="Phone and email" onPress={() => {}} />
        <ListRow title="Log in with face or fingerprint" right={<Toggle label="Log in with face or fingerprint" value={bio} onChange={setBio} />} />
      </Group>
      <Group title="WALLET"><ListRow title="Wallet settings" onPress={() => router.push('/wallet/settings')} /></Group>
      <Group title="PREFERENCES">
        <ListRow title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow title="Passport country" right={<T v="small">Nigeria</T>} onPress={() => {}} />
        <ListRow title="Currency" right={<T v="small">Naira (₦)</T>} onPress={() => {}} />
      </Group>
      <Group title="CONNECTED APPS">
        <ListRow icon={CalendarDays} title="Google Calendar" subtitle="Connected · trips sync automatically" right={<Badge label="Manage" />} onPress={() => router.push('/travels?view=Calendar')} chevron={false} />
      </Group>
      <Group title="PRIVACY & COMMUNITY">
        <ListRow title="Who can see my trips" right={<T v="small">{visibility}</T>} onPress={nextVisibility} />
        <ListRow title="Help and support" onPress={() => {}} />
      </Group>
      {status === 'signedIn'
        ? <Button variant="danger" label="Log out" onPress={async () => { await signOut(); router.dismissAll(); router.replace('/'); }} />
        : <Button label="SIGN IN" onPress={() => router.push('/sign-up')} />}
    </Screen>
  );
}
