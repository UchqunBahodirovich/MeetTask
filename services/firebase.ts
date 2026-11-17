import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';

/**
 * Web config identifies the Firebase project and is meant to be public;
 * access is controlled by Firebase security rules, not by hiding these values.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBUvNifButhrpKEAYbruXTm3wsZI0NhlSo',
  authDomain: 'meettaskai.firebaseapp.com',
  projectId: 'meettaskai',
  storageBucket: 'meettaskai.firebasestorage.app',
  messagingSenderId: '930193451714',
  appId: '1:930193451714:web:710f7c1a7302336534e95b',
  measurementId: 'G-LBR3P19W7C',
};

export const firebaseApp = initializeApp(firebaseConfig);

// Analytics is unavailable in some browsers and in private mode, so it is
// initialised only where the SDK reports support and never blocks startup.
void isSupported()
  .then((supported) => {
    if (supported) getAnalytics(firebaseApp);
  })
  .catch(() => {
    /* analytics is optional */
  });

/**
 * Signs in with Google and returns the Firebase ID token.
 *
 * The token only proves who the person is — the API exchanges it for its own
 * session, because workspace and role live on this backend, not in Firebase.
 */
export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getAuth(firebaseApp), provider);
  return credential.user.getIdToken();
}
