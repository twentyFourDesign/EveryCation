import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { commentSchema } from '@everycation/shared';
import { Avatar, Badge, Button, Empty, Loading, Note, Photo, Screen, T, colors, cx } from '@/ui';
import { errorMessage } from '@/lib/api';
import { initials, isUuid, timeAgo, tipImage, useAddComment, useReport, useTip, useTipComments } from '@/lib/community';
import { useSession } from '@/lib/session';

export default function Comments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tip } = useTip(id);
  const { data, isLoading, error } = useTipComments(id);
  const add = useAddComment(id); const report = useReport();
  const { status, me } = useSession();
  const [draft, setDraft] = useState(''); const [reported, setReported] = useState<string[]>([]); const [problem, setProblem] = useState('');
  const ok = commentSchema.safeParse({ body: draft.trim() }).success;

  async function send() {
    if (!ok) return;
    setProblem('');
    try { await add.mutateAsync(draft.trim()); setDraft(''); }
    catch (e) { setProblem(errorMessage(e)); }
  }
  async function flag(commentId: string) {
    if (status !== 'signedIn') return router.push('/sign-up');
    try { await report.mutateAsync({ targetType: 'comment', targetId: commentId, reason: 'Reported from the app' }); setReported((r) => [...r, commentId]); }
    catch (e) { setProblem(errorMessage(e)); }
  }
  if (!isUuid(id)) return <Screen title="Comments"><Empty>Comments are not available for this sample tip.</Empty></Screen>;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <Screen title={`Comments · ${data?.length ?? tip?.comments ?? 0}`} footer={status === 'signedIn' ? (
        <>
          <View className="flex-row items-center gap-2.5">
            <Avatar initials={initials(me?.name ?? 'You')} size={36} />
            <TextInput value={draft} onChangeText={setDraft} placeholder={`Add a comment for ${tip?.author.name.split(' ')[0] ?? 'the author'}`} placeholderTextColor={colors.inkMuted} accessibilityLabel="Add a comment" maxLength={500} onSubmitEditing={send}
              className="h-12 min-w-0 flex-1 rounded-full bg-surface-muted px-4 font-pop text-[15px] text-ink" />
            <Pressable accessibilityRole="button" accessibilityLabel="Post comment" accessibilityState={{ disabled: !ok || add.isPending }} disabled={!ok || add.isPending} onPress={send} className={cx('h-12 w-12 items-center justify-center rounded-full bg-gold', (!ok || add.isPending) && 'opacity-40')}><Send size={20} color={colors.ink} /></Pressable>
          </View>
          <T v="small" className="text-center text-xs">Keep it kind and useful. Community guidelines</T>
        </>) : <Button label="SIGN IN TO COMMENT" onPress={() => router.push('/sign-up')} />}>
        {tip && <View className="flex-row items-center gap-3 rounded-2xl bg-surface-muted p-2.5"><Photo k={tipImage(tip)} className="h-12 w-12 rounded-xl" /><View className="flex-1"><T v="label" numberOfLines={1}>{tip.title}</T><T v="small">{tip.author.name}</T></View></View>}
        {isLoading && <Loading what="comments" />}
        {(!!error || !!problem) && <Note tone="danger">{problem || errorMessage(error)}</Note>}
        {data?.length === 0 && <Empty>No comments yet. Be the first to add one.</Empty>}
        {data?.map((c) => (
          <View key={c.id} className="flex-row gap-3">
            <Avatar initials={initials(c.author.name)} size={36} />
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2"><T v="label">{c.mine ? 'You' : c.author.name}</T>{c.isTipAuthor && <Badge label="Author" />}<T v="small">· {timeAgo(c.createdAt)}</T></View>
              <T>{c.body}</T>
              <View className="flex-row gap-5 pt-1">
                <Text accessibilityRole="button" onPress={() => setDraft(`@${c.author.name.split(' ')[0]} `)} className="font-pop-sb text-[13px] text-ink-muted">Reply</Text>
                {!c.mine && <Text accessibilityRole="button" onPress={() => flag(c.id)} className="font-pop-sb text-[13px] text-ink-muted">{reported.includes(c.id) ? 'Reported' : 'Report'}</Text>}
              </View>
            </View>
          </View>
        ))}
      </Screen>
    </KeyboardAvoidingView>
  );
}
