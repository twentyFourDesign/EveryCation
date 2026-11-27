import Constants from 'expo-constants';
import { router } from 'expo-router';
import { IconCalendar } from '@/ui/icons';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar, Badge, Button, ListRow, Note, Screen, T, Toggle } from '@/ui';
import { CountryField } from '@/ui/country-field';
import { allowBiometrics, biometricsAllowed, biometricsAvailable } from '@/lib/biometric-pin';
import { errorMessage } from '@/lib/api';
import { initials } from '@/lib/community';
import { useSession } from '@/lib/session';
import { useCalendar } from '@/lib/social';
import { usePassport } from '@/lib/travel';

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <View><T v="eyebrow" className="mb-1 text-ink-muted">{title}</T>{children}</View>;

export default function Settings() {
  const { status, me, signOut, updateProfile } = useSession();
  const signedIn = status === 'signedIn';
  const passport = usePassport();
  const calendar = useCalendar().data;
  const [bio, setBio] = useState<{ has: boolean; on: boolean } | null>(null);
  const [problem, setProblem] = useState('');
  useEffect(() => { void Promise.all([biometricsAvailable(), biometricsAllowed()]).then(([has, on]) => setBio({ has, on })); }, []);

  async function save(patch: Parameters<typeof updateProfile>[0]) {
    setProblem('');
    try { await updateProfile(patch); } catch (e) { setProblem(errorMessage(e)); }
  }
  const calendarText = !calendar?.available ? null : calendar.connected ? `Connected${calendar.account ? ` · ${calendar.account}` : ''}` : 'Not connected · add trips to your calendar';

  return (
    <Screen title="Settings">
      {signedIn && me ? (
        <ListRow title={me.name ?? 'Your profile'} subtitle={[me.handle && `@${me.handle}`, me.email].filter(Boolean).join(' · ')} right={<Avatar initials={initials(me.name ?? 'You')} uri={me.avatarUrl} size={44} />} onPress={() => router.push('/edit-profile')} />
      ) : (
        <Note>Sign in to change your profile, email and privacy settings.</Note>
      )}

      {signedIn && (
        <Group title="ACCOUNT">
          <ListRow title="Profile and photo" subtitle="Name, username, home city, about you" onPress={() => router.push('/edit-profile')} />
          <ListRow title="Email address" subtitle={me?.email ?? 'Add an email address'} onPress={() => router.push('/settings/email')} />
          {bio?.has && <ListRow title="Approve withdrawals with face or fingerprint" subtitle="Instead of typing your PIN on this phone" right={<Toggle label="Approve withdrawals with face or fingerprint" value={bio.on} onChange={(on) => { setBio({ has: true, on }); void allowBiometrics(on); }} />} />}
        </Group>
      )}

      <Group title="TRAVEL">
        <CountryField label="Passport you travel on" value={passport.code} onChange={passport.choose} hint="Used for visa and entry rules. You can check other passports on the Visa & entry screen." />
      </Group>

      {signedIn && (
        <Group title="WALLET">
          <ListRow title="Wallet settings" subtitle="PIN, bank accounts, freeze wallet" onPress={() => router.push('/wallet/settings')} />
          <ListRow title="Currency" subtitle="Wallet balances, savings and prices are in naira" right={<T v="small">Naira (₦)</T>} chevron={false} />
        </Group>
      )}

      {signedIn && (
        <Group title="NOTIFICATIONS AND APPS">
          <ListRow title="Notifications" subtitle="Comments, wallet and trip reminders" onPress={() => router.push('/notifications')} />
          {calendarText && <ListRow icon={IconCalendar} title="Google Calendar" subtitle={calendarText} right={<Badge label={calendar?.connected ? 'Manage' : 'Connect'} />} onPress={() => router.push('/travels?view=Calendar')} chevron={false} />}
        </Group>
      )}

      {signedIn && me && (
        <Group title="PRIVACY">
          <ListRow title="Show my home city" subtitle="Next to your name on moments, tips and your profile" right={<Toggle label="Show my home city" value={me.showCity} onChange={(showCity) => save({ showCity })} />} />
          <ListRow title="Your trips, checklists and savings" subtitle="Always private. Only moments, tips, advice and plans you publish are public." chevron={false} />
        </Group>
      )}

      <Group title="HELP">
        <ListRow title="Help and support" subtitle="Questions, problems, contact us" onPress={() => router.push('/help')} />
        <ListRow title="Community guidelines" onPress={() => router.push('/help?topic=guidelines')} />
      </Group>

      {!!problem && <Note tone="danger">{problem}</Note>}
      {signedIn ? (
        <View className="gap-3">
          <Button variant="outline" label="Log out" onPress={async () => { await signOut(); router.dismissAll(); router.replace('/'); }} />
          <Button variant="danger" label="Delete account" onPress={() => router.push('/settings/delete-account')} />
        </View>
      ) : <Button label="SIGN IN" onPress={() => router.push('/sign-up')} />}
      <T v="small" className="text-center text-xs">EveryCation {Constants.expoConfig?.version ?? ''}</T>
    </Screen>
  );
}
