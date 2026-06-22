#!/bin/bash
# Quick APK Build - One command for testing

set -e

echo "📱 QC Checklist - Quick APK Build"
echo "=================================="
echo ""
echo "Step 1/3: Installing dependencies..."
npm install --silent

echo "Step 2/3: Building Debug APK..."
echo "(This may take 2-3 minutes)"
echo ""

npx expo build:android --type apk --clear

echo ""
echo "✅ Build Complete!"
echo ""
echo "📥 Download your APK from the link above"
echo ""
echo "💾 Installation:"
echo "   adb install /path/to/app.apk"
echo ""
echo "📖 Full guide: See APK-BUILD-GUIDE.md"
