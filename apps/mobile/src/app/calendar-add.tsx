import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { z } from 'zod';
import { calendarItemSchema } from '@everycation/shared';
import { Button, Chips, FormInput, Screen, Segmented, T, Toggle } from '@/ui';
import { useApp } from '@/lib/store';

type Form = z.infer<typeof calendarItemSchema>;
const kinds = ['Activity', 'Reminder', 'New trip'] as const;
const kindKey = { Activity: 'activity', Reminder: 'reminder', 'New trip': 'trip' } as const;
const reminders = ['1 hour before', '30 minutes before', 'The evening before'];

export default function AddToCalendar() {
  const { day = 'Mon 14' } = useLocalSearchParams<{ day?: string }>();
  const addItinerary = useApp((s) => s.addItinerary);
  const { control, handleSubmit, setValue } = useForm<Form>({ resolver: zodResolver(calendarItemSchema),
    defaultValues: { kind: 'activity', title: '', date: `${day} Dec`, from: '06:30', to: '09:00', location: '', remind: reminders[0], google: true } });
  const kind = useWatch({ control, name: 'kind' });
  const save = handleSubmit((v) => { addItinerary({ day: v.date.replace(/ Dec.*$/, ''), time: v.from, title: v.title, note: v.location || `Reminder ${v.remind}` }); router.back(); });
  return (
    <Screen title="Add to calendar" footer={<Button label="SAVE" onPress={save} />}>
      <Segmented options={kinds} value={kinds.find((k) => kindKey[k] === kind)!} onChange={(k) => setValue('kind', kindKey[k])} />
      <FormInput control={control} name="title" label="Title *" placeholder="Lago di Braies at sunrise" />
      {kind !== 'trip' && <View className="gap-1.5"><T v="label">Trip</T><View className="h-[52px] justify-center rounded-xl border-[1.5px] border-control-border px-4"><T>Dolomites trip · 12–19 Dec</T></View></View>}
      <FormInput control={control} name="date" label="Date" placeholder="Mon 14 Dec" />
      <View className="flex-row gap-3"><View className="flex-1"><FormInput control={control} name="from" label="From" placeholder="06:30" /></View><View className="flex-1"><FormInput control={control} name="to" label="To" placeholder="09:00" /></View></View>
      <FormInput control={control} name="location" label="Location" placeholder="Lago di Braies, South Tyrol" />
      <View className="gap-2"><T v="label">Remind me</T><Controller control={control} name="remind" render={({ field }) => <Chips wrap options={reminders} value={field.value} onChange={field.onChange} />} /></View>
      <View className="flex-row items-center gap-3 rounded-card bg-tint p-3.5"><CalendarCheck size={22} color="#002C82" />
        <View className="flex-1"><T v="strong">Also add to Google Calendar</T><T v="small">&quot;EveryCation trips&quot; · Oluwole O.</T></View>
        <Controller control={control} name="google" render={({ field }) => <Toggle label="Also add to Google Calendar" value={field.value} onChange={field.onChange} />} /></View>
    </Screen>
  );
}
