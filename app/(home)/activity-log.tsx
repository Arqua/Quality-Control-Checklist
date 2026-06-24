import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { Activity } from '@/types/database';

export default function ActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const { notify } = useNotification();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [])
  );

  const loadActivities = async () => {
    try {
      setLoading(true);
      const recentActivities = await db.getRecentActivities(100);
      setActivities(recentActivities);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load activities' });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: Activity['type']): string => {
    switch (type) {
      case 'CHECKLIST_COMPLETED':
        return 'task-alt';
      case 'SEVERITY_FLAGGED':
        return 'warning';
      case 'PUNCH_ITEM_CLOSED':
        return 'check-circle';
      case 'NOTE_ADDED':
        return 'note';
      default:
        return 'info';
    }
  };

  const getActivityColor = (type: Activity['type'], severity?: string): string => {
    if (severity === 'HIGH') return '#DC2626';
    switch (type) {
      case 'CHECKLIST_COMPLETED':
        return '#059669';
      case 'SEVERITY_FLAGGED':
        return '#EA580C';
      case 'PUNCH_ITEM_CLOSED':
        return '#3B82F6';
      case 'NOTE_ADDED':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const getActivityLabel = (type: Activity['type']): string => {
    switch (type) {
      case 'CHECKLIST_COMPLETED':
        return 'Completed Checklist';
      case 'SEVERITY_FLAGGED':
        return 'Flagged Issue';
      case 'PUNCH_ITEM_CLOSED':
        return 'Closed Punch Item';
      case 'NOTE_ADDED':
        return 'Added Note';
      default:
        return type;
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
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <MaterialIcons name="history" size={48} color="#ccc" />
            <Text className="text-construction-dark text-center mt-3 text-gray-500">
              No activities yet. Start inspections to see team updates.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
            <View className="flex-row items-start">
              <View
                className="rounded-full p-2 mr-3"
                style={{
                  backgroundColor: `${getActivityColor(item.type, item.severity ?? undefined)}20`,
                }}
              >
                <MaterialIcons
                  name={getActivityIcon(item.type)}
                  size={20}
                  color={getActivityColor(item.type, item.severity ?? undefined)}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center mb-1">
                  <Text className="font-bold text-sm text-construction-dark">
                    {getActivityLabel(item.type)}
                  </Text>
                  {item.severity === 'HIGH' && (
                    <View className="ml-2 bg-red-100 rounded px-2 py-1">
                      <Text className="text-red-700 text-xs font-bold">HIGH</Text>
                    </View>
                  )}
                </View>
                <Text className="text-gray-700 text-sm mb-1">{item.description}</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-gray-500">
                    by {item.actor_name}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()} at{' '}
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
