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
export async function rememberPin(pin: string) { if (await biometricsAvailable()) await SecureStore.setItemAsync(KEY, pin, options).catch(() => {}); }
export async function pinWithBiometrics(): Promise<string | null> { return SecureStore.getItemAsync(KEY, options).catch(() => null); }
export async function forgetPin() { if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY).catch(() => {}); }
