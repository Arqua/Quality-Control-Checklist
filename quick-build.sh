#!/bin/bash
# Quick APK Build - One command for testing

set -e

echo "📱 QC Checklist - Quick APK Build"
echo "=================================="
echo ""
echo "Step 1/3: Installing dependencies..."
npm install --silent

echo "Step 2/3: Ensuring EAS CLI is available..."
command -v eas >/dev/null 2>&1 || npm install -g eas-cli

echo "Step 3/3: Building APK via EAS (cloud)..."
echo "(Requires a free Expo account; run 'eas login' if prompted)"
echo ""

eas build --platform android --profile preview

echo ""
echo "✅ Build Complete!"
echo ""
echo "📥 Download your APK from the link above"
echo ""
echo "💾 Installation:"
echo "   adb install /path/to/app.apk"
echo ""
echo "📖 Full guide: See APK-BUILD-GUIDE.md"
