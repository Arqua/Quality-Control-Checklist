# APK Build Guide - Field Testing

This guide walks you through building an APK for Android field testing without needing an Expo account.

## Quick Start (5 minutes)

### Option 1: Easiest - Via Expo Cloud (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Build debug APK
eas build --platform android --profile preview

# 3. When prompted:
#    - You can create a free Expo account or skip
#    - Choose "Use existing build cache" if available
#    - Build will take 2-3 minutes
```

The APK download link will appear in your terminal. Download it and transfer to your Android device.

---

## Option 2: Manual Build via Android Studio

### Prerequisites
- Android SDK (API 31+)
- Java JDK 11+
- Gradle

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Generate Expo prebuild
npx expo prebuild --clean --platform android

# 3. Build APK using Gradle
cd android
./gradlew assembleDebug

# 4. APK location
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Option 3: Docker Build (No Local Setup Needed)

```bash
docker run --rm -it \
  -v $PWD:/app \
  -w /app \
  node:18-alpine \
  sh -c 'npm install && eas build --platform android --profile preview'
```

---

## Installation on Device

### Method 1: ADB (Android Debug Bridge)

```bash
# Install ADB if not already installed
# macOS: brew install android-platform-tools
# Windows: Download from Google
# Linux: apt-get install android-sdk-platform-tools

# Connect device via USB (enable Developer Mode)
adb install path/to/app.apk

# Launch app
adb shell am start -n com.arqua.qcchecklist/.MainActivity
```

### Method 2: Manual Install via USB

1. Download APK to computer
2. Connect Android device via USB
3. Enable "File Transfer" mode on device
4. Copy APK to device's Downloads folder
5. On device: Open Files → Downloads → tap APK file → Install

### Method 3: QR Code/Share

1. After building, Expo provides a download link
2. Scan QR code on device or email link
3. Tap link on device to download and install

---

## Testing in Field Conditions

### What to Test

1. **Offline Functionality**
   - Turn off WiFi/cellular before opening app
   - Create new checklist
   - Mark items Pass/Fail/N/A
   - App should work without network
   - Data persists locally

2. **Bright Sunlight**
   - Test colors are readable in direct sunlight
   - Orange (#FF6B35) and Dark Blue (#004E89) should have good contrast
   - Button sizes adequate for gloved hands

3. **Touch Response**
   - Buttons should respond immediately
   - No lag when switching between items
   - Comments input smooth

4. **Battery Usage**
   - Monitor battery drain during 30-min inspection
   - Background sync shouldn't drain heavily

5. **Storage**
   - Check SQLite database size
   - Ensure room for photos when feature is added

### Device Recommendations

**Minimum:**
- Android 12+
- 4GB RAM
- 500MB free storage

**Recommended:**
- Android 13+
- 6GB+ RAM
- Rugged phone (e.g., CAT phones, Samsung Galaxy XCover)
- IP67+ waterproofing for construction sites

---

## Build Files Explained

### Debug APK (`app-debug.apk`)
- ✅ Fast build (~2-3 min)
- ✅ For testing on dev devices only
- ❌ Not production-ready
- ❌ Unsigned

### Release APK (`app-release.apk`)
- ✅ Can be uploaded to Google Play
- ✅ Signed with certificate
- ⚠️ Slower build (~5-10 min)
- Requires: Keystore file for signing

---

## Creating a Release Build (Production)

### Step 1: Generate Keystore

```bash
keytool -genkey -v -keystore my-release-key.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias my-key-alias

# Fill in your info when prompted
# Save the password securely!
```

### Step 2: Build Release APK

```bash
eas build --platform android --profile production
```

### Step 3: Upload to Play Store

See: https://developer.android.com/studio/publish

---

## Troubleshooting

### Build Fails - "Node version mismatch"
```bash
# Use nvm to manage Node versions
nvm use 18
npm install
```

### "Unable to create debuggable build"
```bash
# Use --clear flag to rebuild from scratch
eas build --platform android --profile preview --clear-cache
```

### "Gradle build failed"
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx expo prebuild --clean --platform android
```

### APK won't install - "Parse error"
```bash
# Device API level too old
# Requires: Android 5.0+ (API 21+)
# Recommended: Android 12+ (API 31+)
```

### App crashes on startup
- Check Logcat: `adb logcat | grep QCChecklist`
- May be SQLite initialization issue
- Check that `expo-sqlite` is properly installed

---

## Version Management

### Track Build Versions

Edit `app.json`:
```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

Increment `versionCode` for each build (1, 2, 3, ...).

---

## Continuous Deployment

### Automated Builds on GitHub

Create `.github/workflows/build-apk.yml`:

```yaml
name: Build APK

on:
  push:
    branches: [main, claude/sleepy-fermi-xj2zdx]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: eas build --platform android --profile preview
```

---

## Performance Optimization

### For Slow Networks
```bash
# Use cache to skip rebuilds
eas build --platform android --profile preview
```

### Smaller APK Size
- Remove unused dependencies
- Minify code: Already done in release builds
- Strip debug symbols: Release build handles this

### Faster Rebuilds
```bash
# Reuse previous build cache
eas build --platform android --profile preview --clear-cache
```

---

## Next Steps

1. **Build & Test Locally**
   - Install on test device
   - Walk through all screens
   - Test offline operations

2. **Field Testing**
   - Deploy to construction team
   - Gather feedback on UX/colors/button sizes
   - Log any crashes or issues

3. **Iterate**
   - Fix issues found in field testing
   - Rebuild and redistribute
   - Collect metrics (battery, storage, crashes)

4. **Backend Integration**
   - Deploy Node.js backend API
   - Connect sync endpoint
   - Test end-to-end sync flow

5. **Production Release**
   - Generate release signing key
   - Build release APK
   - Submit to Google Play Store

---

## Security Notes

- Debug APK is **not secure** - only for internal testing
- Don't distribute debug APKs to end users
- Release APK must be signed with private key
- Store keystore password securely (e.g., password manager)
- Never commit keystore to Git

---

## Support

- **Expo Docs**: https://docs.expo.dev/build/setup
- **GitHub Issues**: [Project repo]
- **Stack Overflow**: Tag with `react-native`, `expo`, `android`
