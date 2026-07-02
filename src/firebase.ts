import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// Firebase 前端設定（apiKey 等屬可公開的客戶端設定，本就會出現在網頁 bundle，
// 安全性由 Firestore 規則 + Auth 把關，非機密憑證）。
// 優先使用建置環境的 VITE_FIREBASE_* 變數，未提供時回退到下方專案 bicycle-10499 的設定。
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD-OWygHwIvIss5UV11IxzzaslmTWt1Uik',
  authDomain: 'bicycle-ee76c.firebaseapp.com',
  projectId: 'bicycle-ee76c',
  storageBucket: 'bicycle-ee76c.firebasestorage.app',
  messagingSenderId: '201437326962',
  appId: '1:201437326962:web:d4ca20885391a9cc1d1ceb',
};

// Realtime Database URL（ESP32 泊位感應器數據）。在 Firebase Console 建立 RTDB 後，
// 把顯示的網址填到 VITE_FIREBASE_DATABASE_URL（或直接改下方預設值）。
// 香港/亞洲區建議選 asia-southeast1，網址格式如下；未建立時相關功能自動停用。
const FALLBACK_DATABASE_URL = 'https://bicycle-ee76c-default-rtdb.asia-southeast1.firebasedatabase.app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FALLBACK_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FALLBACK_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FALLBACK_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FALLBACK_FIREBASE_CONFIG.appId,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || FALLBACK_DATABASE_URL,
};

export const realtimeDatabaseUrl: string = firebaseConfig.databaseURL;

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

