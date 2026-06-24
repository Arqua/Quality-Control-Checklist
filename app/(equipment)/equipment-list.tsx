import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { EquipmentInspection } from '@/types/database';

export default function EquipmentListScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [inspections, setInspections] = useState<EquipmentInspection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInspections = useCallback(async () => {
    try {
      setLoading(true);
      const items = await db.getEquipmentInspectionsByProject(projectId);
      setInspections(items);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load equipment inspections' });
    } finally {
      setLoading(false);
    }
  }, [projectId, notify]);

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [loadInspections])
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', icon: '#16a34a' };
      case 'FAIL':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: '#dc2626' };
      default:
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', icon: '#d97706' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'check-circle';
      case 'FAIL':
        return 'cancel';
      default:
        return 'warning';
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
        data={inspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <MaterialIcons name="construction" size={48} color="#ccc" />
            <Text className="text-construction-dark text-center mt-3 text-gray-500">
              No equipment inspections yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const statusStyle = getStatusColor(item.inspection_status);
          const passCount = [
            item.engine_condition,
            item.hydraulic_systems,
            item.tires_tracks,
            item.lights_mirrors,
            item.safety_devices,
            item.fluid_levels,
            item.structural_integrity,
            item.operator_controls,
          ].filter(v => v === true).length;

          return (
            <View
              className={`mb-3 rounded-lg p-4 ${statusStyle.bg} border ${statusStyle.border}`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className={`text-base font-bold ${statusStyle.text}`}>
                    {item.equipment_number}
                  </Text>
                  <Text className="text-xs text-gray-600 mt-1">
                    {item.equipment_type}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <MaterialIcons
                    name={getStatusIcon(item.inspection_status)}
                    size={24}
                    color={statusStyle.icon}
                  />
                </View>
              </View>

              <View className="bg-white/50 rounded px-2 py-1 mb-2">
                <Text className="text-xs text-gray-700">
                  {passCount} of 8 checks passed
                </Text>
              </View>

              <Text className="text-xs text-gray-600 mb-1">
                Inspector: {item.inspector_name}
              </Text>
              <Text className="text-xs text-gray-600">
                {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
              </Text>

              {item.notes && (
                <Text className="text-xs text-gray-700 mt-2 italic">
                  "{item.notes}"
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
