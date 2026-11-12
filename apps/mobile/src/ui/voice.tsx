import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors } from './index';

export interface VoiceNote { uri: string; seconds: number }
/** Voice tips are short on purpose: quick to record, quick to listen to and small to upload. */
export const MAX_VOICE_SECONDS = 120;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** What to hand to uploadMedia: a file path on phones, a real File in the browser. */
export async function voiceUpload(note: VoiceNote) {
  if (Platform.OS !== 'web') return { uri: note.uri, mimeType: 'audio/mp4', fileName: 'voice-tip.m4a' };
  const blob = await (await fetch(note.uri)).blob();
  return { uri: note.uri, file: new File([blob], 'voice-tip.webm', { type: blob.type.startsWith('audio/') ? blob.type : 'audio/webm' }) };
}

/** A record button that turns into a timer and a stop button. Hands back the finished recording. */
export function VoiceRecorder({ onDone, onError }: { onDone: (note: VoiceNote) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(false);
  const stopping = useRef(false);
  const seconds = Math.floor(state.durationMillis / 1000);

  async function start() {
    setStarting(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return onError('Allow microphone access in your phone settings to record a voice tip.');
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { onError('We could not start recording. Check that no other app is using the microphone.'); } finally { setStarting(false); }
  }
  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    const length = Math.max(1, Math.round(recorder.getStatus().durationMillis / 1000));
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }); // so playback uses the loudspeaker again on iPhone
      if (recorder.uri) onDone({ uri: recorder.uri, seconds: length }); else onError('That recording was not saved. Please try again.');
    } catch { onError('That recording was not saved. Please try again.'); } finally { stopping.current = false; }
  }
  const stopRef = useRef(stop);
  useEffect(() => { stopRef.current = stop; });
  useEffect(() => { if (state.isRecording && seconds >= MAX_VOICE_SECONDS) void stopRef.current(); }, [state.isRecording, seconds]);

  if (state.isRecording) return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-danger-soft p-3" accessibilityLiveRegion="polite">
      <View className="h-3 w-3 rounded-full bg-danger" />
      <Text className="flex-1 font-pop-sb text-[15px] text-ink">Recording {clock(seconds)} <Text className="font-pop text-[13px] text-ink-muted">of {clock(MAX_VOICE_SECONDS)}</Text></Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={stop} className="h-11 flex-row items-center gap-2 rounded-full bg-danger px-4 active:opacity-80"><Square size={14} color="#fff" fill="#fff" /><Text className="font-pop-sb text-[13px] text-white">Stop</Text></Pressable>
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Record a voice tip" disabled={starting} onPress={start} className="h-11 flex-row items-center justify-center gap-2 rounded-full border-[1.5px] border-navy active:opacity-70">
      <Mic size={18} color={colors.navy} /><Text className="font-pop-sb text-[13px] text-navy">{starting ? 'Starting…' : 'Record a voice tip'}</Text>
    </Pressable>
  );
}

/** Plays a voice note: play or pause, a progress bar and the time. `seconds` is shown until the file reports its own length. */
export function VoicePlayer({ url, seconds, label = 'Voice tip' }: { url: string; seconds?: number; label?: string }) {
  const player = useAudioPlayer(url, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  // Recordings made in a browser often report no length, so fall back to what we measured.
  const total = Number.isFinite(status.duration) && status.duration > 0 ? status.duration : seconds ?? 0;
  const at = Math.min(status.currentTime, total || status.currentTime);
  useEffect(() => { if (status.didJustFinish) player.seekTo(0); }, [status.didJustFinish, player]);
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-tint p-3">
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? `Pause ${label.toLowerCase()}` : `Play ${label.toLowerCase()}`} onPress={() => (status.playing ? player.pause() : player.play())} className="h-12 w-12 items-center justify-center rounded-full bg-navy active:opacity-80">
        {status.playing ? <Pause size={20} color="#fff" fill="#fff" /> : <Play size={20} color="#fff" fill="#fff" />}
      </Pressable>
      <View className="flex-1 gap-1.5">
        <Text className="font-pop-sb text-[13px] text-navy">{label}</Text>
        <View className="h-1.5 overflow-hidden rounded-full bg-white"><View className="h-full rounded-full bg-navy" style={{ width: `${total ? Math.min(100, (at / total) * 100) : 0}%` }} /></View>
      </View>
      <Text className="font-pop-md text-[13px] text-ink-muted">{clock(status.playing || at > 0 ? at : total)}</Text>
    </View>
  );
}
