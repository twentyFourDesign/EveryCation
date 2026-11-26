import * as Location from 'expo-location';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { usePlaceSearch, type PlaceHit } from '@/lib/trips';
import { T, colors, cx } from './index';

/** Asks the phone where it is and names the town there. Returns null with a reason the traveller can act on. */
async function currentPlace(ask: boolean): Promise<{ hit?: PlaceHit; problem?: string }> {
  const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return { problem: ask ? 'Allow location access in your settings to use where you are now.' : undefined };
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000, requiredAccuracy: 5_000 });
    const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { hit: await api<PlaceHit>(`/geo/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`) };
  } catch { return { problem: 'We could not find where you are. Type the place instead.' }; }
}

/**
 * A place box that suggests towns as the traveller types and can fill in where they are now.
 * `picked` is the suggestion they chose, with its exact position; typing again clears it.
 * With `detect`, the box fills itself in when the traveller has already allowed location access (it never asks by itself).
 */
export function PlaceField({ label, value, onChangeText, picked, onPick, error, hint, placeholder = 'Start typing a city, island or region', current = true, detect = false }: {
  label: string; value: string; onChangeText: (v: string) => void; picked: PlaceHit | null; onPick: (hit: PlaceHit | null) => void;
  error?: string; hint?: string; placeholder?: string; current?: boolean; detect?: boolean;
}) {
  const [term, setTerm] = useState(''); const [focused, setFocused] = useState(false);
  const [locating, setLocating] = useState(false); const [problem, setProblem] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(picked ? '' : value.trim()), 300); return () => clearTimeout(t); }, [value, picked]);
  const search = usePlaceSearch(term);
  const suggestions = focused && !picked && term.length >= 2 && term === value.trim() ? search.data ?? [] : [];
  const touched = useRef(false);

  function choose(hit: PlaceHit) { onPick(hit); onChangeText(hit.label); setProblem(''); setFocused(false); }
  async function locate(ask: boolean) {
    setProblem(''); setLocating(true);
    const r = await currentPlace(ask);
    setLocating(false);
    // Do not overwrite something the traveller typed while we were looking.
    if (r.hit && (ask || !touched.current)) choose(r.hit);
    else if (r.problem) setProblem(r.problem);
  }
  // Fill in where they are only if location is already allowed; asking happens only when they tap the button.
  useEffect(() => {
    if (!detect || value) return;
    void Location.getForegroundPermissionsAsync().then((p) => { if (p.granted) void locate(false); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const note = error ?? problem;
  return (
    <View className="gap-1.5">
      <T v="label">{label}</T>
      <View>
        <TextInput accessibilityLabel={label} value={value} placeholder={placeholder} placeholderTextColor={colors.inkMuted} autoCorrect={false} maxLength={80}
          onChangeText={(v) => { touched.current = true; onChangeText(v); onPick(null); }} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
          className={cx('h-[52px] rounded-xl border-[1.5px] bg-white pl-4 pr-12 font-pop text-[15px] text-ink focus:border-navy', note ? 'border-danger' : 'border-control-border')} />
        <View pointerEvents="none" className="absolute right-4 top-[15px]">
          {locating ? <ActivityIndicator size="small" color={colors.navy} /> : <MapPin size={20} color={picked ? colors.navy : colors.inkMuted} />}
        </View>
      </View>
      {suggestions.length > 0 && (
        <View className="overflow-hidden rounded-2xl border border-line bg-white" accessibilityLabel="Place suggestions">
          {suggestions.map((h, i) => (
            <Pressable key={`${h.label}${h.lat}`} accessibilityRole="button" accessibilityLabel={`${h.name}, ${h.detail}`} onPress={() => choose(h)} className={cx('flex-row items-center gap-3 px-3.5 py-3 active:bg-surface-muted', i > 0 && 'border-t border-line')}>
              <MapPin size={18} color={h.source === 'everycation' ? colors.navy : colors.inkMuted} />
              <View className="flex-1"><T v="strong" className="text-sm">{h.name}</T><T v="small" className="text-xs">{h.detail}</T></View>
            </Pressable>
          ))}
        </View>
      )}
      {focused && !picked && term.length >= 2 && term === value.trim() && search.isFetched && !search.isFetching && !suggestions.length && (
        <Text className="font-pop text-xs text-ink-muted">No matches yet. Try adding the country, like Vík, Iceland.</Text>
      )}
      {current && (
        <Pressable accessibilityRole="button" disabled={locating} onPress={() => locate(true)} className="flex-row items-center gap-1.5 self-start py-1">
          <LocateFixed size={16} color={colors.navy} />
          <Text className="font-pop-sb text-[13px] text-heading-blue">{locating ? 'Finding where you are…' : 'Use my current location'}</Text>
        </Pressable>
      )}
      {note ? <Text accessibilityRole="alert" className="font-pop-md text-xs text-danger">{note}</Text> : picked ? <Text className="font-pop text-xs text-ink-muted">{hint ?? `${picked.detail === 'Country' ? picked.name : picked.label} pinned.`}</Text> : null}
    </View>
  );
}
