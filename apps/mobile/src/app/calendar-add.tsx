import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, Input, Loading, Note, Screen, T } from '@/ui';
import { errorMessage } from '@/lib/api';
import { dayLabel, daysOf, useAddItem, useTrips } from '@/lib/trips';

const reminders = ['1 hour before', '30 minutes before', 'The evening before'];

/** Adds an activity to one of your trips. Opened from a trip or from the calendar. */
export default function AddToItinerary() {
  const p = useLocalSearchParams<{ tripId?: string; day?: string }>();
  const { data: trips, isLoading } = useTrips();
  const add = useAddItem();
  const open = (trips ?? []).filter((t) => t.status !== 'past');
  const [tripId, setTripId] = useState(p.tripId ?? ''); const [day, setDay] = useState(p.day ?? '');
  const [title, setTitle] = useState(''); const [time, setTime] = useState('09:00'); const [note, setNote] = useState(''); const [remind, setRemind] = useState(reminders[0]!);
  const [tried, setTried] = useState(false); const [error, setError] = useState('');
  if (isLoading) return <Screen title="Add to itinerary"><Loading what="your trips" /></Screen>;
  const trip = (trips ?? []).find((t) => t.id === tripId) ?? open[0];
  if (!trip) return <Screen title="Add to itinerary"><View className="gap-4 pt-8"><T className="text-center text-ink-muted">Add a trip first, then plan what you&apos;ll do each day.</T><Button label="ADD A TRIP" onPress={() => router.replace('/trip/new')} /></View></Screen>;
  const days = daysOf(trip); const chosen = days.includes(day) ? day : days[0]!; const labels = days.map(dayLabel);
  const errors = { title: title.trim().length < 2 ? 'Add a title' : undefined, time: !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? 'Use a time like 06:30' : undefined };
  async function save() {
    setTried(true); setError('');
    if (errors.title || errors.time) return;
    try { await add.mutateAsync({ tripId: trip!.id, day: chosen, time, title: title.trim(), note: note.trim() || undefined, remind }); router.back(); }
    catch (e) { setError(errorMessage(e)); }
  }
  return (
    <Screen title="Add to itinerary" footer={<Button disabled={add.isPending} label={add.isPending ? 'SAVING…' : 'SAVE'} onPress={save} />}>
      {open.length > 1 && <View className="gap-2"><T v="label">Trip</T><Chips wrap options={open.map((t) => t.title)} value={trip.title} onChange={(name) => { setTripId(open.find((t) => t.title === name)!.id); setDay(''); }} /></View>}
      {open.length <= 1 && <T v="small">{trip.title}</T>}
      <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Lago di Braies at sunrise" maxLength={80} error={tried ? errors.title : undefined} />
      <View className="gap-2"><T v="label">Day</T><Chips options={labels} value={dayLabel(chosen)} onChange={(l) => setDay(days[labels.indexOf(l)]!)} /></View>
      <Input label="Time" value={time} onChangeText={setTime} placeholder="06:30" keyboardType="numbers-and-punctuation" maxLength={5} error={tried ? errors.time : undefined} />
      <Input label="Place or note" value={note} onChangeText={setNote} placeholder="Lago di Braies, South Tyrol" maxLength={200} />
      <View className="gap-2"><T v="label">Remind me</T><Chips wrap options={reminders} value={remind} onChange={setRemind} /></View>
      <Note>Your reminder choice is saved with the activity. Phone reminders and Google Calendar sync switch on once notifications and Google are connected.</Note>
      {!!error && <Note tone="danger">{error}</Note>}
    </Screen>
  );
}
