import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'bicycle-ee76c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export async function getFirebaseServices(): Promise<{ app: FirebaseApp; auth: Auth; db: Firestore } | null> {
  if (!isFirebaseConfigured) return null;

  if (!app) {
    const [{ initializeApp, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }

  return { app, auth: auth!, db: db! };
}

export async function getAnonymousUid(): Promise<string | null> {
  const services = await getFirebaseServices();
  if (!services) return null;

  if (services.auth.currentUser) return services.auth.currentUser.uid;

  try {
    const { signInAnonymously } = await import('firebase/auth');
    const credential = await signInAnonymously(services.auth);
    return credential.user.uid;
  } catch {
    return null;
  }
}

