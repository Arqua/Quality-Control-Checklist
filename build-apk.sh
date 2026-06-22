#!/bin/bash

# QC Checklist APK Build Script
# Builds a debug APK for field testing without requiring Expo EAS account

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
echo "1. DEBUG APK (Fast - ~2-3 min, good for testing)"
echo "2. RELEASE APK (Production - ~5-10 min, requires signing)"
echo "3. BUILD LOCALLY (Using Android SDK)"
echo ""
read -p "Select option (1-3): " build_option

case $build_option in
    1)
        echo ""
        echo "🔨 Building DEBUG APK..."
        echo "This creates an unsigned APK suitable for testing on development devices."
        echo ""

        # Check if expo is available
        if ! npx expo --version &> /dev/null; then
            echo "⚠️  Installing Expo CLI globally..."
            npm install -g expo-cli
        fi

        echo "🔄 Starting build process..."
        echo ""
        echo "Note: You'll be prompted to log into Expo (optional, can skip)"
        echo "For field testing, you can skip login and use local build."
        echo ""

        # Build debug APK
        npx expo build:android --type apk --clear

        echo ""
        echo "✅ DEBUG APK Build Complete!"
        echo ""
        echo "Next steps:"
        echo "1. Download the APK from the build link above"
        echo "2. Install on Android device:"
        echo "   adb install path/to/app.apk"
        echo "3. Or transfer via USB and install manually"
        echo ""
        ;;

    2)
        echo ""
        echo "🔐 Building RELEASE APK..."
        echo "This creates a signed, release-ready APK."
        echo ""

        if [ ! -f "android/app/my-release-key.keystore" ]; then
            echo "⚠️  Keystore file not found. Creating new one..."
            echo ""
            read -p "Keystore password: " keystore_pass
            read -p "Key password: " key_pass

            # Create keystore
            keytool -genkey -v -keystore android/app/my-release-key.keystore \
              -keyalg RSA -keysize 2048 -validity 10000 \
              -alias my-key-alias

            echo "✓ Keystore created"
        fi

        echo "🔄 Starting release build..."
        npx expo build:android --type release --clear

        echo ""
        echo "✅ RELEASE APK Build Complete!"
        echo "Download and test on devices"
        echo ""
        ;;

    3)
        echo ""
        echo "🔨 Local Build Instructions"
        echo "==========================="
        echo ""
        echo "Requirements:"
        echo "- Android SDK installed (API level 31+)"
        echo "- Java Development Kit (JDK) 11+"
        echo "- Gradle"
        echo ""
        echo "Steps:"
        echo "1. Install Expo CLI: npm install -g expo-cli"
        echo "2. Install EAS CLI: npm install -g eas-cli"
        echo "3. Run: eas build --platform android --local"
        echo ""
        echo "Or use Docker:"
        echo "docker run --rm -v \$PWD:/workspace node:18-alpine sh -c 'cd /workspace && npm install && npx expo build:android --type apk'"
        echo ""
        ;;

    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📚 For more info, see GETTING_STARTED.md"
