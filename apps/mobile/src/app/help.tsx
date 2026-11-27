import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Screen, SectionTitle, T, colors } from '@/ui';
import { useSession } from '@/lib/session';

/** Where support emails go. Change it here when a dedicated support inbox is set up. */
export const SUPPORT_EMAIL = 'wole@24group.com.ng';

const FAQ: [string, string][] = [
  ['I did not get my sign-in code', 'Codes arrive within a minute from no-reply@24group.com.ng. Check your spam or promotions folder, then ask for a new code. Each code works for 10 minutes.'],
  ['How do I keep my wallet safe?', 'Withdrawals need your PIN, and you can freeze your wallet any time in Wallet settings. We will never ask for your PIN or sign-in code by phone, email or message.'],
  ['How accurate are the visa rules?', 'They come from public sources and are checked regularly, but rules change. Always confirm with the embassy or official government site before you book.'],
  ['Someone posted something harmful', 'Open the moment, tip or comment and tap Report. Our team reviews every report and can remove posts and suspend accounts.'],
  ['How do I change my email or delete my account?', 'Go to Profile, then Settings. Email address changes after you confirm a code sent to the new address. Delete account is at the bottom of Settings.'],
];
const GUIDELINES = [
  'Be kind. Disagree with ideas, not people.',
  'Share what you saw yourself. Say when it happened, especially for safety alerts.',
  'No scams, fake visa offers, or selling services in comments. Travel companies can advertise through Packages.',
  'Do not post other people\'s private details, or photos of them without asking.',
  'No hate, harassment, nudity or violence.',
  'Posts that break these rules are removed, and repeat offenders lose their account.',
];

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="gap-2 border-b border-line py-3.5">
      <View className="flex-row items-center gap-3"><T v="strong" className="flex-1">{q}</T>{open ? <ChevronUp size={20} color={colors.inkMuted} /> : <ChevronDown size={20} color={colors.inkMuted} />}</View>
      {open && <T className="text-ink-muted">{a}</T>}
    </Pressable>
  );
}

export default function Help() {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const me = useSession((s) => s.me);
  const email = () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('EveryCation help')}&body=${encodeURIComponent(`\n\n—\nAccount: ${me?.email ?? 'not signed in'}`)}`);
  const guidelines = (
    <View className="gap-2">
      <SectionTitle>Community guidelines</SectionTitle>
      <T className="text-ink-muted">Moments, tips and advice are public. Keep them useful and safe for every traveller.</T>
      {GUIDELINES.map((g) => <T key={g}>• {g}</T>)}
    </View>
  );
  return (
    <Screen title={topic === 'guidelines' ? 'Community guidelines' : 'Help and support'}>
      {topic === 'guidelines' ? guidelines : (
        <>
          <View><SectionTitle>Common questions</SectionTitle>{FAQ.map(([q, a]) => <Question key={q} q={q} a={a} />)}</View>
          <View className="gap-3 rounded-card bg-surface-muted p-4">
            <T v="strong">Still stuck?</T>
            <T className="text-ink-muted">Email us and we will reply within one working day. Tell us what you were doing and what went wrong.</T>
            <Button variant="navy" icon={Mail} label="Email support" onPress={email} />
          </View>
          {guidelines}
        </>
      )}
    </Screen>
  );
}
