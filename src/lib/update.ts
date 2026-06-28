const UPDATE_URL = 'https://raw.githubusercontent.com/domi021/anime-tracker/main/version.json';

export interface UpdateInfo {
  version: string;
  apkUrl: string;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(UPDATE_URL);
    if (!res.ok) return null;
    const info: UpdateInfo = await res.json();
    if (info.version !== currentVersion) return info;
    return null;
  } catch {
    return null;
  }
}
