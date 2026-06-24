import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { IncidentReport } from '@/types/database';

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  INJURY_ILLNESS: { label: 'Injury/Illness', icon: 'health-and-safety' },
  MOTOR_VEHICLE: { label: 'Motor Vehicle', icon: 'directions-car' },
  PROPERTY_DAMAGE: { label: 'Property Damage', icon: 'broken-image' },
  ENVIRONMENTAL_SPILL: { label: 'Environmental Spill', icon: 'water-drop' },
  LINE_STRIKE: { label: 'Line Strike', icon: 'bolt' },
  NEAR_MISS: { label: 'Near Miss', icon: 'warning' },
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#DC2626',
  UNDER_REVIEW: '#EA580C',
  RESOLVED: '#059669',
};

export default function IncidentsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId as string;
  const { notify } = useNotification();

  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentReport['status']>('ALL');

  useFocusEffect(
    useCallback(() => {
      loadIncidents();
    }, [projectId])
  );

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await db.getIncidentReportsByProject(projectId);
      setIncidents(data);
      applyFilter(data, statusFilter);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load incidents' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (data: IncidentReport[], filter: typeof statusFilter) => {
    if (filter === 'ALL') {
      setFilteredIncidents(data);
    } else {
      setFilteredIncidents(data.filter((inc) => inc.status === filter));
    }
  };

  const handleFilterChange = (filter: typeof statusFilter) => {
    setStatusFilter(filter);
    applyFilter(incidents, filter);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return '#FCD34D';
      case 'MEDIUM':
        return '#F97316';
      case 'HIGH':
        return '#DC2626';
      default:
        return '#6B7280';
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
      {/* Filter Buttons */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {(['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => handleFilterChange(status)}
              className={`px-4 py-2 rounded-full border ${
                statusFilter === status
                  ? 'bg-construction-orange border-construction-orange'
                  : 'bg-white border-gray-300'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  statusFilter === status ? 'text-white' : 'text-construction-dark'
                }`}
              >
                {status === 'ALL' ? 'All' : status.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Incidents List */}
      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <MaterialIcons name="inbox" size={48} color="#ccc" />
            <Text className="text-construction-dark text-center mt-3 text-gray-500">
              {statusFilter === 'ALL'
                ? 'No incidents reported'
                : `No ${statusFilter.replace(/_/g, ' ').toLowerCase()} incidents`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(safety)/incident-details',
                params: { incidentId: item.id },
              })
            }
            className="bg-white rounded-lg mb-3 overflow-hidden border border-gray-200"
          >
            <View className="flex-row items-start p-4">
              {/* Category Icon */}
              <View className="mr-4">
                <View
                  className="rounded-lg p-3 items-center justify-center"
                  style={{
                    backgroundColor: `${getSeverityColor(item.severity)}20`,
                  }}
                >
                  <MaterialIcons
                    name={CATEGORY_LABELS[item.category]?.icon || 'warning'}
                    size={24}
                    color={getSeverityColor(item.severity)}
                  />
                </View>
              </View>

              {/* Incident Info */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-construction-dark font-bold text-sm">
                    {CATEGORY_LABELS[item.category]?.label || item.category}
                  </Text>
                  <View
                    className="rounded-full px-2 py-1"
                    style={{ backgroundColor: `${getSeverityColor(item.severity)}20` }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: getSeverityColor(item.severity) }}
                    >
                      {item.severity}
                    </Text>
                  </View>
                </View>

                <Text className="text-gray-700 text-sm mb-2 leading-4">
                  {item.description.length > 80
                    ? `${item.description.substring(0, 80)}...`
                    : item.description}
                </Text>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="rounded-full px-2 py-1"
                      style={{ backgroundColor: `${STATUS_COLORS[item.status]}20` }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: STATUS_COLORS[item.status] }}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    {item.location && (
                      <View className="flex-row items-center">
                        <MaterialIcons name="location-on" size={14} color="#9CA3AF" />
                        <Text className="text-xs text-gray-500 ml-1">{item.location}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">
                    {new Date(item.date_time).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
