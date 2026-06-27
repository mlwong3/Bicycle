import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// Firebase 前端設定（apiKey 等屬可公開的客戶端設定，本就會出現在網頁 bundle，
// 安全性由 Firestore 規則 + Auth 把關，非機密憑證）。
// 優先使用建置環境的 VITE_FIREBASE_* 變數，未提供時回退到下方專案 bicycle-10499 的設定。
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAKNsu3GPW3l6CR6WuZAktNicDaXPRy6BQ',
  authDomain: 'bicycle-10499.firebaseapp.com',
  projectId: 'bicycle-10499',
  storageBucket: 'bicycle-10499.firebasestorage.app',
  messagingSenderId: '729712744526',
  appId: '1:729712744526:web:288ae7cd8050f3fc090b1f',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FALLBACK_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK_FIREBASE_CONFIG.appId,
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

