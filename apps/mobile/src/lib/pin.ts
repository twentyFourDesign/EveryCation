import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'everycation.wallet.pin';
let memory: string | null = '2580'; // sample PIN for the demo user; web has no secure storage

/**
 * The PIN is kept here only so the demo flow works offline. In production the app
 * never stores the PIN: it sends it over TLS and the API checks an Argon2id hash.
 */
export async function savePin(pin: string) {
  memory = pin;
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(KEY, pin, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function checkPin(pin: string) {
  const stored = Platform.OS === 'web' ? memory : ((await SecureStore.getItemAsync(KEY)) ?? memory);
  return stored === pin;
}
export async function canUseBiometrics() {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}
export async function approveWithBiometrics(reason: string) {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Use PIN' });
  return r.success;
}
