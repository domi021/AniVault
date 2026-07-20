# Release Checklist

## 1. Bump Version

Update the version number in all three files (use the same version everywhere):

- `package.json` → `"version": "X.Y.Z"`
- `app.json` → `"version": "X.Y.Z"`
- `version.json` → `"version": "X.Y.Z"` and update `"apkUrl"` to point to the new release tag

Example for version.json:
```json
{
  "version": "X.Y.Z",
  "apkUrl": "https://github.com/domi021/anime-tracker/releases/download/vX.Y.Z/app-release.apk"
}
```

## 2. Commit and Tag

```bash
git add -A
git commit -m "vX.Y.Z - Brief description of changes"
git tag -a vX.Y.Z -m "vX.Y.Z - Brief description"
git push && git push --tags
```

## 3. Build APK on Homelab

```bash
ssh homelab
cd ~/anime-tracker
git checkout -- . && git pull origin main
source ~/.nvm/nvm.sh && npm install

# Only needed if native dependencies changed (new Expo SDK, new plugins, etc.)
export JAVA_HOME=~/android-sdk/jdk-17.0.12
export ANDROID_HOME=~/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
npx expo prebuild --platform android --clean

# Build the APK (takes ~1-10 min depending on cache)
cd android && ./gradlew assembleRelease
```

APK output: `~/anime-tracker/android/app/build/outputs/apk/release/app-release.apk`

## 4. Download APK

```bash
# From your local machine:
scp homelab:~/anime-tracker/android/app/build/outputs/apk/release/app-release.apk ~/Downloads/app-release.apk
```

## 5. Create GitHub Release

```bash
gh release create vX.Y.Z \
  --repo domi021/anime-tracker \
  --title "vX.Y.Z" \
  --notes "## Changes
  - Change 1
  - Change 2

  ### Note
  If updating from a previous version, you may need to uninstall the old app first (signing key change)." \
  ~/Downloads/app-release.apk
```

Or create manually at https://github.com/domi021/anime-tracker/releases/new

## 6. Update This File

Bump the version example in this file to match the latest release.

---
Current version: 1.3.1
