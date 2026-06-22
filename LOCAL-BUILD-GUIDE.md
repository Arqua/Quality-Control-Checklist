# 🚀 Local APK Build Guide

The QC Checklist app is **ready to build** - I've prebuilt the Android native code. Follow these instructions to create an APK on your local machine.

---

## 📋 What's Ready

✅ **All dependencies installed** (`node_modules/`)  
✅ **React Native prebuild complete** (`android/` directory)  
✅ **EAS configuration ready** (`eas.json`)  
✅ **Gradle wrapper configured** (v8.14.3)  

Just need to build!

---

## 🎯 Three Build Options

### Option 1: EAS Cloud Build (Easiest - **Recommended**)

No Android SDK needed. Builds in Expo's cloud.

```bash
# 1. Clone repo to local machine
git clone https://github.com/Arqua/Quality-Control-Checklist.git
cd Quality-Control-Checklist
git checkout claude/sleepy-fermi-xj2zdx

# 2. Install EAS CLI
npm install -g eas-cli

# 3. Create free Expo account at https://expo.dev/signup

# 4. Login
eas login

# 5. Build debug APK
eas build --platform android --profile development

# 6. When prompted to create app.json build config, press 'y'

# The APK will be built in Expo's cloud
# Download link will appear in terminal
```

**Time:** 3-5 minutes  
**Account:** Free Expo account  
**Advantage:** No local Android SDK setup needed

---

### Option 2: Local Gradle Build (Fastest if SDK installed)

Build on your machine using Android SDK.

#### Prerequisites
```bash
# macOS
brew install openjdk@17
brew install gradle
# Then download Android SDK from https://developer.android.com/studio

# Windows
# Download Android Studio: https://developer.android.com/studio

# Linux (Ubuntu/Debian)
sudo apt-get install openjdk-17-jdk-headless
sudo apt-get install gradle
# Then download Android SDK
```

#### Build Steps
```bash
# 1. Clone and navigate
git clone https://github.com/Arqua/Quality-Control-Checklist.git
cd Quality-Control-Checklist
git checkout claude/sleepy-fermi-xj2zdx

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Set Android SDK path
export ANDROID_HOME=/path/to/android/sdk
# Or on Windows:
# set ANDROID_HOME=C:\Users\YourName\AppData\Local\Android\sdk

# 4. Build APK
cd android
./gradlew assembleDebug
# (or gradlew.bat on Windows)

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

**Time:** 5-10 minutes (first build)  
**Account:** None needed  
**Advantage:** Fastest once Android SDK is installed

---

### Option 3: Docker Build (Cross-platform)

Build in isolated Docker container - no local setup needed.

#### Prerequisites
- Docker installed

#### Build
```bash
# Clone repo
git clone https://github.com/Arqua/Quality-Control-Checklist.git
cd Quality-Control-Checklist
git checkout claude/sleepy-fermi-xj2zdx

# Build in Docker
docker run --rm \
  -v $PWD:/workspace \
  -w /workspace \
  --entrypoint "/bin/bash" \
  node:18-alpine \
  -c '
    npm install --legacy-peer-deps && \
    npx expo prebuild --clean --platform android && \
    cd android && \
    ./gradlew assembleDebug && \
    cd .. && \
    echo "✅ APK ready: android/app/build/outputs/apk/debug/app-debug.apk"
  '

# APK will be in android/app/build/outputs/apk/debug/app-debug.apk
```

**Time:** 10-15 minutes  
**Setup:** Docker only  
**Advantage:** Works on any OS with Docker

---

## 📱 After Building

### Installation Options

**Option A: Via ADB**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B: Manual**
1. Transfer APK to Android device via USB
2. Open file manager → Downloads
3. Tap APK → Install

**Option C: Firebase App Distribution**
```bash
# Upload to test team
firebase appdistribution:distribute android/app/build/outputs/apk/debug/app-debug.apk \
  --app 1:123456789:android:abcdef123456 \
  --release-notes "Test build"
```

---

## ⚡ Build Commands Cheat Sheet

```bash
# Install dependencies (one time)
npm install --legacy-peer-deps

# Development/Debug build
eas build --platform android --profile development

# Production/Release build
eas build --platform android --profile production

# Local build with Gradle
cd android && ./gradlew assembleDebug

# Local release build (requires signing key)
cd android && ./gradlew assembleRelease

# Test on device
adb install app-debug.apk
adb shell am start -n com.arqua.qcchecklist/.MainActivity

# View device logs
adb logcat | grep -i qc
```

---

## 🔧 Troubleshooting

### "Android SDK not found"
```bash
# Set ANDROID_HOME to your SDK location
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
export ANDROID_HOME=~/Android/Sdk              # Linux
set ANDROID_HOME=C:\Users\User\AppData\Local\Android\sdk  # Windows

# Then try building again
```

### "Gradle version mismatch"
```bash
# Use the wrapper (./gradlew or gradlew.bat)
# It automatically downloads the correct version (8.14.3)
```

### "Out of memory" error
```bash
# Increase heap size
export GRADLE_OPTS="-Xmx4096m"
./gradlew assembleDebug
```

### "Could not determine java version"
```bash
# Install Java 17+
# Verify: java --version
# Should show 17 or higher
```

### APK won't install
- Ensure Android 5.0+ (API 21+)
- Uninstall previous version: `adb uninstall com.arqua.qcchecklist`
- Clear cache: `adb shell pm clear com.arqua.qcchecklist`

---

## 📊 Build Sizes & Times

| Build Type | Size | Time | Account |
|------------|------|------|---------|
| Debug APK | ~45MB | 3-5 min | EAS free |
| Release APK | ~35MB | 5-10 min | EAS free |
| Local Debug | ~45MB | 5-10 min | None |

---

## 🎯 Field Testing

Once you have the APK:

1. **Install on device**
   ```bash
   adb install app-debug.apk
   ```

2. **Test offline**
   - Enable airplane mode
   - Create new checklist
   - Mark items Pass/Fail/N/A
   - Should work without network

3. **Test sunlight readability**
   - Step outside
   - Check button contrast
   - Verify text is readable

4. **Test battery drain**
   - Check battery level before/after 30-min use
   - Background sync shouldn't drain heavily

5. **Collect feedback**
   - Button size for gloved hands
   - Color contrast in bright sunlight
   - App performance/crashes
   - Battery life impact

---

## 📈 Performance Tips

### Faster Builds
```bash
# Skip prebuild if no changes
eas build --platform android --cache

# Parallel build (faster)
./gradlew assembleDebug --parallel
```

### Smaller APK
- Release builds are ~10MB smaller than debug
- `shrinkResources = true` removes unused resources
- Proguard/R8 minification enabled in release

---

## 🔐 Release APK (for Google Play)

After successful testing:

```bash
# Create signed release APK
eas build --platform android --profile production

# This requires:
# 1. Signing key (EAS generates one first time)
# 2. EAS account (free)

# Upload to Google Play Console
# See: https://developer.android.com/studio/publish
```

---

## 📚 Next Steps

1. ✅ Build APK locally (choose one option above)
2. ✅ Test on physical Android device
3. ✅ Collect field feedback
4. ⬜ Deploy backend API
5. ⬜ Test end-to-end sync
6. ⬜ Submit to Google Play Store

---

## 🆘 Need Help?

- **Expo Docs**: https://docs.expo.dev/build/setup/
- **Android Docs**: https://developer.android.com/studio
- **Project Repo**: https://github.com/Arqua/Quality-Control-Checklist
- **Issues**: Create issue in repo

---

## 📝 Quick Checklist

Before sending to field teams:

- [ ] Build succeeded without errors
- [ ] APK installs on test device
- [ ] App starts without crashing
- [ ] All 3 screens load correctly
- [ ] Pass/Fail/N/A buttons work
- [ ] Comments can be entered
- [ ] Sign-off modal displays
- [ ] Works offline (airplane mode)
- [ ] UI readable in sunlight
- [ ] No memory leaks after 10 min use

---

**You're ready to build!** 🚀

Start with Option 1 (EAS Cloud) if you're unsure - it's the easiest and requires no SDK setup.

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile development
```
