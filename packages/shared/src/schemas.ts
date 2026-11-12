import { z } from 'zod';
import { parseNaira } from './money';

/** Form rules shared by the app, the console and (later) the API. */
const amount = (min: number, label = 'an amount') =>
  z.string().refine((v) => (parseNaira(v) ?? 0) >= min * 100, `Enter ${label} of at least ₦${min.toLocaleString()}`);

export const phoneSchema = z.object({
  phone: z.string().regex(/^[\d\s]{10,13}$/, 'Enter your phone number, like 803 123 4821'),
});
export const emailSchema = z.object({ email: z.string().trim().pipe(z.email('Enter a valid email address, like ada@example.com')) });
export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export const identitySchema = z.object({
  method: z.enum(['BVN', 'NIN']),
  number: z.string().regex(/^\d{11}$/, 'This number has 11 digits'),
  dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use dd/mm/yyyy'),
});
export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, 'Your PIN has 4 digits')
  .refine((p) => !['1234', '0000', '1111', '4321'].includes(p), 'Choose a PIN that is harder to guess');
export const bankSchema = z.object({
  bank: z.string().min(1, 'Choose your bank'),
  accountNumber: z.string().regex(/^\d{10}$/, 'Account numbers have 10 digits'),
});

export const addMoneySchema = z.object({ amount: amount(1000), destination: z.string(), method: z.enum(['transfer', 'card']) });
export const withdrawSchema = z.object({ amount: amount(1000), source: z.string() });
export const goalSchema = z.object({
  kind: z.enum(['trip', 'shopping', 'package']),
  name: z.string().min(2, 'Give your goal a name'),
  target: amount(5000, 'a target'),
  by: z.string().min(4, 'Choose a date'),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  locked: z.boolean(),
});

export const tipSchema = z.object({
  format: z.enum(['video', 'voice', 'write']),
  place: z.string().min(2, 'Add the place'),
  headline: z.string().min(8, 'Write a headline of at least 8 characters').max(80),
  category: z.string(),
  body: z.string().optional(),
});
export const adviceSchema = z.object({
  location: z.string().min(2, 'Choose a location'),
  topic: z.string().min(1, 'Choose a topic'),
  body: z.string().min(30, 'Write at least 30 characters so it is useful').max(600),
  showPassport: z.boolean(),
});
export const commentSchema = z.object({ body: z.string().min(1).max(500) });
export const calendarItemSchema = z.object({
  kind: z.enum(['activity', 'reminder', 'trip']),
  title: z.string().min(2, 'Add a title'),
  date: z.string().min(3, 'Choose a date'),
  from: z.string(),
  to: z.string(),
  location: z.string(),
  remind: z.string(),
  google: z.boolean(),
});
export const sellPlanSchema = z.object({
  mode: z.enum(['private', 'free', 'sell']),
  price: z.string(),
}).refine((v) => v.mode !== 'sell' || (parseNaira(v.price) ?? 0) >= 100000, { path: ['price'], message: 'Set a price of at least ₦1,000' });

export const adminSignInSchema = z.object({
  email: z.email('Enter your work email'),
  password: z.string().min(8, 'Enter your password'),
  code: z.string().regex(/^\d{3}\s?\d{3}$/, 'Enter the 6-digit code'),
});
export const broadcastSchema = z.object({
  audience: z.string(),
  title: z.string().min(3, 'Add a title').max(50, 'Keep the title under 50 characters'),
  message: z.string().min(10, 'Write the message').max(140, 'Keep the message under 140 characters'),
  opens: z.string(),
  date: z.string().min(3),
  time: z.string().min(3),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type AdviceInput = z.infer<typeof adviceSchema>;
export type BroadcastInput = z.infer<typeof broadcastSchema>;
