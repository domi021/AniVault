import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { version as pkgVersion } from '../../package.json';

const UPDATE_URL = 'https://raw.githubusercontent.com/domi021/anime-tracker/main/version.json';

export interface UpdateInfo {
  version: string;
  apkUrl: string;
}

export function getCurrentVersion(): string {
  return (
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    pkgVersion ??
    '0.0.0'
  );
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(UPDATE_URL + '?t=' + Date.now());
    if (!res.ok) return null;
    const info: UpdateInfo = await res.json();
    if (info.version !== getCurrentVersion()) return info;
    return null;
  } catch {
    return null;
  }
}

export function getUpdateUrl(): string {
  return 'https://github.com/domi021/anime-tracker/releases/latest';
}
