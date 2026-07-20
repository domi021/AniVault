import Constants from 'expo-constants';
import * as Application from 'expo-application';

const UPDATE_URL = 'https://raw.githubusercontent.com/domi021/AniVault/main/version.json';

export interface UpdateInfo {
  version: string;
  apkUrl: string;
}

export function getCurrentVersion(): string {
  return Application.nativeApplicationVersion
    || Constants.expoConfig?.version
    || '1.0.0';
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const current = getCurrentVersion();
    const res = await fetch(UPDATE_URL + '?t=' + Date.now());
    if (!res.ok) return null;
    const info: UpdateInfo = await res.json();
    if (info.version !== current) return info;
    return null;
  } catch {
    return null;
  }
}

export function getUpdateUrl(): string {
  return 'https://github.com/domi021/AniVault/releases/latest';
}
