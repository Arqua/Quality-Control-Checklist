import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useI18n } from '@/locales/i18nContext';
import { useAuth } from '@/auth/authContext';
import { Language } from '@/locales/translations';

const LANGUAGES: { code: Language; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language, setLanguage } = useI18n();
  const { user } = useAuth();

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        {/* User Info */}
        <View className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
          <View className="flex-row items-center mb-3">
            <MaterialIcons name="person" size={24} color="#004E89" />
            <Text className="text-lg font-bold text-construction-dark ml-3">
              {user?.username}
            </Text>
          </View>
          <Text className="text-sm text-gray-600">
            {user?.role === 'manager' ? 'Manager' : 'Inspector'}
          </Text>
        </View>

        {/* Language Selection */}
        <View>
          <Text className="text-lg font-bold text-construction-dark mb-3">
            Language
          </Text>
          <View className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {LANGUAGES.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                className={`p-4 flex-row items-center justify-between ${
                  index < LANGUAGES.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-construction-dark">
                    {lang.label}
                  </Text>
                  <Text className="text-sm text-gray-500">{lang.nativeName}</Text>
                </View>
                {language === lang.code && (
                  <MaterialIcons name="check-circle" size={24} color="#059669" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* About Section */}
        <View className="mt-8">
          <Text className="text-lg font-bold text-construction-dark mb-3">
            About
          </Text>
          <View className="bg-white rounded-lg p-4 border border-gray-200">
            <View className="mb-3">
              <Text className="text-xs text-gray-500 font-semibold uppercase">
                Version
              </Text>
              <Text className="text-gray-700 mt-1">1.0.0</Text>
            </View>
            <View>
              <Text className="text-xs text-gray-500 font-semibold uppercase">
                Features
              </Text>
              <Text className="text-gray-700 mt-1 text-sm">
                • Offline-first inspection checklists{'\n'}
                • Cloud photo storage{'\n'}
                • Team activity tracking{'\n'}
                • Multi-language support{'\n'}
                • High-severity alerts
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
