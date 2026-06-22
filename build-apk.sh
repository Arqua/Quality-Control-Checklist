#!/bin/bash

# QC Checklist APK Build Script
# Builds an Android APK via the EAS Build workflow.
# (The legacy `expo build:android` command was removed in newer Expo SDKs.)

set -e

echo "🔨 QC Checklist APK Builder"
echo "============================"
echo ""

# Check if node/npm is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo "✓ npm version: $(npm --version)"
echo ""

# Ensure EAS CLI is available
if ! command -v eas &> /dev/null; then
    echo "⚠️  EAS CLI not found. Installing globally..."
    npm install -g eas-cli
fi
echo "✓ EAS CLI version: $(eas --version 2>/dev/null || echo 'installed')"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

echo ""
echo "📱 APK Build Options:"
echo "===================="
echo ""
echo "1. PREVIEW APK   (cloud build, internal distribution - good for field testing)"
echo "2. PRODUCTION APK (cloud build, release-ready, signed by EAS)"
echo "3. LOCAL APK     (build on this machine, requires Android SDK + JDK 17)"
echo ""
read -p "Select option (1-3): " build_option

case $build_option in
    1)
        echo ""
        echo "🔨 Building PREVIEW APK via EAS (cloud)..."
        echo "An Expo account is required (free). Run 'eas login' if prompted."
        echo ""
        eas build --platform android --profile preview
        echo ""
        echo "✅ Build submitted! A download link appears above when it finishes."
        echo "   Install with: adb install <downloaded.apk>"
        ;;

    2)
        echo ""
        echo "🔐 Building PRODUCTION APK via EAS (cloud)..."
        echo "EAS manages the release signing keystore for you."
        echo ""
        eas build --platform android --profile production
        echo ""
        echo "✅ Build submitted! Download the signed APK from the link above."
        ;;

    3)
        echo ""
        echo "🔨 Building LOCAL APK via EAS..."
        echo "Requires: Android SDK (ANDROID_HOME), JDK 17."
        echo ""
        eas build --platform android --profile preview --local
        echo ""
        echo "✅ Local build complete. The APK path is printed above."
        ;;

    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📚 For more info, see LOCAL-BUILD-GUIDE.md"
