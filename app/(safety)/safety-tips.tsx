import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { Card } from '@/components/ui';
import { SafetyTip } from '@/types/database';

const CATEGORY_ICONS: Record<string, string> = {
  PPE: 'health-and-safety',
  HAZARD_AWARENESS: 'warning',
  BEST_PRACTICES: 'lightbulb',
  EMERGENCY_RESPONSE: 'emergency',
};

const CATEGORY_COLORS: Record<string, string> = {
  PPE: '#3B82F6',
  HAZARD_AWARENESS: '#EA580C',
  BEST_PRACTICES: '#059669',
  EMERGENCY_RESPONSE: '#DC2626',
};

export default function SafetyTipsScreen() {
  const insets = useSafeAreaInsets();
  const { notify } = useNotification();

  const [dailyTip, setDailyTip] = useState<SafetyTip | null>(null);
  const [allTips, setAllTips] = useState<SafetyTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTips();
    }, [])
  );

  const loadTips = async () => {
    try {
      setLoading(true);
      const [daily, all] = await Promise.all([
        db.getDailyTip(),
        db.getAllTips(),
      ]);
      setDailyTip(daily);
      setAllTips(all);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load safety tips' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTip = async () => {
    try {
      const tip = await db.getDailyTip();
      setDailyTip(tip);
      notify({ type: 'success', message: 'New safety tip loaded' });
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load new tip' });
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-construction-light">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        {/* Daily Tip Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-construction-dark font-bold text-xl">Safety Tip of the Day</Text>
            <TouchableOpacity onPress={handleRefreshTip} className="p-2">
              <MaterialIcons name="refresh" size={24} color="#004E89" />
            </TouchableOpacity>
          </View>

          {dailyTip ? (
            <Card
              elevated
              className="border-l-4"
              style={{
                borderLeftColor: CATEGORY_COLORS[dailyTip.category],
              }}
            >
              <View
                className="p-6"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[dailyTip.category]}20`,
                }}
              >
                <View className="flex-row items-center mb-3">
                  <MaterialIcons
                    name={CATEGORY_ICONS[dailyTip.category]}
                    size={28}
                    color={CATEGORY_COLORS[dailyTip.category]}
                  />
                  <Text
                    className="font-semibold ml-3 text-sm uppercase tracking-wider"
                    style={{ color: CATEGORY_COLORS[dailyTip.category] }}
                  >
                    {dailyTip.category.replace(/_/g, ' ')}
                  </Text>
                </View>

                <Text className="text-construction-dark font-bold text-lg mb-2">
                  {dailyTip.title}
                </Text>

                <Text className="text-gray-700 text-base leading-6">
                  {dailyTip.content}
                </Text>

                <View className="mt-4 pt-4 border-t border-gray-300">
                  <Text className="text-gray-500 text-xs">
                    Remember this tip throughout your workday. Safety is everyone's responsibility.
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <Card elevated>
              <View className="p-6 items-center">
                <MaterialIcons name="lightbulb-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 text-center mt-3">
                  No safety tips available yet
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* All Tips Section */}
        <View>
          <TouchableOpacity
            onPress={() => setShowAll(!showAll)}
            className="flex-row items-center justify-between mb-4"
          >
            <Text className="text-construction-dark font-bold text-lg">
              All Safety Tips ({allTips.length})
            </Text>
            <MaterialIcons
              name={showAll ? 'expand-less' : 'expand-more'}
              size={24}
              color="#004E89"
            />
          </TouchableOpacity>

          {showAll && (
            <View>
              {allTips.length === 0 ? (
                <Card elevated>
                  <View className="p-6 items-center">
                    <MaterialIcons name="library-books" size={48} color="#9CA3AF" />
                    <Text className="text-gray-500 text-center mt-3">
                      No tips available
                    </Text>
                  </View>
                </Card>
              ) : (
                allTips.map((tip) => (
                  <Card
                    key={tip.id}
                    elevated
                    className="mb-3 border-l-4"
                    style={{
                      borderLeftColor: CATEGORY_COLORS[tip.category],
                    }}
                  >
                    <View className="p-4">
                      <View className="flex-row items-center mb-2">
                        <MaterialIcons
                          name={CATEGORY_ICONS[tip.category]}
                          size={20}
                          color={CATEGORY_COLORS[tip.category]}
                        />
                        <Text
                          className="font-semibold ml-2 text-xs uppercase tracking-wide"
                          style={{ color: CATEGORY_COLORS[tip.category] }}
                        >
                          {tip.category.replace(/_/g, ' ')}
                        </Text>
                      </View>

                      <Text className="text-construction-dark font-semibold text-base mb-1">
                        {tip.title}
                      </Text>

                      <Text className="text-gray-700 text-sm leading-5">
                        {tip.content.length > 120
                          ? `${tip.content.substring(0, 120)}...`
                          : tip.content}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </View>

        {/* Tips Categories Info */}
        <Card elevated className="mt-8">
          <View className="p-4">
            <Text className="text-construction-dark font-bold text-base mb-3">
              Safety Tip Categories
            </Text>
            <View className="space-y-2">
              {Object.entries(CATEGORY_ICONS).map(([category, icon]) => (
                <View key={category} className="flex-row items-center">
                  <MaterialIcons
                    name={icon}
                    size={18}
                    color={CATEGORY_COLORS[category]}
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-gray-700 text-sm">
                    {category.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
