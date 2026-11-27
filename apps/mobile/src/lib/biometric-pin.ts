import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'everycation.wallet.pin';
const options: SecureStore.SecureStoreOptions = { requireAuthentication: true, authenticationPrompt: 'Approve with face or fingerprint', keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY };

/**
 * Lets a customer approve with face or fingerprint instead of typing the PIN.
 * The PIN is kept in the phone's Keychain/Keystore and released only after a
 * biometric check; the API still verifies it on every withdrawal.
 */
export async function biometricsAvailable() {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}
export async function rememberPin(pin: string) { if ((await biometricsAvailable()) && (await biometricsAllowed())) await SecureStore.setItemAsync(KEY, pin, options).catch(() => {}); }
export async function pinWithBiometrics(): Promise<string | null> { return SecureStore.getItemAsync(KEY, options).catch(() => null); }
export async function forgetPin() { if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY).catch(() => {}); }

const OFF = 'everycation.biometrics.off';
/** Whether the traveller allows face or fingerprint for withdrawals on this phone. On unless they turned it off in Settings. */
export async function biometricsAllowed() { if (Platform.OS === 'web') return false; return (await SecureStore.getItemAsync(OFF).catch(() => null)) !== '1'; }
/** Turning it off also forgets the saved PIN, so nothing stays on the phone. */
export async function allowBiometrics(on: boolean) {
  if (Platform.OS === 'web') return;
  if (on) await SecureStore.deleteItemAsync(OFF).catch(() => {});
  else { await SecureStore.setItemAsync(OFF, '1').catch(() => {}); await forgetPin(); }
}
