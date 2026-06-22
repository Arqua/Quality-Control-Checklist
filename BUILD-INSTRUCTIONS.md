# 🚀 Build & Deploy APK for Field Testing

Quick reference for building the QC Checklist app as an Android APK.

## ⚡ Fastest Way (3 minutes)

```bash
./quick-build.sh
```

This will:
1. Install dependencies
2. Build a debug APK
3. Provide download link

## 📋 All Build Options

### Option A: Interactive Menu
```bash
./build-apk.sh
```
Menu-driven, choose between debug, release, or local build.

### Option B: Direct Commands

**Debug APK (for testing)**
```bash
npm install
npx expo build:android --type apk
```

**Release APK (for production)**
```bash
npm install
npx expo build:android --type release
```

### Option C: No Account Needed (Local Build)

```bash
# Install Expo CLI globally
npm install -g expo-cli

# Build locally with Android SDK
npx expo prebuild --clean --platform android
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 After Building

### Download APK
- Expo will provide a download link in terminal
- Or scan the QR code shown
- Or wait for email with link

### Install on Device

**Using ADB:**
```bash
# USB connect Android device (Developer Mode enabled)
adb install path/to/app.apk
```

**Manual:**
1. Download APK to device via WiFi
2. Open file manager → Downloads
3. Tap APK file → Install

**via Expo App:**
1. Install Expo Go app on device
2. Open dev server: `npm start`
3. Scan QR code with Expo Go

---

## 📊 Build Comparison

| Method | Speed | Setup | Account | Field Ready |
|--------|-------|-------|---------|-------------|
| `quick-build.sh` | ⚡⚡ 2-3 min | None | Optional | ✅ Yes |
| Cloud Build | ⚡⚡ 2-3 min | npm | Expo (free) | ✅ Yes |
| Local Build | ⚠️ 5-10 min | Android SDK | No | ✅ Yes |
| Release Build | ⚠️ 5-10 min | npm | Optional | ✅ Production |

---

## 🧪 Field Testing Checklist

After building and installing:

- [ ] App starts without errors
- [ ] HomeScreen shows sample project & checklists
- [ ] Can create new checklist (NewChecklistScreen)
- [ ] Can enter inspector name
- [ ] Can select template (Pre-Pour Concrete)
- [ ] InspectionScreen loads all 5 items
- [ ] Pass/Fail/N/A buttons toggle correctly
- [ ] Comments can be entered
- [ ] Progress bar updates (should show 80% complete)
- [ ] "Sign Off" button triggers modal
- [ ] Back buttons work on all screens
- [ ] App works offline (airplane mode)
- [ ] No crashes during normal use
- [ ] Screen is readable in bright sunlight

---

## 🔧 Troubleshooting

### "Command not found: npm"
Install Node.js 18+ from nodejs.org

### "Build failed - Gradle error"
```bash
cd android && ./gradlew clean && cd ..
npx expo prebuild --clean --platform android
```

### "APK install fails - Parse error"
Device is too old. Requires Android 5.0+ (API 21+).
Recommended: Android 12+ (API 31+)

### "App crashes on startup"
Check device logs:
```bash
adb logcat | grep -i error
```

---

## 📦 Version Tracking

Increment version before each build:

In `app.json`:
```json
{
  "version": "1.0.1",
  "android": {
    "versionCode": 2
  }
}
```

Then rebuild to deploy new version.

---

## 📚 Documentation

- **Full guide**: See `APK-BUILD-GUIDE.md`
- **Dev setup**: See `GETTING_STARTED.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Repo**: See `README.md`

---

## 🎯 Next Steps After Field Testing

1. **Collect Feedback**
   - Sunlight readability
   - Button size for gloved hands
   - Battery usage
   - Speed/performance

2. **Fix Issues**
   - Apply fixes to code
   - Rebuild and redeploy

3. **Backend Integration**
   - Deploy sync endpoint
   - Test end-to-end data sync

4. **Production Release**
   - Build release APK
   - Submit to Google Play Store
   - Monitor crashes with Firebase/Sentry

---

## 📞 Quick Help

```bash
# Check Expo is installed
npx expo --version

# See available build options
npx expo build:android --help

# List previous builds
npx expo build:android --list

# View recent build details
npx expo build:android --fetch-status
```

---

Start building! 🚀

```bash
./quick-build.sh
```
