import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as db from '@/database/db';
import { useNotification } from '@/components/Notification';
import { Card } from '@/components/ui';
import { IncidentReport } from '@/types/database';

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  INJURY_ILLNESS: { label: 'Injury/Illness', icon: 'health-and-safety' },
  MOTOR_VEHICLE: { label: 'Motor Vehicle', icon: 'directions-car' },
  PROPERTY_DAMAGE: { label: 'Property Damage', icon: 'broken-image' },
  ENVIRONMENTAL_SPILL: { label: 'Environmental Spill', icon: 'water-drop' },
  LINE_STRIKE: { label: 'Line Strike', icon: 'bolt' },
  NEAR_MISS: { label: 'Near Miss', icon: 'warning' },
};

const STATUS_OPTIONS: IncidentReport['status'][] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED'];
const STATUS_COLORS: Record<string, string> = {
  OPEN: '#DC2626',
  UNDER_REVIEW: '#EA580C',
  RESOLVED: '#059669',
};

export default function IncidentDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const incidentId = params.incidentId as string;
  const { notify } = useNotification();

  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadIncident();
    }, [incidentId])
  );

  const loadIncident = async () => {
    try {
      setLoading(true);
      const data = await db.getIncidentReportById(incidentId);
      setIncident(data);
    } catch (error) {
      notify({ type: 'error', message: 'Failed to load incident details' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: IncidentReport['status']) => {
    if (!incident) return;

    setUpdating(true);
    try {
      await db.updateIncidentReportStatus(incident.id, newStatus);
      setIncident({ ...incident, status: newStatus });
      setShowStatusPicker(false);
      notify({ type: 'success', message: `Incident marked as ${newStatus.replace(/_/g, ' ').toLowerCase()}` });
    } catch (error) {
      notify({ type: 'error', message: 'Failed to update incident status' });
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-construction-light">
        <ActivityIndicator size="large" color="#004E89" />
      </View>
    );
  }

  if (!incident) {
    return (
      <View className="flex-1 justify-center items-center bg-construction-light">
        <Text className="text-gray-600">Incident not found</Text>
      </View>
    );
  }

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

  return (
    <View className="flex-1 bg-construction-light" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
      >
        {/* Header Card */}
        <Card elevated className="mb-4">
          <View className="p-4">
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1">
                <Text className="text-construction-dark font-bold text-lg">
                  {CATEGORY_LABELS[incident.category]?.label}
                </Text>
                <Text className="text-gray-500 text-sm mt-1">
                  Reported {new Date(incident.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View
                className="rounded-lg px-3 py-1.5"
                style={{ backgroundColor: `${getSeverityColor(incident.severity)}20` }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: getSeverityColor(incident.severity) }}
                >
                  {incident.severity} SEVERITY
                </Text>
              </View>
            </View>

            {/* Alert Badge for HIGH severity */}
            {incident.severity === 'HIGH' && (
              <View className="bg-red-50 border border-red-200 rounded-lg p-3 flex-row items-center">
                <MaterialIcons name="warning" size={18} color="#DC2626" />
                <Text className="text-red-700 text-xs ml-2 flex-1">
                  Management has been notified of this high-severity incident.
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Status Card */}
        <Card elevated className="mb-4">
          <View className="p-4">
            <Text className="text-construction-dark font-bold text-sm mb-3">Current Status</Text>
            <TouchableOpacity
              onPress={() => setShowStatusPicker(true)}
              disabled={updating}
              className="border-2 border-gray-300 rounded-xl p-3 flex-row items-center justify-between"
              style={{
                borderColor: STATUS_COLORS[incident.status],
              }}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-3 h-3 rounded-full mr-3"
                  style={{ backgroundColor: STATUS_COLORS[incident.status] }}
                />
                <Text
                  className="text-base font-semibold"
                  style={{ color: STATUS_COLORS[incident.status] }}
                >
                  {incident.status.replace(/_/g, ' ')}
                </Text>
              </View>
              <MaterialIcons name="expand-more" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Description */}
        <Card elevated className="mb-4">
          <View className="p-4">
            <Text className="text-construction-dark font-bold text-sm mb-2">Description</Text>
            <Text className="text-gray-700 text-base leading-6">
              {incident.description}
            </Text>
          </View>
        </Card>

        {/* Location */}
        {incident.location && (
          <Card elevated className="mb-4">
            <View className="p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="location-on" size={20} color="#004E89" />
                <Text className="text-construction-dark font-bold text-sm ml-2">Location</Text>
              </View>
              <Text className="text-gray-700 text-base">
                {incident.location}
              </Text>
            </View>
          </Card>
        )}

        {/* Involved Parties */}
        {incident.involved_parties && (
          <Card elevated className="mb-4">
            <View className="p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="people" size={20} color="#004E89" />
                <Text className="text-construction-dark font-bold text-sm ml-2">Involved Parties</Text>
              </View>
              <Text className="text-gray-700 text-base">
                {incident.involved_parties}
              </Text>
            </View>
          </Card>
        )}

        {/* Corrective Actions */}
        {incident.corrective_actions && (
          <Card elevated className="mb-4">
            <View className="p-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="assignment" size={20} color="#004E89" />
                <Text className="text-construction-dark font-bold text-sm ml-2">Corrective Actions</Text>
              </View>
              <Text className="text-gray-700 text-base">
                {incident.corrective_actions}
              </Text>
            </View>
          </Card>
        )}

        {/* Reporter Info */}
        <Card elevated className="bg-brand-50">
          <View className="p-4">
            <Text className="text-gray-600 text-xs mb-1">Reported by</Text>
            <Text className="text-construction-dark font-semibold">{incident.reporter_name}</Text>
            <Text className="text-gray-500 text-xs mt-2">
              {new Date(incident.created_at).toLocaleString()}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl">
            <View className="border-b border-gray-200 px-4 py-4 flex-row justify-between items-center">
              <Text className="font-bold text-lg text-construction-dark">Update Status</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <MaterialIcons name="close" size={24} color="#004E89" />
              </TouchableOpacity>
            </View>

            <View className="px-4 py-4">
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => handleStatusChange(status)}
                  disabled={updating}
                  className="py-4 border-b border-gray-200"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-4 h-4 rounded-full mr-3"
                        style={{ backgroundColor: STATUS_COLORS[status] }}
                      />
                      <Text className="text-construction-dark font-semibold text-base">
                        {status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    {incident.status === status && (
                      <MaterialIcons name="check-circle" size={24} color="#059669" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
