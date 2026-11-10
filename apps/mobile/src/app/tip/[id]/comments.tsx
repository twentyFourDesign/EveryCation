import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { api, commentSchema, sample, type Comment } from '@everycation/shared';
import { Avatar, Badge, Empty, Photo, Screen, T, colors, cx } from '@/ui';
import { person } from '@/lib/people';
import { useApp } from '@/lib/store';

export default function Comments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tip } = useQuery({ queryKey: ['tip', id], queryFn: () => api.tip(id) });
  const { data = [] } = useQuery({ queryKey: ['comments', id], queryFn: () => api.comments(id) });
  const [mine, setMine] = useState<Comment[]>([]);
  const [reported, setReported] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const { likedComments, toggle } = useApp();
  const all = [...(id === 'ulun-danu' ? data : []), ...mine];
  const author = tip ? person(tip.authorId) : null;
  const ok = commentSchema.safeParse({ body: draft.trim() }).success;
  const send = () => { if (!ok) return; setMine((m) => [...m, { id: `m${Date.now()}`, tipId: id, authorId: 'wole', when: 'now', body: draft.trim(), likes: 0 }]); setDraft(''); };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
      <Screen title={`Comments · ${(tip?.comments ?? 0) + mine.length}`} footer={
        <>
          <View className="flex-row items-center gap-2.5">
            <Avatar initials={sample.me.initials} size={36} />
            <TextInput value={draft} onChangeText={setDraft} placeholder={`Add a comment for ${author?.name.split(' ')[0] ?? 'the author'}`} placeholderTextColor={colors.inkMuted} accessibilityLabel="Add a comment" maxLength={500} onSubmitEditing={send}
              className="h-12 min-w-0 flex-1 rounded-full bg-surface-muted px-4 font-pop text-[15px] text-ink" />
            <Pressable accessibilityRole="button" accessibilityLabel="Post comment" accessibilityState={{ disabled: !ok }} disabled={!ok} onPress={send} className={cx('h-12 w-12 items-center justify-center rounded-full bg-gold', !ok && 'opacity-40')}><Send size={20} color={colors.ink} /></Pressable>
          </View>
          <T v="small" className="text-center text-xs">Keep it kind and useful. Community guidelines</T>
        </>}>
        {tip && <View className="flex-row items-center gap-3 rounded-2xl bg-surface-muted p-2.5"><Photo k={tip.image} className="h-12 w-12 rounded-xl" /><View className="flex-1"><T v="label" numberOfLines={1}>{tip.title}</T><T v="small">{author?.name}</T></View></View>}
        {all.length === 0 && <Empty>No comments yet. Be the first to add one.</Empty>}
        {all.map((c) => {
          const p = person(c.authorId); const liked = likedComments.includes(c.id);
          return (
            <View key={c.id} className={cx('flex-row gap-3', c.isAuthor && 'ml-8')}>
              <Avatar initials={p.initials} size={36} />
              <View className="flex-1 gap-1">
                <View className="flex-row flex-wrap items-center gap-2"><T v="label">{p.id === 'wole' ? 'You' : p.name}</T>{c.isAuthor && <Badge label="Author" />}<T v="small">· {c.when}</T></View>
                <T>{c.body}</T>
                <View className="flex-row gap-5 pt-1">
                  <Text accessibilityRole="button" onPress={() => toggle('likedComments', c.id)} className={cx('font-pop-sb text-[13px]', liked ? 'text-navy' : 'text-ink-muted')}>{liked ? 'Liked' : 'Like'}{c.likes + (liked ? 1 : 0) > 0 ? ` · ${c.likes + (liked ? 1 : 0)}` : ''}</Text>
                  <Text accessibilityRole="button" onPress={() => setDraft(`@${p.name.split(' ')[0]} `)} className="font-pop-sb text-[13px] text-ink-muted">Reply</Text>
                  {p.id !== 'wole' && <Text accessibilityRole="button" onPress={() => setReported((r) => [...r, c.id])} className="font-pop-sb text-[13px] text-ink-muted">{reported.includes(c.id) ? 'Reported' : 'Report'}</Text>}
                </View>
              </View>
            </View>
          );
        })}
      </Screen>
    </KeyboardAvoidingView>
  );
}
