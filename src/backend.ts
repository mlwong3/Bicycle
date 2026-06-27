import { carbonSaved } from './carbon';
import { getAnonymousUid, getFirebaseServices, isFirebaseConfigured } from './firebase';
import { Bike, Report } from './types';

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
