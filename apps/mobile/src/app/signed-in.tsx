import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Loading, Screen } from '@/ui';

// In a browser, Google sign-in happens in a pop-up window that lands here; this hands the result back to the page that opened it.
const finishing = WebBrowser.maybeCompleteAuthSession().type === 'success';

/** Where Google sends people back to. On phones the sign-in screen is already handling the result, so this just moves on. */
export default function SignedIn() {
  if (finishing) return <Screen title=""><Loading what="your account" /></Screen>;
  return <Redirect href="/explore" />;
}
