import { carbonSaved } from './carbon';
import { getAnonymousUid, getFirebaseServices, isFirebaseConfigured } from './firebase';
import { getInlineReportImageExtension, isInlineReportImage } from './reportMedia';
import { Bike, Report } from './types';

export { isInlineReportImage } from './reportMedia';

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
}

export function isCloudBackendEnabled(): boolean {
  return isFirebaseConfigured;
}

export async function syncBikeRegistration(bike: Bike): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;

  const uid = await getAnonymousUid();
  if (!uid) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const tagId = bike.nfcTagId || `QJ-NFC-${safeId(bike.frameNo)}`;
  await Promise.all([
    setDoc(doc(services.db, 'bikes', bike.id), {
      bikeId: bike.id,
      frameNo: bike.frameNo,
      model: bike.model,
      ownerDisplayName: bike.ownerName,
      ownerUid: uid,
      nfcTagId: tagId,
      nfcBound: bike.nfcBound,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(doc(services.db, 'nfcTags', tagId), {
      tagId,
      bikeId: bike.id,
      frameNo: bike.frameNo,
      ownerUid: uid,
      status: 'active',
      updatedAt: serverTimestamp(),
      writtenAt: serverTimestamp(),
    }, { merge: true }),
  ]);
}

export async function syncReport(report: Report): Promise<void> {
  const services = await getFirebaseServices();
  if (!services) return;

  const uid = await getAnonymousUid();
  if (!uid) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(doc(services.db, 'reports', report.id), {
    ...report,
    createdBy: uid,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * 示範用：上傳本機相片以供跨裝置顯示；失敗時保留原 data URL。
 * 正式部署仍須另行收緊 Storage Rules 及實測權限。
 */
export async function uploadReportImage(imageUrl: string | undefined, reportId: string): Promise<string | undefined> {
  if (!isInlineReportImage(imageUrl)) return imageUrl;

  try {
    const services = await getFirebaseServices();
    const uid = await getAnonymousUid();
    if (!services || !uid) return imageUrl;

    const { getDownloadURL, getStorage, ref, uploadString } = await import('firebase/storage');
    const storage = getStorage(services.app);
    const storageRef = ref(storage, `reports/${uid}/${reportId}.${getInlineReportImageExtension(imageUrl)}`);
    await uploadString(storageRef, imageUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch {
    return imageUrl;
  }
}

/** 示範模式登入紀錄；Rules 拒絕或離線時回傳 false，不中斷本機展示。 */
export async function recordAdminDemoLogin(): Promise<boolean> {
  try {
    const services = await getFirebaseServices();
    const uid = await getAnonymousUid();
    if (!services || !uid) return false;

    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(doc(services.db, 'admins', uid), {
      uid,
      role: 'demo-admin',
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 管理員全案件讀取的預留介面。現行 Rules 可能因擁有者限制而回傳 null，
 * AdminTab 在此情況下仍使用 App state 的本機示範案件。
 */
export async function fetchAllReports(): Promise<Report[] | null> {
  try {
    const services = await getFirebaseServices();
    if (!services) return null;

    const { collection, getDocs } = await import('firebase/firestore');
    const snapshot = await getDocs(collection(services.db, 'reports'));
    return snapshot.docs.map((item) => item.data() as Report);
  } catch {
    return null;
  }
}

/** 示範模式案件更新：只同步管理欄位，不修改 citizen 建立者資料。 */
export async function syncReportStatus(report: Report): Promise<boolean> {
  try {
    const services = await getFirebaseServices();
    const uid = await getAnonymousUid();
    if (!services || !uid) return false;

    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
    await setDoc(doc(services.db, 'reports', report.id), {
      status: report.status,
      statusHistory: report.statusHistory || [],
      noticeDate: report.noticeDate || null,
      handledBy: report.handledBy || uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

export async function syncTrip(distanceKm: number): Promise<void> {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return;

  const services = await getFirebaseServices();
  if (!services) return;

  const uid = await getAnonymousUid();
  if (!uid) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  const tripId = `trip-${Date.now()}-${Math.round(distanceKm * 1000)}`;
  await setDoc(doc(services.db, 'trips', tripId), {
    tripId,
    uid,
    distanceKm,
    carbonSavedKg: carbonSaved(distanceKm),
    createdAt: serverTimestamp(),
  });
}
