import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const app = initializeApp(firebaseConfig);

// App Check turns on only when a reCAPTCHA key is provided (see SETUP_GUIDE).
export const appCheckEnabled = Boolean(env.VITE_RECAPTCHA_SITE_KEY);
if (appCheckEnabled) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
// Sign-in lasts only while this browser tab is open (good for shared computers).
setPersistence(auth, browserSessionPersistence).catch(() => {});
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
