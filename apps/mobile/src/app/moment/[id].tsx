import { router, useLocalSearchParams } from 'expo-router';
import { Flag, Send, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Avatar, Badge, Button, Empty, Loading, Note, Screen, T, colors, cx, go } from '@/ui';
import { errorMessage } from '@/lib/api';
import { initials, timeAgo, useReport } from '@/lib/community';
import { KINDS, useAddMomentComment, useMoment, useMomentComments, useRemoveMoment, useRemoveMomentComment } from '@/lib/moments';
import { useSession } from '@/lib/session';
import { MomentCard } from '@/ui/moment-card';

/** A moment in full, with its replies. */
export default function MomentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: m, isLoading, error } = useMoment(id);
  const comments = useMomentComments(id);
  const add = useAddMomentComment(id); const removeComment = useRemoveMomentComment(id); const remove = useRemoveMoment(); const report = useReport();
  const { status, me } = useSession(); const signedIn = status === 'signedIn';
  const [draft, setDraft] = useState(''); const [problem, setProblem] = useState(''); const [reported, setReported] = useState<string[]>([]); const [confirm, setConfirm] = useState(false);
  const ok = draft.trim().length >= 1 && draft.trim().length <= 500;

  if (isLoading) return <Screen title="Moment"><Loading what="this moment" /></Screen>;
  if (!m) return <Screen title="Moment"><Note tone="danger">{error ? errorMessage(error) : 'This moment is no longer available.'}</Note></Screen>;

  async function send() {
    if (!ok) return;
    setProblem('');
    try { await add.mutateAsync(draft.trim()); setDraft(''); } catch (e) { setProblem(errorMessage(e)); }
  }
  async function flag(targetType: 'moment' | 'moment_comment', targetId: string) {
    if (!signedIn) return router.push('/sign-up');
    try { await report.mutateAsync({ targetType, targetId, reason: 'Reported from the app' }); setReported((r) => [...r, targetId]); } catch (e) { setProblem(errorMessage(e)); }
  }
  const footer = signedIn ? (
    <View className="flex-row items-center gap-2.5">
      <Avatar initials={initials(me?.name ?? 'You')} size={36} />
      <TextInput value={draft} onChangeText={setDraft} placeholder={m.mine ? 'Reply to the comments' : `Reply to ${m.author.name.split(' ')[0]}`} placeholderTextColor={colors.inkMuted} accessibilityLabel="Write a comment" maxLength={500} onSubmitEditing={send}
        className="h-12 min-w-0 flex-1 rounded-full bg-surface-muted px-4 font-pop text-[15px] text-ink" />
      <Pressable accessibilityRole="button" accessibilityLabel="Post comment" accessibilityState={{ disabled: !ok || add.isPending }} disabled={!ok || add.isPending} onPress={send} className={cx('h-12 w-12 items-center justify-center rounded-full bg-gold', (!ok || add.isPending) && 'opacity-40')}><Send size={20} color={colors.ink} /></Pressable>
    </View>
  ) : <Button label="SIGN IN TO LIKE AND REPLY" onPress={() => router.push('/sign-up')} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <Screen title={KINDS[m.kind].label} footer={footer}>
        <MomentCard m={m} open={false} />
        <View className="flex-row justify-end gap-5">
          {m.mine ? (
            <Pressable accessibilityRole="button" disabled={remove.isPending} onPress={() => (confirm ? remove.mutate(m.id, { onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/explore')) }) : setConfirm(true))} className="flex-row items-center gap-1.5 py-1">
              <Trash2 size={15} color={colors.danger} /><Text className="font-pop-sb text-[13px] text-danger">{confirm ? 'Tap again to delete' : 'Delete moment'}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" disabled={reported.includes(m.id)} onPress={() => flag('moment', m.id)} className="flex-row items-center gap-1.5 py-1">
              <Flag size={15} color={colors.inkMuted} /><Text className="font-pop-sb text-[13px] text-ink-muted">{reported.includes(m.id) ? 'Reported. Thank you' : 'Report'}</Text>
            </Pressable>
          )}
        </View>

        <T v="title">Comments{comments.data ? ` · ${comments.data.length}` : ''}</T>
        {!!problem && <Note tone="danger">{problem}</Note>}
        {comments.isLoading && <Loading what="comments" />}
        {comments.data?.length === 0 && <Empty>No replies yet. Start the conversation.</Empty>}
        {comments.data?.map((c) => (
          <View key={c.id} className="flex-row gap-3">
            <Avatar initials={initials(c.author.name)} size={36} onPress={() => go(`/traveller/${c.author.id}`)} />
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2"><T v="label">{c.mine ? 'You' : c.author.name}</T>{c.isAuthor && <Badge label="Author" />}<T v="small">· {timeAgo(c.createdAt)}</T></View>
              <T>{c.body}</T>
              <View className="flex-row gap-5 pt-1">
                {signedIn && <Text accessibilityRole="button" onPress={() => setDraft(`@${c.author.name.split(' ')[0]} `)} className="font-pop-sb text-[13px] text-ink-muted">Reply</Text>}
                {(c.mine || m.mine) && <Text accessibilityRole="button" onPress={() => removeComment.mutate(c.id)} className="font-pop-sb text-[13px] text-ink-muted">Remove</Text>}
                {!c.mine && <Text accessibilityRole="button" onPress={() => !reported.includes(c.id) && flag('moment_comment', c.id)} className="font-pop-sb text-[13px] text-ink-muted">{reported.includes(c.id) ? 'Reported' : 'Report'}</Text>}
              </View>
            </View>
          </View>
        ))}
        <T v="small" className="text-center text-xs">Keep it kind. Moments are public.</T>
      </Screen>
    </KeyboardAvoidingView>
  );
}
