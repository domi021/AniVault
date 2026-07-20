import { version as APP_VERSION } from '../../package.json';

const UPDATE_URL = 'https://raw.githubusercontent.com/domi021/AniVault/main/version.json';

export interface UpdateInfo {
  version: string;
  apkUrl: string;
}

export function getCurrentVersion(): string {
  return APP_VERSION;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(UPDATE_URL + '?t=' + Date.now());
    if (!res.ok) return null;
    const info: UpdateInfo = await res.json();
    if (info.version !== APP_VERSION) return info;
    return null;
  } catch {
    return null;
  }
}

export function getUpdateUrl(): string {
  return 'https://github.com/domi021/AniVault/releases/latest';
}
