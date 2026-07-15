const VERSION = 'v2';

export const STORAGE_KEYS = {
  onboardingDone: `hk_bike:${VERSION}:onboarding_done`,
  bikes: `hk_bike:${VERSION}:registered_list`,
  reports: `hk_bike:${VERSION}:reports_history`,
  workOrders: `hk_bike:${VERSION}:work_orders`,
  jointOperations: `hk_bike:${VERSION}:joint_operations`,
  savedParkingIds: `hk_bike:${VERSION}:saved_parking_spots`,
  userScore: `hk_bike:${VERSION}:user_green_score`,
  totalDistanceKm: `hk_bike:${VERSION}:total_distance_km`,
  currentTab: `hk_bike:${VERSION}:current_active_tab`,
  language: `hk_bike:${VERSION}:display_language`,
  csdiApiKey: `hk_bike:${VERSION}:csdi_api_key`,
  enabledWmsLayers: `hk_bike:${VERSION}:enabled_wms_layers`,
  showCyclingData: `hk_bike:${VERSION}:show_cycling_data`,
} as const;

const LEGACY_KEYS = [
  'hk_bike_onboarding_done',
  'hk_bike_registered_list',
  'hk_bike_reports_history',
  'hk_bike_saved_parking_spots',
  'hk_bike_user_green_score',
  'hk_bike_total_distance_km',
  'hk_bike_current_active_tab',
  'hk_bike_display_language',
  'HK_CSDI_API_KEY',
  'HK_BIKE_ENABLED_WMS_LAYERS',
  'HK_BIKE_SHOW_CYCLING_DATA',
];

export function readStoredJson<T>(key: string, fallback: T, legacyKeys: string[] = []): T {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;

    for (const legacyKey of legacyKeys) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy) {
        const parsed = JSON.parse(legacy) as T;
        writeStoredJson(key, parsed);
        return parsed;
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function writeStoredJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing or when quota is exceeded.
  }
}

export function readStoredString(key: string, fallback: string, legacyKeys: string[] = []): string {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved !== null) return saved;

    for (const legacyKey of legacyKeys) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy !== null) {
        writeStoredString(key, legacy);
        return legacy;
      }
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function writeStoredString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors and keep the in-memory state usable.
  }
}

export function readStoredNumber(key: string, fallback: number, legacyKeys: string[] = []): number {
  const raw = readStoredString(key, '', legacyKeys);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clearAppStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
    LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Keep reset functional even when storage is unavailable.
  }
}
